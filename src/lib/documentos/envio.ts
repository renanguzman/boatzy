import { formatarTamanho } from '@/lib/upload';
import { MAX_ARQUIVO_DOCUMENTO_BYTES, MAX_ARQUIVO_DOCUMENTO_MB, TIPOS_ARQUIVO_DOCUMENTO } from './tipos';

/**
 * Envio do arquivo do documento direto do navegador para o bucket privado
 * (SPEC §95.2) — mesmo fluxo das fotos de galeria (§44.2): preparar → PUT
 * assinado → confirmar. Devolve a key do objeto (nunca uma URL pública).
 */

const ENDPOINT = '/api/painel/documentos/upload';

/** Motivo da recusa do arquivo, ou null se pode ser usado. */
export function validarArquivoDocumento(file: File): string | null {
  const nome = file.name.toLowerCase();
  if (nome.endsWith('.heic') || nome.endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif') {
    return 'Formato HEIC (padrão do iPhone) não é aceito. Tire a foto pelo próprio painel ou, no iPhone, use Ajustes › Câmera › Formatos › "Mais compatível".';
  }
  if (!(TIPOS_ARQUIVO_DOCUMENTO as readonly string[]).includes(file.type)) {
    return 'Envie uma foto (JPG, PNG ou WEBP) ou um arquivo PDF.';
  }
  if (file.size === 0) return 'O arquivo está vazio.';
  if (file.size > MAX_ARQUIVO_DOCUMENTO_BYTES) {
    return `O arquivo tem ${formatarTamanho(file.size)} — o máximo é ${MAX_ARQUIVO_DOCUMENTO_MB} MB.`;
  }
  return null;
}

export async function chamarRota<T>(
  corpo: object,
  endpoint: string = ENDPOINT,
): Promise<{ ok: true; json: T } | { ok: false; erro: string }> {
  let res: Response;
  try {
    res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  } catch {
    return { ok: false, erro: 'Falha de conexão durante o envio. Verifique sua internet e tente novamente.' };
  }
  const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (res.ok && json) return { ok: true, json };
  if (json?.error) return { ok: false, erro: json.error.charAt(0).toUpperCase() + json.error.slice(1) };
  return { ok: false, erro: `O servidor não conseguiu processar o arquivo (erro ${res.status}). Tente novamente.` };
}

export function putNoStorage(url: string, file: File, onProgresso: (pct: number) => void): Promise<string | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgresso(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      resolve(
        xhr.status >= 200 && xhr.status < 300
          ? null
          : xhr.status === 403
            ? 'O link de envio expirou ou foi recusado pelo armazenamento. Tente novamente.'
            : `O armazenamento recusou o arquivo (erro ${xhr.status}). Tente novamente.`,
      );
    // Sem resposta: queda de conexão ou CORS do bucket de documentos não configurado.
    xhr.onerror = () => resolve('Não foi possível enviar ao armazenamento de documentos. Verifique sua internet e tente novamente.');
    xhr.ontimeout = () => resolve('O envio demorou demais e foi interrompido. Tente novamente.');
    xhr.send(file);
  });
}

export type ArquivoEnviado = { key: string; nome: string; tipo: string; tamanho: number };

export async function enviarArquivoDocumento(
  file: File,
  documentoId: string,
  onProgresso: (pct: number) => void = () => {},
): Promise<{ ok: true; arquivo: ArquivoEnviado } | { ok: false; erro: string }> {
  const preparo = await chamarRota<{ uploadUrl: string; key: string }>({
    acao: 'preparar', documentoId, nome: file.name, tipo: file.type, tamanho: file.size,
  });
  if (!preparo.ok) return preparo;

  const falha = await putNoStorage(preparo.json.uploadUrl, file, onProgresso);
  if (falha) return { ok: false, erro: falha };

  const confirmacao = await chamarRota<{ key: string }>({ acao: 'confirmar', documentoId, key: preparo.json.key });
  if (!confirmacao.ok) return confirmacao;
  return { ok: true, arquivo: { key: confirmacao.json.key, nome: file.name, tipo: file.type, tamanho: file.size } };
}

/** Arquivos já enviados nesta página: uma nova tentativa de salvar o cadastro não sobe de novo. */
const enviados = new WeakMap<File, { documentoId: string; arquivo: ArquivoEnviado }>();

/**
 * Envia o arquivo de um documento embutido num cadastro (SPEC §95.10) — uma vez só por
 * arquivo e documento, mesmo que o cadastro precise ser salvo de novo.
 */
export async function enviarArquivoRascunho(
  r: { id: string; arquivo: File },
  onProgresso: (pct: number) => void = () => {},
): Promise<{ ok: true; arquivo: ArquivoEnviado } | { ok: false; erro: string }> {
  const anterior = enviados.get(r.arquivo);
  if (anterior?.documentoId === r.id) return { ok: true, arquivo: anterior.arquivo };
  const res = await enviarArquivoDocumento(r.arquivo, r.id, onProgresso);
  if (res.ok) enviados.set(r.arquivo, { documentoId: r.id, arquivo: res.arquivo });
  return res;
}
