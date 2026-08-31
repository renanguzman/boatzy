'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Check, X, Loader2, User, Crown, Pencil } from 'lucide-react';
import type { AtendenteOption } from '@/lib/equipe-types';
import { confirmarReserva, recusarReserva, definirAtendentes } from '../../actions';

type Status = 'pendente' | 'confirmada' | 'recusada' | 'cancelada' | 'concluida';

type Props = {
  reservaId: string;
  status: Status;
  atendenteOptions: AtendenteOption[];
  atendentesAtuais: string[];
};

const RESOLVIDA_LABEL: Record<Exclude<Status, 'pendente' | 'confirmada' | 'concluida'>, string> = {
  recusada: 'Esta reserva foi recusada.',
  cancelada: 'Esta reserva foi cancelada pelo cliente.',
};

function selecaoPadrao(options: AtendenteOption[], atuais: string[]): string[] {
  if (atuais.length > 0) return atuais.filter((id) => options.some((o) => o.id === id));
  const membros = options.filter((o) => !o.is_gestor).map((o) => o.id);
  if (membros.length > 0) return membros;
  const gestor = options.find((o) => o.is_gestor);
  return gestor ? [gestor.id] : [];
}

function ListaAtendentes({
  options,
  selecionados,
  onToggle,
}: {
  options: AtendenteOption[];
  selecionados: string[];
  onToggle: (id: string) => void;
}) {
  if (options.length === 0) {
    return (
      <p className="text-xs text-amber-600">
        Nenhuma pessoa disponível. Vincule membros da equipe a esta embarcação em{' '}
        <a href="/painel/equipe" className="underline">
          Equipe
        </a>
        .
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      {options.map((o) => {
        const checked = selecionados.includes(o.id);
        return (
          <label
            key={o.id}
            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
              checked ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <input type="checkbox" className="accent-emerald-600" checked={checked} onChange={() => onToggle(o.id)} />
            <span className="w-7 h-7 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
              {o.foto_url ? (
                <Image src={o.foto_url} alt={o.nome_completo} width={28} height={28} className="w-full h-full object-cover" />
              ) : (
                <User className="w-3.5 h-3.5 text-slate-300" />
              )}
            </span>
            <span className="flex items-center gap-1 truncate">
              {o.is_gestor && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
              {o.is_gestor ? 'Você (gestor)' : o.nome_completo}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export default function ReservaAcoes({ reservaId, status, atendenteOptions, atendentesAtuais }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [acao, setAcao] = useState<'confirmar' | 'recusar' | null>(null);
  const [editandoAtendentes, setEditandoAtendentes] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>(
    selecaoPadrao(atendenteOptions, atendentesAtuais),
  );
  const [erro, setErro] = useState<string | null>(null);

  function toggle(id: string) {
    setSelecionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // ── Reserva já confirmada / concluída: editar atendentes ──────────────────
  if (status === 'confirmada' || status === 'concluida') {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[#0B2447]">Equipe que vai atender</h2>
          {!editandoAtendentes && (
            <button
              onClick={() => {
                setSelecionados(selecaoPadrao(atendenteOptions, atendentesAtuais));
                setEditandoAtendentes(true);
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#0B3D91] hover:underline"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </button>
          )}
        </div>

        {erro && <p className="mb-3 text-xs font-medium text-red-600">{erro}</p>}

        {editandoAtendentes ? (
          <div className="space-y-3">
            <ListaAtendentes options={atendenteOptions} selecionados={selecionados} onToggle={toggle} />
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setErro(null);
                  startTransition(async () => {
                    const res = await definirAtendentes(reservaId, selecionados);
                    if (!res.ok) setErro(res.error ?? 'Erro ao salvar.');
                    else {
                      setEditandoAtendentes(false);
                      router.refresh();
                    }
                  });
                }}
                disabled={pending}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Salvar
              </button>
              <button
                onClick={() => {
                  setEditandoAtendentes(false);
                  setErro(null);
                }}
                disabled={pending}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : atendentesAtuais.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma pessoa indicada ainda.</p>
        ) : (
          <ul className="space-y-2">
            {atendenteOptions
              .filter((o) => atendentesAtuais.includes(o.id))
              .map((o) => (
                <li key={o.id} className="flex items-center gap-2.5 text-sm text-slate-700">
                  <span className="w-7 h-7 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                    {o.foto_url ? (
                      <Image src={o.foto_url} alt={o.nome_completo} width={28} height={28} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-slate-300" />
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    {o.is_gestor && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                    {o.is_gestor ? 'Você (gestor)' : o.nome_completo}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>
    );
  }

  // ── Reserva recusada / cancelada ─────────────────────────────────────────
  if (status !== 'pendente') {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
        <p className="text-sm text-slate-500">{RESOLVIDA_LABEL[status]} Não há ações pendentes.</p>
      </section>
    );
  }

  // ── Reserva pendente ────────────────────────────────────────────────────
  function submeter() {
    if (!acao) return;
    setErro(null);
    startTransition(async () => {
      const res =
        acao === 'confirmar'
          ? await confirmarReserva(reservaId, observacao, selecionados)
          : await recusarReserva(reservaId, observacao);
      if (!res.ok) {
        setErro(res.error ?? 'Erro ao processar.');
      } else {
        setAcao(null);
        setObservacao('');
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <h2 className="text-sm font-bold text-[#0B2447] mb-4">Responder solicitação</h2>

      {erro && <p className="mb-3 text-xs font-medium text-red-600">{erro}</p>}

      {acao === 'confirmar' ? (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">Quem vai atender o cliente?</p>
            <ListaAtendentes options={atendenteOptions} selecionados={selecionados} onToggle={toggle} />
          </div>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
            placeholder="Observação ao cliente (opcional) — ponto de encontro, instruções…"
            className="w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B3D91]/30"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={submeter}
              disabled={pending}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Confirmar
            </button>
            <button
              onClick={() => {
                setAcao(null);
                setErro(null);
              }}
              disabled={pending}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Voltar
            </button>
          </div>
        </div>
      ) : acao === 'recusar' ? (
        <div className="space-y-3">
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
            placeholder="Motivo do cancelamento (opcional) — será retornado ao cliente."
            className="w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B3D91]/30"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={submeter}
              disabled={pending}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              Cancelar reserva
            </button>
            <button
              onClick={() => {
                setAcao(null);
                setErro(null);
              }}
              disabled={pending}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            onClick={() => {
              setSelecionados(selecaoPadrao(atendenteOptions, atendentesAtuais));
              setAcao('confirmar');
            }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Check className="h-4 w-4" />
            Confirmar reserva
          </button>
          <button
            onClick={() => setAcao('recusar')}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2.5 text-sm font-semibold"
          >
            <X className="h-4 w-4" />
            Cancelar reserva
          </button>
        </div>
      )}
    </section>
  );
}
