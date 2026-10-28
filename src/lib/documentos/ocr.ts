import { lerCampos, pontuarTexto, type CamposLidos } from './leitura';

/**
 * Leitura do documento NO NAVEGADOR (SPEC §95.4) — sem IA e sem servidor: o
 * texto lido não sai do aparelho do gestor.
 *
 *  1. PDF digital (ex.: TIE digital da Marinha): texto extraído direto do PDF
 *     com pdf.js — instantâneo e exato.
 *  2. Foto ou PDF escaneado: imagem tratada (até 2000px, tons de cinza,
 *     contraste esticado) e OCR com Tesseract.js em português, modo "texto
 *     esparso" (PSM 11 — o que melhor leu os campos em molduras do TIE).
 *     Foto de lado é comum: tenta 0°, 270°, 90° e 180° e fica com a leitura
 *     que mais parece um documento náutico.
 *
 * As bibliotecas são carregadas sob demanda (import dinâmico) — o resto do
 * painel não fica mais pesado. Os arquivos do Tesseract (motor e idioma) vêm
 * do CDN jsDelivr e ficam em cache no navegador depois da 1ª leitura.
 */

export type EtapaLeitura = 'preparando' | 'lendo' | 'interpretando';

export type ProgressoLeitura = { etapa: EtapaLeitura; mensagem: string; progresso?: number };

export type ResultadoLeitura = {
  origem: 'pdf' | 'ocr';
  campos: CamposLidos;
  /** Confiança média do OCR (0–100); null no texto do PDF. */
  confianca: number | null;
};

type Opcoes = {
  embarcacoesConhecidas?: string[];
  pessoasConhecidas?: string[];
  /** Validade máxima do tipo escolhido, em anos (descarta datas impossíveis). */
  anosValidade?: number | null;
  onProgresso?: (p: ProgressoLeitura) => void;
};

const LADO_MAXIMO = 2000;
const LADO_MINIMO = 1600;

export async function lerDocumento(arquivo: File, opts: Opcoes = {}): Promise<ResultadoLeitura> {
  const avisar = opts.onProgresso ?? (() => {});
  const conhecidos = {
    embarcacoesConhecidas: opts.embarcacoesConhecidas,
    pessoasConhecidas: opts.pessoasConhecidas,
    anosValidade: opts.anosValidade,
  };

  let imagem: HTMLCanvasElement;
  if (arquivo.type === 'application/pdf') {
    avisar({ etapa: 'preparando', mensagem: 'Abrindo o PDF…' });
    const pdf = await abrirPdf(arquivo);
    const texto = await textoDoPdf(pdf);
    if (texto.replace(/\s/g, '').length > 40 && pontuarTexto(texto) >= 2) {
      avisar({ etapa: 'interpretando', mensagem: 'Lendo os campos do documento…' });
      return { origem: 'pdf', campos: lerCampos(texto, conhecidos), confianca: null };
    }
    // PDF escaneado (só imagem): segue pelo OCR da 1ª página.
    imagem = await renderizarPaginaPdf(pdf);
  } else {
    avisar({ etapa: 'preparando', mensagem: 'Preparando a imagem…' });
    imagem = await canvasDaImagem(arquivo);
  }

  tratarImagem(imagem);
  return ocr(imagem, avisar, conhecidos);
}

// ── PDF ───────────────────────────────────────────────────────────────────────

type PdfDoc = import('pdfjs-dist').PDFDocumentProxy;

async function abrirPdf(arquivo: File): Promise<PdfDoc> {
  const pdfjs = await import('pdfjs-dist');
  // Worker do mesmo pacote/versão, pelo CDN (dispensa configuração do bundler).
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  return pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
}

/** Texto da 1ª página, uma linha por linha visual do PDF. */
async function textoDoPdf(pdf: PdfDoc): Promise<string> {
  const pagina = await pdf.getPage(1);
  const conteudo = await pagina.getTextContent();
  let texto = '';
  for (const item of conteudo.items) {
    if (!('str' in item)) continue;
    texto += item.str;
    texto += item.hasEOL ? '\n' : ' ';
  }
  return texto;
}

async function renderizarPaginaPdf(pdf: PdfDoc): Promise<HTMLCanvasElement> {
  const pagina = await pdf.getPage(1);
  const base = pagina.getViewport({ scale: 1 });
  const escala = LADO_MAXIMO / Math.max(base.width, base.height);
  const viewport = pagina.getViewport({ scale: escala });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await pagina.render({ canvas, viewport }).promise;
  return canvas;
}

// ── Imagem ────────────────────────────────────────────────────────────────────

