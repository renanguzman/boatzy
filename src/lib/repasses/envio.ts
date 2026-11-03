import { chamarRota, putNoStorage, validarArquivoDocumento } from '@/lib/documentos/envio';

/**
 * Envio do comprovante do repasse direto do navegador para o bucket privado (SPEC §101):
 * preparar → PUT assinado → confirmar. Devolve a key (nunca uma URL pública). Mesmas regras
 * de arquivo dos documentos (JPG/PNG/WEBP/PDF, até o limite de lá).
 */

const ENDPOINT = '/api/administrator/repasses/upload';

export const validarComprovante = validarArquivoDocumento;

export type ComprovanteEnviado = { key: string; nome: string };

export async function enviarComprovante(
  file: File,
  gestorId: string,
  repasseId: string,
  onProgresso: (pct: number) => void = () => {},
): Promise<{ ok: true; comprovante: ComprovanteEnviado } | { ok: false; erro: string }> {
  const preparo = await chamarRota<{ uploadUrl: string; key: string }>(
    { acao: 'preparar', gestorId, repasseId, nome: file.name, tipo: file.type, tamanho: file.size },
    ENDPOINT,
  );
  if (!preparo.ok) return preparo;

  const falha = await putNoStorage(preparo.json.uploadUrl, file, onProgresso);
  if (falha) return { ok: false, erro: falha };

  const confirmacao = await chamarRota<{ key: string }>({ acao: 'confirmar', gestorId, repasseId, key: preparo.json.key }, ENDPOINT);
  if (!confirmacao.ok) return confirmacao;
  return { ok: true, comprovante: { key: confirmacao.json.key, nome: file.name } };
}
