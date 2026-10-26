import type { Idioma } from '@/i18n/config';
import type { Mensagens } from '../../messages/pt-BR';

// Chaves e idiomas tipados: `t('chave')` inexistente vira erro de compilação (SPEC §94.3).
declare module 'next-intl' {
  interface AppConfig {
    Locale: Idioma;
    Messages: Mensagens;
  }
}