/** Desenha a foto num canvas (respeitando a orientação EXIF) já no tamanho de trabalho. */
async function canvasDaImagem(arquivo: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  const maior = Math.max(bitmap.width, bitmap.height);
  const escala = maior > LADO_MAXIMO ? LADO_MAXIMO / maior : maior < LADO_MINIMO ? LADO_MINIMO / maior : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

/** Tons de cinza + contraste esticado entre os percentis 1 e 99 (fundo claro, texto escuro). */
function tratarImagem(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = img.data;
  const histograma = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) {
    const cinza = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    px[i] = cinza;
    histograma[cinza]++;
  }
  const total = px.length / 4;
  let acumulado = 0;
  let baixo = 0;
  let alto = 255;
  for (let v = 0; v < 256; v++) {
    acumulado += histograma[v];
    if (acumulado <= total * 0.01) baixo = v;
    if (acumulado <= total * 0.99) alto = v;
  }
  const faixa = Math.max(1, alto - baixo);
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.max(0, Math.min(255, Math.round(((px[i] - baixo) * 255) / faixa)));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

function girar(origem: HTMLCanvasElement, graus: number): HTMLCanvasElement {
  if (graus === 0) return origem;
  const canvas = document.createElement('canvas');
  const deitado = graus === 90 || graus === 270;
  canvas.width = deitado ? origem.height : origem.width;
  canvas.height = deitado ? origem.width : origem.height;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((graus * Math.PI) / 180);
  ctx.drawImage(origem, -origem.width / 2, -origem.height / 2);
  return canvas;
}

// ── OCR ───────────────────────────────────────────────────────────────────────

/** Ordem das tentativas: foto em pé, de lado (anti-horário e horário), de cabeça para baixo. */
const ROTACOES = [0, 270, 90, 180];

/** Preto e branco puro (limiar fixo sobre a imagem já tratada) — 2ª passada quando faltam campos. */
function binarizar(origem: HTMLCanvasElement, limiar = 150): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = origem.width;
  canvas.height = origem.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(origem, 0, 0);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const v = px[i] >= limiar ? 255 : 0;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Reforço de nitidez (máscara 3×3) — 3ª passada, para texto suavizado pela câmera. */
function realcar(origem: HTMLCanvasElement): HTMLCanvasElement {
  const { width: w, height: h } = origem;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(origem, 0, 0);
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const a = src.data;
  const b = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let v = a[i];
      if (x > 0 && y > 0 && x < w - 1 && y < h - 1) {
        v = 5 * a[i] - a[i - 4] - a[i + 4] - a[i - w * 4] - a[i + w * 4];
      }
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      b[i] = b[i + 1] = b[i + 2] = v;
      b[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

async function ocr(
  imagem: HTMLCanvasElement,
  avisar: (p: ProgressoLeitura) => void,
  conhecidos: Pick<Opcoes, 'embarcacoesConhecidas' | 'pessoasConhecidas' | 'anosValidade'>,
): Promise<ResultadoLeitura> {
  const { createWorker, PSM } = await import('tesseract.js');
  avisar({ etapa: 'preparando', mensagem: 'Carregando o leitor de documentos…' });

  let mensagem = 'Lendo o documento…';
  const worker = await createWorker('por', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') avisar({ etapa: 'lendo', mensagem, progresso: m.progress });
    },
  });

  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });

    // 1) Posição da foto: fica com a leitura que mais parece um documento náutico.
    let melhor = { texto: '', confianca: 0, nota: -1, graus: 0 };
    for (const graus of ROTACOES) {
      const { data } = await worker.recognize(girar(imagem, graus));
      const pontos = pontuarTexto(data.text);
      const nota = pontos * 10 + data.confidence / 10;
      if (nota > melhor.nota) melhor = { texto: data.text, confianca: data.confidence, nota, graus };
      // Leitura boa o bastante: não precisa testar as outras posições.
      if (pontos >= 6 && data.confidence >= 55) break;
      mensagem = 'Ajustando a posição da foto…';
    }

    let campos = lerCampos(melhor.texto, conhecidos);

    // 2) Faltou validade ou número: novas passadas (preto e branco; nitidez reforçada) completando
    //    só o que faltou — molduras, fundo texturizado e o suavizado da câmera confundem o OCR de
    //    formas diferentes em cada versão da imagem.
    const melhorPosicao = girar(imagem, melhor.graus);
    for (const variante of [binarizar, realcar]) {
      if (campos.dataValidade && campos.numero) break;
      mensagem = 'Conferindo os dados…';
      const { data } = await worker.recognize(variante(melhorPosicao));
      const extra = lerCampos(data.text, conhecidos);
      campos = Object.fromEntries(
        Object.entries(campos).map(([k, v]) => [k, v ?? extra[k as keyof CamposLidos]]),
      ) as CamposLidos;
    }

    return { origem: 'ocr', campos, confianca: Math.round(melhor.confianca) };
  } finally {
    await worker.terminate();
  }
}
