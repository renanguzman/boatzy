/**
 * Foto do perfil do operador (SPEC §99) — recorte e redução no navegador, antes do envio.
 * O projeto não tinha crop/resize: sem isto o rosto sai cortado nos retratos 4:5 do site e a
 * foto de celular (vários MB) estoura o limite de corpo das funções da Vercel (4,5 MB).
 */

/** Proporção do retrato (largura:altura) e tamanho final exportado. */
export const PROPORCAO_FOTO_PERFIL = 4 / 5;
export const FOTO_PERFIL_LARGURA = 800;
export const FOTO_PERFIL_ALTURA = 1000;
/** Acima disto o servidor recusa (a foto reduzida costuma ter 100–400 KB). */
export const FOTO_PERFIL_MAX_BYTES = 4 * 1024 * 1024;

export type AreaEnquadrada = {
  /** Centro da janela visível, em pixels da imagem original. */
  cx: number;
  cy: number;
  /** 1 = a imagem cobre o quadro; maior = aproxima. */
  zoom: number;
};

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;

/** Lê a imagem respeitando a orientação do EXIF (fotos de celular vêm "deitadas"). */
export async function lerImagem(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

/** Escala (quadro px / imagem px) com a qual a imagem apenas cobre o quadro, vezes o zoom. */
export function escalaDoQuadro(img: { width: number; height: number }, quadro: { w: number; h: number }, zoom: number): number {
  return Math.max(quadro.w / img.width, quadro.h / img.height) * zoom;
}

/** Mantém a janela visível dentro da imagem. */
export function limitarArea(
  area: AreaEnquadrada,
  img: { width: number; height: number },
  quadro: { w: number; h: number },
): AreaEnquadrada {
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, area.zoom));
  const escala = escalaDoQuadro(img, quadro, zoom);
  const vw = quadro.w / escala;
  const vh = quadro.h / escala;
  return {
    zoom,
    cx: Math.min(img.width - vw / 2, Math.max(vw / 2, area.cx)),
    cy: Math.min(img.height - vh / 2, Math.max(vh / 2, area.cy)),
  };
}

/** Enquadramento inicial: centrado na horizontal e mais para o alto (onde costuma estar o rosto). */
export function areaInicial(img: { width: number; height: number }, quadro: { w: number; h: number }): AreaEnquadrada {
  const escala = escalaDoQuadro(img, quadro, 1);
  const vh = quadro.h / escala;
  return limitarArea({ zoom: 1, cx: img.width / 2, cy: vh / 2 + (img.height - vh) * 0.25 }, img, quadro);
}

function paraBlob(canvas: HTMLCanvasElement, tipo: string, qualidade: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, qualidade));
}

/**
 * Recorta a janela visível e reduz para 800×1000. Tenta WebP; onde o navegador não codifica
 * WebP (Safari devolve PNG), cai para JPEG — nunca envia um PNG gigante.
 */
export async function exportarFotoPerfil(
  img: ImageBitmap,
  quadro: { w: number; h: number },
  area: AreaEnquadrada,
): Promise<{ blob: Blob; extensao: 'webp' | 'jpg' } | null> {
  const { cx, cy, zoom } = limitarArea(area, img, quadro);
  const escala = escalaDoQuadro(img, quadro, zoom);
  const vw = quadro.w / escala;
  const vh = quadro.h / escala;

  const canvas = document.createElement('canvas');
  canvas.width = FOTO_PERFIL_LARGURA;
  canvas.height = FOTO_PERFIL_ALTURA;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, cx - vw / 2, cy - vh / 2, vw, vh, 0, 0, FOTO_PERFIL_LARGURA, FOTO_PERFIL_ALTURA);

  const webp = await paraBlob(canvas, 'image/webp', 0.85);
  if (webp && webp.type === 'image/webp') return { blob: webp, extensao: 'webp' };
  const jpeg = await paraBlob(canvas, 'image/jpeg', 0.88);
  return jpeg ? { blob: jpeg, extensao: 'jpg' } : null;
}
