import { MAX_IMAGE_SIZE_BYTES, MAX_IMAGE_SIZE_MB, TIPOS_IMAGEM_PERMITIDOS, formatarTamanho } from '@/lib/upload';

/**
 * Validação e envio direto ao R2 das fotos das galerias do painel (navegador).
 * Usado pelo `GaleriaImagensEditor` (ao adicionar) e pelos formulários de
 * embarcação/roteiro (no salvar, antes de gravar o registro).
 */

/** Motivo da recusa de um arquivo, ou null se ele pode entrar na galeria. */
export async function validarImagem(file: File): Promise<string | null> {
  const nome = file.name.toLowerCase();
  if (nome.endsWith('.heic') || nome.endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif') {
    return 'formato HEIC (padrão do iPhone) não é aceito. Converta para JPG ou, no iPhone, use Ajustes › Câmera › Formatos › "Mais compatível".';
  }
  if (!(TIPOS_IMAGEM_PERMITIDOS as readonly string[]).includes(file.type)) {
    return `formato não suportado${file.type ? ` (${file.type})` : ''}. Envie JPG, PNG ou WEBP.`;
  }
  if (file.size === 0) return 'o arquivo está vazio.';
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return `tem ${formatarTamanho(file.size)} — o máximo é ${MAX_IMAGE_SIZE_MB} MB por foto.`;
  }
  try {
    const bitmap = await createImageBitmap(file);
    bitmap.close();
  } catch {
    return 'não foi possível ler a imagem — o arquivo pode estar corrompido ou incompleto.';
  }
  return null;
}

type ResultadoEnvio = { ok: true; url: string } | { ok: false; erro: string };

/** POST JSON na rota de upload; qualquer falha vira uma mensagem para o usuário. */
async function chamarRota<T>(endpoint: string, corpo: object): Promise<{ ok: true; json: T } | { ok: false; erro: string }> {
  let res: Response;
  try {
    res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  } catch {
    return { ok: false, erro: 'falha de conexão durante o envio. Verifique sua internet e tente novamente.' };
  }
  const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (res.ok && json) return { ok: true, json };
  if (json?.error) return { ok: false, erro: json.error };
  if (res.status === 401) return { ok: false, erro: 'sua sessão expirou. Entre novamente no painel e tente de novo.' };
  return { ok: false, erro: `o servidor não conseguiu processar a foto (erro ${res.status}). Tente novamente em instantes.` };
}

/** PUT direto no R2 pela URL assinada (XHR, para acompanhar o progresso). */
function putNoStorage(url: string, file: File, onProgresso: (pct: number) => void): Promise<string | null> {
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgresso(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => resolve(
      xhr.status >= 200 && xhr.status < 300 ? null
        : xhr.status === 403 ? 'o link de envio expirou ou foi recusado pelo armazenamento. Tente novamente.'
        : `o armazenamento recusou a foto (erro ${xhr.status}). Tente novamente.`,
    );
    // Sem resposta: queda de conexão ou bloqueio de CORS do bucket.
    xhr.onerror = () => resolve('não foi possível enviar ao armazenamento de imagens. Verifique sua internet e tente novamente.');
    xhr.ontimeout = () => resolve('o envio demorou demais e foi interrompido. Tente novamente com uma conexão melhor.');
    xhr.send(file);
  });
}

/**
 * Envia uma foto direto do navegador para o R2 (o arquivo não passa pela
 * função da Vercel, limitada a 4,5 MB): pede a URL assinada, faz o PUT e pede
 * ao servidor para conferir o conteúdo gravado.
 */
async function enviarImagem(
  file: File, endpoint: string, entidadeId: string, onProgresso: (pct: number) => void,
): Promise<ResultadoEnvio> {
  const preparo = await chamarRota<{ uploadUrl: string; key: string }>(endpoint, {
    acao: 'preparar', entidadeId, nome: file.name, tipo: file.type, tamanho: file.size,
  });
  if (!preparo.ok) return preparo;

  const falhaPut = await putNoStorage(preparo.json.uploadUrl, file, onProgresso);
  if (falhaPut) return { ok: false, erro: falhaPut };

  const confirmacao = await chamarRota<{ publicUrl: string }>(endpoint, {
    acao: 'confirmar', entidadeId, key: preparo.json.key,
  });
  if (!confirmacao.ok) return confirmacao;
  return { ok: true, url: confirmacao.json.publicUrl };
}

type ItemEnviavel = { key: string; file?: File; urlEnviada?: string };
type PatchEnvio = { status?: 'uploading' | 'done' | 'error'; erro?: string; urlEnviada?: string; progresso?: number };

/**
 * Envia todas as fotos novas da galeria (as já enviadas numa tentativa
 * anterior não sobem de novo). `atualizar` reflete o andamento em cada item
 * (enviando → enviada/erro, com a mensagem). Devolve a URL de cada foto nova
 * e quantas falharam — com falha, o formulário NÃO deve salvar o registro.
 */
export async function enviarFotosNovas<T extends ItemEnviavel>(params: {
  itens: T[];
  endpoint: string;
  entidadeId: string;
  atualizar: (key: string, patch: PatchEnvio) => void;
}): Promise<{ urls: Record<string, string>; falhas: number }> {
  const urls: Record<string, string> = {};
  let falhas = 0;

  for (const item of params.itens) {
    if (!item.file) continue;
    if (item.urlEnviada) { urls[item.key] = item.urlEnviada; continue; }

    params.atualizar(item.key, { status: 'uploading', erro: undefined, progresso: 0 });
    const r = await enviarImagem(item.file, params.endpoint, params.entidadeId,
      pct => params.atualizar(item.key, { progresso: pct }));
    if (r.ok) {
      urls[item.key] = r.url;
      params.atualizar(item.key, { status: 'done', urlEnviada: r.url });
    } else {
      falhas += 1;
      params.atualizar(item.key, { status: 'error', erro: r.erro });
    }
  }

  return { urls, falhas };
}

export function mensagemFalhaEnvio(falhas: number): string {
  const fotos = falhas === 1 ? '1 foto não pôde ser enviada' : `${falhas} fotos não puderam ser enviadas`;
  return `${fotos} e nada foi salvo ainda. Veja o motivo em cada foto na etapa Fotos, remova ou troque a imagem e tente de novo.`;
}

export const MENSAGEM_SEM_FOTOS = 'Adicione pelo menos 1 foto — ela é obrigatória para salvar.';
