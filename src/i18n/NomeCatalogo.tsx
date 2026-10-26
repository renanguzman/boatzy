'use client';

import { useCatalogo } from './CatalogoProvider';
import type { CategoriaCatalogo } from './catalogo';

/** Nome de catálogo no idioma do site, para componentes de servidor síncronos (sem contexto). */
export default function NomeCatalogo({ categoria, nome }: { categoria: CategoriaCatalogo; nome: string }) {
  const { traduzir } = useCatalogo();
  return <>{traduzir(categoria, nome)}</>;
}
