/**
 * Destino pós-login do painel (ex.: link do e-mail "nova solicitação" →
 * /painel/agendamentos/<id>). O proxy manda o gestor deslogado para
 * `/painel/login?redirect_to=<caminho>`; a tela de login guarda o caminho no
 * cookie abaixo (cookie em vez de query no redirect do OAuth, que precisa bater
 * exatamente com a allow list do Supabase) e `/api/painel/setup-role` redireciona
 * para ele no fim do login. Só aceita caminhos internos do painel.
 */

export const COOKIE_DESTINO_PAINEL = 'boatzy_painel_destino';

/** Caminho interno do painel (sem host, sem "//", sem caracteres estranhos), ou null. */
export function destinoPainelSeguro(valor: string | null | undefined): string | null {
  if (!valor) return null;
  if (!/^\/painel(\/[A-Za-z0-9\-_/]*)?(\?[A-Za-z0-9\-_=&%.]*)?$/.test(valor)) return null;
  if (valor.startsWith('//') || valor.includes('/login') || valor.includes('/auth/')) return null;
  return valor;
}
