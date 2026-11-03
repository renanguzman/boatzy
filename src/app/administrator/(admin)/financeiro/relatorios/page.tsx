import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2, TriangleAlert, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatCurrencyPrecise } from '@/lib/utils';
import { formatarData } from '@/lib/datas';
import FinanceiroAbas from '../_components/FinanceiroAbas';
import ExportarPlanilha from '../_components/ExportarPlanilha';
import { listarGestoresDosRepasses } from '../repasses/_lib/consulta';
import {
  exportarBalancete, exportarDemonstrativo, exportarDetalhePedidos, exportarRazao, exportarRepassesPeriodo,
} from './actions';
import {
  ABAS_RELATORIOS, POR_PAGINA_RAZAO, carregarBalancete, carregarConciliacao, carregarDemonstrativo, carregarRazao, lerFiltros,
  listarContas, type AbaRelatorio, type FiltrosRelatorio,
} from './_lib/consulta';

const brl = formatCurrencyPrecise;

const ROTULO_ABA: Record<AbaRelatorio, string> = {
  demonstrativo: 'Demonstrativo', balancete: 'Balancete', razao: 'Razão', conciliacao: 'Conciliação',
};

const th = 'px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400';
const controle = 'rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20';

function href(f: FiltrosRelatorio, extra: Record<string, string | number | null>) {
  const p = new URLSearchParams();
  const base: Record<string, string | number | null> = {
    aba: f.aba, de: f.de, ate: f.ate, base: f.base, gestor: f.gestor, conta: f.conta, pagina: f.pagina > 1 ? f.pagina : null,
  };
  for (const [k, v] of Object.entries({ ...base, ...extra })) if (v !== null && v !== '') p.set(k, String(v));
  return `/administrator/financeiro/relatorios?${p.toString()}`;
}

