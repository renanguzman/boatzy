'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { LOCALE_INTL, isIdioma, IDIOMA_PADRAO } from './config';
import {
  CATALOGO_VAZIO,
  criarTradutorCatalogo,
  ordenarPorCatalogo,
  type CategoriaCatalogo,
  type DadosCatalogo,
  type TradutorCatalogo,
} from './catalogo';

const Contexto = createContext<DadosCatalogo>(CATALOGO_VAZIO);

/** Entrega o dicionário dos catálogos (vindo do servidor, no layout raiz) aos componentes de cliente. */
export function CatalogoProvider({ dados, children }: { dados: DadosCatalogo; children: ReactNode }) {
  return <Contexto.Provider value={dados}>{children}</Contexto.Provider>;
}

/** `traduzir(categoria, nomePtBR)` e `ordenar(itens, categoria)` no idioma do site. */
export function useCatalogo(): {
  traduzir: TradutorCatalogo;
  ordenar: <T extends { nome: string }>(itens: T[], categoria: CategoriaCatalogo) => T[];
} {
  const dados = useContext(Contexto);
  const locale = useLocale();
  const localeIntl = LOCALE_INTL[isIdioma(locale) ? locale : IDIOMA_PADRAO];
  return useMemo(() => {
    const traduzir = criarTradutorCatalogo(dados);
    return {
      traduzir,
      ordenar: (itens, categoria) => ordenarPorCatalogo(itens, categoria, traduzir, localeIntl),
    };
  }, [dados, localeIntl]);
}
