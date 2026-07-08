import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Variante com centavos — usada em relatórios financeiros (ex.: /painel/receitas),
// onde arredondar para inteiro mascararia diferenças reais entre valores.
export function formatCurrencyPrecise(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
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
