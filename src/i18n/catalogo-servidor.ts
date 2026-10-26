import 'server-only';

import { getLocale } from 'next-intl/server';
import { supabaseAdmin } from '@/lib/supabase';
import { IDIOMA_PADRAO, LOCALE_INTL, isIdioma, type Idioma } from './config';
import {
  CATALOGO_VAZIO,
  CATEGORIAS_CATALOGO,
  TABELA_CATALOGO,
  criarTradutorCatalogo,
  type DadosCatalogo,
  type TradutorCatalogo,
} from './catalogo';

const TTL_MS = 60_000;
const cache = new Map<Idioma, { expira: number; dados: DadosCatalogo }>();

type Linha = { nome: string; nome_en: string | null; nome_es: string | null };

/**
 * Dicionário dos catálogos no idioma. pt-BR não consulta o banco. Cache em memória de 1 minuto
 * por instância (os catálogos são pequenos e mudam pouco); se a consulta falhar — por exemplo,
 * antes da migration `20261027` — devolve vazio e o site mostra os nomes em pt-BR.
 */
export async function carregarDadosCatalogo(idioma: Idioma): Promise<DadosCatalogo> {
  if (idioma === IDIOMA_PADRAO) return CATALOGO_VAZIO;

  const agora = Date.now();
  const emCache = cache.get(idioma);
  if (emCache && emCache.expira > agora) return emCache.dados;

  const coluna = idioma === 'es' ? 'nome_es' : 'nome_en';
  const resultados = await Promise.all(
    CATEGORIAS_CATALOGO.map((c) => supabaseAdmin.from(TABELA_CATALOGO[c]).select('nome, nome_en, nome_es')),
  );

  const dados: DadosCatalogo = { tipo: {}, comodidade: {}, acessorio: {}, equipamento: {} };
  resultados.forEach(({ data, error }, i) => {
    if (error) {
      console.error(`[catalogo] falha ao carregar ${TABELA_CATALOGO[CATEGORIAS_CATALOGO[i]]}:`, error.message);
      return;
    }
    for (const linha of (data ?? []) as Linha[]) {
      const traduzido = linha[coluna]?.trim();
      if (traduzido) dados[CATEGORIAS_CATALOGO[i]][linha.nome] = traduzido;
    }
  });

  // Não guarda no cache um resultado vazio por falha (tenta de novo na próxima requisição).
  if (resultados.every((r) => !r.error)) cache.set(idioma, { expira: agora + TTL_MS, dados });
  return dados;
}

/** Tradutor dos catálogos para o idioma da requisição, para páginas e funções `async` do servidor. */
export async function getCatalogo(): Promise<{
  traduzir: TradutorCatalogo;
  dados: DadosCatalogo;
  localeIntl: string;
}> {
  const locale = await getLocale();
  const idioma = isIdioma(locale) ? locale : IDIOMA_PADRAO;
  const dados = await carregarDadosCatalogo(idioma);
  return { traduzir: criarTradutorCatalogo(dados), dados, localeIntl: LOCALE_INTL[idioma] };
}
