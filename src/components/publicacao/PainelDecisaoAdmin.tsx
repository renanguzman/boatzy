'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Gavel, Loader2, Lock, Undo2, Ban } from 'lucide-react';
import { tipoTransicao, type PublicacaoEntidade, type StatusPublicacaoQualquer } from '@/lib/publicacao/config';
import { decidirPublicacaoAdmin, type DecisaoAdmin } from '@/lib/publicacao/actions';

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
export default function PainelDecisaoAdmin({ entidade, id, status, aviso }: {
  entidade: PublicacaoEntidade;
  id: string;
  status: StatusPublicacaoQualquer;
  /** Alerta exibido acima das decisões (ex.: embarcação do roteiro não aprovada). */
  aviso?: string | null;
}) {
  const router = useRouter();
  const moderarPara = entidade === 'anuncio_venda' ? 'pausado' : 'inativo';
  const disponiveis = (['aprovar', 'devolver', 'moderar'] as DecisaoAdmin[]).filter(d => {
    const para = d === 'aprovar' ? 'ativo' : d === 'devolver' ? 'retorno' : moderarPara;
    return tipoTransicao(entidade, 'admin', status, para) !== null;
  });

  const [decisao, setDecisao] = useState<DecisaoAdmin | null>(null);
  const [observacao, setObservacao] = useState('');
  const [interna, setInterna] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function confirmar() {
    if (!decisao) return;
    if (DECISOES[decisao].obrigaObservacao && !observacao.trim()) {
      setErro('Escreva a observação para o gestor.');
      return;
    }
    setErro(null);
    startTransition(async () => {
      const r = await decidirPublicacaoAdmin({ entidade, id, decisao, observacao, observacaoInterna: interna });
      if (!r.ok) { setErro(r.error); return; }
      setOk(`${DECISOES[decisao].label}: concluído.`);
      setDecisao(null); setObservacao(''); setInterna('');
      router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <Gavel className="w-4 h-4 text-[#0B2447]" />
        <h2 className="text-sm font-bold text-[#0B2447] tracking-wide uppercase">Decisão</h2>
      </div>
      <div className="p-6 space-y-4">
        {aviso && (
          <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
            <p className="text-sm text-amber-900">{aviso}</p>
          </div>
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
                return (
                  <button key={d} type="button" onClick={() => { setDecisao(sel ? null : d); setErro(null); setOk(null); }}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
                      sel ? 'border-[#0B2447] bg-[#0B2447] text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
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
                    className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0B2447]/40 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20" />
                </label>
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1 text-sm font-medium text-slate-700">
                    <Lock className="h-3.5 w-3.5 text-violet-500" /> Observação interna
                    <span className="font-normal text-slate-400">(só a equipe vê — opcional)</span>
                  </span>
                  <textarea rows={2} value={interna} onChange={e => setInterna(e.target.value)} maxLength={2000}
                    placeholder="Anotações da análise, documentos conferidos…"
                    className="w-full resize-none rounded-xl border border-violet-200 bg-violet-50/30 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                </label>

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
