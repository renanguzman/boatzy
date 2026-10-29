import type { DocumentoTipo } from '@/types/supabase';
import { encontrarNomeNoTexto, nomeApresentavel, normalizarNome } from './nomes';
import { normalizarCategorias } from './tipos';

/**
 * Interpretação do texto lido de um documento (OCR da foto ou texto do PDF) —
 * SPEC §95.4. Função pura: recebe o texto e devolve os campos que conseguiu
 * reconhecer. O gestor sempre confere antes de salvar.
 *
 * Calibrado com TIE/TIEM reais (Capitania dos Portos de SC) e com a CHA
 * digital compartilhada pelo gov.br (frente + verso). O OCR em modo "texto
 * esparso" devolve cada rótulo e cada valor numa linha, na ordem do documento:
 * os valores são procurados nas linhas logo depois do rótulo.
 */

export type CamposLidos = {
  /** Tipo que o texto aparenta ser (para avisar se o gestor escolheu outro). */
  tipoDetectado: DocumentoTipo | null;
  numero: string | null;
  titular: string | null;
  embarcacaoNome: string | null;
  /** Categorias da habilitação separadas por vírgula ("mestre,motonauta"). */
  categoria: string | null;
  /** CPF do titular da habilitação (gravado em `documento.titular_cpf`). */
  cpf: string | null;
  dataEmissao: string | null;
  dataValidade: string | null;
  tipoEmbarcacao: string | null;
  areaNavegacao: string | null;
  atividade: string | null;
  /** Habilitação: "Limites da navegação" (só a parte em português). */
  limitesNavegacao: string | null;
  /** Órgão que emitiu (ex.: "Capitania dos Portos de Santa Catarina"). */
  orgaoEmissor: string | null;
};

/** Quanto o texto "parece" um documento náutico — escolhe a melhor rotação da foto. */
export function pontuarTexto(texto: string): number {
  const t = normalizarNome(texto);
  const chaves = [
    'REPUBLICA', 'FEDERATIVA', 'AUTORIDADE', 'MARITIMA', 'CAPITANIA', 'MARINHA', 'TITULO', 'INSCRICAO',
    'EMBARCACAO', 'VALIDADE', 'HABILITACAO', 'AMADOR', 'CATEGORIA', 'NOME', 'PROPULSAO', 'NAVEGACAO',
  ];
  return chaves.filter((c) => t.includes(c)).length;
}

type Linha = { original: string; norm: string; junto: string };

function linhas(texto: string): Linha[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((original) => {
      const norm = normalizarNome(original);
      return { original, norm, junto: norm.replace(/ /g, '') };
    });
}

// ── Datas ─────────────────────────────────────────────────────────────────────

type DataLida = { iso: string; linha: number };

const RE_DATA = /(?<!\d)(\d{2})\s?[/.-]?\s?(\d{2})\s?[/.-]?\s?(\d{4})(?!\d)/g;

/**
 * Linhas do "envelope" do documento digital, não do documento: "Compartilhado pelo
 * aplicativo gov.br em 29/10/2026", "Assinado digitalmente…". A data delas não é
 * emissão nem validade (a CHA do gov.br tinha a data do compartilhamento lida como validade).
 */
const RE_LINHA_ENVELOPE = /COMPARTILHAD|ASSINAD|GERADOEM|IMPRESSOEM|CONSULTADOEM|VALIDARITI/;

function datas(ls: Linha[]): DataLida[] {
  const out: DataLida[] = [];
  ls.forEach((l, i) => {
    if (RE_LINHA_ENVELOPE.test(l.junto)) return;
    for (const m of l.original.matchAll(RE_DATA)) {
      const [dia, mes, ano] = [Number(m[1]), Number(m[2]), Number(m[3])];
      if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || ano < 1950 || ano > 2099) continue;
      const d = new Date(Date.UTC(ano, mes - 1, dia));
      if (d.getUTCDate() !== dia) continue; // 31/02 etc.
      out.push({ iso: `${m[3]}-${m[2]}-${m[1]}`, linha: i });
    }
  });
  return out;
}

/** Primeira data nas `alcance` linhas a partir do rótulo (inclusive). */
function dataAposRotulo(ls: Linha[], ds: DataLida[], rotulos: string[], alcance = 6): string | null {
  const i = ls.findIndex((l) => rotulos.some((r) => l.junto.includes(r)));
  if (i < 0) return null;
  return ds.find((d) => d.linha >= i && d.linha <= i + alcance)?.iso ?? null;
}

// ── Número do documento ───────────────────────────────────────────────────────

