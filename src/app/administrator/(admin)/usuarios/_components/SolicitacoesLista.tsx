'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Loader2, UserCheck, MapPin, Ship, Phone, IdCard, Mail } from 'lucide-react';
import { decidirSolicitacaoGestor } from '../actions';
import { maskCpfCnpj } from '@/lib/validators';
import { formatarTelefoneE164 } from '@/lib/countries';
import { formatarData, formatarDataHora } from '@/lib/datas';
import type { SolicitacaoGestorStatus } from '@/types/supabase';

export type SolicitacaoItem = {
  id: string;
  status: SolicitacaoGestorStatus;
  nome: string;
  telefone: string;
  documento: string;
  qtd_embarcacoes: number;
  mensagem: string | null;
  observacao: string | null;
  observacao_interna: string | null;
  created_at: string;
  decidido_em: string | null;
  usuario: { id: string; email: string; created_at: string } | null;
  decisor: { name: string } | null;
  municipios: { nome: string } | null;
  estados: { uf: string } | null;
};

type Decisao = { item: SolicitacaoItem; aprovar: boolean };

const textarea =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition';

/** Cartões da fila de pedidos de gestor com aprovar / recusar (SPEC §62). */
export default function SolicitacoesLista({ itens, status }: { itens: SolicitacaoItem[]; status: SolicitacaoGestorStatus }) {
  const [decisao, setDecisao] = useState<Decisao | null>(null);

  if (itens.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center py-20 text-center">
        <UserCheck className="w-12 h-12 text-slate-200 mb-4" />
        <p className="text-sm font-medium text-slate-500">
          {status === 'pendente' ? 'Nenhum pedido aguardando análise' : 'Nenhum pedido nesta aba'}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Os pedidos aparecem aqui quando alguém pede acesso ao painel de gestor.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4">
        {itens.map((s) => (
          <article key={s.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex flex-col lg:flex-row lg:items-start gap-4 justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-[#0B2447]">{s.nome}</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pedido em {formatarDataHora(s.created_at)}
                  {s.usuario ? ` · conta criada em ${formatarData(s.usuario.created_at)}` : ''}
                </p>
              </div>
              {s.status === 'pendente' && (
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setDecisao({ item: s, aprovar: false })}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" /> Recusar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisao({ item: s, aprovar: true })}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                  >
                    <Check className="w-4 h-4" /> Aprovar
                  </button>
                </div>
              )}
            </div>

            <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3 text-sm">
              <Dado icon={Mail} rotulo="E-mail" valor={s.usuario?.email ?? '—'} />
              <Dado icon={Phone} rotulo="Celular" valor={formatarTelefoneE164(s.telefone)} />
              <Dado icon={IdCard} rotulo={s.documento.length === 14 ? 'CNPJ' : 'CPF'} valor={maskCpfCnpj(s.documento)} />
              <Dado icon={MapPin} rotulo="Cidade da embarcação"
                valor={`${s.municipios?.nome ?? '—'}${s.estados?.uf ? `/${s.estados.uf}` : ''}`} />
              <Dado icon={Ship} rotulo="Embarcações" valor={String(s.qtd_embarcacoes)} />
            </dl>

            {s.mensagem && (
              <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 whitespace-pre-line">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Mensagem</span>
                {s.mensagem}
              </p>
            )}

            {s.status !== 'pendente' && (
              <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${s.status === 'aprovada' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                <p className="font-semibold">
                  {s.status === 'aprovada' ? 'Aprovado' : 'Recusado'} em {formatarDataHora(s.decidido_em)}
                  {s.decisor?.name ? ` por ${s.decisor.name}` : ''}
                </p>
                {s.observacao && <p className="mt-1">Ao solicitante: {s.observacao}</p>}
                {s.observacao_interna && <p className="mt-1 opacity-80">Interna: {s.observacao_interna}</p>}
              </div>
            )}
          </article>
        ))}
      </div>

      {decisao && <ModalDecisao decisao={decisao} onClose={() => setDecisao(null)} />}
    </>
  );
}

function Dado({ icon: Icon, rotulo, valor }: { icon: typeof Mail; rotulo: string; valor: string }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className="w-4 h-4 text-slate-300 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{rotulo}</dt>
        <dd className="text-slate-700 break-words tabular-nums">{valor}</dd>
      </div>
    </div>
  );
}

function ModalDecisao({ decisao, onClose }: { decisao: Decisao; onClose: () => void }) {
  const router = useRouter();
  const [observacao, setObservacao] = useState('');
  const [observacaoInterna, setObservacaoInterna] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, startSalvar] = useTransition();
  const { item, aprovar } = decisao;

  function confirmar() {
    setErro('');
    if (!aprovar && !observacao.trim()) {
      setErro('Escreva ao solicitante o motivo da recusa.');
      return;
    }
    startSalvar(async () => {
      const r = await decidirSolicitacaoGestor({ id: item.id, aprovar, observacao, observacaoInterna });
      if (!r.ok) {
        setErro(r.error ?? 'Não foi possível salvar a decisão.');
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true"
      aria-labelledby="decisao-titulo" onKeyDown={(e) => e.key === 'Escape' && !salvando && onClose()}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
        <h2 id="decisao-titulo" className="text-lg font-bold text-[#0B2447]">
          {aprovar ? `Aprovar ${item.nome} como gestor?` : `Recusar o pedido de ${item.nome}?`}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {aprovar
            ? 'A conta passa a acessar o painel de gestor na hora. O solicitante recebe um e-mail.'
            : 'O solicitante recebe um e-mail com a sua observação e pode enviar um novo pedido.'}
        </p>

        <div className="mt-5 grid gap-4">
          <div>
            <label htmlFor="decisao-obs" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#0B2447]">
              Observação ao solicitante {aprovar ? '(opcional)' : ''}
            </label>
            <textarea id="decisao-obs" rows={3} maxLength={1000} value={observacao}
              onChange={(e) => setObservacao(e.target.value)} disabled={salvando} className={textarea}
              placeholder={aprovar ? 'Ex.: boas-vindas ou próximos passos.' : 'Ex.: não conseguimos confirmar os dados da embarcação.'} />
          </div>
          <div>
            <label htmlFor="decisao-interna" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#0B2447]">
              Observação interna (opcional)
            </label>
            <textarea id="decisao-interna" rows={2} maxLength={1000} value={observacaoInterna}
              onChange={(e) => setObservacaoInterna(e.target.value)} disabled={salvando} className={textarea}
              placeholder="Só a equipe Boatzy vê." />
          </div>
        </div>

        {erro && <p role="alert" className="mt-3 text-sm text-red-600">{erro}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={salvando}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
            Cancelar
          </button>
          <button type="button" onClick={confirmar} disabled={salvando}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
              aprovar ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
            }`}>
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            {aprovar ? 'Aprovar gestor' : 'Recusar pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}
