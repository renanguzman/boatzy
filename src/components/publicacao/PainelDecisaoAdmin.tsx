'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Gavel, Loader2, Lock, Undo2, Ban, FileCheck2, ExternalLink } from 'lucide-react';
import { tipoTransicao, type PublicacaoEntidade, type StatusPublicacaoQualquer } from '@/lib/publicacao/config';
import { decidirPublicacaoAdmin, type DecisaoAdmin } from '@/lib/publicacao/actions';
import { pendenciaInscricao } from '@/lib/documentos/aprovacao';
import { TIPOS_DOCUMENTO } from '@/lib/documentos/tipos';
import type { DocumentoAtual } from '@/lib/documentos/rascunho';
import { formatarData } from '@/lib/datas';
import { SeloValidade } from '@/components/painel/documentos/SeloValidade';

/** Recado sugerido ao devolver embarcação sem o documento de inscrição. */
const PEDIDO_DOCUMENTO =
  'Para aprovarmos a embarcação, envie a foto ou o PDF do documento de inscrição (TIE ou TIEM) em dia, na etapa "Documentos" do cadastro.';

const DECISOES: Record<DecisaoAdmin, {
  label: string; Icon: React.ElementType; botao: string; ajuda: string; obrigaObservacao: boolean;
}> = {
  aprovar: {
    label: 'Aprovar e publicar', Icon: CheckCircle2, botao: 'bg-emerald-600 hover:bg-emerald-700',
    ajuda: 'O registro passa a aparecer no site. A observação (opcional) fica visível ao gestor.',
    obrigaObservacao: false,
  },
  devolver: {
    label: 'Devolver para ajustes', Icon: Undo2, botao: 'bg-orange-600 hover:bg-orange-700',
    ajuda: 'O gestor recebe a observação (timeline e e-mail), ajusta e reenvia para análise.',
    obrigaObservacao: true,
  },
  moderar: {
    label: 'Retirar do ar', Icon: Ban, botao: 'bg-red-600 hover:bg-red-700',
    ajuda: 'Tira o registro do site. Para voltar, o gestor solicita reativação e passa por nova análise.',
    obrigaObservacao: true,
  },
};

/**
 * Decisão do administrator sobre uma publicação. Só mostra as decisões
 * permitidas no status atual (o banco valida de novo). Observação: visível
 * ao gestor; observação interna: só para a equipe.
 */
