'use client';

import { useId, useState } from 'react';
import {
  Check, ChevronDown, ChevronRight, ChevronUp, Eye, HelpCircle, Plus, Repeat, Star, Sun, Trash2, Undo2,
} from 'lucide-react';
import CalendarioPrecos from '@/components/painel/CalendarioPrecos';
import IndicadorRolagem from '@/components/painel/IndicadorRolagem';
import {
  decomporPreco, previaDeFormulario, type RegraFormulario, type RegraPreco, type TipoRegraRecorrente,
} from '@/lib/precos-calendario';
import {
  JANELAS_RESERVA_MESES, type JanelaReservaMeses, type OcupacaoDia,
} from '@/lib/disponibilidade';
import { dataMaximaReservaISO, formatarData } from '@/lib/datas';

// ─── Constantes ───────────────────────────────────────────────────────────────

const DIAS_SEMANA = [
  { value: 0, label: 'Dom' }, { value: 1, label: 'Seg' }, { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' }, { value: 4, label: 'Qui' }, { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const DIAS_MES: Record<number, number> = {
  1: 31, 2: 29, 3: 31, 4: 30, 5: 31, 6: 30, 7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31,
};

/**
 * Tipos de regra do passo ③. Cores iguais às das células do `CalendarioPrecos`,
 * para ligar "a regra" a "onde ela vale". A data específica não está aqui: é
 * criada clicando no dia do calendário (passo ⑤).
 */
const TIPOS: {
  tipo: TipoRegraRecorrente; label: string; exemplo: string; icon: React.ElementType;
  sugestaoNome: string; placeholderNome: string;
  card: string; texto: string; selo: string;
}[] = [
  {
    tipo: 'periodo_anual', label: 'Período anual', exemplo: 'Verão, férias', icon: Sun,
    sugestaoNome: 'Alta temporada', placeholderNome: 'ex: Alta temporada',
    card: 'border-amber-200 bg-amber-50/70 hover:border-amber-300', texto: 'text-amber-700', selo: 'bg-amber-100 text-amber-700',
  },
  {
    tipo: 'dia_semana', label: 'Dias da semana', exemplo: 'Sábado e domingo', icon: Repeat,
    sugestaoNome: 'Fim de semana', placeholderNome: 'ex: Fim de semana',
    card: 'border-blue-200 bg-blue-50/70 hover:border-blue-300', texto: 'text-blue-700', selo: 'bg-blue-100 text-blue-700',
  },
];
const TIPO = Object.fromEntries(TIPOS.map(t => [t.tipo, t])) as Record<TipoRegraRecorrente, (typeof TIPOS)[number]>;

// Como o preço de cada data é decidido (aberto em "Saiba mais"). Espelha
// `resolverPrecoNaData` / `get_preco_roteiro`.
const PRECO_NIVEIS = [
  { nivel: 1, emoji: '📌', titulo: 'Data específica — vence sempre',
    desc: 'Preço que você define clicando no dia do calendário. Vale acima de qualquer regra, mesmo sendo menor. Ex: Réveillon 31/12 = ', exemplo: 'R$ 3.000',
    cardCls: 'border-violet-200 bg-violet-50/70', tituloCls: 'text-violet-700', descCls: 'text-violet-600', numCls: 'bg-violet-600' },
  { nivel: 2, emoji: '⚖️', titulo: 'Período anual e Dias da semana — vale o maior preço',
    desc: 'Se mais de uma regra valer na mesma data, o sistema cobra a de maior preço, seja qual for o tipo.', exemplo: '',
    cardCls: 'border-amber-200 bg-gradient-to-r from-amber-50/70 to-blue-50/70', tituloCls: 'text-slate-700', descCls: 'text-slate-600', numCls: 'bg-slate-600' },
  { nivel: 3, emoji: '🏷️', titulo: 'Preço padrão',
    desc: 'Aplicado quando nenhuma regra vale para a data.', exemplo: '',
    cardCls: 'border-slate-200 bg-white', tituloCls: 'text-slate-600', descCls: 'text-slate-400', numCls: 'bg-slate-400' },
] as const;

const inputCls = `w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800
  placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20
  focus:border-[#0B2447]/40 transition bg-white`;
const selectCls = `${inputCls} appearance-none cursor-pointer`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function resumoRegra(r: RegraPreco): string {
  if (r.tipo === 'dia_semana') {
    return [...(r.diasSemana ?? [])].sort().map(d => DIAS_SEMANA[d].label).join(', ');
  }
  if (r.tipo === 'periodo_anual') {
    const d = (dia?: number | null, mes?: number | null) => `${String(dia ?? 1).padStart(2, '0')}/${MESES[(mes ?? 1) - 1]}`;
    return `${d(r.periodoDiaInicio, r.periodoMesInicio)} → ${d(r.periodoDiaFim, r.periodoMesFim)} (todo ano)`;
  }
  return '';
}

function regraNova(tipo: TipoRegraRecorrente): RegraFormulario {
  return {
    tipo, nome: TIPO[tipo].sugestaoNome, valor: '',
    diasSemana: tipo === 'dia_semana' ? [0, 6] : [],
    periodoMesInicio: 12, periodoDiaInicio: 1,
    periodoMesFim: 2, periodoDiaFim: 28,
  };
}

/** O que ainda falta para adicionar a regra (null = pronta). */
function faltaNaRegra(r: RegraFormulario): string | null {
  if (!r.nome.trim()) return 'dê um nome à regra';
  if (!(parseFloat(r.valor) > 0)) return 'informe o preço';
  if (r.tipo === 'dia_semana' && r.diasSemana.length === 0) return 'escolha ao menos um dia da semana';
  return null;
}

function semAnimacao(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function irParaCalendario() {
  document.getElementById('calendario-precos')?.scrollIntoView({ behavior: semAnimacao() ? 'auto' : 'smooth', block: 'start' });
}

type NumPasso = 1 | 2 | 3 | 4;

/** "Sex, Sáb e Dom" / "Todos os dias" — semana começando na segunda. */
function descreverDias(dias: number[]): string {
  if (dias.length === 0 || dias.length === 7) return 'Todos os dias';
  const ordem = [1, 2, 3, 4, 5, 6, 0].filter(d => dias.includes(d)).map(d => DIAS_SEMANA[d].label);
  return ordem.length === 1 ? ordem[0] : `${ordem.slice(0, -1).join(', ')} e ${ordem[ordem.length - 1]}`;
}
type EstadoPasso = 'feito' | 'atual' | 'pendente';

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type RegraListada = {
  /** Mesmo id usado na `regra` (id do banco ou id local). */
  id: string;
  regra: RegraPreco;
  /** `salva` = já no banco; `nova` = adicionada nesta sessão; `excluir` = salva, marcada para exclusão. */
  estado: 'salva' | 'nova' | 'excluir';
};

type Props = {
  precoBase: string;
  onPrecoBaseChange: (v: string) => void;
  diariaAtivo: boolean;
  onDiariaAtivoChange: (v: boolean) => void;
  diariaValor: string;
  onDiariaValorChange: (v: string) => void;
  diariaMinimo: string;
  onDiariaMinimoChange: (v: string) => void;

  regras: RegraListada[];
  onAdicionarRegra: (r: RegraFormulario) => void;
  /** Regra salva: marca/desmarca a exclusão. Regra nova: remove. */
  onRemoverRegra: (id: string) => void;

  ajustes: Record<string, number>;
  onAjustesChange: (ajustes: Record<string, number>) => void;

  /** Dias da semana de operação (0=Dom..6=Sáb). Vazio = todos. */
  diasOperacao: number[];
  onDiasOperacaoChange: (dias: number[]) => void;
  /** Até quantos meses à frente o cliente pode reservar. */
  janelaMeses: JanelaReservaMeses;
  onJanelaMesesChange: (meses: JanelaReservaMeses) => void;
  /** Exceções do roteiro: false = dia fechado; true = dia aberto fora da operação. */
  diasRoteiro: Record<string, boolean>;
  onDiasRoteiroChange: (dias: Record<string, boolean>) => void;
  /** Dias com o barco inteiro fechado. null = roteiro sem embarcação. */
  fechamentosBarco: string[] | null;
  onFechamentosBarcoChange: (datas: string[]) => void;
  /** Reservas que ocupam dias — deste roteiro ou de outro roteiro do mesmo barco. */
  ocupacao: OcupacaoDia[];
  pedidosPendentes?: Record<string, number>;
  taxaPercent: number;

  /** A etapa Preço está visível (liga o atalho flutuante até o calendário). */
  ativa: boolean;
};

/**
 * Etapa "Preço e disponibilidade" do cadastro/edição de roteiro, em passos
 * guiados: ① como o cliente paga → ② preço padrão → ③ quando o roteiro opera
 * (dias da semana + janela de reservas) → ④ preços especiais (regras).
 * Os passos ①–④ são um accordion (um aberto por vez; ao entrar, só o passo da
 * vez aberto): número enquanto pendente, ✓ quando concluído, "Próximo passo"
 * abre o seguinte. O calendário (⑤) — o mesmo que o cliente vê — fica sempre
 * à vista (ao lado em telas ≥ xl, logo abaixo nas demais): preço e
 * disponibilidade de cada dia, com o que ainda não foi salvo.
 */
export default function EtapaPreco({
  precoBase, onPrecoBaseChange, diariaAtivo, onDiariaAtivoChange,
  diariaValor, onDiariaValorChange, diariaMinimo, onDiariaMinimoChange,
  regras, onAdicionarRegra, onRemoverRegra,
  ajustes, onAjustesChange, diasOperacao, onDiasOperacaoChange, janelaMeses, onJanelaMesesChange,
  diasRoteiro, onDiasRoteiroChange, fechamentosBarco, onFechamentosBarcoChange, ocupacao, pedidosPendentes,
  taxaPercent, ativa,
}: Props) {
  const [rf, setRf] = useState<RegraFormulario | null>(null);
  const [destaqueId, setDestaqueId] = useState<string | null>(null);
  const [verTaxa, setVerTaxa] = useState(false);
  const [saibaMais, setSaibaMais] = useState(false);
  const [confirmados, setConfirmados] = useState<NumPasso[]>([]);
  const uid = useId();
  const idPasso = (n: NumPasso) => `${uid}-passo-${n}`;

  const precoBaseNum = precoBase !== '' && parseFloat(precoBase) >= 0 ? parseFloat(precoBase) : null;
  const decomposicao = precoBaseNum != null && precoBaseNum > 0 ? decomporPreco(precoBaseNum, taxaPercent) : null;

  const ativas = regras.filter(r => r.estado !== 'excluir');
  const regrasCalendario = ativas.map(r => r.regra);
  const destaque = ativas.find(r => r.id === destaqueId) ?? null;
  const previaForm = rf ? previaDeFormulario(rf) : null;
  const previa = rf ? previaForm : destaque?.regra ?? null;
  const falta = rf ? faltaNaRegra(rf) : null;
  const mostrarSeloNova = regras.some(r => r.estado !== 'nova');

  // Lista agrupada por tipo (período anual, depois dias da semana), estável dentro do tipo.
  // Datas específicas não entram: os forms as passam em `ajustes`.
  const ordem = (t: TipoRegraRecorrente) => TIPOS.findIndex(x => x.tipo === t);
  const lista = regras
    .filter(r => r.regra.tipo !== 'data_fixa')
    .sort((a, b) => ordem(a.regra.tipo as TipoRegraRecorrente) - ordem(b.regra.tipo as TipoRegraRecorrente));
  const totalDatasEspecificas = Object.keys(ajustes).length;

  const passo1Ok = !diariaAtivo || parseFloat(diariaValor) > 0;
  const passo2Ok = precoBaseNum != null && precoBaseNum > 0;
  const temEspeciais = ativas.length > 0 || totalDatasEspecificas > 0;
  // Roteiro que já chegou com preço (edição): os passos com padrão válido contam como feitos.
  const [jaConfigurado] = useState(passo2Ok);
  const dataMaxima = dataMaximaReservaISO(janelaMeses);

  // ① e ③ já nascem válidos (só Roteiro; todos os dias, 3 meses): contam como
  // feitos quando o gestor confirma o passo ou o roteiro já estava configurado
  // (① também quando o preço padrão já existe). ④ é opcional: feito com algum
  // preço especial ou ao concluir sem nenhum.
  const feito: Record<NumPasso, boolean> = {
    1: passo1Ok && (confirmados.includes(1) || passo2Ok),
    2: passo2Ok,
    3: confirmados.includes(3) || jaConfigurado,
    4: temEspeciais || confirmados.includes(4),
  };
  const proximo = ([1, 2, 3, 4] as const).find(n => !feito[n]) ?? 5;
  // Ao montar, o passo da vez (primeiro pendente) já vem aberto e os demais
  // fechados — no cadastro novo, o ①. Com tudo concluído (edição), todos fechados.
  const [aberto, setAberto] = useState<NumPasso | null>(() => (proximo === 5 ? null : proximo));
  const estado = (n: NumPasso): EstadoPasso =>
    feito[n] ? 'feito' : aberto === n || proximo === n ? 'atual' : 'pendente';

  const resumo1 = diariaAtivo && passo1Ok
    ? `Roteiro (diária única) + Por diária: ${brl(parseFloat(diariaValor))}${parseInt(diariaMinimo) > 1 ? ` · mín. ${parseInt(diariaMinimo)} diárias` : ''}`
    : 'Roteiro (diária única)';
  const resumo2 = decomposicao && precoBaseNum != null
    ? `${brl(precoBaseNum)} / dia · cliente paga ${brl(decomposicao.clientePaga)}`
    : undefined;
  const resumo3 = `${descreverDias(diasOperacao)} · reservas até ${formatarData(dataMaxima)}`;
  const resumo4 = temEspeciais
    ? [
        ativas.length > 0 && `${ativas.length} ${ativas.length === 1 ? 'regra' : 'regras'}`,
        totalDatasEspecificas > 0 && `${totalDatasEspecificas} ${totalDatasEspecificas === 1 ? 'data específica' : 'datas específicas'}`,
      ].filter(Boolean).join(' · ')
    : 'Nenhum preço especial';

  function alternarPasso(n: NumPasso) {
    // A regra em destaque só faz sentido com a lista à vista.
    if (aberto === 4) setDestaqueId(null);
    setAberto(a => (a === n ? null : n));
  }

  /** "Próximo passo" / "Concluir": marca o passo e abre o seguinte (o ④ só fecha). */
  function concluirPasso(n: NumPasso) {
    setConfirmados(c => (c.includes(n) ? c : [...c, n]));
    if (n === 4) setDestaqueId(null);
    const seguinte = n < 4 ? ((n + 1) as NumPasso) : null;
    setAberto(seguinte);
    if (!seguinte) return;
    requestAnimationFrame(() => {
      const secao = document.getElementById(idPasso(seguinte));
      secao?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
      secao?.scrollIntoView({ block: 'nearest', behavior: semAnimacao() ? 'auto' : 'smooth' });
    });
  }

  function abrirRegra(tipo: TipoRegraRecorrente) {
    setDestaqueId(null);
    setRf(regraNova(tipo));
  }

  function trocarTipo(tipo: TipoRegraRecorrente) {
    setRf(r => {
      if (!r) return r;
      const nomeEhSugestao = !r.nome.trim() || TIPOS.some(t => t.sugestaoNome === r.nome);
      return {
        ...r, tipo,
        nome: nomeEhSugestao ? TIPO[tipo].sugestaoNome : r.nome,
        diasSemana: tipo === 'dia_semana' && r.diasSemana.length === 0 ? [0, 6] : r.diasSemana,
      };
    });
  }

  function setRfCampo<K extends keyof RegraFormulario>(k: K, v: RegraFormulario[K]) {
    setRf(r => (r ? { ...r, [k]: v } : r));
  }

  function toggleDia(d: number) {
    setRf(r => r && ({
      ...r,
      diasSemana: r.diasSemana.includes(d) ? r.diasSemana.filter(x => x !== d) : [...r.diasSemana, d].sort(),
    }));
  }

  function adicionar() {
    if (!rf || faltaNaRegra(rf)) return;
    onAdicionarRegra(rf);
    setRf(null);
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8 xl:items-start">
      {/* ── Passos 1–3 ─────────────────────────────────────────────────────── */}
      <div className="xl:col-span-5 @container min-w-0 space-y-3">

        {/* ① Como o cliente paga */}
        <Passo n={1} id={idPasso(1)} titulo="Como o cliente paga" estado={estado(1)}
          aberto={aberto === 1} onAlternar={() => alternarPasso(1)}
          resumo={feito[1] ? resumo1 : undefined}
          pendencia={diariaAtivo && !passo1Ok ? 'Falta o valor da diária' : undefined}
          subtitulo="Ative quantos modelos quiser — o cliente vê e escolhe entre os disponíveis ao reservar.">
          <div className="grid grid-cols-1 @xs:grid-cols-2 gap-2">
            <div className="flex items-start gap-2.5 rounded-xl border border-[#0B2447]/20 bg-[#0B2447]/[0.03] p-3">
              <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded bg-[#0B2447] text-white shrink-0">
                <Check className="w-3 h-3" strokeWidth={3} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#0B2447] leading-tight">Roteiro (diária única)</span>
                <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">
                  O cliente reserva o roteiro inteiro por um dia. Preço nos passos 2 e 3.
                </span>
              </span>
            </div>
            <button type="button" onClick={() => onDiariaAtivoChange(!diariaAtivo)} aria-pressed={diariaAtivo}
              className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                diariaAtivo ? 'border-[#0B2447]/20 bg-[#0B2447]/[0.03]' : 'border-slate-200 hover:border-slate-300'
              }`}>
              <span className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border-2 shrink-0 ${
                diariaAtivo ? 'bg-[#0B2447] border-[#0B2447] text-white' : 'border-slate-300'
              }`}>
                {diariaAtivo && <Check className="w-3 h-3" strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#0B2447] leading-tight">Por diária</span>
                <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Passeio de vários dias — o cliente escolhe a data de saída e quantas diárias quer.
                </span>
              </span>
            </button>
          </div>

          {diariaAtivo && (
            <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Valor da diária<span className="text-red-500 ml-0.5">*</span>
                </label>
                <CampoReais value={diariaValor} onChange={onDiariaValorChange} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Diárias mínimas</label>
                <input className={inputCls} type="number" min="1" step="1" placeholder="1" inputMode="numeric"
                  value={diariaMinimo} onChange={e => onDiariaMinimoChange(e.target.value)} />
              </div>
              <p className="col-span-2 text-[11px] text-slate-400 -mt-1">
                Diárias mínimas: menor quantidade de diárias que o cliente pode reservar.
              </p>
            </div>
          )}

          <RodapePasso rotulo="Próximo passo" falta={passo1Ok ? null : 'valor da diária'} onClick={() => concluirPasso(1)} />
        </Passo>

        {/* ② Preço padrão */}
        <Passo n={2} id={idPasso(2)} titulo="Preço padrão por dia" estado={estado(2)}
          aberto={aberto === 2} onAlternar={() => alternarPasso(2)}
          resumo={feito[2] ? resumo2 : undefined}
          subtitulo="Aplicado quando nenhuma regra específica estiver vigente na data da reserva.">
          <div className="max-w-[14rem]">
            <CampoReais value={precoBase} onChange={onPrecoBaseChange} sufixo="/ dia" />
          </div>

          <div className="mt-2 text-xs text-slate-500">
            {decomposicao ? (
              <p>
                Cliente paga <strong className="text-[#0B2447]">{brl(decomposicao.clientePaga)}</strong>
                <span className="text-slate-300 mx-1.5">·</span>
                Você recebe <strong className="text-emerald-700">{brl(decomposicao.voceRecebe)}</strong>
              </p>
            ) : (
              <p className="text-slate-400">Digite o preço para ver quanto o cliente paga e quanto você recebe.</p>
            )}
            <button type="button" onClick={() => setVerTaxa(v => !v)} aria-expanded={verTaxa}
              className="mt-1 inline-flex items-center gap-1 font-semibold text-[#0B3D91] hover:text-[#0B2447]">
              Entenda a taxa do Boatzy ({fmtPct(taxaPercent)}%)
              {verTaxa ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {verTaxa && (
              <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50/70 p-3 text-xs leading-relaxed text-sky-900">
                <p className="font-semibold">
                  Taxa do Boatzy: {fmtPct(taxaPercent)}% — paga pelo cliente, por cima do seu preço
                </p>
                <p className="mt-0.5 text-sky-800/90">
                  O cliente paga o <strong>preço que você define + a taxa</strong>. Você recebe{' '}
                  <strong>100% do preço definido</strong>, sem desconto. Cupons saem da taxa do Boatzy, nunca do seu valor.
                  A taxa vale a do momento em que o cliente solicita a reserva.
                </p>
              </div>
            )}
          </div>

          <RodapePasso rotulo="Próximo passo" falta={passo2Ok ? null : 'o preço padrão'} onClick={() => concluirPasso(2)} />
        </Passo>

        {/* ③ Quando o roteiro opera */}
        <Passo n={3} id={idPasso(3)} titulo="Quando o roteiro opera" estado={estado(3)}
          aberto={aberto === 3} onAlternar={() => alternarPasso(3)}
          resumo={feito[3] ? resumo3 : undefined}
          subtitulo="Dias da semana em que o passeio sai e até quando os clientes podem reservar.">
          <div>
            <p className="text-xs font-medium text-slate-600 mb-1.5">Dias de operação</p>
            <div className="grid grid-cols-7 gap-1" role="group" aria-label="Dias de operação">
              {DIAS_SEMANA.map(d => {
                const on = diasOperacao.length === 0 || diasOperacao.includes(d.value);
                return (
                  <button key={d.value} type="button" aria-pressed={on}
                    onClick={() => {
                      const base = diasOperacao.length === 0 ? DIAS_SEMANA.map(x => x.value) : diasOperacao;
                      const novo = on ? base.filter(x => x !== d.value) : [...base, d.value].sort();
                      if (novo.length === 0) return; // pelo menos um dia
                      onDiasOperacaoChange(novo.length === 7 ? [] : novo);
                    }}
                    className={`h-10 rounded-lg text-xs font-bold transition-all ${
                      on ? 'bg-[#0B2447] text-white shadow-md shadow-[#0B2447]/20' : 'bg-white border border-slate-200 text-slate-500 hover:border-[#0B2447]/30'
                    }`}>
                    {d.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400 leading-snug">
              {descreverDias(diasOperacao)}. Nos outros dias o roteiro fica fechado — dá para abrir um dia específico no calendário (ex.: feriado).
            </p>
          </div>

          <div className="mt-4">
            <p className="text-xs font-medium text-slate-600 mb-1.5">Abrir reservas para os próximos</p>
            <div className="grid grid-cols-4 gap-1 bg-slate-100 rounded-xl p-1" role="radiogroup" aria-label="Janela de reservas">
              {JANELAS_RESERVA_MESES.map(m => (
                <button key={m} type="button" role="radio" aria-checked={janelaMeses === m} onClick={() => onJanelaMesesChange(m)}
                  className={`rounded-lg py-2 text-xs font-semibold transition-all ${
                    janelaMeses === m ? 'bg-white text-[#0B2447] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {m === 12 ? '1 ano' : `${m} meses`}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 leading-snug">
              Clientes podem reservar até <strong className="text-[#0B2447]">{formatarData(dataMaxima)}</strong>. Os dias depois disso
              aparecem no calendário como fora da janela — você já pode deixar preço e disponibilidade prontos.
            </p>
          </div>

          <RodapePasso rotulo="Próximo passo" onClick={() => concluirPasso(3)} />
        </Passo>

        {/* ④ Preços especiais */}
        <Passo n={4} id={idPasso(4)} titulo="Preços especiais" estado={estado(4)} opcional
          aberto={aberto === 4} onAlternar={() => alternarPasso(4)}
          resumo={feito[4] ? resumo4 : undefined}
          subtitulo="Cobre diferente em temporadas ou dias da semana — e veja no calendário onde cada preço vale.">

          {!rf ? (
            <>
              <p className="text-xs font-medium text-slate-600 mb-2">Escolha o tipo de preço especial:</p>
              <div className="grid grid-cols-2 gap-2">
                {TIPOS.map(t => (
                  <button key={t.tipo} type="button" onClick={() => abrirRegra(t.tipo)}
                    className={`group flex flex-col items-center gap-1 rounded-xl border px-1.5 pt-3 pb-2.5 text-center transition-all hover:shadow-sm ${t.card}`}>
                    <t.icon className={`w-5 h-5 ${t.texto}`} />
                    <span className={`text-xs font-bold leading-tight ${t.texto}`}>{t.label}</span>
                    <span className="text-[10px] text-slate-500 leading-tight">{t.exemplo}</span>
                    <span className={`mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-semibold ${t.texto} opacity-70 group-hover:opacity-100`}>
                      <Plus className="w-3 h-3" /> Criar
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <FormRegra
              rf={rf} falta={falta} temPrevia={!!previaForm}
              onTipo={trocarTipo} onCampo={setRfCampo} onToggleDia={toggleDia}
              onCancelar={() => setRf(null)} onAdicionar={adicionar}
            />
          )}

          {/* Data específica: definida direto no calendário */}
          <div className="mt-2 flex items-start gap-2.5 rounded-xl border border-dashed border-violet-200 bg-violet-50/50 px-3 py-2.5">
            <Star className="w-4 h-4 shrink-0 mt-px text-violet-600" />
            <div className="min-w-0 text-[11px] leading-snug text-slate-600">
              <p>
                <strong className="text-violet-700">Data específica</strong> (Réveillon, feriados)? Clique no dia no calendário{' '}
                <span className="xl:hidden">abaixo</span><span className="hidden xl:inline">ao lado</span> e defina o preço.
                Ele <strong className="text-slate-700">vale acima de qualquer regra</strong>.
              </p>
              <button type="button" onClick={irParaCalendario}
                className="xl:hidden mt-1 font-semibold text-violet-700 hover:text-violet-900">
                Ir para o calendário ↓
              </button>
            </div>
          </div>

          {/* Conflito entre regras: uma linha + explicação completa sob demanda */}
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500 leading-relaxed">
            Se duas regras valerem no mesmo dia, vale a de <strong className="text-slate-700">maior preço</strong>.
            {' '}A <span className="font-semibold text-violet-700">data específica</span> vence sempre.{' '}
            <button type="button" onClick={() => setSaibaMais(v => !v)} aria-expanded={saibaMais}
              className="inline-flex items-center gap-0.5 font-semibold text-[#0B3D91] hover:text-[#0B2447]">
              <HelpCircle className="w-3 h-3" /> {saibaMais ? 'Fechar' : 'Saiba mais'}
            </button>
          </div>

          {saibaMais && (
            <div className="mt-2 rounded-xl border border-slate-100 bg-white p-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Para cada data, o sistema decide o preço nesta ordem:
              </p>
              <ol className="mt-2 space-y-1.5">
                {PRECO_NIVEIS.map(n => (
                  <li key={n.nivel} className={`flex items-start gap-2.5 rounded-lg border p-2.5 ${n.cardCls}`}>
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${n.numCls}`}>
                      {n.nivel}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold ${n.tituloCls}`}>{n.emoji} {n.titulo}</p>
                      <p className={`text-[11px] leading-relaxed ${n.descCls}`}>
                        {n.desc}{n.exemplo && <strong>{n.exemplo}</strong>}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-[11px] text-slate-500 leading-relaxed bg-slate-100/70 rounded-lg p-2.5">
                💡 Um sábado de janeiro está no Verão (<strong>R$ 2.000</strong>) e no Fim de semana (R$ 1.500): o sistema cobra{' '}
                <strong>R$ 2.000</strong>, o maior. Se você definir no calendário <strong>R$ 1.800</strong> para esse sábado,
                vale R$ 1.800 — a data específica vence sempre, mesmo sendo menor.
              </p>
            </div>
          )}

          {/* Regras criadas */}
          {lista.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Suas regras ({ativas.length})
                <span className="ml-1.5 font-medium normal-case tracking-normal text-slate-400">— toque para ver no calendário</span>
              </p>
              <ul className="rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                {lista.map(item => {
                  const t = TIPO[item.regra.tipo as TipoRegraRecorrente];
                  const excluir = item.estado === 'excluir';
                  const emDestaque = !rf && destaque?.id === item.id;
                  return (
                    <li key={item.id} className={`flex items-center gap-1 pr-1 transition-colors ${
                      emDestaque ? 'bg-[#0B3D91]/[0.06]' : 'bg-white'
                    }`}>
                      <button type="button" disabled={excluir}
                        onClick={() => { setRf(null); setDestaqueId(emDestaque ? null : item.id); }}
                        aria-pressed={emDestaque}
                        title={excluir ? undefined : 'Ver no calendário onde esta regra vale'}
                        className="flex-1 min-w-0 flex items-center gap-2.5 pl-3 py-2.5 text-left disabled:cursor-default">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${t.selo} ${excluir ? 'opacity-40' : ''}`}>
                          <t.icon className="w-3.5 h-3.5" />
                        </span>
                        <span className={`min-w-0 flex-1 ${excluir ? 'opacity-50' : ''}`}>
                          <span className="flex items-center gap-1.5">
                            <span className={`text-sm font-semibold text-[#0B2447] truncate ${excluir ? 'line-through' : ''}`}>
                              {item.regra.nome}
                            </span>
                            {item.estado === 'nova' && mostrarSeloNova && (
                              <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-emerald-700">nova</span>
                            )}
                            {excluir && (
                              <span className="shrink-0 text-[10px] font-semibold text-red-500">será excluída</span>
                            )}
                          </span>
                          <span className="block text-[11px] text-slate-400 leading-snug">
                            {t.label} · {resumoRegra(item.regra)}
                          </span>
                        </span>
                        <span className={`shrink-0 text-sm font-bold whitespace-nowrap ${excluir ? 'text-slate-400 line-through' : 'text-emerald-700'}`}>
                          {brl(item.regra.valor)}
                        </span>
                        {emDestaque && <Eye className="w-3.5 h-3.5 shrink-0 text-[#0B3D91]" aria-label="Em destaque no calendário" />}
                      </button>
                      <button type="button" onClick={() => { if (destaqueId === item.id) setDestaqueId(null); onRemoverRegra(item.id); }}
                        aria-label={excluir ? `Desfazer exclusão de ${item.regra.nome}` : `Excluir ${item.regra.nome}`}
                        title={excluir ? 'Desfazer exclusão' : 'Excluir regra'}
                        className={`w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg transition-colors shrink-0 ${
                          excluir ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'
                        }`}>
                        {excluir ? <Undo2 className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {!rf && <RodapePasso rotulo="Concluir" icone="check" onClick={() => concluirPasso(4)} />}
        </Passo>
      </div>

      {/* ── ④ Calendário ───────────────────────────────────────────────────── */}
      <div id="calendario-precos" className="xl:col-span-7 min-w-0 scroll-mt-24 xl:sticky xl:top-4
        border-t border-slate-100 pt-6 xl:border-t-0 xl:pt-0">
        <div className="flex items-center gap-2.5 mb-1">
          <NumeroPasso n={5} estado={proximo === 5 ? 'atual' : 'pendente'} />
          <p className="text-sm font-bold text-[#0B2447]">Confira e ajuste no calendário</p>
        </div>
        <p className="text-xs text-slate-400 mb-4 sm:pl-8">
          Preço e disponibilidade de cada dia — <strong>é este calendário que o cliente vê</strong> na página do roteiro.
          Vale para o modelo <strong>Roteiro (diária única)</strong>; a disponibilidade vale também para Por diária.
        </p>
        <CalendarioPrecos
          precoBase={precoBaseNum}
          regras={regrasCalendario}
          ajustes={ajustes}
          onAjustesChange={onAjustesChange}
          diasOperacao={diasOperacao}
          janelaMeses={janelaMeses}
          diasRoteiro={diasRoteiro}
          onDiasRoteiroChange={onDiasRoteiroChange}
          fechamentosBarco={fechamentosBarco}
          onFechamentosBarcoChange={onFechamentosBarcoChange}
          ocupacao={ocupacao}
          pedidosPendentes={pedidosPendentes}
          taxaPercent={taxaPercent}
          previaRegra={previa}
          previaTitulo={rf ? undefined : destaque ? `Onde vale a regra “${destaque.regra.nome}”` : undefined}
        />
      </div>

      <IndicadorRolagem
        alvoId="calendario-precos"
        ativo={ativa}
        rotulo={previa ? 'Ver a prévia no calendário' : 'Ver o calendário de preços'}
      />
    </div>
  );
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function fmtPct(p: number): string {
  return p.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

const NUMERO_CLS: Record<EstadoPasso, string> = {
  feito: 'bg-emerald-500 text-white',
  atual: 'bg-[#0B2447] text-white',
  pendente: 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200',
};

function NumeroPasso({ n, estado }: { n: number; estado: EstadoPasso }) {
  return (
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${NUMERO_CLS[estado]}`}>
      {estado === 'feito'
        ? <Check className="w-3.5 h-3.5" strokeWidth={3} aria-label="Passo concluído" />
        : n}
    </span>
  );
}

/**
 * Item do accordion: o cabeçalho é um botão (abre/fecha) e o conteúdo anima a
 * altura (grid 0fr → 1fr). Fechado, o conteúdo fica `inert` (fora do Tab) e o
 * cabeçalho mostra o resumo do passo concluído ou o que falta.
 */
function Passo({ n, id, titulo, subtitulo, estado, aberto, onAlternar, resumo, pendencia, opcional, children }: {
  n: NumPasso; id: string; titulo: string; subtitulo: string; estado: EstadoPasso;
  aberto: boolean; onAlternar: () => void;
  /** Mostrado no lugar do subtítulo quando o passo está concluído e fechado. */
  resumo?: string;
  /** Aviso (âmbar) no lugar do subtítulo quando o passo está fechado com algo faltando. */
  pendencia?: string;
  opcional?: boolean; children: React.ReactNode;
}) {
  const linha = !aberto && pendencia ? pendencia : !aberto && resumo ? resumo : subtitulo;
  return (
    <section id={id} className={`scroll-mt-24 rounded-2xl border bg-white transition-[border-color,box-shadow] ${
      aberto
        ? 'border-[#0B2447]/20 shadow-sm'
        : estado === 'atual' ? 'border-[#0B2447]/15 hover:border-[#0B2447]/30' : 'border-slate-200 hover:border-slate-300'
    }`}>
      <h3>
        <button type="button" id={`${id}-cab`} onClick={onAlternar} aria-expanded={aberto} aria-controls={`${id}-conteudo`}
          className="w-full flex items-start gap-2.5 rounded-2xl p-4 text-left">
          <NumeroPasso n={n} estado={estado} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-[#0B2447] leading-6">
              {titulo}
              {opcional && (
                <span className="ml-2 align-middle rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">opcional</span>
              )}
            </span>
            <span className={`block text-xs leading-snug ${
              !aberto && pendencia ? 'font-medium text-amber-700'
                : !aberto && resumo ? 'font-medium text-slate-600'
                  : 'text-slate-400'
            }`}>
              {linha}
            </span>
          </span>
          <ChevronDown className={`mt-1 w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 motion-reduce:transition-none ${
            aberto ? 'rotate-180' : ''
          }`} aria-hidden />
        </button>
      </h3>
      <div id={`${id}-conteudo`} role="region" aria-labelledby={`${id}-cab`} inert={!aberto}
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
          aberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4 sm:pl-[3.125rem]">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** Rodapé do passo aberto: avança (ou conclui) quando o passo está válido. */
function RodapePasso({ rotulo, onClick, falta = null, icone = 'seta' }: {
  rotulo: string; onClick: () => void; falta?: string | null; icone?: 'seta' | 'check';
}) {
  return (
    <div className="mt-4 flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
      {falta && <span className="text-[11px] text-slate-400 text-right">Falta: {falta}</span>}
      <button type="button" onClick={onClick} disabled={!!falta}
        className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-xs font-semibold px-4 py-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
        {rotulo}
        {icone === 'check' ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function CampoReais({ value, onChange, sufixo, autoFocus }: {
  value: string; onChange: (v: string) => void; sufixo?: string; autoFocus?: boolean;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">R$</span>
      <input className={`${inputCls} pl-10 ${sufixo ? 'pr-14' : ''}`} type="number" min="0" step="0.01"
        inputMode="decimal" placeholder="0,00" autoFocus={autoFocus}
        value={value} onChange={e => onChange(e.target.value)} />
      {sufixo && (
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">{sufixo}</span>
      )}
    </div>
  );
}

function FormRegra({ rf, falta, temPrevia, onTipo, onCampo, onToggleDia, onCancelar, onAdicionar }: {
  rf: RegraFormulario;
  falta: string | null;
  temPrevia: boolean;
  onTipo: (t: TipoRegraRecorrente) => void;
  onCampo: <K extends keyof RegraFormulario>(k: K, v: RegraFormulario[K]) => void;
  onToggleDia: (d: number) => void;
  onCancelar: () => void;
  onAdicionar: () => void;
}) {
  const t = TIPO[rf.tipo];
  return (
    <div className="rounded-xl border-2 border-[#0B2447]/15 bg-slate-50/60 p-3.5 space-y-3.5">
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nova regra</p>
        <div className="grid grid-cols-2 gap-1 bg-slate-100 rounded-xl p-1" role="tablist" aria-label="Tipo de regra">
          {TIPOS.map(x => (
            <button key={x.tipo} type="button" role="tab" aria-selected={rf.tipo === x.tipo} onClick={() => onTipo(x.tipo)}
              className={`flex items-center justify-center gap-1.5 px-1 py-2 rounded-lg text-[11px] leading-tight font-semibold transition-all ${
                rf.tipo === x.tipo ? `bg-white shadow-sm ${x.texto}` : 'text-slate-500 hover:text-slate-700'
              }`}>
              <x.icon className="w-3.5 h-3.5 shrink-0" />
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Nome da regra<span className="text-red-500 ml-0.5">*</span></label>
          <input className={inputCls} placeholder={t.placeholderNome}
            value={rf.nome} onChange={e => onCampo('nome', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Preço nesses dias<span className="text-red-500 ml-0.5">*</span></label>
          <CampoReais value={rf.valor} onChange={v => onCampo('valor', v)} sufixo="/ dia" autoFocus />
        </div>
      </div>

      {rf.tipo === 'dia_semana' && (
        <div>
          <p className="text-xs font-medium text-slate-600 mb-1">Dias da semana<span className="text-red-500 ml-0.5">*</span></p>
          <div className="grid grid-cols-7 gap-1">
            {DIAS_SEMANA.map(d => {
              const on = rf.diasSemana.includes(d.value);
              return (
                <button key={d.value} type="button" onClick={() => onToggleDia(d.value)} aria-pressed={on}
                  className={`h-10 rounded-lg text-xs font-bold transition-all ${
                    on ? 'bg-[#0B2447] text-white shadow-md shadow-[#0B2447]/20' : 'bg-white border border-slate-200 text-slate-500 hover:border-[#0B2447]/30'
                  }`}>
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {rf.tipo === 'periodo_anual' && (
        <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
          {([
            { rotulo: 'Início', mes: 'periodoMesInicio', dia: 'periodoDiaInicio' },
            { rotulo: 'Fim', mes: 'periodoMesFim', dia: 'periodoDiaFim' },
          ] as const).map(c => (
            <div key={c.rotulo}>
              <p className="text-xs font-medium text-slate-600 mb-1">{c.rotulo}<span className="text-red-500 ml-0.5">*</span></p>
              {/* Grid (não flex) para o mês nunca disputar largura com o dia. */}
              <div className="grid grid-cols-[1fr_5.5rem] gap-2">
                <select className={selectCls} aria-label={`Mês de ${c.rotulo.toLowerCase()}`}
                  value={rf[c.mes]} onChange={e => onCampo(c.mes, parseInt(e.target.value))}>
                  {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <select className={selectCls} aria-label={`Dia de ${c.rotulo.toLowerCase()}`}
                  value={rf[c.dia]} onChange={e => onCampo(c.dia, parseInt(e.target.value))}>
                  {Array.from({ length: DIAS_MES[rf[c.mes]] }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>{String(d).padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          <p className="@md:col-span-2 text-[11px] text-slate-400">
            💡 Repete todo ano. Para períodos que cruzam o ano (ex: Dez → Mar), o sistema identifica automaticamente.
          </p>
        </div>
      )}

      <p className={`flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-[11px] leading-snug ${
        temPrevia ? 'bg-[#0B3D91]/[0.06] text-[#0B2447]' : 'bg-white text-slate-500 border border-slate-100'
      }`}>
        <Eye className="w-3.5 h-3.5 shrink-0 mt-px" />
        {temPrevia ? (
          <span>
            Prévia ligada: os dias destacados no calendário{' '}
            <span className="xl:hidden">abaixo</span><span className="hidden xl:inline">ao lado</span>{' '}
            mostram onde esta regra vai valer.
          </span>
        ) : (
          <span>Preencha o preço{rf.tipo === 'dia_semana' ? ' e os dias' : ''} para ver a prévia no calendário.</span>
        )}
      </p>

      <div className="flex items-center gap-2">
        <button type="button" onClick={onCancelar}
          className="px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors">
          Cancelar
        </button>
        <div className="flex-1 flex flex-col items-end gap-1">
          <button type="button" onClick={onAdicionar} disabled={!!falta}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Plus className="w-3.5 h-3.5" />
            Adicionar regra
          </button>
          {falta && <span className="text-[10px] text-slate-400 text-right">Falta: {falta}</span>}
        </div>
      </div>
    </div>
  );
}
