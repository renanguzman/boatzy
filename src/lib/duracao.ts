/**
 * Duração do passeio — conversões entre o par (valor, unidade) usado no
 * cadastro, o número em horas gravado em `roteiro.duracao_horas` (o que a
 * busca filtra e ordena) e o rótulo em `roteiro.duracao` (o que aparece nos
 * cards). Convenção do banco: 1 dia = 24 horas.
 *
 * Módulo puro (sem `server-only`): usado nos formulários do painel, nas
 * server actions e no painel de filtros de /buscar.
 */

export type DuracaoUnidade = 'horas' | 'dias';

export const HORAS_POR_DIA = 24;

/** (valor digitado, unidade) → horas. Retorna null para entrada vazia/inválida. */
export function duracaoParaHoras(valor: string | number, unidade: DuracaoUnidade): number | null {
  const bruto = typeof valor === 'number' ? valor : parseFloat(String(valor).replace(',', '.'));
  if (!Number.isFinite(bruto) || bruto <= 0) return null;
  const horas = unidade === 'dias' ? bruto * HORAS_POR_DIA : bruto;
  // numeric(6,2) no banco — arredonda e limita para não estourar o CHECK.
  const arredondado = Math.round(horas * 100) / 100;
  return arredondado > 0 && arredondado <= 9999 ? arredondado : null;
}

/**
 * horas → (valor, unidade) para preencher o formulário. Múltiplos exatos de 24
 * voltam como dias (o gestor que digitou "2 dias" reencontra "2 dias").
 */
export function horasParaPartes(horas: number | null | undefined): {
  valor: string;
  unidade: DuracaoUnidade;
} {
  if (horas == null || !Number.isFinite(horas) || horas <= 0) return { valor: '', unidade: 'horas' };
  if (horas % HORAS_POR_DIA === 0) {
    return { valor: String(horas / HORAS_POR_DIA), unidade: 'dias' };
  }
  return { valor: String(Number(horas.toFixed(2))), unidade: 'horas' };
}

/** Rótulo exibido nos cards e gravado em `roteiro.duracao` ("4 horas", "2 dias"). */
export function duracaoTexto(horas: number | null | undefined): string | null {
  if (horas == null || !Number.isFinite(horas) || horas <= 0) return null;
  const { valor, unidade } = horasParaPartes(horas);
  const numero = valor.replace('.', ',');
  if (unidade === 'dias') return `${numero} ${Number(valor) === 1 ? 'dia' : 'dias'}`;
  return `${numero} ${Number(valor) === 1 ? 'hora' : 'horas'}`;
}

/** Faixas prontas do painel de filtros de /buscar (min/max em horas, inclusivos). */
export const DURACAO_PRESETS: { label: string; min: number | null; max: number | null }[] = [
  { label: 'Até 3 horas', min: null, max: 3 },
  { label: '3 a 6 horas', min: 3, max: 6 },
  { label: '6 a 12 horas', min: 6, max: 12 },
  { label: 'Dia inteiro (12h a 1 dia)', min: 12, max: 24 },
  { label: 'Mais de 1 dia', min: 24.01, max: null },
];

/** Rótulo curto da faixa de duração selecionada (chip e botão de filtros). */
export function faixaDuracaoLabel(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  const preset = DURACAO_PRESETS.find((p) => p.min === min && p.max === max);
  if (preset) return preset.label;
  const fmt = (h: number) => duracaoTexto(h) ?? `${h}h`;
  if (min != null && max != null) return `${fmt(min)} a ${fmt(max)}`;
  if (min != null) return `A partir de ${fmt(min)}`;
  return `Até ${fmt(max as number)}`;
}

/** Rótulo curto da faixa de preço selecionada. */
export function faixaPrecoLabel(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  if (min != null && max != null) return `${fmt(min)} a ${fmt(max)}`;
  if (min != null) return `A partir de ${fmt(min)}`;
  return `Até ${fmt(max as number)}`;
}
