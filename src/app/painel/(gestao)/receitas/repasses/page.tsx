import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, ArrowLeft, FileText, HandCoins } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { checkRoleInDb } from '@/lib/roles';
import { formatCurrencyPrecise } from '@/lib/utils';
import { formatarData } from '@/lib/datas';
import { resumoDestino } from '@/lib/recebimento-tipos';
import { METODO_REPASSE, SITUACAO_GESTOR } from '@/lib/repasses/rotulos';
import ResumoRepasses from '../_components/ResumoRepasses';
import {
  ABAS_GESTOR, carregarPedidosDoGestor, carregarRepassesDoGestor, totaisDeRepasse, type AbaGestor,
} from './_lib/consulta';

export const metadata = { title: 'Meus repasses — Painel Boatzy' };

const brl = formatCurrencyPrecise;
const ROTULO_ABA: Record<AbaGestor, string> = { todos: 'Todos', aguardando: 'Aguardando', liberado: 'Liberados', pago: 'Pagos' };

export default async function RepassesPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');
  if (!(await checkRoleInDb(user.id, ['gestor', 'admin']))) redirect('/painel');

  const { aba: abaParam } = await searchParams;
  const aba = ABAS_GESTOR.find((a) => a === abaParam) ?? 'todos';

  const [totais, pedidos, lotes] = await Promise.all([
    totaisDeRepasse(user.id),
    aba === 'pago' ? Promise.resolve(null) : carregarPedidosDoGestor(user.id, aba),
    aba === 'pago' ? carregarRepassesDoGestor(user.id) : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <Link href="/painel/receitas" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#0B2447]">
        <ArrowLeft className="h-4 w-4" /> Receitas
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#0B2447] sm:text-2xl">Meus repasses</h1>
        <p className="mt-1 text-sm text-slate-500">
          O Boatzy recebe o pagamento do cliente e repassa a você o valor dos seus itens depois do passeio. Acompanhe aqui o que está
          aguardando, o que foi liberado e o que já foi pago, com o comprovante de cada depósito.
        </p>
      </div>

      <ResumoRepasses totais={totais} />

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Situação">
        {ABAS_GESTOR.map((a) => (
          <Link
            key={a}
            href={a === 'todos' ? '/painel/receitas/repasses' : `/painel/receitas/repasses?aba=${a}`}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              a === aba ? 'bg-[#0B2447] text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:text-[#0B2447]'
            }`}
          >
            {ROTULO_ABA[a]}
          </Link>
        ))}
      </nav>

      {lotes && (
        lotes.length === 0 ? (
          <Vazio titulo="Nenhum repasse pago ainda" texto="Quando o Boatzy depositar o valor de um passeio, o repasse e o comprovante aparecem aqui." />
        ) : (
          <ul className="space-y-3">
            {lotes.map((r) => (
              <li key={r.id}>
                <Link href={`/painel/receitas/repasses/${r.id}`} className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-colors hover:border-slate-200 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0B2447]">Repasse #{r.numero}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatarData(r.pago_em)} · {METODO_REPASSE[r.metodo]} · {resumoDestino(r.destino_snapshot, true)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    {r.comprovante_key && <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700"><FileText className="h-3.5 w-3.5" /> Comprovante</span>}
                    <span className="text-lg font-bold text-[#0B2447]">{brl(Number(r.valor_total))}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )
      )}

      {pedidos && (
        pedidos.linhas.length === 0 ? (
          <Vazio
            titulo="Nada por aqui"
            texto="Os pedidos pagos pelos seus clientes aparecem aqui assim que o pagamento é confirmado, com a previsão de liberação do repasse."
          />
        ) : (
          <>
            <ul className="divide-y divide-slate-50 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              {pedidos.linhas.map((p) => {
                const s = SITUACAO_GESTOR[p.situacao];
                return (
                  <li key={p.pedido_id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {p.item_nome}
                        {p.tipo === 'avulso' && <span className="ml-2 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">cobrança adicional</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {p.cliente_nome} · passeio em {p.fim_passeio ? formatarData(p.fim_passeio) : '—'} · pedido #{p.numero}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {p.repasse_id && p.repasse_numero != null
                          ? <Link href={`/painel/receitas/repasses/${p.repasse_id}`} className="font-semibold text-[#0B3D91] hover:underline">Repasse #{p.repasse_numero}{p.repasse_pago_em ? ` · pago em ${formatarData(p.repasse_pago_em)}` : ''}</Link>
                          : p.situacao === 'aguardando_recebimento'
                            ? 'Aguardando a compensação do pagamento'
                            : p.liberado_em && p.situacao !== 'retido' && p.situacao !== 'reembolsado'
                              ? `${p.situacao === 'a_repassar' ? 'Liberado desde' : 'Liberação prevista em'} ${formatarData(p.liberado_em)}`
                              : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
                      <span className="w-28 text-right text-base font-bold text-[#0B2447]">{brl(Number(p.valor_repassar))}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            {pedidos.truncado && <p className="mt-3 text-xs text-slate-400">Mostrando os 500 pedidos mais recentes.</p>}
          </>
        )
      )}

      {!totais.temRecebimento && (
        <p className="mt-6 flex items-start gap-2 text-xs text-slate-500">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          Para receber, informe onde depositar em <Link href="/painel/recebimentos" className="font-semibold text-[#0B3D91] hover:underline">Recebimentos</Link>.
        </p>
      )}
    </div>
  );
}

function Vazio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
      <HandCoins className="mx-auto h-8 w-8 text-slate-300" />
      <p className="mt-3 text-sm font-semibold text-[#0B2447]">{titulo}</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">{texto}</p>
    </div>
  );
}
