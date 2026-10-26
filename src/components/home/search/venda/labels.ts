// Helpers puros de rótulo dos filtros de venda (ano/valor). Módulo neutro
// (sem 'use client') para poder ser chamado tanto pelos pickers no client
// quanto pela página de resultados /vendas no servidor — recebem o tradutor
// `CamposVenda` e os formatos do idioma (SPEC §94.11).
import type { Formatos } from '@/i18n/formatos';

export type FaixaValue = { min: string; max: string };

/** Tradutor de `CamposVenda` (useTranslations no client, getTranslations no servidor). */
export type TradutorCamposVenda = (
  chave: 'ano.emDiante' | 'ano.ateAno' | 'valor.aPartirDe' | 'valor.ate',
  valores: Record<string, string>,
) => string;

export function anoVendaLabel(v: FaixaValue, t: TradutorCamposVenda): string | null {
  if (v.min && v.max) return v.min === v.max ? v.min : `${v.min}–${v.max}`;
  if (v.min) return t('ano.emDiante', { ano: v.min });
  if (v.max) return t('ano.ateAno', { ano: v.max });
  return null;
}

/** "450000" → "R$ 450 mil" / "R$450K"; "1200000" → "R$ 1,2 mi" / "R$1.2M" (rótulo compacto do campo/chip). */
export function valorCompacto(v: string, f: Formatos): string {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return v;
  return f.moedaCompacta(n);
}

export function valorVendaLabel(v: FaixaValue, t: TradutorCamposVenda, f: Formatos): string | null {
  if (v.min && v.max) return `${valorCompacto(v.min, f)} – ${valorCompacto(v.max, f)}`;
  if (v.min) return t('valor.aPartirDe', { valor: valorCompacto(v.min, f) });
  if (v.max) return t('valor.ate', { valor: valorCompacto(v.max, f) });
  return null;
}
