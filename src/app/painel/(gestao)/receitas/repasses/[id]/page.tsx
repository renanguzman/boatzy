import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ExternalLink, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ehUuid } from '@/lib/upload-imagem-server';
import { formatCurrencyPrecise } from '@/lib/utils';
import { formatarData, formatarDataHora } from '@/lib/datas';
import { resumoDestino } from '@/lib/recebimento-tipos';
import { METODO_REPASSE } from '@/lib/repasses/rotulos';

export const metadata = { title: 'Repasse — Painel Boatzy' };

const brl = formatCurrencyPrecise;

export default async function RepasseDoGestorPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  const { id } = await params;
  if (!ehUuid(id)) notFound();

  // Só o dono vê o repasse (cancelados saem da vista do gestor: o pedido volta à fila).
  const { data: r } = await supabaseAdmin
    .from('repasse')
    .select('id, numero, valor_total, metodo, pago_em, referencia, comprovante_key, comprovante_nome, destino_snapshot')
    .eq('id', id)
    .eq('gestor_id', user.id)
    .eq('status', 'pago')
    .maybeSingle();
  if (!r) notFound();

  const { data: itens } = await supabaseAdmin.from('repasse_item').select('pedido_id, valor').eq('repasse_id', id).eq('cancelado', false);
  const pedidoIds = (itens ?? []).map((i) => i.pedido_id);
  const { data: pedidos } = pedidoIds.length
    ? await supabaseAdmin
        .from('pedido')
        .select('id, numero, tipo, reserva:reserva_id ( item_nome, data_reserva, data_fim_reserva ), avulso:pedido_avulso ( titulo, reserva:reserva_id ( item_nome, data_reserva, data_fim_reserva ) )')
        .in('id', pedidoIds)
    : { data: [] };

  type Reserva = { item_nome: string; data_reserva: string; data_fim_reserva: string | null } | null;
  const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <Link href="/painel/receitas/repasses?aba=pago" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#0B2447]">
        <ArrowLeft className="h-4 w-4" /> Meus repasses
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#0B2447] sm:text-2xl">Repasse #{r.numero}</h1>
          <p className="mt-1 text-sm text-slate-500">Pago em {formatarDataHora(r.pago_em)} · {METODO_REPASSE[r.metodo]}</p>
        </div>
        <p className="text-3xl font-bold text-[#0B2447]">{brl(Number(r.valor_total))}</p>
      </div>

      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-[#0B2447]">Depósito</h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Destino</dt><dd className="mt-0.5 break-words text-slate-700">{resumoDestino(r.destino_snapshot, true)}</dd></div>
            <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Titular</dt><dd className="mt-0.5 text-slate-700">{r.destino_snapshot.titular_nome}</dd></div>
            <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Referência bancária</dt><dd className="mt-0.5 break-words text-slate-700">{r.referencia ?? '—'}</dd></div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Comprovante</dt>
              <dd className="mt-0.5">
                {r.comprovante_key ? (
                  <a href={`/api/painel/repasses/${r.id}/comprovante`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-[#0B3D91] hover:underline">
                    <FileText className="h-4 w-4" /> {r.comprovante_nome ?? 'Abrir comprovante'} <ExternalLink className="h-3 w-3" />
                  </a>
                ) : <span className="text-slate-500">Ainda não anexado pela equipe Boatzy</span>}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-[#0B2447]">Passeios incluídos ({pedidos?.length ?? 0})</h2>
          <ul className="divide-y divide-slate-50 text-sm">
            {(pedidos ?? []).map((p) => {
              const avulso = um(p.avulso as unknown as { titulo: string; reserva: Reserva | Reserva[] } | null);
              const reserva = (avulso ? um(avulso.reserva) : um(p.reserva as unknown as Reserva | Reserva[])) as Reserva;
              const valor = itens?.find((i) => i.pedido_id === p.id)?.valor ?? 0;
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-800">{avulso ? `${avulso.titulo} · ` : ''}{reserva?.item_nome ?? 'Passeio'}</span>
                    <span className="text-xs text-slate-400">
                      Pedido #{p.numero}{reserva ? ` · passeio em ${formatarData(reserva.data_fim_reserva ?? reserva.data_reserva)}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-[#0B2447]">{brl(Number(valor))}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <p className="text-xs text-slate-400">
          Dúvidas sobre este repasse? Fale com a equipe Boatzy informando o número #{r.numero}.
        </p>
      </div>
    </div>
  );
}
