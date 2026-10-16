'use client';

import { useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, MousePointerClick, CalendarRange, Info, Wallet, PencilLine,
  RotateCcw, X, Eye, CircleAlert,
} from 'lucide-react';
import { hojeISO } from '@/lib/datas';
import {
  type RegraPreco, type OrigemPreco,
  resolverPrecoNaData, regraCobreData, ajustesComoRegras, compactarAjustes, decomporPreco,
  diaDaSemanaISO, somarDiasISO, intervaloISO,
} from '@/lib/precos-calendario';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DOW_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DOW_LONGOS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

/** Janela que o calendário cobre, a mesma do "a partir de" do card (365 dias). */
const JANELA_DIAS = 365;

// `data_fixa` = data específica: o preço definido clicando no dia, que vence qualquer regra.
const ORIGEM: Record<OrigemPreco, { label: string; cell: string; dot: string }> = {
  preco_base:    { label: 'Preço base',      cell: 'bg-white border-slate-200',                       dot: 'bg-slate-400' },
  dia_semana:    { label: 'Dia da semana',   cell: 'bg-blue-50 border-blue-200',                      dot: 'bg-blue-500' },
  periodo_anual: { label: 'Período anual',   cell: 'bg-amber-50 border-amber-200',                    dot: 'bg-amber-500' },
  data_fixa:     { label: 'Data específica', cell: 'bg-violet-50 border-violet-300',                  dot: 'bg-violet-500' },
  sem_preco:     { label: 'Sem preço',       cell: 'bg-red-50 border-red-200 border-dashed',          dot: 'bg-red-400' },
};

