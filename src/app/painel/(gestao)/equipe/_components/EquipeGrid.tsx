'use client';

import { useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Search, User, UsersRound, Ship, BadgeCheck, Phone, Pencil, Power, Trash2, Loader2,
} from 'lucide-react';
import { maskCPF, applyPhoneMask, onlyDigits } from '@/lib/validators';
import { alternarAtivoMembro, excluirMembro } from '../actions';

export type MembroListItem = {
  id: string;
  nome_completo: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  foto_url: string | null;
  ativo: boolean;
  tem_conta_vinculada: boolean;
  embarcacoes: { id: string; nome: string }[];
  total_atendimentos: number;
  created_at: string;
};

function fmtTelefone(digits: string | null): string {
  if (!digits) return '—';
  const d = onlyDigits(digits);
  return applyPhoneMask(d, d.length > 10 ? '(##) #####-####' : '(##) ####-####');
}

export default function EquipeGrid({ membros }: { membros: MembroListItem[] }) {
  const [busca, setBusca] = useState('');
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return membros;
    return membros.filter(
      (m) =>
        m.nome_completo.toLowerCase().includes(q) ||
        (m.email ?? '').toLowerCase().includes(q) ||
        (m.cpf ?? '').includes(onlyDigits(q)) ||
        m.embarcacoes.some((e) => e.nome.toLowerCase().includes(q)),
    );
  }, [membros, busca]);

  function toggleAtivo(m: MembroListItem) {
    setErro(null);
    startTransition(async () => {
      const res = await alternarAtivoMembro(m.id, !m.ativo);
      if (!res.ok) setErro(res.error ?? 'Erro ao atualizar.');
    });
  }

  function remover(m: MembroListItem) {
    if (!confirm(`Excluir "${m.nome_completo}" da equipe?`)) return;
    setErro(null);
    startTransition(async () => {
      const res = await excluirMembro(m.id);
      if (!res.ok) setErro(res.error ?? 'Erro ao excluir.');
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-slate-700">
          Membros cadastrados <span className="text-slate-400 font-normal">({membros.length})</span>
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, CPF, e-mail ou embarcação…"
            className="w-72 max-w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500/40"
          />
        </div>
      </div>

      {erro && (
        <p className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-medium text-red-700">
          {erro}
        </p>
      )}

      {filtrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 flex flex-col items-center text-center">
          <UsersRound className="w-10 h-10 text-slate-200 mb-3" />
          <p className="text-sm font-medium text-slate-500">
            {busca ? 'Nenhum membro encontrado' : 'Nenhum membro na equipe ainda'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {busca ? 'Tente outros termos.' : 'Use o formulário acima para adicionar o primeiro.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtrados.map((m) => (
            <div
              key={m.id}
              className={`rounded-2xl border bg-white shadow-sm p-4 flex flex-col gap-3 ${
                m.ativo ? 'border-slate-200' : 'border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                  {m.foto_url ? (
                    <Image
                      src={m.foto_url}
                      alt={m.nome_completo}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-6 h-6 text-slate-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-[#0B2447] truncate">{m.nome_completo}</p>
                    {m.tem_conta_vinculada && (
                      <BadgeCheck className="w-3.5 h-3.5 text-teal-500 shrink-0" aria-label="Conta vinculada" />
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{m.cpf ? maskCPF(m.cpf) : '—'}</p>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {fmtTelefone(m.telefone)}
                  </p>
                </div>
                {!m.ativo && (
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                    Inativo
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {m.embarcacoes.length === 0 ? (
                  <span className="text-xs text-amber-600">Sem embarcação vinculada</span>
                ) : (
                  m.embarcacoes.map((e) => (
                    <span
                      key={e.id}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium px-2 py-0.5"
                    >
                      <Ship className="w-3 h-3" />
                      {e.nome}
                    </span>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-auto">
                <span className="text-[11px] text-slate-400">
                  {m.total_atendimentos} atendimento{m.total_atendimentos !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-1">
                  <Link
                    href={`/painel/equipe/${m.id}/editar`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#0B2447] hover:bg-slate-100 transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => toggleAtivo(m)}
                    disabled={pending}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50"
                    title={m.ativo ? 'Desativar' : 'Reativar'}
                  >
                    {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => remover(m)}
                    disabled={pending}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
