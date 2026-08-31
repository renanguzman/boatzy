/**
 * Tipos compartilhados da Equipe — módulo neutro (sem `server-only`) para
 * poder ser importado tanto no servidor quanto em componentes client.
 */

/** Membro da equipe (ou o próprio gestor) como opção de atendente. */
export type AtendenteOption = {
  id: string;
  nome_completo: string;
  foto_url: string | null;
  telefone: string | null;
  is_gestor: boolean;
};
