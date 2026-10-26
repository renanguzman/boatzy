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

/**
 * Faixas prontas do painel de filtros de /buscar (min/max em horas, inclusivos).
 * Rótulo no idioma do site: `Busca.duracaoPresets.<id>`.
 */
export const DURACAO_PRESETS = [
  { id: 'ate3', min: null, max: 3 },
  { id: 'de3a6', min: 3, max: 6 },
  { id: 'de6a12', min: 6, max: 12 },
  { id: 'diaInteiro', min: 12, max: 24 },
  { id: 'maisDe1Dia', min: 24.01, max: null },
] as const satisfies readonly { id: string; min: number | null; max: number | null }[];

const MINUTOS_POR_DIA = HORAS_POR_DIA * 60;

/**
 * Retorno aproximado do passeio: horário de saída + duração, num relógio de
 * 24 h. Passando da meia-noite, volta a contar do 00:00 (22:00 + 6 h = 04:00)
 * e `diasDepois` diz em quantos dias depois da saída ele cai (0 = mesmo dia).
 * Aceita duração fracionada (2,5 h = 2 h 30). `horarioSaida` vem como o tipo
 * `time` do banco ('HH:MM' ou 'HH:MM:SS'). null quando falta algum dos dois.
 */
export function horarioRetorno(
  horarioSaida: string | null | undefined,
  duracaoHoras: number | null | undefined,
): { horario: string; diasDepois: number } | null {
  if (!horarioSaida || duracaoHoras == null || !Number.isFinite(duracaoHoras) || duracaoHoras <= 0) return null;
  const [h, m] = horarioSaida.split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  const total = h * 60 + m + Math.round(duracaoHoras * 60);
  const noDia = total % MINUTOS_POR_DIA;
  const hh = String(Math.floor(noDia / 60)).padStart(2, '0');
  const mm = String(noDia % 60).padStart(2, '0');
  return { horario: `${hh}:${mm}`, diasDepois: Math.floor(total / MINUTOS_POR_DIA) };
}

/** "18:00", "04:00 (dia seguinte)", "10:00 (+2 dias)". */
export function retornoTexto(retorno: { horario: string; diasDepois: number }): string {
  if (retorno.diasDepois === 0) return retorno.horario;
  if (retorno.diasDepois === 1) return `${retorno.horario} (dia seguinte)`;
  return `${retorno.horario} (+${retorno.diasDepois} dias)`;
}
