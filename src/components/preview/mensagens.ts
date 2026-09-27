import type { EmbarcacaoDetalheDados } from '@/app/embarcacoes/[id]/_components/EmbarcacaoDetalheView';
import type { RoteiroDetalheDados } from '@/app/roteiros/[id]/_components/RoteiroDetalheView';

/**
 * Protocolo entre o formulário do painel (janela pai) e a página de prévia
 * (`/painel/preview/*`, dentro de um iframe da mesma origem):
 *   1. o iframe avisa que está pronto (`PREVIEW_PRONTO`);
 *   2. o pai responde com os dados atuais do formulário (`PREVIEW_DADOS`).
 * Fotos ainda não enviadas trafegam como URLs `blob:` — válidas no iframe
 * por ser a mesma origem.
 */
export const PREVIEW_PRONTO = 'boatzy:preview-pronto';
export const PREVIEW_DADOS = 'boatzy:preview-dados';

export type PreviewDados =
  | { tipo: 'embarcacao'; embarcacao: EmbarcacaoDetalheDados; datasBloqueadas: string[] }
  | { tipo: 'roteiro'; roteiro: RoteiroDetalheDados; datasBloqueadas: string[] };

export type PreviewMensagem =
  | { type: typeof PREVIEW_PRONTO }
  | { type: typeof PREVIEW_DADOS; dados: PreviewDados };
