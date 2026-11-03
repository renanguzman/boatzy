import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ExternalLink, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ehUuid } from '@/lib/upload-imagem-server';
import { formatCurrencyPrecise } from '@/lib/utils';
import { formatarData, formatarDataHora } from '@/lib/datas';
import { resumoDestino } from '@/lib/recebimento-tipos';
import { ACAO_REPASSE, METODO_REPASSE } from '@/lib/repasses/rotulos';
import FinanceiroAbas from '../../_components/FinanceiroAbas';
import AcoesRepasse from './_components/AcoesRepasse';

const brl = formatCurrencyPrecise;

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <div className="mt-0.5 break-words text-sm text-slate-700">{children}</div>
    </div>
  );
}

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-bold text-[#0B2447]">{titulo}</h2>
      {children}
    </section>
  );
}

export default async function AdminRepasseDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/administrator/login');

  const { id } = await params;
  if (!ehUuid(id)) notFound();

  const { data: r } = await supabaseAdmin.from('repasse').select('*').eq('id', id).maybeSingle();
  if (!r) notFound();

  const [{ data: itens }, { data: gestor }, { data: auditoria }, { data: lotes }] = await Promise.all([
    supabaseAdmin.from('repasse_item').select('pedido_id, valor').eq('repasse_id', id),
    supabaseAdmin.from('users').select('id, name, email, cpf_cnpj').eq('id', r.gestor_id).maybeSingle(),
    supabaseAdmin.from('financeiro_auditoria').select('id, acao, admin_id, motivo, criado_em').eq('entidade', 'repasse').eq('entidade_id', id).order('criado_em', { ascending: false }),
    supabaseAdmin.from('lancamento_lote').select('id, descricao, tipo, data_caixa').eq('repasse_id', id).order('criado_em'),
  ]);
  const pedidoIds = (itens ?? []).map((i) => i.pedido_id);
  const idsAdmin = [...new Set([r.pago_por, r.cancelado_por, ...(auditoria ?? []).map((a) => a.admin_id)].filter((x): x is string => !!x))];
  const [{ data: pedidos }, { data: linhas }, { data: admins }] = await Promise.all([
    pedidoIds.length
      ? supabaseAdmin.from('pedido').select('id, numero, valor_itens, tipo, reserva:reserva_id ( item_nome, data_reserva, data_fim_reserva )').in('id', pedidoIds)
      : Promise.resolve({ data: [] }),
    lotes?.length
      ? supabaseAdmin.from('lancamento_financeiro').select('lote_id, conta_codigo, natureza, valor').in('lote_id', lotes.map((l) => l.id))
      : Promise.resolve({ data: [] }),
    idsAdmin.length ? supabaseAdmin.from('users').select('id, name').in('id', idsAdmin) : Promise.resolve({ data: [] }),
  ]);
  const nomeAdmin = new Map((admins ?? []).map((a) => [a.id, a.name ?? '—']));
  const cancelado = r.status === 'cancelado';
  const d = r.destino_snapshot;

  return (
    <div className="p-8">
      <FinanceiroAbas ativa="repasses" />

      <Link href="/administrator/financeiro/repasses?aba=repassados" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#0B2447]">
        <ArrowLeft className="h-4 w-4" /> Repasses
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">
            Repasse #{r.numero}
            <span className={`ml-3 align-middle rounded-full px-2.5 py-1 text-xs font-semibold ${cancelado ? 'bg-slate-100 text-slate-500' : 'bg-teal-50 text-teal-700'}`}>
              {cancelado ? 'Cancelado' : 'Pago'}
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {gestor?.name ?? '—'} · pago em {formatarDataHora(r.pago_em)} · registrado por {r.pago_por ? nomeAdmin.get(r.pago_por) ?? '—' : '—'}
          </p>
        </div>
        <p className="text-3xl font-bold text-[#0B2447]">{brl(Number(r.valor_total))}</p>
      </div>

      <div className="mb-6"><AcoesRepasse repasseId={r.id} gestorId={r.gestor_id} temComprovante={!!r.comprovante_key} cancelado={cancelado} /></div>

      {cancelado && (
        <p className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Cancelado em {r.cancelado_em ? formatarDataHora(r.cancelado_em) : '—'} por {r.cancelado_por ? nomeAdmin.get(r.cancelado_por) ?? '—' : '—'}. Motivo: {r.motivo_cancelamento}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card titulo="Pagamento">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Meio">{METODO_REPASSE[r.metodo]}</Campo>
            <Campo label="Pago em">{formatarDataHora(r.pago_em)}</Campo>
            <Campo label="Referência bancária">{r.referencia ?? '—'}</Campo>
            <Campo label="Observação">{r.observacao ?? '—'}</Campo>
            <Campo label="Comprovante">
              {r.comprovante_key ? (
                <a href={`/api/painel/repasses/${r.id}/comprovante`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-[#0B3D91] hover:underline">
                  <FileText className="h-4 w-4" /> {r.comprovante_nome ?? 'Abrir'} <ExternalLink className="h-3 w-3" />
                </a>
              ) : <span className="font-semibold text-amber-600">Pendente</span>}
            </Campo>
          </div>
        </Card>

        <Card titulo="Destino (congelado no momento do pagamento)">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Destino"><span className="sm:col-span-2">{resumoDestino(d)}</span></Campo>
            <Campo label="Titular">{d.titular_nome}</Campo>
            <Campo label="CPF/CNPJ do titular">{d.titular_documento}</Campo>
            <Campo label="Gestor">{gestor ? <Link href={`/administrator/operadores/${gestor.id}`} className="text-[#0B3D91] hover:underline">{gestor.name}</Link> : '—'}</Campo>
            <Campo label="CPF/CNPJ do gestor">{d.gestor_documento ?? gestor?.cpf_cnpj ?? '—'}</Campo>
          </div>
        </Card>

        <Card titulo={`Pedidos incluídos (${pedidos?.length ?? 0})`}>
          <ul className="divide-y divide-slate-50 text-sm">
            {(pedidos ?? []).map((p) => {
              const reserva = Array.isArray(p.reserva) ? p.reserva[0] : p.reserva;
              const valor = itens?.find((i) => i.pedido_id === p.id)?.valor ?? p.valor_itens;
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <Link href={`/administrator/pedidos/${p.id}`} className="font-semibold text-[#0B3D91] hover:underline">#{p.numero}</Link>
                    <span className="ml-2 text-slate-600">{reserva?.item_nome ?? 'Cobrança avulsa'}</span>
                    {reserva?.data_reserva && <span className="ml-2 text-xs text-slate-400">{formatarData(reserva.data_fim_reserva ?? reserva.data_reserva)}</span>}
                  </span>
                  <span className="shrink-0 font-semibold text-[#0B2447]">{brl(Number(valor))}</span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card titulo="Lançamento contábil">
          {(lotes ?? []).length === 0 ? <p className="text-sm text-slate-400">Sem lançamentos.</p> : (
            <div className="space-y-4">
              {(lotes ?? []).map((l) => (
                <div key={l.id}>
                  <p className="text-xs font-semibold text-slate-500">{l.descricao} · caixa {formatarData(l.data_caixa)}</p>
                  <table className="mt-1 w-full text-sm">
                    <tbody>
                      {(linhas ?? []).filter((x) => x.lote_id === l.id).map((x, i) => (
                        <tr key={i} className="border-b border-slate-50 last:border-0">
                          <td className="w-8 py-1.5 font-mono text-xs text-slate-400">{x.natureza}</td>
                          <td className="py-1.5 text-slate-600">{x.conta_codigo}</td>
                          <td className="py-1.5 text-right font-semibold text-[#0B2447]">{brl(Number(x.valor))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card titulo="Auditoria">
          {(auditoria ?? []).length === 0 ? <p className="text-sm text-slate-400">Sem registros.</p> : (
            <ul className="divide-y divide-slate-50 text-sm">
              {(auditoria ?? []).map((a) => (
                <li key={a.id} className="py-2.5">
                  <p className="font-semibold text-slate-700">{ACAO_REPASSE[a.acao] ?? a.acao}</p>
                  <p className="text-xs text-slate-400">{formatarDataHora(a.criado_em)}{a.admin_id ? ` · ${nomeAdmin.get(a.admin_id) ?? 'admin'}` : ''}</p>
                  {a.motivo && <p className="mt-0.5 text-xs text-slate-600">Motivo: {a.motivo}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