export default async function AdminRelatoriosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/administrator/login');

  const f = lerFiltros(await searchParams);
  const [gestores, contas] = await Promise.all([listarGestoresDosRepasses(), listarContas()]);

  const demonstrativo = f.aba === 'demonstrativo' ? await carregarDemonstrativo(f) : null;
  const balancete = f.aba === 'balancete' ? await carregarBalancete(f) : null;
  const razao = f.aba === 'razao' ? await carregarRazao(f) : null;
  const conciliacao = f.aba === 'conciliacao' ? await carregarConciliacao() : null;
  const paginasRazao = razao ? Math.max(1, Math.ceil(razao.total / POR_PAGINA_RAZAO)) : 1;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0B2447]/5">
          <Wallet className="h-5 w-5 text-[#0B2447]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Financeiro</h1>
          <p className="text-sm text-slate-500">
            Relatórios contábeis a partir do ledger de partidas dobradas — para balancete, conciliação e envio ao escritório de contabilidade.
          </p>
        </div>
      </div>

      <FinanceiroAbas ativa="relatorios" />

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Relatório">
        {ABAS_RELATORIOS.map((a) => (
          <Link
            key={a}
            href={href(f, { aba: a, pagina: null })}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              a === f.aba ? 'bg-[#0B2447] text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:text-[#0B2447]'
            }`}
          >
            {ROTULO_ABA[a]}
          </Link>
        ))}
      </nav>

      {f.aba !== 'conciliacao' && (
        <form method="GET" className="mb-5 flex flex-wrap items-end gap-3">
          <input type="hidden" name="aba" value={f.aba} />
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            De
            <input type="date" name="de" defaultValue={f.de} className={`${controle} mt-1 block normal-case tracking-normal`} />
          </label>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Até
            <input type="date" name="ate" defaultValue={f.ate} className={`${controle} mt-1 block normal-case tracking-normal`} />
          </label>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Base
            <select name="base" defaultValue={f.base} className={`${controle} mt-1 block normal-case tracking-normal`}>
              <option value="competencia">Competência (data do passeio)</option>
              <option value="caixa">Caixa (data do dinheiro)</option>
            </select>
          </label>
          {f.aba !== 'balancete' && (
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Gestor
              <select name="gestor" defaultValue={f.gestor ?? ''} className={`${controle} mt-1 block min-w-[180px] normal-case tracking-normal`}>
                <option value="">Todos</option>
                {gestores.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
            </label>
          )}
          {f.aba === 'razao' && (
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Conta
              <select name="conta" defaultValue={f.conta ?? ''} className={`${controle} mt-1 block normal-case tracking-normal`}>
                <option value="">Todas</option>
                {contas.map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nome}</option>)}
              </select>
            </label>
          )}
          <button type="submit" className="rounded-xl bg-[#0B2447] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B3D91]">Aplicar</button>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {f.aba === 'demonstrativo' && <ExportarPlanilha acao={exportarDemonstrativo} arquivo="demonstrativo-gestores" aba="Demonstrativo" />}
            {f.aba === 'balancete' && <ExportarPlanilha acao={exportarBalancete} arquivo="balancete-boatzy" aba="Balancete" />}
            {f.aba === 'razao' && <ExportarPlanilha acao={exportarRazao} arquivo="razao-boatzy" aba="Razão" />}
          </div>
        </form>
      )}

      {demonstrativo && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              ['Bruto pago pelos clientes', demonstrativo.totais.bruto],
              ['Devido aos gestores', demonstrativo.totais.devido],
              ['Repassado', demonstrativo.totais.repassado],
              ['Saldo a repassar (acumulado)', demonstrativo.saldoObrigacoes],
            ].map(([rotulo, valor]) => (
              <div key={rotulo as string} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{rotulo}</p>
                <p className="mt-2 text-xl font-bold text-[#0B2447]">{brl(valor as number)}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className={th}>Gestor</th><th className={`${th} text-right`}>Pedidos</th><th className={`${th} text-right`}>Bruto</th>
                <th className={`${th} text-right`}>Tarifa Asaas</th><th className={`${th} text-right`}>Descontos</th>
                <th className={`${th} text-right`}>Comissão</th><th className={`${th} text-right`}>Devido ao gestor</th>
                <th className={`${th} text-right`}>Repassado</th><th className={`${th} text-right`}>Saldo do período</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {demonstrativo.linhas.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-400">Sem lançamentos neste período.</td></tr>
                )}
                {demonstrativo.linhas.map((l) => (
                  <tr key={l.gestor_id}>
                    <td className="px-4 py-3"><span className="font-semibold text-slate-800">{l.nome}</span><span className="block text-xs text-slate-400">{l.documento ?? ''}</span></td>
                    <td className="px-4 py-3 text-right text-slate-600">{l.pedidos}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{brl(l.bruto)}</td>
                    <td className="px-4 py-3 text-right text-amber-700">{brl(l.tarifa)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{brl(l.desconto)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{brl(l.comissao)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#0B2447]">{brl(l.devido)}</td>
                    <td className="px-4 py-3 text-right text-teal-700">{brl(l.repassado)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{brl(l.devido - l.repassado)}</td>
                  </tr>
                ))}
              </tbody>
              {demonstrativo.linhas.length > 0 && (
                <tfoot><tr className="border-t border-slate-200 bg-slate-50/60 font-bold text-[#0B2447]">
                  <td className="px-4 py-3">Total</td><td className="px-4 py-3 text-right">{demonstrativo.totais.pedidos}</td>
                  <td className="px-4 py-3 text-right">{brl(demonstrativo.totais.bruto)}</td><td className="px-4 py-3 text-right">{brl(demonstrativo.totais.tarifa)}</td>
                  <td className="px-4 py-3 text-right">{brl(demonstrativo.totais.desconto)}</td><td className="px-4 py-3 text-right">{brl(demonstrativo.totais.comissao)}</td>
                  <td className="px-4 py-3 text-right">{brl(demonstrativo.totais.devido)}</td><td className="px-4 py-3 text-right">{brl(demonstrativo.totais.repassado)}</td>
                  <td className="px-4 py-3 text-right">{brl(demonstrativo.totais.devido - demonstrativo.totais.repassado)}</td>
                </tr></tfoot>
              )}
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span>Para o contador:</span>
            <ExportarPlanilha acao={exportarDetalhePedidos} arquivo="detalhe-pedidos" aba="Pedidos" />
            <ExportarPlanilha acao={exportarRepassesPeriodo} arquivo="repasses-periodo" aba="Repasses" />
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Período {formatarData(f.de)} a {formatarData(f.ate)}, base {f.base === 'caixa' ? 'caixa (data em que o dinheiro entrou/saiu)' : 'competência (data do passeio; repasses na data do pagamento)'}.
            As planilhas “Detalhe por pedido” e “Repasses” seguem o mesmo período.
          </p>
        </>
      )}

      {balancete && (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead><tr className="border-b border-slate-100">
              <th className={th}>Conta</th><th className={th}>Nome</th><th className={th}>Grupo</th>
              <th className={`${th} text-right`}>Débitos</th><th className={`${th} text-right`}>Créditos</th><th className={`${th} text-right`}>Saldo</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {balancete.contas.map((c) => (
                <tr key={c.conta_codigo}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.conta_codigo}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{c.conta_nome}</td>
                  <td className="px-4 py-3 capitalize text-slate-500">{c.grupo}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{brl(c.debitos)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{brl(c.creditos)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#0B2447]">{brl(c.saldo)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t border-slate-200 bg-slate-50/60 font-bold text-[#0B2447]">
              <td className="px-4 py-3" colSpan={3}>
                Total {balancete.fecha
                  ? <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> fecha</span>
                  : <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-red-600"><TriangleAlert className="h-3.5 w-3.5" /> não fecha</span>}
              </td>
              <td className="px-4 py-3 text-right">{brl(balancete.debitos)}</td><td className="px-4 py-3 text-right">{brl(balancete.creditos)}</td><td />
            </tr></tfoot>
          </table>
        </div>
      )}

      {razao && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className={th}>Competência</th><th className={th}>Caixa</th><th className={th}>Histórico</th><th className={th}>Gestor</th>
                <th className={th}>Conta</th><th className={`${th} text-right`}>Débito</th><th className={`${th} text-right`}>Crédito</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {razao.linhas.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">Sem lançamentos neste período.</td></tr>
                )}
                {razao.linhas.map((l, i) => (
                  <tr key={`${l.lote_id}-${i}`}>
                    <td className="px-4 py-2.5 text-slate-600">{formatarData(l.data_competencia)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{formatarData(l.data_caixa)}</td>
                    <td className="px-4 py-2.5 text-slate-700">{l.descricao}</td>
                    <td className="px-4 py-2.5 text-slate-600">{l.gestor_nome}</td>
                    <td className="px-4 py-2.5 text-slate-600"><span className="font-mono text-xs text-slate-400">{l.conta_codigo}</span> {l.conta_nome}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{l.natureza === 'D' ? brl(l.valor) : ''}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{l.natureza === 'C' ? brl(l.valor) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {paginasRazao > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>Página {f.pagina} de {paginasRazao} · {razao.total} lançamento(s)</span>
              <span className="flex gap-2">
                {f.pagina > 1 && <Link href={href(f, { pagina: f.pagina - 1 })} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50">Anterior</Link>}
                {f.pagina < paginasRazao && <Link href={href(f, { pagina: f.pagina + 1 })} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50">Próxima</Link>}
              </span>
            </div>
          )}
        </>
      )}

      {conciliacao && (
        <div className="space-y-4">
          {conciliacao.map((c) => (
            <section key={c.chave} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                {c.ok
                  ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                  : <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />}
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold text-[#0B2447]">{c.titulo}</h2>
                  <p className="mt-0.5 text-sm text-slate-600">{c.resumo}</p>
                  {c.itens.length > 0 && (
                    <ul className="mt-3 divide-y divide-slate-50 text-sm">
                      {c.itens.map((i) => (
                        <li key={`${i.href}-${i.detalhe}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                          <Link href={i.href} className="font-semibold text-[#0B3D91] hover:underline">{i.rotulo}</Link>
                          <span className="text-xs text-slate-500">{i.detalhe}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
