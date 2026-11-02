'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, CheckCircle2, Gavel, Loader2, Lock, Undo2, Eye } from 'lucide-react';
import type { DecisaoPerfil } from '@/lib/operador-tipos';
import type { OperadorPerfilStatus } from '@/types/supabase';
import { decidirPerfilOperador } from '../actions';

const DECISOES: Record<DecisaoPerfil, {
  label: string; Icon: React.ElementType; botao: string; ajuda: string; obrigaObservacao: boolean; ok: string;
}> = {
  aprovar: {
    label: 'Aprovar e publicar', Icon: CheckCircle2, botao: 'bg-emerald-600 hover:bg-emerald-700',
    ajuda: 'A versão enviada passa a aparecer no site (roteiros, embarcações e página do operador). A observação (opcional) fica visível ao gestor.',
    obrigaObservacao: false, ok: 'Perfil aprovado e publicado.',
  },
  devolver: {
    label: 'Devolver para ajustes', Icon: Undo2, botao: 'bg-orange-600 hover:bg-orange-700',
    ajuda: 'O gestor recebe a observação (e-mail e painel), ajusta e reenvia. Se já houver uma versão no ar, ela continua visível.',
    obrigaObservacao: true, ok: 'Perfil devolvido ao gestor.',
  },
  retirar: {
    label: 'Retirar do ar', Icon: Ban, botao: 'bg-red-600 hover:bg-red-700',
    ajuda: 'Tira o perfil do site agora. Para voltar, o gestor ajusta e envia de novo (ou você restaura).',
    obrigaObservacao: true, ok: 'Perfil retirado do ar.',
  },
  restaurar: {
    label: 'Restaurar no ar', Icon: Eye, botao: 'bg-sky-600 hover:bg-sky-700',
    ajuda: 'Recoloca no site a última versão aprovada.',
    obrigaObservacao: false, ok: 'Perfil restaurado no ar.',
  },
};

/** Decisões possíveis em cada situação (o banco valida de novo). */
function disponiveis(status: OperadorPerfilStatus | 'sem_perfil', temPublicado: boolean): DecisaoPerfil[] {
  switch (status) {
    case 'em_analise': return temPublicado ? ['aprovar', 'devolver', 'retirar'] : ['aprovar', 'devolver'];
    case 'aprovado': return ['retirar'];
    case 'devolvido': return temPublicado ? ['retirar'] : [];
    case 'retirado': return ['restaurar'];
    default: return [];
  }
}

/**
 * Decisão do admin sobre o perfil do operador (SPEC §99). Observação: visível ao gestor;
 * observação interna: só para a equipe. `versao` trava a decisão se o gestor mexeu no meio.
 */
export default function PainelDecisaoPerfil({ ownerId, status, temPublicado, versao }: {
  ownerId: string;
  status: OperadorPerfilStatus | 'sem_perfil';
  temPublicado: boolean;
  versao: string;
}) {
  const router = useRouter();
  const opcoes = disponiveis(status, temPublicado);
  const [decisao, setDecisao] = useState<DecisaoPerfil | null>(null);
  const [observacao, setObservacao] = useState('');
  const [interna, setInterna] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function confirmar() {
    if (!decisao) return;
    const cfg = DECISOES[decisao];
    if (cfg.obrigaObservacao && !observacao.trim()) { setErro('Escreva a observação para o gestor.'); return; }
    setErro(null);
    iniciar(async () => {
      const r = await decidirPerfilOperador({ ownerId, decisao, observacao, observacaoInterna: interna, versao });
      if (!r.ok) { setErro(r.error); return; }
      setOk(cfg.ok);
      setDecisao(null); setObservacao(''); setInterna('');
      router.refresh();
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/50 px-6 py-4">
        <Gavel className="h-4 w-4 text-marinho" />
        <h2 className="text-sm font-bold uppercase tracking-wide text-marinho">Decisão</h2>
      </div>

      <div className="space-y-4 px-6 py-5">
        {ok && <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {ok}</p>}

        {opcoes.length === 0 ? (
          <p className="text-sm text-slate-500">
            {status === 'sem_perfil' || status === 'rascunho'
              ? 'O gestor ainda não enviou o perfil para análise.'
              : 'Nada a decidir agora: o gestor está ajustando o perfil devolvido.'}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {opcoes.map((d) => {
                const { Icon, label, botao } = DECISOES[d];
                const ativo = decisao === d;
                return (
                  <button key={d} type="button" aria-pressed={ativo} disabled={pendente}
                    onClick={() => { setDecisao(ativo ? null : d); setErro(null); setOk(null); }}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                      ativo ? `${botao} text-white shadow-sm` : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}>
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                );
              })}
            </div>

            {decisao && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-xs text-slate-600">{DECISOES[decisao].ajuda}</p>
                <div>
                  <label htmlFor="dec-obs" className="mb-1 block text-xs font-semibold text-slate-700">
                    Observação para o gestor {DECISOES[decisao].obrigaObservacao ? <span className="text-red-500">*</span> : <span className="font-normal text-slate-400">(opcional)</span>}
                  </label>
                  <textarea id="dec-obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} maxLength={1000}
                    className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-[#0B2447]/50 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/15"
                    placeholder={decisao === 'devolver' ? 'Ex.: Use uma foto de rosto, com boa luz, e tire o telefone do texto.' : ''} />
                </div>
                <div>
                  <label htmlFor="dec-int" className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Lock className="h-3 w-3 text-slate-400" /> Observação interna <span className="font-normal text-slate-400">(só a equipe vê)</span>
                  </label>
                  <textarea id="dec-int" value={interna} onChange={(e) => setInterna(e.target.value)} rows={2} maxLength={1000}
                    className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-[#0B2447]/50 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/15" />
                </div>
                {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
                <button type="button" onClick={confirmar} disabled={pendente}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${DECISOES[decisao].botao}`}>
                  {pendente && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar: {DECISOES[decisao].label.toLowerCase()}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
