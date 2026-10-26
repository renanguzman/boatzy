import { useTranslations } from 'next-intl';

const MODALIDADES_CAPITAO = ['com_capitao', 'sem_capitao', 'opcional'] as const;
type ModalidadeCapitao = (typeof MODALIDADES_CAPITAO)[number];

function isModalidadeCapitao(valor: string): valor is ModalidadeCapitao {
  return (MODALIDADES_CAPITAO as readonly string[]).includes(valor);
}

/**
 * Rótulos de valores de domínio gravados no banco (enums), no idioma do site.
 * Valor desconhecido volta como veio. Serve componentes cliente e Server
 * Components síncronos.
 */
export function useRotulos() {
  const t = useTranslations('Roteiro');
  return {
    /** `embarcacao.modalidade_capitao` → "Com Capitão" / "Captain included" / "Con capitán". */
    capitao: (modalidade: string) => (isModalidadeCapitao(modalidade) ? t(`capitao.${modalidade}`) : modalidade),
  };
}
