/**
 * Limite de pessoas de uma reserva (puro — usado no card de reserva, na
 * confirmação e na criação da reserva).
 *
 * O limite é o MENOR entre os limites cadastrados: capacidade da embarcação
 * (limite físico), capacidade do roteiro (`roteiro.quantidade_pessoas`, que o
 * gestor pode ajustar) e, no modelo Por Pessoa, o máximo de pessoas do modelo.
 * Valores nulos ou ≤ 0 contam como "não cadastrado". `null` = sem limite.
 */
export function capacidadeMaxima(...limites: (number | null | undefined)[]): number | null {
  const validos = limites.filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
  return validos.length ? Math.min(...validos) : null;
}

export function mensagemCapacidadeExcedida(max: number): string {
  return `Este passeio comporta no máximo ${max} ${max === 1 ? 'pessoa' : 'pessoas'}.`;
}
