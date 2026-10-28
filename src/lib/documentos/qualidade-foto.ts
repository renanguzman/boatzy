/**
 * Avaliação da qualidade da foto de um documento antes da leitura (SPEC §95.8)
 * — função pura sobre os pixels (RGBA), sem dependências: roda no navegador e
 * nos testes. Trabalha numa cópia reduzida (lado maior ~640px).
 *
 *  - nitidez: variância do Laplaciano (foto tremida/fora de foco → valor baixo);
 *  - iluminação: brilho médio (escura ou estourada);
 *  - reflexo: fração de pixels quase brancos (plástico do documento refletindo);
 *  - resolução: lado menor da foto original.
 *
 * Limiares calibrados com fotos reais de TIE e versões degradadas delas: o OCR
 * leu todos os campos até nitidez ~830 e falhou a partir de ~490 (desfoque σ1,2).
 */

export type ProblemaFoto = 'tremida' | 'escura' | 'clara' | 'reflexo' | 'pequena';

export type QualidadeFoto = {
  boa: boolean;
  problemas: ProblemaFoto[];
  medidas: { nitidez: number; brilho: number; reflexo: number; ladoMenor: number };
};

export const LIMIARES_FOTO = {
  nitidezMinima: 600,
  brilhoMinimo: 70,
  brilhoMaximo: 225,
  reflexoMaximo: 0.06,
  ladoMenorMinimo: 600,
};

export const MENSAGEM_PROBLEMA: Record<ProblemaFoto, { titulo: string; dica: string }> = {
  tremida: { titulo: 'Foto tremida ou fora de foco', dica: 'Apoie os cotovelos, aproxime e espere a câmera focar antes de tocar.' },
  escura: { titulo: 'Foto escura', dica: 'Procure um lugar mais claro ou acenda a luz.' },
  clara: { titulo: 'Foto clara demais', dica: 'Evite luz direta do sol sobre o documento.' },
  reflexo: { titulo: 'Reflexo sobre o documento', dica: 'Incline um pouco o documento ou tire do plástico para sumir o brilho.' },
  pequena: { titulo: 'Resolução baixa', dica: 'Aproxime a câmera para o documento ocupar a moldura.' },
};

type Pixels = { data: ArrayLike<number>; width: number; height: number };

/**
 * `imagem`: pixels RGBA já reduzidos (lado maior ~640px).
 * `ladoMenorOriginal`: lado menor da foto antes da redução (resolução real).
 */
export function avaliarQualidade(imagem: Pixels, ladoMenorOriginal: number): QualidadeFoto {
  const { data, width: w, height: h } = imagem;
  const cinza = new Float32Array(w * h);
  let soma = 0;
  let estourados = 0;
  for (let i = 0, p = 0; p < cinza.length; i += 4, p++) {
    const v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    cinza[p] = v;
    soma += v;
    if (v >= 250) estourados++;
  }
  const brilho = soma / cinza.length;
  const reflexo = estourados / cinza.length;

  // Variância do Laplaciano (4 vizinhos), ignorando a borda.
  let n = 0;
  let media = 0;
  let m2 = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      const lap = 4 * cinza[p] - cinza[p - 1] - cinza[p + 1] - cinza[p - w] - cinza[p + w];
      n++;
      const d = lap - media;
      media += d / n;
      m2 += d * (lap - media);
    }
  }
  const nitidez = n > 1 ? m2 / (n - 1) : 0;

  const L = LIMIARES_FOTO;
  const problemas: ProblemaFoto[] = [];
  if (nitidez < L.nitidezMinima) problemas.push('tremida');
  if (brilho < L.brilhoMinimo) problemas.push('escura');
  else if (brilho > L.brilhoMaximo) problemas.push('clara');
  if (reflexo > L.reflexoMaximo) problemas.push('reflexo');
  if (ladoMenorOriginal < L.ladoMenorMinimo) problemas.push('pequena');

  return {
    boa: problemas.length === 0,
    problemas,
    medidas: {
      nitidez: Math.round(nitidez),
      brilho: Math.round(brilho),
      reflexo: Math.round(reflexo * 1000) / 1000,
      ladoMenor: ladoMenorOriginal,
    },
  };
}

/** No navegador: avalia um canvas/imagem/bitmap (reduz para ~640px antes). */
export function avaliarQualidadeDe(
  fonte: CanvasImageSource & { width: number; height: number },
): QualidadeFoto {
  const maior = Math.max(fonte.width, fonte.height);
  const escala = Math.min(1, 640 / maior);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(fonte.width * escala));
  canvas.height = Math.max(1, Math.round(fonte.height * escala));
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(fonte, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return avaliarQualidade(img, Math.min(fonte.width, fonte.height));
}