export default function PainelDecisaoAdmin({ entidade, id, status, aviso, inscricao }: {
  entidade: PublicacaoEntidade;
  id: string;
  status: StatusPublicacaoQualquer;
  /** Alerta exibido acima das decisões (ex.: embarcação do roteiro não aprovada). */
  aviso?: string | null;
  /**
   * Embarcação: documento de inscrição que vale (SPEC §95.11). Sem ele em dia, não aprova;
   * com ele, a aprovação pede a confirmação de conferência. `undefined` nas outras entidades.
   */
  inscricao?: DocumentoAtual | null;
}) {
  const exigeDocumento = entidade === 'embarcacao' && inscricao !== undefined;
  const pendencia = exigeDocumento ? pendenciaInscricao(inscricao) : null;
  const router = useRouter();
  const moderarPara = entidade === 'anuncio_venda' ? 'pausado' : 'inativo';
  const disponiveis = (['aprovar', 'devolver', 'moderar'] as DecisaoAdmin[]).filter(d => {
    const para = d === 'aprovar' ? 'ativo' : d === 'devolver' ? 'retorno' : moderarPara;
    return tipoTransicao(entidade, 'admin', status, para) !== null;
  });

  const [decisao, setDecisao] = useState<DecisaoAdmin | null>(null);
  const [observacao, setObservacao] = useState('');
  const [interna, setInterna] = useState('');
  const [conferido, setConferido] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function escolher(d: DecisaoAdmin) {
    const sel = decisao === d;
    setDecisao(sel ? null : d);
    setErro(null); setOk(null); setConferido(false);
    // Devolução por falta de documento: já sugere o recado ao gestor.
    if (!sel && d === 'devolver' && pendencia && !observacao.trim()) setObservacao(PEDIDO_DOCUMENTO);
  }

  function confirmar() {
    if (!decisao) return;
    if (DECISOES[decisao].obrigaObservacao && !observacao.trim()) {
      setErro('Escreva a observação para o gestor.');
      return;
    }
    if (decisao === 'aprovar' && exigeDocumento && !conferido) {
      setErro('Confirme que conferiu o documento da embarcação.');
      return;
    }
    setErro(null);
    startTransition(async () => {
      const r = await decidirPublicacaoAdmin({
        entidade, id, decisao, observacao, observacaoInterna: interna,
        documentoConferido: decisao === 'aprovar' && exigeDocumento ? conferido : undefined,
      });
      if (!r.ok) { setErro(r.error); return; }
      setOk(`${DECISOES[decisao].label}: concluído.`);
      setDecisao(null); setObservacao(''); setInterna(''); setConferido(false);
      router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <Gavel className="w-4 h-4 text-marinho" />
        <h2 className="text-sm font-bold text-marinho tracking-wide uppercase">Decisão</h2>
      </div>
      <div className="p-6 space-y-4">
        {aviso && (
          <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
            <p className="text-sm text-amber-900">{aviso}</p>
          </div>
        )}

        {exigeDocumento && (
          pendencia ? (
            <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
              <FileCheck2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <p className="text-sm text-red-800">
                {pendencia === 'nao_enviado'
                  ? <><strong>Falta o documento de inscrição</strong> (TIE, TIEM ou PRPM). A embarcação só pode ser aprovada com ele — devolva pedindo o envio.</>
                  : <><strong>{inscricao ? TIPOS_DOCUMENTO[inscricao.tipo].sigla : 'Documento'} vencido</strong>{inscricao?.data_validade ? ` em ${formatarData(inscricao.data_validade)}` : ''}. Peça o documento renovado antes de aprovar.</>}
              </p>
            </div>
          ) : inscricao && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm">
              <FileCheck2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              <span className="font-semibold text-slate-800">{TIPOS_DOCUMENTO[inscricao.tipo].sigla}</span>
              {inscricao.numero && <span className="tabular-nums text-slate-500">nº {inscricao.numero}</span>}
              <SeloValidade validade={inscricao.data_validade} />
              {inscricao.tem_arquivo && (
                <a href={`/api/painel/documentos/${inscricao.id}/arquivo`} target="_blank" rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" /> Ver arquivo
                </a>
              )}
            </div>
          )
        )}

        {ok && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{ok}</p>}

        {disponiveis.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhuma decisão pendente neste status. Registros só são publicados a partir de <strong>Em análise</strong>.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {disponiveis.map(d => {
                const { label, Icon } = DECISOES[d];
                const sel = decisao === d;
                const bloqueado = d === 'aprovar' && !!pendencia;
                return (
                  <button key={d} type="button" onClick={() => escolher(d)} disabled={bloqueado}
                    title={bloqueado ? 'Precisa do documento de inscrição em dia' : undefined}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      sel ? 'border-marinho bg-marinho text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                );
              })}
            </div>

            {decisao && (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">{DECISOES[decisao].ajuda}</p>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    Observação para o gestor
                    {DECISOES[decisao].obrigaObservacao
                      ? <span className="ml-0.5 text-red-500">*</span>
                      : <span className="ml-1 font-normal text-slate-400">(opcional)</span>}
                  </span>
                  <textarea rows={3} value={observacao} onChange={e => setObservacao(e.target.value)} maxLength={2000}
                    placeholder={decisao === 'aprovar' ? 'Ex.: cadastro aprovado, obrigado!' : 'Explique o que precisa ser ajustado.'}
                    className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-grafite placeholder:text-slate-400 focus:border-marinho/40 focus:outline-none focus:ring-2 focus:ring-marinho/20" />
                </label>
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1 text-sm font-medium text-slate-700">
                    <Lock className="h-3.5 w-3.5 text-violet-500" /> Observação interna
                    <span className="font-normal text-slate-400">(só a equipe vê — opcional)</span>
                  </span>
                  <textarea rows={2} value={interna} onChange={e => setInterna(e.target.value)} maxLength={2000}
                    placeholder="Anotações da análise, documentos conferidos…"
                    className="w-full resize-none rounded-xl border border-violet-200 bg-violet-50/30 px-3.5 py-2.5 text-sm text-grafite placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                </label>

                {decisao === 'aprovar' && exigeDocumento && (
                  <label className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-sm text-slate-700">
                    <input type="checkbox" checked={conferido} onChange={e => setConferido(e.target.checked)} className="mt-0.5 accent-emerald-600" />
                    <span>
                      <strong>Conferi o documento da embarcação:</strong> está legível, é desta embarcação e está em dia.
                      <span className="block text-xs text-slate-500">Fica registrado no histórico (observação interna).</span>
                    </span>
                  </label>
                )}

                {erro && (
                  <p className="flex items-start gap-1.5 text-sm text-red-600">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />{erro}
                  </p>
                )}

                <div className="flex justify-end">
                  <button type="button" disabled={pendente} onClick={confirmar}
                    className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${DECISOES[decisao].botao}`}>
                    {pendente && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Confirmar: {DECISOES[decisao].label}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
