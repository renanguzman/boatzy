import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { FUSO_HORARIO } from '@/lib/datas';
import {
  COOKIE_IDIOMA,
  HEADER_AREA,
  IDIOMA_PADRAO,
  idiomaDoAcceptLanguage,
  isIdioma,
  type Idioma,
} from './config';

const MENSAGENS = {
  'pt-BR': () => import('../../messages/pt-BR'),
  'en-US': () => import('../../messages/en-US'),
  es: () => import('../../messages/es'),
} satisfies Record<Idioma, unknown>;

/**
 * Idioma da requisição, nesta ordem (SPEC §94.2):
 * 1. painel/administrador (marcados pelo proxy) → sempre pt-BR;
 * 2. cookie `NEXT_LOCALE` — escolha no seletor, ou a do perfil copiada no login;
 * 3. `Accept-Language` do navegador;
 * 4. pt-BR.
 */
async function idiomaDaRequisicao(): Promise<Idioma> {
  const h = await headers();
  if (h.get(HEADER_AREA) === 'interno') return IDIOMA_PADRAO;

  const cookie = (await cookies()).get(COOKIE_IDIOMA)?.value;
  if (isIdioma(cookie)) return cookie;

  return idiomaDoAcceptLanguage(h.get('accept-language')) ?? IDIOMA_PADRAO;
}

export default getRequestConfig(async ({ locale }) => {
  // `locale` só vem preenchido quando o código pede um idioma explícito
  // (ex.: `getTranslations({ locale: 'pt-BR', namespace })`).
  const idioma = isIdioma(locale) ? locale : await idiomaDaRequisicao();
  return {
    locale: idioma,
    messages: (await MENSAGENS[idioma]()).default,
    // Tudo é exibido no horário de Brasília, em qualquer idioma (o passeio é no Brasil).
    timeZone: FUSO_HORARIO,
  };
});
