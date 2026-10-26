import { clsx, type ClassValue } from 'clsx';
import { FUSO_HORARIO } from '@/lib/datas';
import { IDIOMA_PADRAO, LOCALE_INTL, type Idioma } from '@/i18n/config';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// Sempre em reais (o Asaas cobra em BRL); o idioma muda só o formato — R$ 1.500 / R$1,500.
export function formatCurrency(value: number, idioma: Idioma = IDIOMA_PADRAO): string {
  return new Intl.NumberFormat(LOCALE_INTL[idioma], {
    style: 'currency',
    currency: 'BRL',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Variante com centavos — usada em relatórios financeiros (ex.: /painel/receitas),
// onde arredondar para inteiro mascararia diferenças reais entre valores.
export function formatCurrencyPrecise(value: number, idioma: Idioma = IDIOMA_PADRAO): string {
  return new Intl.NumberFormat(LOCALE_INTL[idioma], {
    style: 'currency',
    currency: 'BRL',
    currencyDisplay: 'narrowSymbol',
  }).format(value);
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_HORARIO, 
    day: '2-digit',
    month: 'short',
  }).format(new Date(date));
}

export function getBoatTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    yacht: 'Iate',
    speedboat: 'Lancha',
    jetski: 'Jet Ski',
    sailboat: 'Veleiro',
    catamaran: 'Catamarã',
  };
  return labels[type] || type;
}
