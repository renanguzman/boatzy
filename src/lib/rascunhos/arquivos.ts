import type { GaleriaItem } from '@/components/painel/GaleriaImagensEditor';
import type { RascunhoDocumento } from '@/lib/documentos/rascunho';

/**
 * Conversão de fotos da galeria e documentos embutidos ⇄ rascunho automático
 * (SPEC §107.3). O `File` vai para o armário de arquivos (`arquivos`, id → File); o
 * JSON guarda só a referência. Progresso/status de envio não entram (mudam a cada
 * instante), mas `urlEnviada` sim: foto que já subiu numa tentativa não sobe de novo.
 */

export type ImagemRascunho = {
  key: string;
  /** Foto já salva no banco (edição). */
  id?: string;
  /** Só das salvas — as novas ganham uma URL local nova ao restaurar. */
  url?: string;
  titulo: string;
  principal: boolean;
  urlEnviada?: string;
};

const idFoto = (key: string) => `foto:${key}`;
const idDocumento = (id: string) => `doc:${id}`;

export function galeriaParaRascunho(itens: GaleriaItem[], arquivos: Record<string, File>): ImagemRascunho[] {
  return itens.map(it => {
    if (it.file) arquivos[idFoto(it.key)] = it.file;
    return {
      key: it.key, id: it.id, url: it.id ? it.url : undefined,
      titulo: it.titulo, principal: it.principal, urlEnviada: it.urlEnviada,
    };
  });
}

/**
 * Rascunho → itens da galeria. Fotos novas sem arquivo guardado contam em `perdidas`;
 * fotos salvas que não existem mais no servidor (`idsSalvos`) são ignoradas.
 */
export function galeriaDoRascunho(
  itens: ImagemRascunho[],
  arquivos: Map<string, File>,
  idsSalvos?: Set<string>,
): { itens: GaleriaItem[]; perdidas: number } {
  let perdidas = 0;
  const out: GaleriaItem[] = [];
  for (const r of itens ?? []) {
    if (r.id) {
      if (idsSalvos && !idsSalvos.has(r.id)) continue;
      out.push({ key: r.key, id: r.id, url: r.url ?? '', titulo: r.titulo, principal: r.principal });
      continue;
    }
    const file = arquivos.get(idFoto(r.key));
    if (!file) { perdidas += 1; continue; }
    out.push({
      key: r.key, file, url: URL.createObjectURL(file), titulo: r.titulo, principal: r.principal,
      urlEnviada: r.urlEnviada, status: r.urlEnviada ? 'done' : undefined,
    });
  }
  if (out.length > 0 && !out.some(i => i.principal)) out[0] = { ...out[0], principal: true };
  else if (out.filter(i => i.principal).length > 1) {
    let achou = false;
    for (let i = 0; i < out.length; i++) {
      if (out[i].principal) {
        if (achou) out[i] = { ...out[i], principal: false };
        achou = true;
      }
    }
  }
  return { itens: out, perdidas };
}

export type DocumentoRascunho = Omit<RascunhoDocumento, 'arquivo'>;

export function documentoParaRascunho(r: RascunhoDocumento | null, arquivos: Record<string, File>): DocumentoRascunho | null {
  if (!r) return null;
  const { arquivo, ...resto } = r;
  arquivos[idDocumento(r.id)] = arquivo;
  return resto;
}

/** Documento sem o arquivo guardado não volta (`perdido`): o gestor envia de novo. */
export function documentoDoRascunho(
  d: DocumentoRascunho | null | undefined,
  arquivos: Map<string, File>,
): { documento: RascunhoDocumento | null; perdido: boolean } {
  if (!d) return { documento: null, perdido: false };
  const arquivo = arquivos.get(idDocumento(d.id));
  if (!arquivo) return { documento: null, perdido: true };
  return { documento: { ...d, arquivo }, perdido: false };
}
