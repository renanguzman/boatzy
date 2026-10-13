import { AlertTriangle, Clock, MessageSquareWarning } from 'lucide-react';
import { formatarDataHora } from '@/lib/datas';
import {
  STATUS_INFO, type PublicacaoEntidade, type StatusPublicacaoQualquer, type TipoEventoPublicacao,
} from '@/lib/publicacao/config';
import StatusPublicacaoBadge from './StatusPublicacaoBadge';
import AcoesStatusGestor from './AcoesStatusGestor';

const AVISO_EDICAO: Record<PublicacaoEntidade, { campos: string; direto: string; registro: string }> = {
  embarcacao: {
    campos: 'nome, descrição, tipo, capitão, capacidade, comprimento, quartos, banheiros, tripulação, localização (endereço) e fotos',
    direto: 'preços, disponibilidade, comodidades, acessórios e equipamentos',
    registro: 'a embarcação',
  },
  roteiro: {
    campos: 'nome, descrição, origem, destino, paradas, duração, embarcação vinculada e fotos',
    direto: 'preços, disponibilidade, bloqueios, horários e catálogo',
    registro: 'o roteiro',
  },
  anuncio_venda: {
    campos: 'fabricante, anos de modelo e fabricação e a descrição',
    direto: 'o valor',
    registro: 'o anúncio',
  },
};

/**
 * Faixa do topo da tela de edição do painel: status atual, o que ele
 * significa, a observação da equipe (Retorno / retirado do ar) e as ações
 * permitidas ao dono.
 */
export default function AvisoStatusPublicacao({
  entidade, id, nome, status, enviadoAnaliseEm, ultimaDecisao, roteirosVinculados, ehAdmin = false,
}: {
  entidade: PublicacaoEntidade;
  id: string;
  nome: string;
  status: StatusPublicacaoQualquer;
  enviadoAnaliseEm: string | null;
  ultimaDecisao: { tipo: TipoEventoPublicacao; observacao: string | null; createdAt: string } | null;
  roteirosVinculados?: string[];
  /** Admin edita sem voltar para análise: o aviso muda de tom. */
  ehAdmin?: boolean;
}) {
  const info = STATUS_INFO[status];
  const mostrarObservacao =
    ultimaDecisao?.observacao &&
    ((status === 'retorno' && ultimaDecisao.tipo === 'retorno') ||
     (ultimaDecisao.tipo === 'moderacao' && (status === 'inativo' || status === 'pausado')));

  const destaque =
    status === 'retorno' ? 'border-orange-200 bg-orange-50/50'
    : status === 'em_analise' ? 'border-amber-200 bg-amber-50/40'
    : 'border-slate-100 bg-white';

  return (
    <div className={`mb-6 rounded-2xl border p-5 shadow-sm ${destaque}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status da publicação</span>
            <StatusPublicacaoBadge status={status} />
          </div>
          <p className="mt-1.5 text-sm text-slate-600">{info?.descricao}</p>

          {status === 'em_analise' && enviadoAnaliseEm && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5" /> Enviado para análise em {formatarDataHora(enviadoAnaliseEm)}
            </p>
          )}

        </div>

        <div className="flex-shrink-0">
          <AcoesStatusGestor entidade={entidade} id={id} nome={nome} status={status}
            roteirosVinculados={roteirosVinculados} modo="pagina" />
        </div>
      </div>

      {status === 'ativo' && (
        <div className={`mt-4 flex gap-2.5 rounded-xl border p-4 ${ehAdmin ? 'border-slate-200 bg-slate-50' : 'border-amber-200 bg-amber-50'}`}>
          <AlertTriangle className={`mt-0.5 h-4 w-4 flex-shrink-0 ${ehAdmin ? 'text-slate-400' : 'text-amber-600'}`} />
          <div className="text-sm text-slate-700">
            {ehAdmin ? (
              <p>
                Você é admin: edições deste cadastro já nascem aprovadas e {AVISO_EDICAO[entidade].registro} continua no ar.
                Para o gestor responsável, alterar campos sensíveis envia para nova análise.
              </p>
            ) : (
              <>
                <p className="font-semibold text-amber-900">
                  Atenção: editar {AVISO_EDICAO[entidade].registro} publicado pode exigir nova análise
                </p>
                <p className="mt-1">
                  Se você alterar {AVISO_EDICAO[entidade].campos}, {AVISO_EDICAO[entidade].registro} volta para
                  análise da equipe Boatzy e <strong>sai do site até ser aprovado novamente</strong>. Você será
                  avisado antes de salvar.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Salvam direto, sem nova análise: {AVISO_EDICAO[entidade].direto}.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {mostrarObservacao && ultimaDecisao && (
        <div className="mt-4 flex gap-2.5 rounded-xl border border-orange-200 bg-white p-4">
          <MessageSquareWarning className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-500" />
          <div>
            <p className="text-xs font-semibold text-orange-800">
              Observação da equipe Boatzy · {formatarDataHora(ultimaDecisao.createdAt)}
            </p>
            <p className="mt-1 text-sm text-slate-700 whitespace-pre-line">{ultimaDecisao.observacao}</p>
          </div>
        </div>
      )}
    </div>
  );
}
