'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, CalendarClock, Loader2, Send, X } from 'lucide-react';
import {
  ENTIDADE_LABEL, STATUS_INFO, acoesGestor,
  type AcaoGestor, type PublicacaoEntidade, type StatusPublicacaoQualquer,
} from '@/lib/publicacao/config';
import { alterarStatusPublicacao, contarReservasFuturas } from '@/lib/publicacao/actions';
import StatusPublicacaoBadge from './StatusPublicacaoBadge';

type Props = {
  entidade: PublicacaoEntidade;
  id: string;
  nome: string;
  status: StatusPublicacaoQualquer;
  /** Embarcação: nomes dos roteiros que saem do site junto. */
  roteirosVinculados?: string[];
  /**
   * 'grid': badge + botão "Alterar" que abre o modal com as ações.
   * 'pagina': um botão por ação (aviso do topo da tela de edição).
   */
  modo?: 'grid' | 'pagina';
};

/**
 * Ações de status do dono do registro (pipeline de aprovação). Só lista as
 * transições permitidas no status atual; o banco valida de novo.
 */
export default function AcoesStatusGestor({ entidade, id, nome, status, roteirosVinculados = [], modo = 'grid' }: Props) {
  const acoes = acoesGestor(entidade, status);
  const [aberto, setAberto] = useState(false);
  const [acao, setAcao] = useState<AcaoGestor | null>(null);

  function abrir(a: AcaoGestor | null) {
    setAcao(a);
    setAberto(true);
  }

  return (
    <>
      {modo === 'grid' ? (
        <div className="flex items-center gap-2">
          <StatusPublicacaoBadge status={status} />
          {acoes.length > 0 && (
            <button
              type="button"
              onClick={() => abrir(acoes.length === 1 ? acoes[0] : null)}
              className="text-[11px] font-semibold text-[#0B3D91] hover:underline whitespace-nowrap"
            >
              Alterar
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {acoes.map(a => (
            <button
              key={a.para}
              type="button"
              onClick={() => abrir(a)}
              className={a.tiraDoAr
                ? 'inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition'
                : 'inline-flex items-center gap-1.5 rounded-xl bg-[#0B2447] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#0B3D91] transition'}
            >
              {!a.tiraDoAr && <Send className="h-3.5 w-3.5" />}
              {a.label}
            </button>
          ))}
        </div>
      )}

      {aberto && (
        <ModalAcao
          entidade={entidade} id={id} nome={nome} status={status}
          acoes={acoes} acaoInicial={acao} roteirosVinculados={roteirosVinculados}
          onFechar={() => setAberto(false)}
        />
      )}
    </>
  );
}

function ModalAcao({ entidade, id, nome, status, acoes, acaoInicial, roteirosVinculados, onFechar }: {
  entidade: PublicacaoEntidade; id: string; nome: string; status: StatusPublicacaoQualquer;
  acoes: AcaoGestor[]; acaoInicial: AcaoGestor | null; roteirosVinculados: string[];
  onFechar: () => void;
}) {
  const router = useRouter();
  const [acao, setAcao] = useState<AcaoGestor | null>(acaoInicial);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [reservasFuturas, setReservasFuturas] = useState<number | null>(null);
  const [pendente, startTransition] = useTransition();

  // Antes de tirar do ar, avisa sobre reservas futuras (elas continuam valendo).
  useEffect(() => {
    if (!acao?.tiraDoAr || entidade === 'anuncio_venda') return;
    let ativo = true;
    contarReservasFuturas(entidade, id).then(n => { if (ativo) setReservasFuturas(n); });
    return () => { ativo = false; };
  }, [acao, entidade, id]);

  function confirmar() {
    if (!acao) return;
    setErro(null);
    startTransition(async () => {
      const r = await alterarStatusPublicacao(entidade, id, acao.para, mensagem);
      if (!r.ok) { setErro(r.error); return; }
      onFechar();
      router.refresh();
    });
  }

  const tiraRoteiros = entidade === 'embarcacao' && acao?.tiraDoAr && status === 'ativo' && roteirosVinculados.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => pendente || onFechar()} />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-xl">
        <button type="button" onClick={onFechar} disabled={pendente} aria-label="Fechar"
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 disabled:opacity-50">
          <X className="h-4 w-4" />
        </button>

        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {ENTIDADE_LABEL[entidade].singular}
        </p>
        <h3 className="mt-0.5 pr-6 text-base font-bold text-[#0B2447]">{nome}</h3>
        <div className="mt-2 flex items-center gap-2">
          <StatusPublicacaoBadge status={status} />
        </div>
        <p className="mt-2 text-sm text-slate-500">{STATUS_INFO[status]?.descricao}</p>

        {!acao ? (
          <div className="mt-5 space-y-2">
            {acoes.map(a => (
              <button key={a.para} type="button" onClick={() => setAcao(a)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:border-[#0B2447]/30 hover:bg-slate-50 transition">
                {a.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-5">
            {acoes.length > 1 && !acaoInicial && (
              <button type="button" onClick={() => { setAcao(null); setErro(null); }}
                className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700">
                <ArrowLeft className="h-3.5 w-3.5" /> Outras ações
              </button>
            )}
            <div className={`rounded-xl border p-4 ${acao.tiraDoAr ? 'border-amber-200 bg-amber-50/60' : 'border-sky-200 bg-sky-50/60'}`}>
              <p className="text-sm font-bold text-slate-800">{acao.label}</p>
              <p className="mt-1 text-sm text-slate-600">{acao.confirmacao}</p>
            </div>

            {tiraRoteiros && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <p className="mb-2 text-xs font-semibold text-amber-800">
                  {roteirosVinculados.length === 1 ? 'Este roteiro vinculado também sai do site:' : 'Estes roteiros vinculados também saem do site:'}
                </p>
                <ul className="max-h-32 space-y-1 overflow-y-auto">
                  {roteirosVinculados.map(r => (
                    <li key={r} className="flex items-center gap-2 text-sm text-amber-900">
                      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />{r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {acao.tiraDoAr && reservasFuturas != null && reservasFuturas > 0 && (
              <div className="mt-3 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
                <CalendarClock className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                <p className="text-sm text-red-800">
                  Há <strong>{reservasFuturas} {reservasFuturas === 1 ? 'reserva futura' : 'reservas futuras'}</strong> em aberto.
                  {' '}{reservasFuturas === 1 ? 'Ela continua valendo' : 'Elas continuam valendo'}; só novas reservas ficam bloqueadas.
                </p>
              </div>
            )}

            {acao.aceitaMensagem && (
              <label className="mt-4 block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Mensagem para a equipe Boatzy <span className="font-normal text-slate-400">(opcional)</span>
                </span>
                <textarea rows={3} value={mensagem} onChange={e => setMensagem(e.target.value)} maxLength={1000}
                  placeholder="Ex.: troquei as fotos e corrigi a capacidade."
                  className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0B2447]/40 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20" />
              </label>
            )}

            {erro && (
              <p className="mt-3 flex items-start gap-1.5 text-sm text-red-600">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />{erro}
              </p>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" disabled={pendente} onClick={onFechar}
                className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" disabled={pendente} onClick={confirmar}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  acao.terminal ? 'bg-red-600 hover:bg-red-700' : acao.tiraDoAr ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#0B2447] hover:bg-[#0B3D91]'}`}>
                {pendente && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirmar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
