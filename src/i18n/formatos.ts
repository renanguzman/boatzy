import { useLocale, useTranslations } from 'next-intl';
import { formatarData, formatarDataHora, formatarHora, opcoesHora } from '@/lib/datas';
import { horasParaPartes } from '@/lib/duracao';
import { formatCurrency, formatCurrencyPrecise } from '@/lib/utils';
import { formatarPreco, type PrecoExibicao } from '@/lib/precos-roteiro';
import type { ReservaModalidadePreco } from '@/types/supabase';
import { LOCALE_INTL, type Idioma } from './config';

/**
 * Formatos do site no idioma da requisição (SPEC §94.5): datas, moeda e os
 * textos que as libs de domínio montavam em pt-BR (duração, retorno,
 * comprimento, preço do card). As libs continuam com a versão pt-BR para o
 * painel; o site usa estas.
 *
 * `useFormatos()` serve componentes cliente e Server Components síncronos;
 * funções `async` do servidor usam `getFormatos()` (`./formatos-servidor`).
 */

export type TradutorFormatos = ReturnType<typeof useTranslations<'Formatos'>>;

const cacheMeses = new Map<Idioma, string[]>();
const cacheDiasSemana = new Map<string, string[]>();

function inicialMaiuscula(texto: string, idioma: Idioma): string {
  return texto.charAt(0).toLocaleUpperCase(LOCALE_INTL[idioma]) + texto.slice(1);
}

/** Nomes dos meses (janeiro primeiro), com inicial maiúscula: "Outubro", "October", "Octubre". */
export function nomesMeses(idioma: Idioma): string[] {
  let nomes = cacheMeses.get(idioma);
  if (!nomes) {
    const fmt = new Intl.DateTimeFormat(LOCALE_INTL[idioma], { month: 'long', timeZone: 'UTC' });
    nomes = Array.from({ length: 12 }, (_, m) => inicialMaiuscula(fmt.format(new Date(Date.UTC(2026, m, 15))), idioma));
    cacheMeses.set(idioma, nomes);
  }
  return nomes;
}

/**
 * Dias da semana, domingo primeiro, com inicial maiúscula e sem ponto: `short` "Dom"/"Sun",
 * `narrow` "D"/"S", `long` "Domingo"/"Sunday".
 */
export function nomesDiasSemana(idioma: Idioma, estilo: 'short' | 'narrow' | 'long' = 'short'): string[] {
  const chave = `${idioma}:${estilo}`;
  let nomes = cacheDiasSemana.get(chave);
  if (!nomes) {
    const fmt = new Intl.DateTimeFormat(LOCALE_INTL[idioma], { weekday: estilo, timeZone: 'UTC' });
    // 04/01/2026 é um domingo.
    nomes = Array.from({ length: 7 }, (_, i) =>
      inicialMaiuscula(fmt.format(new Date(Date.UTC(2026, 0, 4 + i))).replace(/\.$/, ''), idioma));
    cacheDiasSemana.set(chave, nomes);
  }
  return nomes;
}

/**
 * Data montada no fuso do navegador (`new Date(ano, mes, dia)`, dos
 * calendários de escolha de data) — sem `timeZone`, para não trocar o dia.
 */
export function formatarDataLocal(d: Date, idioma: Idioma, opts: Intl.DateTimeFormatOptions): string {
  return d.toLocaleDateString(LOCALE_INTL[idioma], opts);
}

export function criarFormatos(t: TradutorFormatos, idioma: Idioma) {
  /** Horário solto 'HH:MM' (ou 'HH:MM:SS', tipo `time` do banco): "14:00" / "2:00 PM". */
  function horario(hhmm: string): string {
    const [h, m] = hhmm.split(':').map(Number);
    if (!Number.isInteger(h) || !Number.isInteger(m)) return hhmm;
    return new Date(Date.UTC(2026, 0, 1, h, m)).toLocaleTimeString(LOCALE_INTL[idioma], { ...opcoesHora(idioma), timeZone: 'UTC' });
  }

  return {
    idioma,
    data: (valor: Parameters<typeof formatarData>[0], opts?: Intl.DateTimeFormatOptions) =>
      formatarData(valor, opts, idioma),
    dataHora: (valor: Parameters<typeof formatarDataHora>[0], opts?: { segundos?: boolean }) =>
      formatarDataHora(valor, opts, idioma),
    hora: (valor: Parameters<typeof formatarHora>[0]) => formatarHora(valor, idioma),
    horario,
    /** Data de calendário (fuso do navegador), ex.: dia escolhido no DatePicker. */
    dataLocal: (d: Date, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }) =>
      formatarDataLocal(d, idioma, opts),
    numero: (n: number, opts?: Intl.NumberFormatOptions) => n.toLocaleString(LOCALE_INTL[idioma], opts),
    /** R$ sem centavos (preços de card e reserva). */
    preco: (valor: number) => formatarPreco(valor, idioma),
    moeda: (valor: number) => formatCurrency(valor, idioma),
    moedaCentavos: (valor: number) => formatCurrencyPrecise(valor, idioma),
    /** "R$ 450 mil" / "R$450K" / "R$450 K" — faixas de valor de venda. */
    moedaCompacta: (valor: number) =>
      new Intl.NumberFormat(LOCALE_INTL[idioma], {
        style: 'currency', currency: 'BRL', currencyDisplay: 'narrowSymbol', notation: 'compact', maximumFractionDigits: 1,
      }).format(valor),
    meses: () => nomesMeses(idioma),
    diasSemana: (estilo?: 'short' | 'narrow' | 'long') => nomesDiasSemana(idioma, estilo),
    pessoas: (count: number) => t('pessoas', { count }),

    /** "4 horas", "2,5 horas", "2 dias" — a partir de `roteiro.duracao_horas`. */
    duracao(horas: number | null | undefined): string | null {
      if (horas == null || !Number.isFinite(horas) || horas <= 0) return null;
      const { valor, unidade } = horasParaPartes(horas);
      return t('duracao', { unidade, valor: Number(valor) });
    },

    /** "18:00", "04:00 (dia seguinte)", "10:00 (+2 dias)". */
    retorno(r: { horario: string; diasDepois: number }): string {
      const hora = horario(r.horario);
      if (r.diasDepois === 0) return hora;
      if (r.diasDepois === 1) return t('retornoDiaSeguinte', { horario: hora });
      return t('retornoDias', { horario: hora, dias: r.diasDepois });
    },

    /** "8,5 m", "28 pés" / "28 ft". null se vazio. */
    comprimento(valor: number | string | null | undefined, unidade: string | null | undefined): string | null {
      if (valor == null || valor === '') return null;
      const n = Number(valor);
      if (!Number.isFinite(n) || n <= 0) return null;
      return unidade === 'pes' ? t('comprimentoPes', { valor: n }) : t('comprimentoMetros', { valor: n });
    },

    /** Sufixo do preço pelo modelo: "/passeio", "/trip", "/paseo". */
    unidadePreco: (modelo: ReservaModalidadePreco) => t(`unidadePreco.${modelo}`),

    /** Texto acima do valor do card: "a partir de" ou "em 25/10". */
    rotuloPreco(p: PrecoExibicao): string {
      return p.data ? t('naData', { data: formatarData(p.data, { day: '2-digit', month: '2-digit' }, idioma) }) : t('aPartirDe');
    },

    capacidadeExcedida: (max: number) => t('capacidadeExcedida', { count: max }),
  };
}

export type Formatos = ReturnType<typeof criarFormatos>;

export function useFormatos(): Formatos {
  return criarFormatos(useTranslations('Formatos'), useLocale());
}
