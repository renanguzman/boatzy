// Helpers puros de rótulo dos filtros de venda (ano/valor). Módulo neutro
// (sem 'use client') para poder ser chamado tanto pelos pickers no client
// quanto pela página de resultados /vendas no servidor.

export type FaixaValue = { min: string; max: string };

export function anoVendaLabel(v: FaixaValue): string | null {
  if (v.min && v.max) return v.min === v.max ? v.min : `${v.min}–${v.max}`;
  if (v.min) return `${v.min} em diante`;
  if (v.max) return `até ${v.max}`;
  return null;
}

/** "450000" → "R$ 450 mil"; "1200000" → "R$ 1,2 mi" (rótulo compacto do campo/chip). */
export function valorCompacto(v: string): string {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return v;
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return `R$ ${n.toLocaleString('pt-BR')}`;
}

export function valorVendaLabel(v: FaixaValue): string | null {
  if (v.min && v.max) return `${valorCompacto(v.min)} – ${valorCompacto(v.max)}`;
  if (v.min) return `a partir de ${valorCompacto(v.min)}`;
  if (v.max) return `até ${valorCompacto(v.max)}`;
  return null;
}
