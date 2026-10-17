'use client';

import { useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, MousePointerClick, CalendarRange, Info, Wallet, PencilLine,
  RotateCcw, X, Eye, CircleAlert, Lock, LockOpen, Ship, CalendarCheck, ExternalLink, Hourglass,
} from 'lucide-react';
import { dataMaximaReservaISO, hojeISO } from '@/lib/datas';
import {
  type RegraPreco, type OrigemPreco,
  resolverPrecoNaData, regraCobreData, ajustesComoRegras, compactarAjustes, decomporPreco,
  diaDaSemanaISO, somarDiasISO, intervaloISO,
} from '@/lib/precos-calendario';
import {
  type AgendaRoteiro, type OcupacaoDia, type SituacaoDia, situacaoDoDia, agruparDatas,
} from '@/lib/disponibilidade';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DOW_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DOW_LONGOS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

/**
 * Dias que o calendário do painel cobre: 12 meses, mesmo com uma janela de
 * reservas menor — o gestor prepara preço e disponibilidade com antecedência.
 */
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
/** Data em que `iso` entra na janela de reservas (iso − N meses, dia ajustado ao fim do mês). */
function dataAbertura(iso: string, meses: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 - meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}

/** Como cada situação de disponibilidade aparece na célula (as abertas usam a cor do preço). */
const CELULA_FECHADA: Partial<Record<SituacaoDia, { label: string; curto: string; cell: string }>> = {
  fechado:       { label: 'Fechado',       curto: 'Fech.', cell: 'bg-slate-100 border-slate-300' },
  barco_fechado: { label: 'Barco fechado', curto: 'Barco', cell: 'bg-slate-200/80 border-slate-300' },
  nao_opera:     { label: 'Não opera',     curto: '—',     cell: 'bg-white border-dashed border-slate-200' },
};
/** Fora da janela: hachura por cima da cor do preço. */
const HACHURA = 'bg-[repeating-linear-gradient(135deg,transparent_0_5px,rgba(100,116,139,0.12)_5px_10px)]';