const RE_NUMERO_ALFA = /(?<![A-Z0-9])(\d{3}[A-Z]\d{8,11})(?![A-Z0-9])/g; // 441M2016005268
const RE_NUMERO = /(?<![\d/.,-])(\d{9,11})(?![\d/.,])/g; // 3810498173
const ROTULOS_NUMERO = ['INSCRICAO', 'NUMERO', 'APOLICE', 'REGISTRO'];

function cpfValido(digitos: string): boolean {
  if (!/^\d{11}$/.test(digitos) || /^(\d)\1{10}$/.test(digitos)) return false;
  const calc = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(digitos[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(digitos[9]) && calc(10) === Number(digitos[10]);
}

function numero(ls: Linha[]): string | null {
  const indicesRotulo = ls
    .map((l, i) => (ROTULOS_NUMERO.some((r) => l.junto.includes(r)) && !l.junto.includes('DATA') ? i : -1))
    .filter((i) => i >= 0);
  const pertoDeRotulo = (i: number) => indicesRotulo.some((r) => i >= r && i - r <= 8);

  type Cand = { valor: string; nota: number; linha: number };
  const cands: Cand[] = [];
  ls.forEach((l, i) => {
    const bruto = l.original.toUpperCase();
    for (const m of bruto.matchAll(RE_NUMERO_ALFA)) cands.push({ valor: m[1], nota: 3, linha: i });
    for (const m of bruto.matchAll(RE_NUMERO)) {
      const v = m[1];
      if (v.length === 11 && cpfValido(v)) continue; // é CPF
      cands.push({ valor: v, nota: v.length === 10 ? 2 : 1, linha: i });
    }
  });
  for (const c of cands) if (pertoDeRotulo(c.linha)) c.nota += 2;
  cands.sort((a, b) => b.nota - a.nota || a.linha - b.linha);
  return cands[0]?.valor ?? null;
}

// ── Textos depois de um rótulo ────────────────────────────────────────────────

/** Palavras de rótulos do documento — uma linha com elas não é um valor. */
const PALAVRAS_ROTULO = [
  'VALIDADE', 'TRIPULANTES', 'PASSAGEIROS', 'INSCRICAO', 'INSCRICÃO', 'DATA', 'MOTOR', 'TIPO', 'QTD', 'OTD',
  'NOME', 'CATEGORIA', 'CPF', 'EMISSAO', 'NASCIMENTO', 'FILIACAO', 'REGISTRO', 'NUMERO', 'EMBARCACAO',
  'PROPRIETARIO', 'REPUBLICA', 'AUTORIDADE', 'CAPITANIA', 'MARINHA', 'NACIONALIDADE', 'ASSINATURA',
];

/** Valor em letras (nome de pessoa ou de embarcação) nas linhas seguintes ao rótulo. */
function textoAposRotulo(
  ls: Linha[],
  rotulo: (l: Linha) => boolean,
  opts: { minPalavras?: number; alcance?: number } = {},
): string | null {
  const { minPalavras = 1, alcance = 6 } = opts;
  const i = ls.findIndex(rotulo);
  if (i < 0) return null;
  for (let j = i + 1; j <= i + alcance && j < ls.length; j++) {
    const valor = ls[j].original
      .replace(/[^A-Za-zÀ-ÿ0-9' -]+/g, ' ')
      .replace(/(^[\s-]+|[\s-]+$)/g, '')
      .replace(/\s+/g, ' ');
    const letras = valor.replace(/[^A-Za-zÀ-ÿ]/g, '');
    if (letras.length < 3) continue;
    const norm = normalizarNome(valor);
    if (PALAVRAS_ROTULO.some((p) => norm.includes(p))) continue;
    // Valor impresso em maiúsculas: descarta linhas de ruído com minúsculas misturadas.
    if (letras !== letras.toUpperCase()) continue;
    if (norm.split(' ').filter((p) => p.length > 1).length < minPalavras) continue;
    return valor;
  }
  return null;
}

// ── Classificação e extras ────────────────────────────────────────────────────

function tipoDetectado(t: string): DocumentoTipo | null {
  const j = t.replace(/ /g, '');
  if (j.includes('MIUDA')) return 'tiem';
  if (j.includes('HABILITACAODEAMADOR') || (j.includes('AMADOR') && j.includes('CATEGORIA'))) return 'cha';
  if (j.includes('CADERNETADEINSCRICAO')) return 'cir';
  if (j.includes('PROPRIEDADEMARITIMA')) return 'prpm';
  // O título costuma quebrar em duas linhas no OCR ("TÍTULO DE INSCRIÇ" / "ÃO DE EMBARCAÇÃO").
  // Vem antes do DPEM: o TIE cita o seguro DPEM no texto (a foto do TIE era lida como "DPEM").
  if (j.includes('TITULODEINSCRI') || j.includes('INSCRICAODEEMBARCA')) return 'tie';
  if (j.includes('DPEM')) return 'dpem';
  if (j.includes('CAPITANIA') && j.includes('EMBARCACAO')) return 'tie';
  return null;
}

/**
 * Categorias da habilitação — a CHA pode somar uma categoria de amador (Arrais, Mestre ou
 * Capitão) com Motonauta e/ou Veleiro ("MESTRE AMADOR E MOTONAUTA"). Procura nas linhas
 * logo após o rótulo "CATEGORIA" e, sem rótulo, no texto todo (só as formas inequívocas).
 */
function categorias(ls: Linha[], tudo: string): string | null {
  const i = ls.findIndex((l) => /^CATEGORIA\b/.test(l.norm));
  const trecho = i >= 0 ? ls.slice(i, i + 4).map((l) => l.norm).join(' ') : null;
  const t = trecho ?? tudo;
  const achadas: string[] = [];
  if (/CAPITAO ?AMADOR/.test(t)) achadas.push('capitao');
  else if (/MESTRE ?AMADOR/.test(t)) achadas.push('mestre');
  else if (/ARRAIS/.test(t)) achadas.push('arrais');
  if (/MOTONAUTA/.test(t)) achadas.push('motonauta');
  if (trecho ? /VELEIRO/.test(t) : /VELEIRO ?AMADOR|CATEGORIA VELEIRO/.test(t)) achadas.push('veleiro');
  return normalizarCategorias(achadas.join(','));
}

/** "Limites da navegação" da habilitação: a linha após o rótulo, sem a tradução em inglês. */
function limitesNavegacao(ls: Linha[]): string | null {
  const i = ls.findIndex((l) => l.junto.includes('LIMITESDANAVEGA') || l.junto.includes('LIMITEDENAVEGA'));
  if (i < 0) return null;
  for (let j = i + 1; j <= i + 3 && j < ls.length; j++) {
    const pt = ls[j].original.split(/\s\/\s?|\s?\/\s/)[0].replace(/[\s./]+$/, '').trim();
    const letras = pt.replace(/[^A-Za-zÀ-ÿ]/g, '');
    if (letras.length < 5 || letras !== letras.toUpperCase()) continue;
    if (/REQUISITOS|EMISSAO|NAVIGATION/.test(ls[j].norm)) break;
    // A tradução em inglês às vezes vem antes na leitura ("WHEN PILOTTING…, INLAND WATERS").
    if (/\b(WHEN|WATERS?|PILOTT?ING|COASTAL|INLAND|OCEANIC|ONLY)\b/.test(normalizarNome(pt))) continue;
    return fraseApresentavel(pt).slice(0, 120);
  }
  return null;
}

/** Órgão emissor: Capitania, Delegacia ou Agência (de preferência logo após "Órgão de emissão"). */
function orgaoEmissor(ls: Linha[]): string | null {
  const re = /^(CAPITANIA|DELEGACIA|AGENCIA) (DOS|DA|DE|DO|FLUVIAL|FLUVIAIS)\b/;
  const i = ls.findIndex((l) => l.junto.includes('ORGAODEEMISSAO') || l.junto.includes('ORGAOEMISSOR'));
  const perto = i >= 0 ? ls.slice(i, i + 5).find((l) => re.test(l.norm)) : undefined;
  const linha = perto ?? ls.find((l) => re.test(l.norm));
  if (!linha) return null;
  const valor = linha.original.replace(/[^A-Za-zÀ-ÿ' -]+/g, ' ').replace(/\s+/g, ' ').trim();
  return nomeApresentavel(valor).slice(0, 80);
}

/** "COSTEIRA. QUANDO PILOTANDO MOTO AQUÁTICA, INTERIOR" → "Costeira. Quando pilotando moto aquática, interior". */
function fraseApresentavel(valor: string): string {
  return valor
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/(^|[.!?]\s+)(\p{L})/gu, (_, antes: string, letra: string) => antes + letra.toUpperCase());
}

const TIPOS_EMBARCACAO: [RegExp, string][] = [
  [/\bLANCHA\b/, 'Lancha'],
  [/\bMOTO ?AQUATICA\b|\bJET ?SKI\b/, 'Moto aquática'],
  [/\bIATE\b/, 'Iate'],
  [/\bVELEIRO\b/, 'Veleiro'],
  [/\bCATAMARA\b/, 'Catamarã'],
  [/\bESCUNA\b/, 'Escuna'],
  [/\bTRAINEIRA\b/, 'Traineira'],
  [/\bBOTE\b/, 'Bote'],
];

function tipoEmbarcacao(t: string): string | null {
  return TIPOS_EMBARCACAO.find(([re]) => re.test(t))?.[1] ?? null;
}

function areaNavegacao(t: string): string | null {
  const aberto = t.indexOf('MAR ABERTO');
  const interior = t.search(/NAVEGACAO INTERIOR|AREA 1 INTERIOR|\bINTERIOR\b/);
  if (aberto < 0 && interior < 0) return null;
  // O primeiro que aparece é o do documento (o outro pode estar nas observações).
  if (interior < 0 || (aberto >= 0 && aberto < interior)) return 'Mar aberto';
  return 'Navegação interior';
}

// ── Entrada ───────────────────────────────────────────────────────────────────

export function lerCampos(
  texto: string,
  opts: {
    embarcacoesConhecidas?: string[];
    pessoasConhecidas?: string[];
    anoAtual?: number;
    /** Validade máxima do tipo em anos (TIE 5, CHA 10, DPEM 1) — data além disso é erro de leitura. */
    anosValidade?: number | null;
  } = {},
): CamposLidos {
  const ls = linhas(texto);
  const tudo = normalizarNome(texto);
  const ds = datas(ls);

  // Validade = a data mais distante do documento (inscrição, emissão e nascimento são anteriores),
  // de preferência entre as que vêm logo depois do rótulo "VALIDADE". Data além da validade máxima
  // do tipo é erro de OCR ("2027" lido como "2037" num TIE, que vale 5 anos) — descartada, a leitura
  // fica vazia e a 2ª passada do OCR tenta de novo. Sem tipo conhecido, o teto é 11 anos.
  // Também não sobe documento vencido há mais de 6 anos: data tão antiga é a de inscrição/nascimento.
  const anoAtual = opts.anoAtual ?? new Date().getFullYear();
  const plausiveis = ds.filter((d) => {
    const ano = Number(d.iso.slice(0, 4));
    return ano <= anoAtual + (opts.anosValidade ?? 11) && ano >= anoAtual - 6;
  });
  const iRotulo = ls.findIndex((l) => /VALIDADE|VALIDOATE|VENCIMENTO|VIGENCIA/.test(l.junto));
  const pertoDoRotulo = iRotulo >= 0 ? plausiveis.filter((d) => d.linha >= iRotulo && d.linha <= iRotulo + 6) : [];
  const candidatas = pertoDoRotulo.length > 0 ? pertoDoRotulo : plausiveis;
  const validade = candidatas.length > 0 ? candidatas.map((d) => d.iso).sort().at(-1)! : null;
  const emissao = dataAposRotulo(ls, ds, ['EMISSAO', 'EXPEDICAO', 'EXPEDIDAEM']);

  const embarcacaoNome =
    encontrarNomeNoTexto(texto, opts.embarcacoesConhecidas ?? []) ??
    textoAposRotulo(ls, (l) => l.junto.includes('NOMEDAEMBARCA'));

  const titular =
    encontrarNomeNoTexto(texto, opts.pessoasConhecidas ?? []) ??
    textoAposRotulo(ls, (l) => l.junto.includes('PROPRIETARIO'), { minPalavras: 2 }) ??
    textoAposRotulo(
      ls,
      (l) => /^NOME\b/.test(l.norm) && !/EMBARCA|FABRICANTE|PAI|MAE|SOCIAL/.test(l.norm),
      { minPalavras: 2 },
    );

  const cpfMatch = [...texto.matchAll(/(?<!\d)(\d{3})\.?\s?(\d{3})\.?\s?(\d{3})\s?-?\s?(\d{2})(?!\d)/g)]
    .map((m) => m.slice(1).join(''))
    .find(cpfValido);

  return {
    tipoDetectado: tipoDetectado(tudo),
    numero: numero(ls),
    titular,
    embarcacaoNome,
    categoria: categorias(ls, tudo),
    cpf: cpfMatch ?? null,
    dataEmissao: emissao && emissao !== validade ? emissao : null,
    dataValidade: validade,
    tipoEmbarcacao: tipoEmbarcacao(tudo),
    areaNavegacao: areaNavegacao(tudo),
    atividade: tudo.includes('ESPORTE E RECREIO') ? 'Esporte e recreio' : null,
    limitesNavegacao: limitesNavegacao(ls),
    orgaoEmissor: orgaoEmissor(ls),
  };
}
