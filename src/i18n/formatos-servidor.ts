import 'server-only';

import { getLocale, getTranslations } from 'next-intl/server';
import { criarFormatos, type Formatos } from './formatos';

/** `useFormatos()` para funções `async` do servidor (páginas, server actions). */
export async function getFormatos(): Promise<Formatos> {
  const [t, idioma] = await Promise.all([getTranslations('Formatos'), getLocale()]);
  return criarFormatos(t, idioma);
}
