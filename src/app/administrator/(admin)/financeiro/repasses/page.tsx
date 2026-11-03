import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, BadgeCheck, Clock, HandCoins, ShieldAlert, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatCurrencyPrecise } from '@/lib/utils';
import { formatarData } from '@/lib/datas';
import { getFinanceiroConfig } from '@/lib/financeiro/config';
import { SITUACAO_ADMIN, METODO_REPASSE, METODOS_REPASSE } from '@/lib/repasses/rotulos';
import { resumoDestino } from '@/lib/recebimento-tipos';
import FinanceiroAbas from '../_components/FinanceiroAbas';
import ExportarPlanilha from '../_components/ExportarPlanilha';
import FilaLiberados from './_components/FilaLiberados';
import { exportarRepasses } from './actions';
import {
  ABAS_REPASSES, PAGE_SIZES, carregarFilaSimples, carregarIndicadores, carregarLiberados, carregarRepasses,
  listarGestoresDosRepasses, lerFiltros, type AbaRepasses, type FiltrosRepasses,
} from './_lib/consulta';

const brl = formatCurrencyPrecise;

const ABA_ROTULO: Record<AbaRepasses, string> = {
  liberados: 'A repassar', aguardando: 'Aguardando', retidos: 'Retidos', repassados: 'Repassados',
};

