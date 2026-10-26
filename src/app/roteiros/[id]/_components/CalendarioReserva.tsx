'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useFormatos } from '@/i18n/formatos';
import { somarDiasISO } from '@/lib/precos-calendario';
import {
  motivoIndisponivel, periodoIndisponivel, type CalendarioCliente, type DiaReserva, type StatusPublico,
} from '@/lib/disponibilidade';

// Meses, dias da semana e valores no idioma do site (useFormatos). Na célula, o valor vai
// compacto para caber ("4.600" / "4,600") — o R$ está na legenda.
function isoDe(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

type Props = {
  calendario: CalendarioCliente;
  selecionada: string | null;
  onSelecionar: (iso: string) => void;
  modalidade: 'roteiro' | 'diaria';
  /** Diárias da reserva Por Diária: destaca o período a partir da saída. */
  diarias?: number;
  /** Meses lado a lado em telas ≥ sm (no celular, sempre 1). */
  meses?: 1 | 2;
};

/**
 * Calendário de reserva do cliente — o mesmo que o gestor configura no painel
 * (`roteiro_calendario`): só os dias disponíveis podem ser escolhidos; os
 * indisponíveis aparecem riscados, sem dizer se estão reservados ou fechados.
 * No modelo Roteiro cada dia mostra o total que o cliente paga (preço + taxa).
 */
export default function CalendarioReserva({
  calendario, selecionada, onSelecionar, modalidade, diarias = 1, meses = 2,
}: Props) {
  const t = useTranslations('Calendario');
  const tComum = useTranslations('Comum');
  const tData = useTranslations('CamposBusca.data');
  const tDisp = useTranslations('Disponibilidade');
  const f = useFormatos();
  const porData = useMemo(() => new Map(calendario.dias.map(d => [d.data, d])), [calendario.dias]);
  const hoje = calendario.dias[0]?.data ?? calendario.dataMaxima;
  const [anoIni, mesIni] = hoje.split('-').map(Number);
  const [anoMax, mesMax] = calendario.dataMaxima.split('-').map(Number);
  const totalMeses = Math.max(1, (anoMax - anoIni) * 12 + (mesMax - mesIni) + 1);

  const offsetDe = (iso: string) => {
    const [a, m] = iso.split('-').map(Number);
    return Math.min(totalMeses - 1, Math.max(0, (a - anoIni) * 12 + (m - mesIni)));
  };
  const [offset, setOffset] = useState(() => (selecionada ? offsetDe(selecionada) : 0));

  const statusDe = (iso: string): StatusPublico => porData.get(iso)?.status ?? 'indisponivel';
  const fimPeriodo = selecionada && modalidade === 'diaria' ? somarDiasISO(selecionada, Math.max(1, diarias) - 1) : selecionada;
  const problema = selecionada && fimPeriodo && modalidade === 'diaria'
    ? periodoIndisponivel(statusDe, selecionada, fimPeriodo)
    : null;

  const mesDo = (o: number) => {
    const total = mesIni - 1 + o;
    return { ano: anoIni + Math.floor(total / 12), mes: total % 12 };
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <button type="button" onClick={() => setOffset(o => Math.max(0, o - 1))} disabled={offset === 0}
          aria-label={tComum('mesAnterior')}
          className="p-2 rounded-full text-slate-700 hover:bg-slate-100 disabled:text-slate-200 disabled:hover:bg-transparent transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-xs text-slate-500 text-center">
          {tData.rich('reservasAbertasAte', {
            data: f.data(calendario.dataMaxima),
            destaque: (texto) => <strong className="font-semibold text-slate-700">{texto}</strong>,
          })}
        </p>
        <button type="button" onClick={() => setOffset(o => Math.min(totalMeses - 1, o + 1))} disabled={offset >= totalMeses - 1}
          aria-label={tComum('proximoMes')}
          className="p-2 rounded-full text-slate-700 hover:bg-slate-100 disabled:text-slate-200 disabled:hover:bg-transparent transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Dois meses lado a lado separados por um filete vertical, para não confundir de qual mês é o dia. */}
      <div className={`grid gap-6 ${meses === 2 ? 'sm:grid-cols-2 sm:gap-0' : ''}`}>
        {[0, 1].slice(0, meses).map(i => {
          const { ano, mes } = mesDo(offset + i);
          return (
            <div
              key={`${ano}-${mes}`}
              className={meses === 2 ? (i === 1 ? 'hidden sm:block sm:border-l sm:border-slate-200 sm:pl-5' : 'sm:pr-5') : ''}
            >
              <Mes ano={ano} mes={mes} hoje={hoje} porData={porData} dataMaxima={calendario.dataMaxima}
                selecionada={selecionada} fimPeriodo={fimPeriodo} modalidade={modalidade}
                onSelecionar={onSelecionar} />
            </div>
          );
        })}
      </div>

      {problema && selecionada && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
          {problema === 'indisponivel'
            ? t('periodoConflito', { count: diarias, data: f.data(selecionada) })
            : tDisp(motivoIndisponivel(problema), { data: f.data(calendario.dataMaxima) })}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        {modalidade === 'roteiro' ? (
          <>
            <span>{t('legendaValores')}</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-turquesa" /> {t('menorPreco')}</span>
          </>
        ) : (
          <span>{t('legendaDiaria')}</span>
        )}
        <span className="flex items-center gap-1.5"><span className="line-through text-slate-300">{f.numero(12)}</span> {t('indisponivel')}</span>
      </div>
    </div>
  );
}

function Mes({ ano, mes, hoje, porData, dataMaxima, selecionada, fimPeriodo, modalidade, onSelecionar }: {
  ano: number; mes: number; hoje: string; porData: Map<string, DiaReserva>; dataMaxima: string;
  selecionada: string | null; fimPeriodo: string | null; modalidade: 'roteiro' | 'diaria';
  onSelecionar: (iso: string) => void;
}) {
  const t = useTranslations('Calendario');
  const f = useFormatos();
  const diasNoMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const primeiroDow = new Date(Date.UTC(ano, mes, 1)).getUTCDay();
  const datas = Array.from({ length: diasNoMes }, (_, i) => isoDe(ano, mes, i + 1));

  const totaisDisponiveis = datas
    .map(d => porData.get(d))
    .filter((d): d is DiaReserva => d?.status === 'disponivel' && d.total != null)
    .map(d => d.total!);
  const menor = totaisDisponiveis.length > 1 && new Set(totaisDisponiveis).size > 1 ? Math.min(...totaisDisponiveis) : null;
  // Mês da data escolhida: a faixa do nome fica em destaque (deixa claro em qual mês se marcou).
  const temSelecionada = selecionada != null && datas.includes(selecionada);

  return (
    <div>
      <p className={`mb-2 rounded-lg py-1.5 text-center text-sm font-semibold transition-colors ${
        temSelecionada ? 'bg-marinho text-white' : 'bg-slate-50 text-marinho'
      }`}>
        {f.meses()[mes]} {ano}
      </p>
      <div className="grid grid-cols-7 gap-0.5">
        {f.diasSemana('narrow').map((d, i) => (
          <div key={i} className="pb-1 text-center text-[10px] font-semibold text-slate-400">{d}</div>
        ))}
        {Array.from({ length: primeiroDow }, (_, i) => <div key={`v${i}`} />)}
        {datas.map(iso => {
          const dia = Number(iso.slice(8));
          const d = porData.get(iso);
          const status: StatusPublico | 'passado' = iso < hoje ? 'passado' : d?.status ?? 'fora_janela';
          const podeIniciar = status === 'disponivel';
          const selecionado = iso === selecionada;
          const noPeriodo = modalidade === 'diaria' && !!selecionada && !!fimPeriodo && iso > selecionada && iso <= fimPeriodo;
          const conflito = noPeriodo && status === 'indisponivel';
          const riscado = status === 'indisponivel' || status === 'nao_opera';
          const titulo = t('tituloDia', {
            diaSemana: f.diasSemana('long')[new Date(Date.UTC(ano, mes, dia)).getUTCDay()],
            data: f.data(iso),
            situacao: podeIniciar
              ? (modalidade === 'roteiro' && d?.total != null ? f.moedaCentavos(d.total) : t('situacao.disponivel'))
              : status === 'fora_janela' ? t('situacao.foraJanela', { data: f.data(dataMaxima) })
              : status === 'passado' ? t('situacao.passado') : t('situacao.indisponivel'),
          });
          return (
            <button key={iso} type="button" disabled={!podeIniciar} onClick={() => onSelecionar(iso)} title={titulo}
              aria-pressed={selecionado}
              className={`flex h-12 flex-col items-center justify-center rounded-lg transition-colors ${
                selecionado ? 'bg-marinho text-white'
                  : conflito ? 'bg-red-50 ring-1 ring-red-300'
                  : noPeriodo ? 'bg-marinho/10'
                  : podeIniciar ? 'hover:bg-slate-100' : 'cursor-default'
              }`}>
              <span className={`text-sm leading-none ${
                selecionado ? 'font-bold' : podeIniciar ? 'font-medium text-grafite' : `text-slate-300 ${riscado ? 'line-through' : ''}`
              }`}>
                {dia}
              </span>
              {modalidade === 'roteiro' && podeIniciar && d?.total != null && (
                <span className={`mt-1 text-[10px] leading-none tabular-nums ${
                  selecionado ? 'text-white/80' : d.total === menor ? 'font-semibold text-turquesa-escuro' : 'text-slate-500'
                }`}>
                  {f.numero(Math.round(d.total))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
