'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  Search,
  ChevronUp,
  ChevronDown,
  Users,
  User,
  MessageCircle,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { authorizeRealtime } from '@/lib/supabase/realtime';

const PAGE_SIZE = 10;

export type ClienteListItem = {
  id: string;
  name: string;
  email: string;
  cpf_cnpj: string | null;
  avatar_url: string | null;
  cliente_desde: string;        // users.created_at (ISO)
  total_reservas: number;
  ultima_reserva: string;       // max(reserva.solicitado_em) (ISO)
  nao_lidas: number;            // mensagens de chat não lidas (cliente → gestor)
};

type SortKey = 'nome' | 'email' | 'cpf' | 'total_reservas' | 'ultima_reserva';
type SortDir = 'asc' | 'desc';

function getSortValue(item: ClienteListItem, key: SortKey): string | number {
  switch (key) {
    case 'nome':           return item.name.toLowerCase();
    case 'email':          return item.email.toLowerCase();
    case 'cpf':            return (item.cpf_cnpj ?? '').toLowerCase();
    case 'total_reservas': return item.total_reservas;
    case 'ultima_reserva': return item.ultima_reserva;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  if (current > 3) pages.push('…');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

function ThSortable({ col, label, className = '', sortKey, sortDir, onSort }: {
  col: SortKey; label: string; className?: string;
  sortKey: SortKey; sortDir: SortDir; onSort: (col: SortKey) => void;
}) {
  const active = sortKey === col;
  return (
    <th
      onClick={() => onSort(col)}
      className={`pb-3 px-4 text-[10px] font-bold tracking-wider uppercase cursor-pointer select-none whitespace-nowrap ${className}`}
    >
      <div className="flex items-center gap-1 text-slate-400 hover:text-[#0B2447] transition-colors">
        {label}
        <span className="flex flex-col">
          <ChevronUp
            className={`w-2.5 h-2.5 -mb-0.5 ${active && sortDir === 'asc' ? 'text-[#0B2447]' : 'text-slate-300'}`}
          />
          <ChevronDown
            className={`w-2.5 h-2.5 ${active && sortDir === 'desc' ? 'text-[#0B2447]' : 'text-slate-300'}`}
          />
        </span>
      </div>
    </th>
  );
}

export default function ClientesGrid({ clientes }: { clientes: ClienteListItem[] }) {
  const [search, setSearch]   = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('ultima_reserva');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage]       = useState(1);

  // Não lidas por cliente, mantidas ao vivo via Realtime (sobrepõem o valor
  // inicial vindo do servidor em cada `ClienteListItem.nao_lidas`).
  const [naoLidasMap, setNaoLidasMap] = useState<Map<string, number>>(
    () => new Map(clientes.map((c) => [c.id, c.nao_lidas])),
  );
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    const supabase = supabaseRef.current;
    let channel: RealtimeChannel | undefined;
    let cancelled = false;

    async function refetch() {
      const { data } = await supabase.rpc('chat_nao_lidas_por_cliente');
      if (cancelled) return;
      setNaoLidasMap(new Map((data ?? []).map((r) => [r.cliente_id, Number(r.total)])));
    }

    (async () => {
      await authorizeRealtime(supabase);
      if (cancelled) return;
      await refetch();
      channel = supabase
        .channel('clientes:nao-lidas')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagem' }, () => {
          void refetch();
        })
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.cpf_cnpj ?? '').toLowerCase().includes(q),
    );
  }, [clientes, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      {/* Search bar */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por nome, e-mail ou CPF/CNPJ..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="w-12 h-12 text-slate-200 mb-4" />
            <p className="text-sm font-medium text-slate-500">
              {search ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {search
                ? 'Tente outros termos de busca.'
                : 'Os clientes aparecem aqui assim que fazem a primeira reserva.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <ThSortable col="nome"           label="Cliente"        className="pl-6" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="email"          label="E-mail"         sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="cpf"            label="CPF / CNPJ"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="total_reservas" label="Reservas"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="ultima_reserva" label="Última reserva" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="pb-3 px-4 pr-6 text-[10px] font-bold text-slate-400 tracking-wider uppercase text-right">
                    Chat
                  </th>
                </tr>
              </thead>
              <tbody>
                {paged.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors"
                  >
                    {/* Cliente */}
                    <td className="py-4 pl-6 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100">
                          {c.avatar_url ? (
                            <Image
                              src={c.avatar_url}
                              alt={c.name}
                              width={44}
                              height={44}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <User className="w-5 h-5 text-slate-300" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#0B2447] leading-tight">{c.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 tracking-wide">
                            Cliente desde {formatDate(c.cliente_desde)}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* E-mail */}
                    <td className="py-4 px-4">
                      <span className="text-sm text-slate-600">{c.email}</span>
                    </td>

                    {/* CPF / CNPJ */}
                    <td className="py-4 px-4">
                      {c.cpf_cnpj ? (
                        <span className="text-sm text-slate-600 whitespace-nowrap">{c.cpf_cnpj}</span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Reservas */}
                    <td className="py-4 px-4">
                      <span className="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
                        {c.total_reservas}
                      </span>
                    </td>

                    {/* Última reserva */}
                    <td className="py-4 px-4">
                      <span className="text-sm text-slate-600 whitespace-nowrap">
                        {formatDate(c.ultima_reserva)}
                      </span>
                    </td>

                    {/* Chat */}
                    <td className="py-4 px-4 pr-6">
                      <div className="flex items-center justify-end">
                        {(() => {
                          const naoLidas = naoLidasMap.get(c.id) ?? 0;
                          return (
                            <Link
                              href={`/painel/clientes/${c.id}/chat`}
                              title={naoLidas > 0 ? `${naoLidas} mensagem(ns) não lida(s)` : 'Abrir chat'}
                              className="relative w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#0B2447] hover:bg-slate-100 transition-colors"
                            >
                              <MessageCircle className="w-5 h-5" />
                              {naoLidas > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                                  {naoLidas > 99 ? '99+' : naoLidas}
                                </span>
                              )}
                            </Link>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer: count + pagination */}
        {sorted.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              Mostrando{' '}
              <span className="font-semibold text-slate-600">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)}
              </span>{' '}
              de{' '}
              <span className="font-semibold text-slate-600">{sorted.length}</span>{' '}
              cliente{sorted.length !== 1 ? 's' : ''}
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  title="Primeira página"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  title="Página anterior"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {getPageNumbers(page, totalPages).map((n, i) =>
                  n === '…' ? (
                    <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-slate-400">
                      …
                    </span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
                        n === page
                          ? 'bg-[#0B2447] text-white shadow-sm'
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {n}
                    </button>
                  ),
                )}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  title="Próxima página"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  title="Última página"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