function brl(v: number): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2,
  });
}
/** Celular: preço compacto para caber na célula (sem "R$"; milhares em "k"). */
function brlCurto(v: number): string {
  if (v < 1000) return String(Math.round(v));
  const k = v / 1000;
  return `${k.toLocaleString('pt-BR', { maximumFractionDigits: k < 10 ? 1 : 0 })}k`;
}
function brlCompleto(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function fmtCurto(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}
function isoDe(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}
function fmtPct(p: number): string {
  return p.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

type Props = {
  precoBase: number | null;
  /** Regras do gestor (sem as datas específicas, que vêm em `ajustes`). */
  regras: RegraPreco[];
  /** Datas específicas (preço de um dia, definido aqui; vence qualquer regra): 'yyyy-mm-dd' → preço. */
  ajustes: Record<string, number>;
  onAjustesChange: (ajustes: Record<string, number>) => void;
  /** Dias da semana de operação (0=Dom..6=Sáb). Vazio = todos. */
  diasOperacao: number[];
  bloqueios: string[];
  /** Datas já seguradas por reservas (confirmadas / aguardando pagamento). */
  datasOcupadas: string[];
  /** Comissão do Boatzy (%) do gestor dono do roteiro. */
  taxaPercent: number;
  /**
   * Regra destacada no calendário: a que o gestor está montando (prévia antes
   * de adicionar) ou uma já criada que ele tocou na lista para ver onde vale.
   */
  previaRegra?: RegraPreco | null;
  /** Título do quadro de prévia (padrão: regra em criação). */
  previaTitulo?: string;
};

type Modo = 'dia' | 'periodo';

export default function CalendarioPrecos({
  precoBase, regras, ajustes, onAjustesChange, diasOperacao, bloqueios, datasOcupadas, taxaPercent, previaRegra = null,
  previaTitulo = 'Prévia da regra que você está criando',
}: Props) {
  const hoje = hojeISO();
  const limite = somarDiasISO(hoje, JANELA_DIAS);
  const [anoHoje, mesHoje] = hoje.split('-').map(Number);
  const [anoLimite, mesLimite] = limite.split('-').map(Number);

  const [view, setView] = useState({ ano: anoHoje, mes: mesHoje - 1 });
  const [modo, setModo] = useState<Modo>('dia');
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [inicio, setInicio] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [valorInput, setValorInput] = useState('');

  const bloqueioSet = useMemo(() => new Set(bloqueios), [bloqueios]);
  const ocupadoSet = useMemo(() => new Set(datasOcupadas), [datasOcupadas]);
  const operaTodos = diasOperacao.length === 0;

  // Regras "oficiais" (com as datas específicas) e, por cima, a prévia da regra em edição
  // (uma regra já existente em destaque não entra de novo).
  const regrasAtuais = useMemo(() => [...regras, ...ajustesComoRegras(ajustes)], [regras, ajustes]);
  const regrasComPrevia = useMemo(
    () => (previaRegra && !regrasAtuais.some(r => r.id === previaRegra.id) ? [...regrasAtuais, previaRegra] : regrasAtuais),
    [regrasAtuais, previaRegra],
  );

  function motivoIndisponivel(iso: string): string | null {
    if (iso < hoje) return 'Data passada';
    if (iso > limite) return 'Fora da janela de 12 meses';
    if (ocupadoSet.has(iso)) return 'Já reservado';
    if (bloqueioSet.has(iso)) return 'Data bloqueada na Disponibilidade';
    if (!operaTodos && !diasOperacao.includes(diaDaSemanaISO(iso))) return 'Fora dos dias de operação';
    return null;
  }

  // ── Resumo da regra em edição ──────────────────────────────────────────────
  const previa = useMemo(() => {
    if (!previaRegra) return null;
    let afetadas = 0;
    // Datas que a regra cobre mas onde vale outro preço: uma data específica
    // (vence sempre) ou outra regra de preço igual ou maior.
    let comDataEspecifica = 0;
    let comPrecoMaior = 0;
    let primeira: string | null = null;
    let ultima: string | null = null;
    for (let i = 0; i <= JANELA_DIAS; i++) {
      const iso = somarDiasISO(hoje, i);
      if (motivoIndisponivel(iso) || !regraCobreData(previaRegra, iso)) continue;
      const vencedora = resolverPrecoNaData(precoBase, regrasComPrevia, iso).regra;
      if (vencedora?.id === previaRegra.id) {
        afetadas++;
        primeira ??= iso;
        ultima = iso;
      } else if (vencedora?.tipo === 'data_fixa') {
        comDataEspecifica++;
      } else {
        comPrecoMaior++;
      }
    }
    return { afetadas, comDataEspecifica, comPrecoMaior, sobrepostas: comDataEspecifica + comPrecoMaior, primeira, ultima };
    // motivoIndisponivel depende só dos props abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previaRegra, precoBase, regrasComPrevia, hoje, ocupadoSet, bloqueioSet, diasOperacao]);

  // A regra em prévia/destaque passou a valer em outro mês: o calendário vai
  // até a primeira data afetada (ajuste de estado no render, sem efeito).
  const [primeiraVista, setPrimeiraVista] = useState<string | null>(null);
  const primeiraAfetada = previa?.primeira ?? null;
  if (primeiraAfetada !== primeiraVista) {
    setPrimeiraVista(primeiraAfetada);
    if (primeiraAfetada) {
      const [a, m] = primeiraAfetada.split('-').map(Number);
      if (a !== view.ano || m - 1 !== view.mes) setView({ ano: a, mes: m - 1 });
    }
  }

  // ── Seleção ────────────────────────────────────────────────────────────────
  const selSet = new Set(selecionados);
  const rascunhoPeriodo = new Set(inicio && hover ? intervaloISO(inicio, hover) : inicio ? [inicio] : []);

  function clicarDia(iso: string) {
    if (motivoIndisponivel(iso)) return;
    if (modo === 'dia') {
      setSelecionados(prev => prev.includes(iso) ? prev.filter(d => d !== iso) : [...prev, iso].sort());
      return;
    }
    if (!inicio) {
      setInicio(iso);
      setSelecionados([iso]);
      return;
    }
    setSelecionados(intervaloISO(inicio, iso).filter(d => !motivoIndisponivel(d)));
    setInicio(null);
    setHover(null);
  }

  function trocarModo(m: Modo) {
    setModo(m);
    setInicio(null);
    setHover(null);
  }

  function limparSelecao() {
    setSelecionados([]);
    setInicio(null);
    setHover(null);
    setValorInput('');
  }

  const valorDigitado = Number(valorInput.replace(',', '.'));
  const valorValido = valorInput.trim() !== '' && Number.isFinite(valorDigitado) && valorDigitado > 0;
  const valorArredondado = valorValido ? Math.round(valorDigitado * 100) / 100 : null;

  function aplicarAjuste() {
    if (valorArredondado == null || selecionados.length === 0) return;
    const novo = { ...ajustes };
    for (const d of selecionados) {
      const automatico = resolverPrecoNaData(precoBase, regras, d).valor;
      // Mesmo preço que o automático: não há o que ajustar.
      if (automatico === valorArredondado) delete novo[d];
      else novo[d] = valorArredondado;
    }
    onAjustesChange(novo);
    limparSelecao();
  }

  function voltarAoAutomatico(dias: string[]) {
    const novo = { ...ajustes };
    for (const d of dias) delete novo[d];
    onAjustesChange(novo);
    setSelecionados(prev => prev.filter(d => !dias.includes(d)));
  }

  // ── Navegação ──────────────────────────────────────────────────────────────
  const podeVoltar = view.ano > anoHoje || (view.ano === anoHoje && view.mes > mesHoje - 1);
  const podeAvancar = view.ano < anoLimite || (view.ano === anoLimite && view.mes < mesLimite - 1);
  function mesAnterior() {
    setView(v => (v.mes === 0 ? { ano: v.ano - 1, mes: 11 } : { ...v, mes: v.mes - 1 }));
  }
  function mesSeguinte() {
    setView(v => (v.mes === 11 ? { ano: v.ano + 1, mes: 0 } : { ...v, mes: v.mes + 1 }));
  }

  const diasNoMes = new Date(Date.UTC(view.ano, view.mes + 1, 0)).getUTCDate();
  const primeiroDow = new Date(Date.UTC(view.ano, view.mes, 1)).getUTCDay();
  const celulas: (string | null)[] = [
    ...Array<null>(primeiroDow).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => isoDe(view.ano, view.mes, i + 1)),
  ];

  // ── Painel lateral ─────────────────────────────────────────────────────────
  const precosSelecionados = selecionados.map(d => resolverPrecoNaData(precoBase, regrasAtuais, d));
  const unico = selecionados.length === 1 ? precosSelecionados[0] : null;
  const valoresSel = precosSelecionados.map(p => p.valor).filter((v): v is number => v != null);
  const minSel = valoresSel.length ? Math.min(...valoresSel) : null;
  const maxSel = valoresSel.length ? Math.max(...valoresSel) : null;
  const selecionadosComAjuste = selecionados.filter(d => ajustes[d] != null);

  const precoDoQuadro = valorArredondado ?? (unico?.valor ?? null);
  const quadroEhExemplo = selecionados.length === 0;
  const precoQuadro = quadroEhExemplo ? precoBase : precoDoQuadro;
  const decomposicao = precoQuadro != null ? decomporPreco(precoQuadro, taxaPercent) : null;

  const gruposAjuste = compactarAjustes(ajustes).filter(g => g.fim >= hoje);
  const totalDiasAjustados = Object.keys(ajustes).length;

  return (
    <div className="space-y-5">
      {/* Como usar: fixo acima do calendário (o painel do dia só aparece com um dia selecionado) */}
      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3">
        <MousePointerClick className="w-4 h-4 shrink-0 mt-0.5 text-[#0B2447]" aria-hidden />
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong className="text-[#0B2447]">Clique em um dia</strong> para ver quanto será cobrado naquela data e, se quiser,
          definir um preço só para ela — a <strong className="text-violet-700">data específica</strong>, que{' '}
          <strong className="text-slate-700">vale acima de qualquer regra</strong>. Use <strong className="text-slate-700">Período</strong> para
          definir vários dias de uma vez.
        </p>
      </div>

      {/* Prévia da regra em edição */}
      {previaRegra && previa && (
        <div className={`flex gap-3 rounded-xl border p-4 ${
          previa.afetadas > 0 ? 'border-[#0B3D91]/30 bg-[#0B3D91]/[0.04]' : 'border-amber-200 bg-amber-50/70'
        }`}>
          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            previa.afetadas > 0 ? 'bg-[#0B3D91]/10 text-[#0B3D91]' : 'bg-amber-100 text-amber-700'
          }`}>
            {previa.afetadas > 0 ? <Eye className="w-4 h-4" /> : <CircleAlert className="w-4 h-4" />}
          </span>
          <div className="text-sm leading-relaxed">
            <p className="font-semibold text-[#0B2447]">{previaTitulo}</p>
            {previa.afetadas > 0 ? (
              <p className="text-xs text-slate-600 mt-0.5">
                Vai valer em <strong>{previa.afetadas} {previa.afetadas === 1 ? 'data' : 'datas'}</strong>
                {previa.primeira && previa.ultima && <> (de {fmtBR(previa.primeira)} a {fmtBR(previa.ultima)})</>},
                destacadas no calendário.
                {previa.sobrepostas > 0 && (
                  <> {previa.sobrepostas === 1 ? 'Outra data continua' : <>Outras <strong>{previa.sobrepostas}</strong> continuam</>} com o preço atual
                  {' '}(<MotivosSobreposicao comDataEspecifica={previa.comDataEspecifica} comPrecoMaior={previa.comPrecoMaior} />).</>
                )}
              </p>
            ) : (
              <p className="text-xs text-amber-800 mt-0.5">
                {previa.sobrepostas > 0
                  ? <>Esta regra não muda nenhum preço: {previa.sobrepostas === 1 ? 'a data que ela cobre' : `as ${previa.sobrepostas} datas que ela cobre`}{' '}
                    {previa.sobrepostas === 1 ? 'continua' : 'continuam'} com o preço atual
                    {' '}(<MotivosSobreposicao comDataEspecifica={previa.comDataEspecifica} comPrecoMaior={previa.comPrecoMaior} />).</>
                  : <>Nenhuma data dos próximos 12 meses é afetada (considerando dias de operação, bloqueios e reservas).</>}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Lado a lado só quando o próprio componente tem espaço (container query). */}
      <div className="@container">
      <div className="flex flex-col @4xl:flex-row gap-6 @4xl:items-start">
        {/* ── Calendário ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 sm:p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1" role="tablist" aria-label="Modo de seleção">
                {([
                  { id: 'dia', label: 'Dia a dia', icon: MousePointerClick },
                  { id: 'periodo', label: 'Período', icon: CalendarRange },
                ] as const).map(({ id, label, icon: Icon }) => (
                  <button key={id} type="button" role="tab" aria-selected={modo === id}
                    onClick={() => trocarModo(id)}
                    className={`flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all ${
                      modo === id ? 'bg-white text-[#0B2447] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                <button type="button" onClick={mesAnterior} disabled={!podeVoltar} aria-label="Mês anterior"
                  className={`p-2.5 sm:p-1.5 rounded-full transition-colors ${
                    podeVoltar ? 'hover:bg-slate-100 text-slate-700' : 'text-slate-200 cursor-default'
                  }`}>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <p className="w-32 sm:w-36 text-center text-sm font-semibold text-slate-800">{MESES[view.mes]} {view.ano}</p>
                <button type="button" onClick={mesSeguinte} disabled={!podeAvancar} aria-label="Próximo mês"
                  className={`p-2.5 sm:p-1.5 rounded-full transition-colors ${
                    podeAvancar ? 'hover:bg-slate-100 text-slate-700' : 'text-slate-200 cursor-default'
                  }`}>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-0.5 sm:gap-1" onMouseLeave={() => setHover(null)}>
              {DOW_CURTOS.map(d => (
                <div key={d} className="text-center text-[10px] font-medium text-slate-400 pb-1">{d}</div>
              ))}
              {celulas.map((iso, i) => {
                if (!iso) return <div key={`e-${i}`} />;
                const motivo = motivoIndisponivel(iso);
                const preco = resolverPrecoNaData(precoBase, regrasComPrevia, iso);
                const chave = preco.origem;
                const dataEspecifica = chave === 'data_fixa';
                const afetadaPrevia = !!previaRegra && !motivo && preco.regra?.id === previaRegra.id;
                const selecionado = selSet.has(iso);
                const noRascunho = !!inicio && rascunhoPeriodo.has(iso) && !motivo;
                const ehHoje = iso === hoje;

                if (motivo) {
                  const ocupado = motivo === 'Já reservado';
                  return (
                    <div key={iso} title={motivo}
                      className={`h-12 sm:h-14 rounded-md sm:rounded-lg border px-0.5 sm:px-1.5 py-1 flex flex-col items-center sm:items-stretch justify-between cursor-default ${
                        ocupado ? 'border-slate-200 bg-slate-100' : 'border-transparent'
                      }`}>
                      <span className="text-[11px] text-slate-300">{Number(iso.slice(8))}</span>
                      <span className={`hidden sm:block text-[10px] font-medium leading-tight ${ocupado ? 'text-slate-500' : 'text-slate-300 line-through'}`}>
                        {ocupado ? 'Reservado' : preco.valor != null && iso >= hoje ? brl(preco.valor) : ''}
                      </span>
                      <span className={`sm:hidden text-[9px] font-medium leading-tight ${ocupado ? 'text-slate-500' : 'text-slate-300 line-through'}`}>
                        {ocupado ? 'Res.' : preco.valor != null && iso >= hoje ? brlCurto(preco.valor) : ''}
                      </span>
                    </div>
                  );
                }

                return (
                  <button key={iso} type="button" onClick={() => clicarDia(iso)}
                    onMouseEnter={() => { if (inicio) setHover(iso); }}
                    title={`${DOW_LONGOS[diaDaSemanaISO(iso)]}, ${fmtBR(iso)} — ${ORIGEM[chave].label}`}
                    className={`relative h-12 sm:h-14 rounded-md sm:rounded-lg border px-0.5 sm:px-1.5 py-1 flex flex-col items-center sm:items-stretch justify-between text-center sm:text-left transition-all hover:shadow-sm ${
                      ORIGEM[chave].cell
                    } ${selecionado || noRascunho ? 'ring-2 ring-[#0B2447] ring-offset-1' : ''}
                    ${afetadaPrevia ? 'ring-2 ring-[#0B3D91] ring-offset-1 shadow-md shadow-[#0B3D91]/20' : ''}`}>
                    <span className={`text-[11px] ${ehHoje ? 'font-bold text-[#0B2447]' : 'text-slate-500'}`}>
                      {Number(iso.slice(8))}
                    </span>
                    <span className={`hidden sm:block text-xs font-semibold leading-tight ${
                      preco.valor == null ? 'text-red-500' : 'text-slate-800'
                    }`}>
                      {preco.valor != null ? brl(preco.valor) : 'Sem preço'}
                    </span>
                    <span className={`sm:hidden text-[10px] font-semibold leading-tight tabular-nums ${
                      preco.valor == null ? 'text-red-500' : 'text-slate-800'
                    }`}>
                      {preco.valor != null ? brlCurto(preco.valor) : '—'}
                    </span>
                    {dataEspecifica && (
                      <PencilLine className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 text-violet-600" aria-label="Data específica" />
                    )}
                  </button>
                );
              })}
            </div>

            {modo === 'periodo' && (
              <div className={`mt-3 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[11px] ${
                inicio ? 'bg-[#0B2447]/5 text-[#0B2447]' : 'bg-slate-50 text-slate-500'
              }`}>
                <span>
                  {inicio
                    ? <>Início em <strong>{fmtBR(inicio)}</strong> — clique no último dia do período.</>
                    : 'Clique no primeiro e no último dia — pode trocar de mês entre os cliques.'}
                </span>
                {inicio && (
                  <button type="button" onClick={limparSelecao} className="shrink-0 font-semibold hover:underline">
                    Cancelar
                  </button>
                )}
              </div>
            )}

            {/* Legenda */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-slate-500">
              {(['preco_base', 'dia_semana', 'periodo_anual'] as const).map(k => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-sm border ${ORIGEM[k].cell}`} />
                  {ORIGEM[k].label}
                </span>
              ))}
              <span className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-sm border ${ORIGEM.data_fixa.cell}`} />
                <PencilLine className="w-2.5 h-2.5 -ml-1 text-violet-600" aria-hidden />
                <span><span className="font-semibold text-violet-700">Data específica</span> (vence sempre)</span>
              </span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-100 border border-slate-200" /> Reservado</span>
              <span className="line-through">Indisponível</span>
            </div>

            {/* Celular/tablet: o painel do dia fica abaixo — atalho até ele. */}
            {selecionados.length > 0 && (
              <button type="button"
                onClick={() => document.getElementById('calendario-precos-dia')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className="@4xl:hidden mt-3 w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#0B2447] text-white text-sm font-semibold py-3">
                Definir preço {selecionados.length === 1 ? 'deste dia' : `dos ${selecionados.length} dias`}
                <ChevronRight className="w-4 h-4 rotate-90" />
              </button>
            )}
          </div>

          {/* Datas específicas */}
          {gruposAjuste.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2 gap-2">
                <p className="text-[11px] font-medium text-slate-500">
                  {totalDiasAjustados} {totalDiasAjustados === 1 ? 'data específica' : 'datas específicas'}
                  <span className="text-slate-400"> — {totalDiasAjustados === 1 ? 'vale' : 'valem'} acima de qualquer regra; entra{totalDiasAjustados === 1 ? '' : 'm'} ao salvar o roteiro</span>
                </p>
                {gruposAjuste.length > 1 && (
                  <button type="button" onClick={() => onAjustesChange({})}
                    className="text-[11px] font-semibold text-slate-400 hover:text-red-600 transition-colors">
                    Limpar todos
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {gruposAjuste.map(g => {
                  const dias = intervaloISO(g.inicio, g.fim);
                  const rotulo = g.inicio === g.fim ? fmtCurto(g.inicio) : `${fmtCurto(g.inicio)} – ${fmtCurto(g.fim)}`;
                  return (
                    <span key={g.inicio}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-800 bg-violet-50 border border-violet-200 rounded-full pl-3 pr-2 py-1">
                      {rotulo}
                      {dias.length > 1 && <span className="text-[10px] text-violet-600">· {dias.length} dias</span>}
                      <span className="font-bold">{brl(g.valor)}</span>
                      <button type="button" onClick={() => voltarAoAutomatico(dias)}
                        className="w-6 h-6 sm:w-4 sm:h-4 -my-1 sm:my-0 flex items-center justify-center rounded-full hover:bg-violet-200 transition-colors"
                        aria-label={`Remover a data específica ${rotulo} (volta ao preço das regras)`}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Painel do dia ──────────────────────────────────────────────── */}
        <div className="w-full @4xl:w-80 shrink-0 space-y-4">
          {selecionados.length > 0 && (
            <div id="calendario-precos-dia" className="rounded-xl border border-slate-200 bg-white p-4 space-y-4 scroll-mt-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#0B2447]">
                    {unico
                      ? `${DOW_LONGOS[diaDaSemanaISO(selecionados[0])]}, ${fmtBR(selecionados[0])}`
                      : `${selecionados.length} dias selecionados`}
                  </p>
                  {!unico && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {fmtCurto(selecionados[0])} a {fmtCurto(selecionados[selecionados.length - 1])}
                    </p>
                  )}
                </div>
                <button type="button" onClick={limparSelecao} aria-label="Limpar seleção"
                  className="shrink-0 w-9 h-9 sm:w-6 sm:h-6 -m-1.5 sm:m-0 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                {unico ? (
                  <>
                    <span className="text-slate-400">Preço atual:</span>{' '}
                    <strong className="text-slate-800">{unico.valor != null ? brlCompleto(unico.valor) : 'sem preço'}</strong>
                    <p className="mt-0.5 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${ORIGEM[unico.origem].dot}`} />
                      {unico.origem === 'data_fixa'
                        ? <span><strong className="text-violet-700">Data específica</strong> — vale acima de qualquer regra</span>
                        : unico.regra
                          ? <span>{ORIGEM[unico.origem].label}: <strong>{unico.regra.nome}</strong></span>
                          : ORIGEM[unico.origem].label}
                    </p>
                    {unico.origem === 'data_fixa' && unico.concorrentes > 0 && (
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        Sobrepõe {unico.concorrentes === 1 ? '1 regra' : `${unico.concorrentes} regras`} deste dia.
                      </p>
                    )}
                    {unico.origem !== 'data_fixa' && unico.concorrentes > 1 && (
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {unico.concorrentes} regras valem neste dia — vale a de maior preço.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-slate-400">Preços atuais:</span>{' '}
                    <strong className="text-slate-800">
                      {minSel == null ? 'sem preço' : minSel === maxSel ? brlCompleto(minSel) : `${brl(minSel)} a ${brl(maxSel!)}`}
                    </strong>
                  </>
                )}
              </div>

              <div>
                <label htmlFor="preco-dia" className="block text-xs font-medium text-slate-600 mb-1.5">
                  Novo preço {unico ? 'para este dia' : 'para os dias selecionados'}
                </label>
                <p className="-mt-1 mb-1.5 text-[11px] text-slate-400 leading-snug">
                  Vira <strong className="text-violet-700">data específica</strong>: vale acima de qualquer regra, mesmo que seja menor.
                </p>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">R$</span>
                  <input id="preco-dia" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0,00"
                    value={valorInput}
                    onChange={e => setValorInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); aplicarAjuste(); } }}
                    className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition bg-white" />
                </div>
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={aplicarAjuste} disabled={!valorValido}
                  className="flex-1 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold px-4 py-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Aplicar preço
                </button>
                {selecionadosComAjuste.length > 0 && (
                  <button type="button" onClick={() => voltarAoAutomatico(selecionadosComAjuste)}
                    title="Remove a data específica e volta ao preço das regras"
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold px-3 py-2.5 transition-colors">
                    <RotateCcw className="w-3.5 h-3.5" />
                    Automático
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Você recebe × Cliente paga */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
              <Wallet className="w-4 h-4 text-[#0B2447]" />
              <p className="text-xs font-bold text-[#0B2447] uppercase tracking-wide">
                {quadroEhExemplo
                  ? 'Exemplo com o preço base'
                  : valorArredondado != null ? 'Com o novo preço' : 'Neste dia'}
              </p>
            </div>
            {decomposicao ? (
              <div className="p-4 space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Preço do passeio</span>
                  <span className="font-medium text-slate-800">{brlCompleto(decomposicao.voceRecebe)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">
                    Taxa Boatzy ({fmtPct(decomposicao.taxaPercent)}%)
                    <span className="block text-[11px] text-slate-400">somada ao preço, paga pelo cliente</span>
                  </span>
                  <span className="font-medium text-slate-800">+ {brlCompleto(decomposicao.taxaValor)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                  <span className="font-bold text-[#0B2447]">Cliente paga</span>
                  <span className="text-base font-bold text-[#0B2447]">{brlCompleto(decomposicao.clientePaga)}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
                  <span className="font-bold text-emerald-800">Você recebe</span>
                  <span className="text-base font-bold text-emerald-800">{brlCompleto(decomposicao.voceRecebe)}</span>
                </div>
                <p className="flex gap-1.5 text-[11px] text-slate-400 leading-snug">
                  <Info className="w-3 h-3 shrink-0 mt-0.5" />
                  Adicionais do catálogo que o cliente escolher entram à parte, com a mesma taxa.
                </p>
              </div>
            ) : (
              <p className="p-4 text-xs text-slate-500 leading-relaxed">
                {quadroEhExemplo
                  ? 'Defina o preço base (ou um preço por data) para ver aqui quanto o cliente paga e quanto você recebe.'
                  : 'Este dia ainda não tem preço. Digite um valor acima para ver quanto o cliente paga e quanto você recebe.'}
              </p>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

/** "uma tem data específica e 2 têm regra de preço igual ou maior" — por que a regra não vale ali. */
function MotivosSobreposicao({ comDataEspecifica, comPrecoMaior }: { comDataEspecifica: number; comPrecoMaior: number }) {
  const partes: string[] = [];
  const total = comDataEspecifica + comPrecoMaior;
  const so = comDataEspecifica === 0 || comPrecoMaior === 0;
  if (comDataEspecifica > 0) {
    partes.push(so
      ? (total === 1 ? 'tem data específica, que vence sempre' : 'têm data específica, que vence sempre')
      : `${comDataEspecifica} ${comDataEspecifica === 1 ? 'tem' : 'têm'} data específica`);
  }
  if (comPrecoMaior > 0) {
    partes.push(so
      ? (total === 1 ? 'outra regra de preço igual ou maior vale nela' : 'outra regra de preço igual ou maior vale nelas')
      : `${comPrecoMaior} ${comPrecoMaior === 1 ? 'tem' : 'têm'} outra regra de preço igual ou maior`);
  }
  return <>{partes.join(' e ')}</>;
}