type Props = {
  precoBase: number | null;
  /** Regras do gestor (sem as datas específicas, que vêm em `ajustes`). */
  regras: RegraPreco[];
  /** Datas específicas (preço de um dia, definido aqui; vence qualquer regra): 'yyyy-mm-dd' → preço. */
  ajustes: Record<string, number>;
  onAjustesChange: (ajustes: Record<string, number>) => void;
  /** Dias da semana de operação (0=Dom..6=Sáb). Vazio = todos. */
  diasOperacao: number[];
  /** Meses à frente em que o cliente pode reservar (3, 6, 9 ou 12). */
  janelaMeses: number;
  /** Exceções do roteiro: false = dia fechado; true = dia aberto fora da operação. */
  diasRoteiro: Record<string, boolean>;
  onDiasRoteiroChange: (dias: Record<string, boolean>) => void;
  /** Dias em que o barco inteiro está fechado (todos os roteiros). null = roteiro sem embarcação. */
  fechamentosBarco: string[] | null;
  onFechamentosBarcoChange: (datas: string[]) => void;
  /** Reservas que ocupam o dia — deste roteiro ou de outro roteiro do mesmo barco. */
  ocupacao: OcupacaoDia[];
  /** Pedidos pendentes do roteiro por dia (não seguram a data). */
  pedidosPendentes?: Record<string, number>;
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
  precoBase, regras, ajustes, onAjustesChange, diasOperacao, janelaMeses,
  diasRoteiro, onDiasRoteiroChange, fechamentosBarco, onFechamentosBarcoChange,
  ocupacao, pedidosPendentes = {}, taxaPercent, previaRegra = null,
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
  /** Dia reservado clicado: a barra mostra só a reserva (não se edita dia ocupado). */
  const [ocupadoSel, setOcupadoSel] = useState<OcupacaoDia | null>(null);
  const precoDiaRef = useRef<HTMLInputElement>(null);

  // Disponibilidade de cada dia pelo espelho de `roteiro_situacao_dia` — com o
  // que o gestor ainda não salvou.
  const dataMaxima = dataMaximaReservaISO(janelaMeses, hoje);
  const ocupacaoPorDia = useMemo(() => {
    const m = new Map<string, OcupacaoDia>();
    for (const o of ocupacao) if (!m.has(o.data) || o.mesmoRoteiro) m.set(o.data, o);
    return m;
  }, [ocupacao]);
  const agenda = useMemo<AgendaRoteiro>(() => ({
    hoje, dataMaxima, diasOperacao, diasRoteiro,
    barcoFechado: new Set(fechamentosBarco ?? []),
    ocupadas: new Set(ocupacaoPorDia.keys()),
  }), [hoje, dataMaxima, diasOperacao, diasRoteiro, fechamentosBarco, ocupacaoPorDia]);
  const situacao = (iso: string) => situacaoDoDia(agenda, iso);
  /** Preço e disponibilidade se editam em dia futuro, dentro do calendário e sem reserva. */
  const editavel = (iso: string) => iso >= hoje && iso <= limite && !agenda.ocupadas.has(iso);

  // Regras "oficiais" (com as datas específicas) e, por cima, a prévia da regra em edição
  // (uma regra já existente em destaque não entra de novo).
  const regrasAtuais = useMemo(() => [...regras, ...ajustesComoRegras(ajustes)], [regras, ajustes]);
  const regrasComPrevia = useMemo(
    () => (previaRegra && !regrasAtuais.some(r => r.id === previaRegra.id) ? [...regrasAtuais, previaRegra] : regrasAtuais),
    [regrasAtuais, previaRegra],
  );

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
      const s = situacaoDoDia(agenda, iso);
      // Conta só os dias abertos (reserváveis agora ou quando entrarem na janela).
      if ((s !== 'disponivel' && s !== 'fora_janela') || !regraCobreData(previaRegra, iso)) continue;
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
  }, [previaRegra, precoBase, regrasComPrevia, hoje, agenda]);

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

  /**
   * Com mouse, a barra de preço já abre com o cursor no campo (digita e Enter).
   * Em tela de toque não: o teclado cobriria o calendário no meio da seleção.
   */
  function focarPrecoDia() {
    requestAnimationFrame(() => {
      if (window.matchMedia('(pointer: fine)').matches) precoDiaRef.current?.focus({ preventScroll: true });
    });
  }

  function clicarDia(iso: string) {
    if (iso < hoje || iso > limite) return;
    const ocupado = ocupacaoPorDia.get(iso);
    if (ocupado) {
      limparSelecao();
      setOcupadoSel(ocupado);
      return;
    }
    setOcupadoSel(null);
    if (modo === 'dia') {
      if (selecionados.length === 0) focarPrecoDia();
      setSelecionados(prev => prev.includes(iso) ? prev.filter(d => d !== iso) : [...prev, iso].sort());
      return;
    }
    if (!inicio) {
      setInicio(iso);
      setSelecionados([iso]);
      return;
    }
    setSelecionados(intervaloISO(inicio, iso).filter(editavel));
    setInicio(null);
    setHover(null);
    focarPrecoDia();
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
    setOcupadoSel(null);
  }

  /** Atalho: seleciona todos os dias editáveis do mês à vista. */
  function selecionarMes() {
    const dias = Array.from(
      { length: new Date(Date.UTC(view.ano, view.mes + 1, 0)).getUTCDate() },
      (_, i) => isoDe(view.ano, view.mes, i + 1),
    ).filter(editavel);
    if (dias.length === 0) return;
    setModo('dia');
    setInicio(null);
    setHover(null);
    setOcupadoSel(null);
    setSelecionados(dias);
    focarPrecoDia();
  }

  // ── Disponibilidade ────────────────────────────────────────────────────────
  const operaNoDiaDaSemana = (iso: string) => diasOperacao.length === 0 || diasOperacao.includes(diaDaSemanaISO(iso));

  function fecharDias(dias: string[]) {
    const novo = { ...diasRoteiro };
    for (const d of dias) novo[d] = false;
    onDiasRoteiroChange(novo);
    limparSelecao();
  }

  /** Reabre: remove o fechamento; dia fora da operação vira abertura excepcional. */
  function abrirDias(dias: string[]) {
    const novo = { ...diasRoteiro };
    for (const d of dias) {
      if (operaNoDiaDaSemana(d)) delete novo[d];
      else novo[d] = true;
    }
    onDiasRoteiroChange(novo);
    limparSelecao();
  }

  function desfazerExcecoes(dias: string[]) {
    const novo = { ...diasRoteiro };
    for (const d of dias) delete novo[d];
    onDiasRoteiroChange(novo);
  }

  function fecharBarco(dias: string[]) {
    onFechamentosBarcoChange([...new Set([...(fechamentosBarco ?? []), ...dias])].sort());
    limparSelecao();
  }

  function reabrirBarco(dias: string[], limpar = true) {
    onFechamentosBarcoChange((fechamentosBarco ?? []).filter(d => !dias.includes(d)));
    if (limpar) limparSelecao();
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
  // No modo Período, a barra só aparece depois do 2º clique (o 1º só marca o início).
  const barraVisivel = selecionados.length > 0 && !inicio;
  const situacoesSel = selecionados.map(situacao);
  const fechaveis = selecionados.filter((_, i) => situacoesSel[i] === 'disponivel' || situacoesSel[i] === 'fora_janela');
  const abriveis = selecionados.filter((_, i) => situacoesSel[i] === 'fechado' || situacoesSel[i] === 'nao_opera');
  const comBarcoFechado = selecionados.filter((_, i) => situacoesSel[i] === 'barco_fechado');
  const situacaoUnica = selecionados.length === 1 ? situacoesSel[0] : null;
  const pendentesSel = selecionados.reduce((n, d) => n + (pedidosPendentes[d] ?? 0), 0);
  const decomposicaoNova = valorArredondado != null ? decomporPreco(valorArredondado, taxaPercent) : null;

  const precoDoQuadro = valorArredondado ?? (unico?.valor ?? null);
  const quadroEhExemplo = selecionados.length === 0;
  const precoQuadro = quadroEhExemplo ? precoBase : precoDoQuadro;
  const decomposicao = precoQuadro != null ? decomporPreco(precoQuadro, taxaPercent) : null;

  const gruposAjuste = compactarAjustes(ajustes).filter(g => g.fim >= hoje);
  const totalDiasAjustados = Object.keys(ajustes).length;
  const futuras = (datas: string[]) => datas.filter(d => d >= hoje);
  const gruposFechados = agruparDatas(futuras(Object.keys(diasRoteiro).filter(d => diasRoteiro[d] === false)));
  const gruposAbertos = agruparDatas(futuras(Object.keys(diasRoteiro).filter(d => diasRoteiro[d] === true)));
  const gruposBarco = agruparDatas(futuras(fechamentosBarco ?? []));

  return (
    <div className="space-y-5">
      {/* Como usar: fixo acima do calendário (o painel do dia só aparece com um dia selecionado) */}
      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3">
        <MousePointerClick className="w-4 h-4 shrink-0 mt-0.5 text-[#0B2447]" aria-hidden />
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong className="text-[#0B2447]">Clique em um dia</strong> para ver o preço e a disponibilidade e, se quiser, mudar:
          definir um preço só para ele — a <strong className="text-violet-700">data específica</strong>, que{' '}
          <strong className="text-slate-700">vale acima de qualquer regra</strong> — ou <strong className="text-slate-700">fechar/abrir</strong> o dia
          para reservas. Use <strong className="text-slate-700">Período</strong> para vários dias de uma vez. O cliente vê este mesmo calendário.
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
                  : <>Nenhuma data dos próximos 12 meses é afetada (considerando dias de operação, dias fechados e reservas).</>}
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
                <button type="button" onClick={selecionarMes}
                  title="Seleciona todos os dias livres do mês — para mudar preço ou disponibilidade de uma vez"
                  className="mr-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-[#0B3D91] hover:bg-[#0B3D91]/5 transition-colors">
                  Selecionar o mês
                </button>
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
                const dia = Number(iso.slice(8));
                if (iso < hoje || iso > limite) {
                  return (
                    <div key={iso} title={iso < hoje ? 'Data passada' : 'Fora do calendário (12 meses)'}
                      className="h-12 sm:h-14 rounded-md sm:rounded-lg px-0.5 sm:px-1.5 py-1 flex flex-col items-center sm:items-stretch cursor-default">
                      <span className="text-[11px] text-slate-300">{dia}</span>
                    </div>
                  );
                }

                const sit = situacao(iso);
                const preco = resolverPrecoNaData(precoBase, regrasComPrevia, iso);
                const ocupado = ocupacaoPorDia.get(iso);
                const fechada = CELULA_FECHADA[sit];
                const aberto = sit === 'disponivel' || sit === 'fora_janela';
                const pendentes = pedidosPendentes[iso] ?? 0;
                const afetadaPrevia = !!previaRegra && aberto && preco.regra?.id === previaRegra.id;
                const selecionado = selSet.has(iso) || ocupadoSel?.data === iso;
                const noRascunho = !!inicio && rascunhoPeriodo.has(iso) && editavel(iso);
                const ehHoje = iso === hoje;
                const precoTexto = preco.valor != null ? brl(preco.valor) : 'sem preço';

                let cell: string;
                let rotulo: React.ReactNode;
                let rotuloCurto: React.ReactNode;
                let titulo: string;
                let icone: React.ReactNode = null;
                if (ocupado) {
                  const aguardando = ocupado.status === 'aguardando_pagamento';
                  cell = ocupado.mesmoRoteiro ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-100 border-slate-300';
                  rotulo = ocupado.mesmoRoteiro ? (aguardando ? 'Aguard. pgto' : 'Reservado') : 'Barco ocupado';
                  rotuloCurto = ocupado.mesmoRoteiro ? 'Res.' : 'Ocup.';
                  titulo = ocupado.mesmoRoteiro
                    ? `Reservado neste roteiro${aguardando ? ' (aguardando pagamento)' : ''}`
                    : `Barco ocupado pelo roteiro “${ocupado.roteiroNome ?? 'outro roteiro'}”`;
                  icone = ocupado.mesmoRoteiro
                    ? (aguardando ? <Hourglass className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-700" /> : <CalendarCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-700" />)
                    : <Ship className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-500" />;
                } else if (fechada) {
                  cell = fechada.cell;
                  rotulo = fechada.label;
                  rotuloCurto = fechada.curto;
                  titulo = `${fechada.label} — ${precoTexto}`;
                  icone = sit === 'barco_fechado'
                    ? <Ship className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-500" />
                    : sit === 'fechado' ? <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-500" /> : null;
                } else {
                  cell = `${ORIGEM[preco.origem].cell} ${sit === 'fora_janela' ? HACHURA : ''}`;
                  rotulo = preco.valor != null ? brl(preco.valor) : 'Sem preço';
                  rotuloCurto = preco.valor != null ? brlCurto(preco.valor) : '—';
                  titulo = `${ORIGEM[preco.origem].label} — ${precoTexto}${sit === 'fora_janela' ? ` · fora da janela, abre para reservas em ${fmtBR(dataAbertura(iso, janelaMeses))}` : ''}`;
                  if (preco.origem === 'data_fixa') icone = <PencilLine className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-violet-600" />;
                }
                const corRotulo = ocupado
                  ? (ocupado.mesmoRoteiro ? 'text-emerald-800' : 'text-slate-600')
                  : fechada ? 'text-slate-500' : preco.valor == null ? 'text-red-500' : 'text-slate-800';

                return (
                  <button key={iso} type="button" onClick={() => clicarDia(iso)}
                    onMouseEnter={() => { if (inicio) setHover(iso); }}
                    title={`${DOW_LONGOS[diaDaSemanaISO(iso)]}, ${fmtBR(iso)} — ${titulo}${pendentes > 0 ? ` · ${pendentes} pedido(s) pendente(s)` : ''}`}
                    className={`relative h-12 sm:h-14 rounded-md sm:rounded-lg border px-0.5 sm:px-1.5 py-1 flex flex-col items-center sm:items-stretch justify-between text-center sm:text-left transition-all hover:shadow-sm ${
                      cell
                    } ${selecionado || noRascunho ? 'ring-2 ring-[#0B2447] ring-offset-1' : ''}
                    ${afetadaPrevia ? 'ring-2 ring-[#0B3D91] ring-offset-1 shadow-md shadow-[#0B3D91]/20' : ''}`}>
                    <span className={`text-[11px] ${ehHoje ? 'font-bold text-[#0B2447]' : fechada ? 'text-slate-400' : 'text-slate-500'}`}>
                      {dia}
                    </span>
                    <span className={`hidden sm:block font-semibold leading-tight ${fechada || ocupado ? 'text-[10px]' : 'text-xs'} ${corRotulo}`}>
                      {rotulo}
                    </span>
                    <span className={`sm:hidden text-[10px] font-semibold leading-tight tabular-nums ${corRotulo}`}>
                      {rotuloCurto}
                    </span>
                    {icone && <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1" aria-hidden>{icone}</span>}
                    {pendentes > 0 && (
                      <span className="absolute top-1 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-5 sm:top-1.5 h-1.5 w-1.5 rounded-full bg-amber-500"
                        aria-label={`${pendentes} pedido(s) pendente(s)`} />
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
              <span className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-sm border ${CELULA_FECHADA.fechado!.cell}`} />
                <Lock className="w-2.5 h-2.5 -ml-1 text-slate-500" aria-hidden /> Fechado
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-sm border ${CELULA_FECHADA.nao_opera!.cell}`} /> Não opera
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm border bg-emerald-50 border-emerald-300" /> Reservado
              </span>
              {fechamentosBarco && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm border bg-slate-100 border-slate-300" />
                  <Ship className="w-2.5 h-2.5 -ml-1 text-slate-500" aria-hidden /> Barco ocupado/fechado (todos os roteiros)
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-sm border border-slate-200 ${HACHURA}`} /> Fora da janela (até {fmtBR(dataMaxima)})
              </span>
              {Object.keys(pedidosPendentes).length > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Pedido pendente
                </span>
              )}
            </div>

          </div>

          {/* Barra de preço do dia: logo abaixo do calendário e `sticky` acima do
              rodapé das etapas (RodapeEtapas, ~6,5rem) — com o fim do calendário fora
              da tela, ela gruda no rodapé e o preço se define sem rolar a página. */}
          {ocupadoSel && (
            <div role="region" aria-label="Reserva do dia selecionado"
              className="sticky bottom-[6.75rem] z-10 mt-3 rounded-xl border border-slate-300 bg-white/95 p-3 shadow-lg shadow-slate-900/10 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 text-xs leading-snug">
                  <p className="text-sm font-bold text-[#0B2447]">
                    {DOW_LONGOS[diaDaSemanaISO(ocupadoSel.data)]}, {fmtBR(ocupadoSel.data)}
                  </p>
                  <p className="mt-0.5 text-slate-600">
                    {ocupadoSel.mesmoRoteiro
                      ? <>Reservado neste roteiro{ocupadoSel.status === 'aguardando_pagamento' && ' — aguardando o pagamento do cliente'}.</>
                      : <>O barco está ocupado pelo roteiro <strong>“{ocupadoSel.roteiroNome ?? 'outro roteiro'}”</strong>
                          {ocupadoSel.status === 'aguardando_pagamento' && ' (aguardando pagamento)'} — um barco faz um passeio por dia.</>}
                    {' '}Para liberar o dia, a reserva precisa ser cancelada em Agendamentos.
                  </p>
                </div>
                <button type="button" onClick={limparSelecao} aria-label="Fechar" title="Fechar (Esc)"
                  className="shrink-0 w-9 h-9 sm:w-7 sm:h-7 -m-1.5 sm:m-0 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <a href={`/painel/agendamentos/${ocupadoSel.reservaId}`} target="_blank" rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B3D91] hover:text-[#0B2447]">
                Ver a reserva em Agendamentos <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {barraVisivel && (
            <div role="region" aria-label="Definir preço dos dias selecionados"
              className="sticky bottom-[6.75rem] z-10 mt-3 rounded-xl border border-[#0B2447]/20 bg-white/95 p-3 shadow-lg shadow-slate-900/10 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 text-xs leading-snug">
                  <p className="text-sm font-bold text-[#0B2447]">
                    {unico
                      ? `${DOW_LONGOS[diaDaSemanaISO(selecionados[0])]}, ${fmtBR(selecionados[0])}`
                      : <>{selecionados.length} dias selecionados <span className="ml-1 text-xs font-medium text-slate-500">
                          {fmtCurto(selecionados[0])} a {fmtCurto(selecionados[selecionados.length - 1])}
                        </span></>}
                  </p>
                  {unico ? (
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-slate-500">
                      <span>Atual: <strong className="text-slate-800">{unico.valor != null ? brlCompleto(unico.valor) : 'sem preço'}</strong></span>
                      <span className="text-slate-300">·</span>
                      <span className="inline-flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${ORIGEM[unico.origem].dot}`} />
                        {unico.origem === 'data_fixa' ? (
                          <span>
                            <strong className="text-violet-700">Data específica</strong>
                            {unico.concorrentes > 0 && ` · sobrepõe ${unico.concorrentes === 1 ? '1 regra' : `${unico.concorrentes} regras`}`}
                          </span>
                        ) : (
                          <span>
                            {ORIGEM[unico.origem].label}
                            {unico.regra && <>: <strong className="text-slate-700">{unico.regra.nome}</strong></>}
                            {unico.concorrentes > 1 && ` · maior entre ${unico.concorrentes} regras`}
                          </span>
                        )}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-0.5 text-slate-500">
                      Atuais: <strong className="text-slate-800">
                        {minSel == null ? 'sem preço' : minSel === maxSel ? brlCompleto(minSel) : `${brl(minSel)} a ${brl(maxSel!)}`}
                      </strong>
                    </p>
                  )}
                  {situacaoUnica && (
                    <p className="mt-0.5 flex items-center gap-1 text-slate-500">
                      {situacaoUnica === 'disponivel' && <><LockOpen className="w-3 h-3 text-emerald-600" /> Aberto para reservas</>}
                      {situacaoUnica === 'fora_janela' && <><LockOpen className="w-3 h-3 text-slate-400" /> Aberto, mas fora da janela — clientes reservam a partir de {fmtBR(dataAbertura(selecionados[0], janelaMeses))}</>}
                      {situacaoUnica === 'fechado' && <><Lock className="w-3 h-3" /> Fechado para reservas</>}
                      {situacaoUnica === 'nao_opera' && <><Lock className="w-3 h-3" /> Fechado — não opera neste dia da semana</>}
                      {situacaoUnica === 'barco_fechado' && <><Ship className="w-3 h-3" /> Barco fechado neste dia (todos os roteiros)</>}
                    </p>
                  )}
                  {pendentesSel > 0 && (
                    <p className="mt-0.5 flex items-center gap-1 font-medium text-amber-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      {pendentesSel === 1 ? '1 pedido pendente' : `${pendentesSel} pedidos pendentes`} — responda em Agendamentos
                    </p>
                  )}
                </div>
                <button type="button" onClick={limparSelecao} aria-label="Limpar seleção" title="Limpar seleção (Esc)"
                  className="shrink-0 w-9 h-9 sm:w-7 sm:h-7 -m-1.5 sm:m-0 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <div className="relative w-36 sm:w-40">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">R$</span>
                  <input ref={precoDiaRef} id="preco-dia" type="number" inputMode="decimal" min="0" step="0.01" placeholder="Novo preço"
                    aria-label={unico ? 'Novo preço para este dia' : 'Novo preço para os dias selecionados'}
                    value={valorInput}
                    onChange={e => setValorInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); aplicarAjuste(); }
                      if (e.key === 'Escape') { e.preventDefault(); limparSelecao(); }
                    }}
                    className="w-full rounded-xl border border-slate-200 pl-9 pr-2.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition bg-white" />
                </div>
                <button type="button" onClick={aplicarAjuste} disabled={!valorValido}
                  className="rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold px-4 py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Aplicar preço
                </button>
                {selecionadosComAjuste.length > 0 && (
                  <button type="button" onClick={() => voltarAoAutomatico(selecionadosComAjuste)}
                    title="Remove a data específica e volta ao preço das regras"
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold px-3 py-2 transition-colors">
                    <RotateCcw className="w-3.5 h-3.5" />
                    Automático
                  </button>
                )}
              </div>

              <p className="mt-2 text-[11px] leading-snug text-slate-500">
                {decomposicaoNova ? (
                  <>
                    Cliente paga <strong className="text-[#0B2447]">{brlCompleto(decomposicaoNova.clientePaga)}</strong>
                    <span className="text-slate-300 mx-1">·</span>
                    Você recebe <strong className="text-emerald-700">{brlCompleto(decomposicaoNova.voceRecebe)}</strong>
                    <span className="text-slate-300 mx-1">·</span>
                    vira <strong className="text-violet-700">data específica</strong> (vale acima de qualquer regra)
                  </>
                ) : (
                  <>Vira <strong className="text-violet-700">data específica</strong>: vale acima de qualquer regra, mesmo que seja menor.</>
                )}
              </p>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
                <span className="mr-0.5 text-[11px] font-semibold text-slate-500">Disponibilidade:</span>
                {fechaveis.length > 0 && (
                  <BotaoDisponibilidade icone={Lock} onClick={() => fecharDias(fechaveis)}
                    titulo="O cliente não consegue reservar este dia neste roteiro">
                    Fechar para reservas{fechaveis.length < selecionados.length ? ` (${fechaveis.length})` : ''}
                  </BotaoDisponibilidade>
                )}
                {fechaveis.length > 0 && fechamentosBarco && (
                  <BotaoDisponibilidade icone={Ship} onClick={() => fecharBarco(fechaveis)}
                    titulo="Fecha o dia em TODOS os roteiros deste barco (ex.: manutenção)">
                    Fechar o barco inteiro
                  </BotaoDisponibilidade>
                )}
                {abriveis.length > 0 && (
                  <BotaoDisponibilidade icone={LockOpen} destaque onClick={() => abrirDias(abriveis)}
                    titulo="Volta a aceitar reservas neste dia (mesmo fora dos dias de operação)">
                    Abrir para reservas{abriveis.length < selecionados.length ? ` (${abriveis.length})` : ''}
                  </BotaoDisponibilidade>
                )}
                {comBarcoFechado.length > 0 && (
                  <BotaoDisponibilidade icone={LockOpen} destaque onClick={() => reabrirBarco(comBarcoFechado)}
                    titulo="Reabre o dia em todos os roteiros deste barco">
                    Reabrir o barco{comBarcoFechado.length < selecionados.length ? ` (${comBarcoFechado.length})` : ''}
                  </BotaoDisponibilidade>
                )}
              </div>
            </div>
          )}

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

          {/* Disponibilidade alterada à mão */}
          {(gruposFechados.length > 0 || gruposAbertos.length > 0 || gruposBarco.length > 0) && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] font-medium text-slate-500">
                Disponibilidade alterada <span className="text-slate-400">— entra ao salvar o roteiro</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {gruposFechados.map(g => (
                  <ChipDatas key={`f${g.inicio}`} grupo={g} icone={Lock} rotulo="Fechado"
                    cls="text-slate-700 bg-slate-100 border-slate-300 hover:bg-slate-200"
                    onRemover={() => desfazerExcecoes(intervaloISO(g.inicio, g.fim))} acao="Reabrir" />
                ))}
                {gruposAbertos.map(g => (
                  <ChipDatas key={`a${g.inicio}`} grupo={g} icone={LockOpen} rotulo="Aberto (fora da operação)"
                    cls="text-emerald-800 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                    onRemover={() => desfazerExcecoes(intervaloISO(g.inicio, g.fim))} acao="Desfazer a abertura de" />
                ))}
                {gruposBarco.map(g => (
                  <ChipDatas key={`b${g.inicio}`} grupo={g} icone={Ship} rotulo="Barco fechado"
                    cls="text-slate-700 bg-slate-200/70 border-slate-300 hover:bg-slate-300/70"
                    onRemover={() => reabrirBarco(intervaloISO(g.inicio, g.fim), false)} acao="Reabrir o barco em" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Quadro do valor (detalhe; o preço do dia se define na barra) ── */}
        <div className="w-full @4xl:w-80 shrink-0 space-y-4">
          {/* Você recebe × Cliente paga */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
              <Wallet className="w-4 h-4 text-[#0B2447]" />
              <p className="text-xs font-bold text-[#0B2447] uppercase tracking-wide">
                {quadroEhExemplo
                  ? 'Exemplo com o preço base'
                  : valorArredondado != null ? 'Com o novo preço' : unico ? 'Neste dia' : 'Dias selecionados'}
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
                  : unico
                    ? 'Este dia ainda não tem preço. Digite o novo preço para ver quanto o cliente paga e quanto você recebe.'
                    : 'Digite o novo preço para ver quanto o cliente paga e quanto você recebe.'}
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

function BotaoDisponibilidade({ icone: Icone, onClick, titulo, destaque, children }: {
  icone: React.ElementType; onClick: () => void; titulo: string; destaque?: boolean; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} title={titulo}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
        destaque
          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}>
      <Icone className="w-3.5 h-3.5" />
      {children}
    </button>
  );
}

function ChipDatas({ grupo, icone: Icone, rotulo, cls, onRemover, acao }: {
  grupo: { inicio: string; fim: string; dias: number };
  icone: React.ElementType; rotulo: string; cls: string; onRemover: () => void; acao: string;
}) {
  const datas = grupo.inicio === grupo.fim ? fmtCurto(grupo.inicio) : `${fmtCurto(grupo.inicio)} – ${fmtCurto(grupo.fim)}`;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border pl-2.5 pr-2 py-1 text-xs font-medium ${cls}`}>
      <Icone className="w-3 h-3 shrink-0" aria-hidden />
      {datas}
      {grupo.dias > 1 && <span className="text-[10px] opacity-70">· {grupo.dias} dias</span>}
      <span className="sr-only">{rotulo}</span>
      <button type="button" onClick={onRemover}
        className="w-6 h-6 sm:w-4 sm:h-4 -my-1 sm:my-0 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors"
        aria-label={`${acao} ${datas}`} title={`${acao} ${datas}`}>
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
