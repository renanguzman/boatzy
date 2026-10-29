/** Última visualização de Agendamentos/Reservas escolhida pelo gestor (SPEC §20.4). */
export const COOKIE_VISAO_AGENDAMENTOS = 'painel_agendamentos_visao';

export type VisaoAgendamentos = 'calendario' | 'lista';

export function parseVisao(valor: string | undefined): VisaoAgendamentos {
  return valor === 'lista' ? 'lista' : 'calendario';
}

/** Grava a escolha por 1 ano (só no navegador). */
export function salvarVisao(v: VisaoAgendamentos): void {
  document.cookie = `${COOKIE_VISAO_AGENDAMENTOS}=${v}; path=/painel; max-age=31536000; samesite=lax`;
}
