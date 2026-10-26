#!/usr/bin/env node
/**
 * Confere as traduções do site (SPEC §94.3) contra a fonte pt-BR:
 *  - mesmos arquivos JSON em cada pasta de messages/;
 *  - mesmas chaves (falta ou sobra em en-US/es);
 *  - mesmas variáveis ICU em cada texto ({nome}, {count, plural, ...});
 *  - nenhum texto vazio;
 *  - cada JSON importado no `index.ts` da sua pasta (senão fica fora do site).
 * O TypeScript já acusa chave faltando; este script pega também sobras e
 * variáveis trocadas. Uso: `npm run i18n:verificar` (sai com código 1 se falhar).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..', 'messages');
const FONTE = 'pt-BR';
const TRADUCOES = ['en-US', 'es'];

const erros = [];

function jsons(idioma) {
  return readdirSync(join(RAIZ, idioma)).filter((f) => f.endsWith('.json')).sort();
}

/** Achata { a: { b: 'x' } } em { 'a.b': 'x' }. */
function achatar(obj, prefixo = '', saida = {}) {
  for (const [chave, valor] of Object.entries(obj)) {
    const caminho = prefixo ? `${prefixo}.${chave}` : chave;
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) achatar(valor, caminho, saida);
    else saida[caminho] = valor;
  }
  return saida;
}

/** Nomes dos argumentos ICU usados no texto (inclusive dentro de plural/select). */
function variaveis(texto) {
  if (typeof texto !== 'string') return '';
  const nomes = new Set();
  for (const m of texto.matchAll(/\{\s*([A-Za-z_]\w*)\s*(?:,|\})/g)) nomes.add(m[1]);
  return [...nomes].sort().join(',');
}

const arquivosFonte = jsons(FONTE);

for (const idioma of [FONTE, ...TRADUCOES]) {
  const indice = readFileSync(join(RAIZ, idioma, 'index.ts'), 'utf8');
  for (const f of jsons(idioma).filter((f) => !indice.includes(`'./${f}'`))) {
    erros.push(`${idioma}: ${f} não é importado em index.ts`);
  }
}

for (const idioma of TRADUCOES) {
  const arquivos = jsons(idioma);
  for (const f of arquivosFonte.filter((f) => !arquivos.includes(f))) erros.push(`${idioma}: falta o arquivo ${f}`);
  for (const f of arquivos.filter((f) => !arquivosFonte.includes(f))) erros.push(`${idioma}: arquivo ${f} não existe em ${FONTE}`);

  for (const arquivo of arquivosFonte.filter((f) => arquivos.includes(f))) {
    const fonte = achatar(JSON.parse(readFileSync(join(RAIZ, FONTE, arquivo), 'utf8')));
    const traducao = achatar(JSON.parse(readFileSync(join(RAIZ, idioma, arquivo), 'utf8')));

    for (const [chave, texto] of Object.entries(fonte)) {
      if (!(chave in traducao)) {
        erros.push(`${idioma}/${arquivo}: falta ${chave}`);
        continue;
      }
      if (typeof traducao[chave] !== 'string' || !traducao[chave].trim()) {
        erros.push(`${idioma}/${arquivo}: ${chave} vazio`);
        continue;
      }
      if (variaveis(texto) !== variaveis(traducao[chave])) {
        erros.push(`${idioma}/${arquivo}: ${chave} usa {${variaveis(traducao[chave])}}, ${FONTE} usa {${variaveis(texto)}}`);
      }
    }
    for (const chave of Object.keys(traducao).filter((c) => !(c in fonte))) {
      erros.push(`${idioma}/${arquivo}: ${chave} não existe em ${FONTE}`);
    }
  }
}

for (const [chave, texto] of Object.entries(
  Object.assign({}, ...arquivosFonte.map((f) => achatar(JSON.parse(readFileSync(join(RAIZ, FONTE, f), 'utf8'))))),
)) {
  if (typeof texto !== 'string' || !texto.trim()) erros.push(`${FONTE}: ${chave} vazio`);
}

if (erros.length) {
  console.error(`✗ ${erros.length} problema(s) nas traduções:\n  ${erros.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ Traduções em dia (${arquivosFonte.length} arquivo(s), ${TRADUCOES.join(' e ')} conferidos com ${FONTE}).`);
