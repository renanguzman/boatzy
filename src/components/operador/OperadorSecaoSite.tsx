import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import OperadorSecao from './OperadorSecao';
import OperadorChatBotao from './OperadorChatBotao';
import type { OperadorPublico } from '@/lib/operador-tipos';

/**
 * Seção do operador como o SITE a monta (SPEC §99): escolhe a ação certa conforme o contexto
 * (roteiro → chat em modal; embarcação → chat da embarcação; dono vendo a própria página →
 * atalho para editar o perfil). Server component: a página entrega o resultado à view.
 */
export default async function OperadorSecaoSite({
  operador,
  ehDono,
  roteiro,
  embarcacaoId,
}: {
  operador: OperadorPublico | null;
  ehDono: boolean;
  roteiro?: { id: string; nome: string };
  embarcacaoId?: string;
}) {
  // Sem versão aprovada no ar, a seção simplesmente não existe.
  if (!operador) return null;

  let acao;
  if (ehDono) {
    const t = await getTranslations('Operador');
    acao = (
      <Link
        href="/painel/perfil"
        className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-marinho transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turquesa"
      >
        {t('editarPerfil')}
      </Link>
    );
  } else if (roteiro || embarcacaoId) {
    acao = <OperadorChatBotao nome={operador.primeiroNome} roteiro={roteiro} embarcacaoId={embarcacaoId} />;
  }

  return <OperadorSecao operador={operador} acao={acao} />;
}