function Indicador({ label, valor, sub, icon: Icon, cor }: { label: string; valor: string; sub?: string; icon: React.ElementType; cor: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <Icon className={`h-4 w-4 ${cor}`} />
      </div>
      <p className="mt-2 text-xl font-bold text-[#0B2447]">{valor}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

/** Querystring mantendo os filtros, trocando o que vier em `extra`. */
function href(f: FiltrosRepasses, extra: Record<string, string | number | null>) {
  const p = new URLSearchParams();
  const base: Record<string, string | number | null> = {
    aba: f.aba, gestor: f.gestor, de: f.de, ate: f.ate, metodo: f.metodo, sem_comprovante: f.semComprovante ? '1' : null,
    por: f.porPagina !== PAGE_SIZES[0] ? f.porPagina : null, pagina: f.pagina > 1 ? f.pagina : null,
  };
  for (const [k, v] of Object.entries({ ...base, ...extra })) if (v !== null && v !== '') p.set(k, String(v));
  return `/administrator/financeiro/repasses?${p.toString()}`;
}

const th = 'px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400';
const controle = 'rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20';

export default async function AdminRepassesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/administrator/login');

  const f = lerFiltros(await searchParams);
  const [k, gestores, config] = await Promise.all([
    carregarIndicadores(), listarGestoresDosRepasses(), getFinanceiroConfig(),
  ]);

  const liberados = f.aba === 'liberados' ? await carregarLiberados(f.gestor) : null;
  const fila = f.aba === 'aguardando' || f.aba === 'retidos' ? await carregarFilaSimples(f.aba, f.gestor) : null;
  const lotes = f.aba === 'repassados' ? await carregarRepasses(f) : null;
  const totalPaginas = lotes ? Math.max(1, Math.ceil(lotes.total / f.porPagina)) : 1;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0B2447]/5">
          <Wallet className="h-5 w-5 text-[#0B2447]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Financeiro</h1>
          <p className="text-sm text-slate-500">
            Repasses aos gestores: o que está liberado, o que aguarda e o que já foi pago, com comprovante. Um pedido é liberado quando o Asaas
            liquida o pagamento, o passeio acontece e passam {config.horas_repasse_apos_passeio}h.
          </p>
        </div>
      </div>

      <FinanceiroAbas ativa="repasses" />

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Indicador label="A repassar agora" valor={brl(k.aRepassar.valor)} sub={`${k.aRepassar.pedidos} pedido(s) · ${k.aRepassar.gestores} gestor(es)`} icon={HandCoins} cor="text-emerald-500" />
        <Indicador label="Aguardando liberação" valor={brl(k.aguardando.valor)} sub={`${k.aguardando.pedidos} pedido(s): passeio, prazo ou Asaas`} icon={Clock} cor="text-sky-500" />
        <Indicador label="Retido" valor={brl(k.retido.valor)} sub={`${k.retido.pedidos} pedido(s): disputa ou reembolso`} icon={ShieldAlert} cor={k.retido.pedidos ? 'text-red-500' : 'text-slate-300'} />
        <Indicador label="Repassado no mês" valor={brl(k.repassadoMes.valor)} sub={`${k.repassadoMes.repasses} repasse(s)`} icon={BadgeCheck} cor="text-teal-600" />
      </div>

      {k.semDestino > 0 && (
        <p role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {k.semDestino} gestor(es) com valor liberado ainda não informaram onde receber. O repasse deles fica bloqueado até preencherem “Recebimentos” no painel.
        </p>
      )}

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Situação">
        {ABAS_REPASSES.map((a) => (
          <Link
            key={a}
            href={href(f, { aba: a, pagina: null })}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              a === f.aba ? 'bg-[#0B2447] text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:text-[#0B2447]'
            }`}
          >
            {ABA_ROTULO[a]}
          </Link>
        ))}
      </nav>

      <form method="GET" className="mb-5 flex flex-wrap items-end gap-3">
        <input type="hidden" name="aba" value={f.aba} />
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Gestor
          <select name="gestor" defaultValue={f.gestor ?? ''} className={`${controle} mt-1 block min-w-[200px] normal-case tracking-normal`}>
            <option value="">Todos</option>
            {gestores.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </label>
        {f.aba === 'repassados' && (
          <>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Pago de
              <input type="date" name="de" defaultValue={f.de ?? ''} className={`${controle} mt-1 block normal-case tracking-normal`} />
            </label>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              até
              <input type="date" name="ate" defaultValue={f.ate ?? ''} className={`${controle} mt-1 block normal-case tracking-normal`} />
            </label>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Meio
              <select name="metodo" defaultValue={f.metodo ?? ''} className={`${controle} mt-1 block normal-case tracking-normal`}>
                <option value="">Todos</option>
                {METODOS_REPASSE.map((m) => <option key={m} value={m}>{METODO_REPASSE[m]}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 pb-2.5 text-sm font-medium normal-case tracking-normal text-slate-600">
              <input type="checkbox" name="sem_comprovante" value="1" defaultChecked={f.semComprovante} className="h-4 w-4 rounded border-slate-300" />
              Sem comprovante
            </label>
          </>
        )}
        <button type="submit" className="rounded-xl bg-[#0B2447] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B3D91]">Filtrar</button>
        {(f.gestor || f.de || f.ate || f.metodo || f.semComprovante) && (
          <Link href={href({ ...f, gestor: null, de: null, ate: null, metodo: null, semComprovante: false, pagina: 1 }, {})} className="pb-2.5 text-sm font-semibold text-slate-400 hover:text-[#0B2447]">
            Limpar
          </Link>
        )}
        {f.aba === 'repassados' && (
          <div className="ml-auto"><ExportarPlanilha acao={exportarRepasses} arquivo="repasses-boatzy" aba="Repasses" /></div>
        )}
      </form>

      {(liberados?.truncado || fila?.truncado) && (
        <p className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          Mostrando os primeiros 3.000 pedidos — filtre por gestor para ver o restante.
        </p>
      )}

      {liberados && <FilaLiberados grupos={liberados.grupos} />}

      {fila && (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead><tr className="border-b border-slate-100">
              <th className={th}>Pedido</th><th className={th}>Gestor</th><th className={th}>Passeio</th>
              <th className={th}>Situação</th><th className={th}>Liberação</th><th className={`${th} text-right`}>A repassar</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {fila.linhas.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">Nada por aqui.</td></tr>
              )}
              {fila.linhas.map((p) => {
                const s = SITUACAO_ADMIN[p.situacao];
                return (
                  <tr key={p.pedido_id}>
                    <td className="px-4 py-3"><Link href={`/administrator/pedidos/${p.pedido_id}`} className="font-semibold text-[#0B3D91] hover:underline">#{p.numero}</Link></td>
                    <td className="px-4 py-3 text-slate-700">{p.gestor_nome}</td>
                    <td className="px-4 py-3 text-slate-600"><span className="block max-w-[220px] truncate">{p.item_nome}</span><span className="text-xs text-slate-400">{p.fim_passeio ? formatarData(p.fim_passeio) : '—'}</span></td>
                    <td className="px-4 py-3"><span title={s.dica} className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.cls}`}>{s.label}</span></td>
                    <td className="px-4 py-3 text-slate-500">
                      {p.situacao === 'aguardando_recebimento'
                        ? (p.credito_previsto_em ? `Asaas credita em ${formatarData(p.credito_previsto_em)}` : 'Aguardando o Asaas')
                        : p.liberado_em ? formatarData(p.liberado_em) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#0B2447]">{brl(Number(p.valor_repassar))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {lotes && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className={th}>Repasse</th><th className={th}>Pago em</th><th className={th}>Gestor</th><th className={th}>Meio / destino</th>
                <th className={th}>Pedidos</th><th className={th}>Comprovante</th><th className={`${th} text-right`}>Valor</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {lotes.linhas.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">Nenhum repasse com estes filtros.</td></tr>
                )}
                {lotes.linhas.map((r) => (
                  <tr key={r.id} className={r.status === 'cancelado' ? 'opacity-60' : ''}>
                    <td className="px-4 py-3">
                      <Link href={`/administrator/financeiro/repasses/${r.id}`} className="font-semibold text-[#0B3D91] hover:underline">#{r.numero}</Link>
                      {r.status === 'cancelado' && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">cancelado</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatarData(r.pago_em)}</td>
                    <td className="px-4 py-3 text-slate-700">{r.gestor_nome}</td>
                    <td className="px-4 py-3 text-slate-600"><span className="block max-w-[260px] truncate" title={resumoDestino(r.destino_snapshot)}>{METODO_REPASSE[r.metodo]} · {resumoDestino(r.destino_snapshot, true)}</span></td>
                    <td className="px-4 py-3 text-slate-600">{r.itens}</td>
                    <td className="px-4 py-3">
                      {r.comprovante_key
                        ? <a href={`/api/painel/repasses/${r.id}/comprovante`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#0B3D91] hover:underline">Abrir</a>
                        : <span className={`text-xs font-semibold ${r.status === 'pago' ? 'text-amber-600' : 'text-slate-400'}`}>{r.status === 'pago' ? 'Pendente' : '—'}</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#0B2447]">{brl(Number(r.valor_total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPaginas > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>Página {f.pagina} de {totalPaginas} · {lotes.total} repasse(s)</span>
              <span className="flex gap-2">
                {f.pagina > 1 && <Link href={href(f, { pagina: f.pagina - 1 })} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50">Anterior</Link>}
                {f.pagina < totalPaginas && <Link href={href(f, { pagina: f.pagina + 1 })} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50">Próxima</Link>}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
