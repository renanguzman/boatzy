'use client';

import { useState } from 'react';
import {
  ChevronLeft, ChevronRight, X, MousePointerClick, CalendarRange, CalendarX2, CalendarCheck2, ListChecks,
} from 'lucide-react';
import { hojeISO } from '@/lib/datas';

const DIAS_SEMANA = [
  { value: 0, label: 'Dom' }, { value: 1, label: 'Seg' }, { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' }, { value: 4, label: 'Qui' }, { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DOW_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Datas trafegam como 'yyyy-mm-dd'; a aritmética é feita em UTC para nunca
// sofrer deslocamento de fuso.
function isoDe(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}
function utc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function somarDias(iso: string, n: number): string {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function diaDaSemana(iso: string): number {
  return utc(iso).getUTCDay();
}
function intervalo(a: string, b: string): string[] {
  const [ini, fim] = a <= b ? [a, b] : [b, a];
  const dias: string[] = [];
  for (let d = ini; d <= fim; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

function fmtBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function fmtIntervalo(ini: string, fim: string): string {
  const [yi, mi, di] = ini.split('-');
  const [yf, mf, df] = fim.split('-');
  return yi === yf ? `${di}/${mi} – ${df}/${mf}/${yf}` : `${di}/${mi}/${yi} – ${df}/${mf}/${yf}`;
}

/** Agrupa datas consecutivas em intervalos para a lista de bloqueios. */
function agruparConsecutivas(datas: string[]): { inicio: string; fim: string; dias: string[] }[] {
  const grupos: { inicio: string; fim: string; dias: string[] }[] = [];
  for (const d of [...new Set(datas)].sort()) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && somarDias(ultimo.fim, 1) === d) {
      ultimo.fim = d;
      ultimo.dias.push(d);
    } else {
      grupos.push({ inicio: d, fim: d, dias: [d] });
    }
  }
  return grupos;
}

const NOMES_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const NOMES_DIA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function juntar(itens: string[]): string {
  return itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

/** [5, 6, 0] → "sexta a domingo"; [1, 3] → "segunda e quarta" (semana começando na segunda). */
function descreverDiasSemana(dias: number[]): string {
  const ordem = [...new Set(dias)].map(d => (d + 6) % 7).sort((a, b) => a - b);
  const blocos: number[][] = [];
  for (const i of ordem) {
    const ultimo = blocos[blocos.length - 1];
    if (ultimo && ultimo[ultimo.length - 1] === i - 1) ultimo.push(i);
    else blocos.push([i]);
  }
  const nome = (i: number) => NOMES_DIA[(i + 1) % 7];
  return juntar(blocos.flatMap(b =>
    b.length >= 3 ? [`${nome(b[0])} a ${nome(b[b.length - 1])}`] : b.map(nome)));
}

function fmtCurto(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${NOMES_DIA_CURTO[diaDaSemana(iso)]} ${d}/${m}`;
}

type Modo = 'dia' | 'periodo';

type Props = {
  /** Dias da semana em que o roteiro opera (0=Dom..6=Sáb). Vazio = todos os dias. */
  diasSemana: number[];
  onDiasSemanaChange: (dias: number[]) => void;
  /** Datas bloqueadas (exceções), em formato ISO 'yyyy-mm-dd'. */
  bloqueios: string[];
  onBloqueiosChange: (datas: string[]) => void;
};

export default function DisponibilidadePicker({
  diasSemana, onDiasSemanaChange, bloqueios, onBloqueiosChange,
}: Props) {
  const hoje = hojeISO();
  const [anoHoje, mesHoje] = hoje.split('-').map(Number);

  const [viewYear, setViewYear] = useState(anoHoje);
  const [viewMonth, setViewMonth] = useState(mesHoje - 1);
  const [modo, setModo] = useState<Modo>('dia');
  // Modo período: primeiro clique fixa o início; o segundo aplica ao intervalo.
  const [inicio, setInicio] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const operaTodos = diasSemana.length === 0;
  const bloqueioSet = new Set(bloqueios);
  // Começar num dia bloqueado = o período será liberado; senão, bloqueado.
  const acaoPeriodo: 'bloquear' | 'liberar' = inicio && bloqueioSet.has(inicio) ? 'liberar' : 'bloquear';
  const previa = new Set(inicio && hover ? intervalo(inicio, hover) : inicio ? [inicio] : []);

  function foraOperacao(iso: string) {
    return !operaTodos && !diasSemana.includes(diaDaSemana(iso));
  }

  function aplicar(datas: string[], acao: 'bloquear' | 'liberar') {
    const futuras = datas.filter(d => d >= hoje);
    if (acao === 'bloquear') {
      onBloqueiosChange([...new Set([...bloqueios, ...futuras])].sort());
    } else {
      const remover = new Set(futuras);
      onBloqueiosChange(bloqueios.filter(b => !remover.has(b)));
    }
  }

  function remover(datas: string[]) {
    const set = new Set(datas);
    onBloqueiosChange(bloqueios.filter(b => !set.has(b)));
  }

  function toggleDia(day: number) {
    onDiasSemanaChange(
      diasSemana.includes(day)
        ? diasSemana.filter(d => d !== day)
        : [...diasSemana, day].sort((a, b) => a - b),
    );
  }

  function clicarDia(iso: string) {
    if (modo === 'dia') {
      aplicar([iso], bloqueioSet.has(iso) ? 'liberar' : 'bloquear');
      return;
    }
    if (!inicio) {
      setInicio(iso);
      return;
    }
    aplicar(intervalo(inicio, iso), acaoPeriodo);
    setInicio(null);
    setHover(null);
  }

  function trocarModo(m: Modo) {
    setModo(m);
    setInicio(null);
    setHover(null);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const canGoPrev = viewYear > anoHoje || (viewYear === anoHoje && viewMonth > mesHoje - 1);

  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay();
  const diasDoMes = Array.from({ length: daysInMonth }, (_, i) => isoDe(viewYear, viewMonth, i + 1));
  const cells: (string | null)[] = [...Array<null>(firstDow).fill(null), ...diasDoMes];

  // Atalho do mês: considera só os dias que o cliente poderia reservar.
  const diasMesFuturos = diasDoMes.filter(d => d >= hoje);
  const diasMesReservaveis = diasMesFuturos.filter(d => !foraOperacao(d));
  const mesTodoBloqueado =
    diasMesReservaveis.length > 0 && diasMesReservaveis.every(d => bloqueioSet.has(d));

  const grupos = agruparConsecutivas(bloqueios);

  // ── Resumo em texto (atualiza a cada clique) ─────────────────────────────
  const diasOperacao = operaTodos ? [0, 1, 2, 3, 4, 5, 6] : diasSemana;
  const diasSemOperacao = [0, 1, 2, 3, 4, 5, 6].filter(d => !diasOperacao.includes(d));
  const textoOperacao = diasOperacao.length === 7
    ? 'Todos os dias da semana'
    : `Toda semana, ${descreverDiasSemana(diasOperacao)}`;
  const proximasDisponiveis: string[] = [];
  for (let d = hoje, i = 0; i < 400 && proximasDisponiveis.length < 4; d = somarDias(d, 1), i++) {
    if (!foraOperacao(d) && !bloqueioSet.has(d)) proximasDisponiveis.push(d);
  }
  const gruposFuturos = agruparConsecutivas(bloqueios.filter(b => b >= hoje));
  const MAX_GRUPOS_RESUMO = 6;

  return (
    <div className="space-y-6">
      {/* Dias da semana de operação */}
      <div>
        <p className="text-xs font-medium text-slate-600 mb-2">Dias da semana em que o roteiro opera</p>
        <div className="grid grid-cols-7 gap-1.5 sm:flex sm:gap-2 sm:flex-wrap">
          {DIAS_SEMANA.map(d => {
            const active = diasSemana.includes(d.value);
            return (
              <button key={d.value} type="button" onClick={() => toggleDia(d.value)}
                className={`w-full sm:w-12 h-11 sm:h-10 rounded-xl text-xs font-bold transition-all ${
                  active
                    ? 'bg-[#0B2447] text-white shadow-md shadow-[#0B2447]/20'
                    : 'bg-white border border-slate-200 text-slate-500 hover:border-[#0B2447]/30'
                }`}>
                {d.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {operaTodos
            ? '💡 Nenhum dia selecionado: o roteiro fica disponível em todos os dias (exceto as datas bloqueadas abaixo).'
            : 'O roteiro só ficará disponível nos dias selecionados.'}
        </p>
      </div>

      {/* Calendário de bloqueios + resumo */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
      <div className="w-full max-w-sm shrink-0">
        <p className="text-xs font-medium text-slate-600 mb-2">Bloquear datas específicas (exceções)</p>
        <div
          className="rounded-xl border border-slate-200 bg-white p-4"
          onKeyDown={e => { if (e.key === 'Escape' && inicio) { setInicio(null); setHover(null); } }}
        >
          {/* Modo de seleção */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-4" role="tablist" aria-label="Modo de seleção">
            {([
              { id: 'dia', label: 'Dia a dia', icon: MousePointerClick },
              { id: 'periodo', label: 'Período', icon: CalendarRange },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" role="tab" aria-selected={modo === id}
                onClick={() => trocarModo(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition-all ${
                  modo === id ? 'bg-white text-[#0B2447] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth} disabled={!canGoPrev} aria-label="Mês anterior"
              className={`p-2.5 sm:p-1.5 rounded-full transition-colors ${
                canGoPrev ? 'hover:bg-slate-100 text-slate-700' : 'text-slate-200 cursor-default'
              }`}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-sm font-semibold text-slate-800">{MESES[viewMonth]} {viewYear}</p>
            <button type="button" onClick={nextMonth} aria-label="Próximo mês"
              className="p-2.5 sm:p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-1" onMouseLeave={() => setHover(null)}>
            {DOW_CURTOS.map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-slate-400 pb-1">{d}</div>
            ))}
            {cells.map((iso, i) => {
              if (!iso) return <div key={`e-${i}`} />;
              const isPast = iso < hoje;
              const fora = foraOperacao(iso);
              const bloqueado = bloqueioSet.has(iso);
              // No modo período, dias fora de operação também servem de início/fim.
              const desabilitado = isPast || (modo === 'dia' && fora);
              const ehInicio = iso === inicio;
              const naPrevia = !isPast && previa.has(iso);

              let cls: string;
              if (isPast) cls = 'text-slate-300 cursor-default';
              else if (ehInicio) cls = 'bg-[#0B2447] text-white font-semibold shadow-sm';
              else if (naPrevia) {
                cls = acaoPeriodo === 'bloquear'
                  ? 'bg-red-100 text-red-700 font-medium'
                  : 'bg-emerald-50 text-emerald-700 font-medium';
              } else if (fora) cls = `text-slate-300 line-through ${modo === 'periodo' ? 'hover:bg-slate-50' : 'cursor-default'}`;
              else if (bloqueado) cls = 'bg-red-500 text-white font-semibold';
              else cls = 'text-slate-700 hover:bg-red-50 hover:text-red-600';

              return (
                <button key={iso} type="button"
                  disabled={desabilitado}
                  onClick={() => clicarDia(iso)}
                  onMouseEnter={() => { if (inicio) setHover(iso); }}
                  title={
                    isPast ? 'Data passada'
                    : modo === 'periodo'
                      ? inicio ? 'Clique para definir o fim do período' : 'Clique para definir o início do período'
                    : fora ? 'Fora dos dias de operação'
                    : bloqueado ? 'Bloqueado — clique para liberar'
                    : 'Disponível — clique para bloquear'
                  }
                  className={`h-9 w-full rounded-lg text-xs transition-colors flex items-center justify-center ${cls}`}>
                  {Number(iso.slice(8))}
                </button>
              );
            })}
          </div>

          {/* Dica / estado do modo período */}
          {modo === 'periodo' && (
            <div className={`mt-3 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[11px] ${
              inicio
                ? acaoPeriodo === 'bloquear' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-50 text-slate-500'
            }`}>
              <span>
                {inicio
                  ? <>Início em <strong>{fmtBR(inicio)}</strong> — escolha o último dia para {acaoPeriodo === 'bloquear' ? 'bloquear' : 'liberar'} o período.</>
                  : 'Clique no primeiro e no último dia — pode trocar de mês entre os cliques.'}
              </span>
              {inicio && (
                <button type="button" onClick={() => { setInicio(null); setHover(null); }}
                  className="shrink-0 font-semibold hover:underline">
                  Cancelar
                </button>
              )}
            </div>
          )}

          {/* Atalho: mês inteiro */}
          <button type="button"
            disabled={diasMesReservaveis.length === 0}
            onClick={() => aplicar(diasMesFuturos, mesTodoBloqueado ? 'liberar' : 'bloquear')}
            className={`mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed ${
              mesTodoBloqueado
                ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                : 'border-dashed border-slate-300 text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600'
            }`}>
            {mesTodoBloqueado
              ? <><CalendarCheck2 className="w-3.5 h-3.5" /> Liberar {MESES[viewMonth].toLowerCase()} inteiro</>
              : <><CalendarX2 className="w-3.5 h-3.5" /> Bloquear {MESES[viewMonth].toLowerCase()} inteiro</>}
          </button>

          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Bloqueado</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-slate-200 inline-block" /> Disponível</span>
            <span className="line-through">Fora de operação</span>
          </div>
        </div>

        {/* Lista de datas bloqueadas, agrupada em períodos */}
        {grupos.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-medium text-slate-500">
                {bloqueios.length} {bloqueios.length === 1 ? 'data bloqueada' : 'datas bloqueadas'}
              </p>
              {grupos.length > 1 && (
                <button type="button" onClick={() => onBloqueiosChange([])}
                  className="text-[11px] font-semibold text-slate-400 hover:text-red-600 transition-colors">
                  Limpar todas
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {grupos.map(g => {
                const rotulo = g.dias.length === 1 ? fmtBR(g.inicio) : fmtIntervalo(g.inicio, g.fim);
                return (
                  <span key={g.inicio}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full pl-3 pr-2 py-1">
                    {rotulo}
                    {g.dias.length > 1 && (
                      <span className="text-[10px] font-semibold text-red-500/80">· {g.dias.length} dias</span>
                    )}
                    <button type="button" onClick={() => remover(g.dias)}
                      className="w-6 h-6 sm:w-4 sm:h-4 -my-1 sm:my-0 flex items-center justify-center rounded-full hover:bg-red-200 transition-colors"
                      aria-label={`Remover bloqueio de ${rotulo}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Resumo para conferência */}
      <div className="flex-1 min-w-0 lg:max-w-lg">
        <p className="text-xs font-medium text-slate-600 mb-2">Resumo para conferência</p>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 divide-y divide-slate-200/80" aria-live="polite">
          <div className="flex items-center gap-2 px-4 sm:px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <ListChecks className="w-3.5 h-3.5" />
            Como os clientes verão este roteiro
          </div>

          {/* Disponível */}
          <div className="flex gap-3 px-4 sm:px-5 py-4">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CalendarCheck2 className="w-4 h-4" />
            </span>
            <div className="min-w-0 space-y-1.5">
              <p className="text-sm font-semibold text-slate-800">Período em que o roteiro estará disponível para reservas</p>
              <p className="text-sm text-slate-600">
                {textoOperacao}, a partir de hoje ({fmtBR(hoje)}), sem data final
                {gruposFuturos.length > 0 ? ' — exceto nos períodos indisponíveis abaixo.' : '.'}
              </p>
              {proximasDisponiveis.length > 0 ? (
                <p className="text-xs text-slate-500">
                  Próximas datas livres:{' '}
                  <span className="font-medium text-emerald-700">{proximasDisponiveis.map(fmtCurto).join(' · ')}</span>
                </p>
              ) : (
                <p className="text-xs font-medium text-amber-700">
                  Nenhuma data livre no próximo ano — revise os bloqueios ou os dias de operação.
                </p>
              )}
            </div>
          </div>

          {/* Indisponível */}
          <div className="flex gap-3 px-4 sm:px-5 py-4">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <CalendarX2 className="w-4 h-4" />
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="text-sm font-semibold text-slate-800">Período em que o roteiro estará indisponível na plataforma</p>
                <p className="text-xs text-slate-500">Nessas datas o roteiro não aparece nas buscas por data e não pode ser reservado.</p>
              </div>

              {diasSemOperacao.length === 0 && gruposFuturos.length === 0 && (
                <p className="text-sm text-slate-600">Nenhuma data indisponível — o roteiro está aberto todos os dias.</p>
              )}

              {diasSemOperacao.length > 0 && (
                <p className="text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Toda semana, {descreverDiasSemana(diasSemOperacao)}</span>
                  {' '}— fora dos dias de operação.
                </p>
              )}

              {gruposFuturos.length > 0 && (
                <ul className="space-y-1.5">
                  {gruposFuturos.slice(0, MAX_GRUPOS_RESUMO).map(g => {
                    const afetados = g.dias.filter(d => !foraOperacao(d)).length;
                    return (
                      <li key={g.inicio} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                        <span className="text-slate-700">
                          <span className="font-medium">
                            {g.dias.length === 1 ? `${fmtBR(g.inicio)} (${NOMES_DIA[diaDaSemana(g.inicio)]})` : fmtIntervalo(g.inicio, g.fim).replace(' – ', ' a ')}
                          </span>
                          {g.dias.length > 1 && <span className="text-slate-500"> · {g.dias.length} dias</span>}
                          {afetados === 0 ? (
                            <span className="block text-xs text-slate-400">Sem efeito: o roteiro já não opera nesses dias.</span>
                          ) : !operaTodos && afetados < g.dias.length ? (
                            <span className="block text-xs text-slate-400">
                              {afetados} {afetados === 1 ? 'dia de operação bloqueado' : 'dias de operação bloqueados'}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                  {gruposFuturos.length > MAX_GRUPOS_RESUMO && (
                    <li className="pl-3.5 text-xs text-slate-500">
                      + {gruposFuturos.length - MAX_GRUPOS_RESUMO} {gruposFuturos.length - MAX_GRUPOS_RESUMO === 1 ? 'outro período' : 'outros períodos'} (veja a lista abaixo do calendário)
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
