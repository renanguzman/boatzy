'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Search, ChevronUp, ChevronDown, Loader2, Users } from 'lucide-react';
import { maskCpfCnpj } from '@/lib/validators';
import { formatarTelefoneE164 } from '@/lib/countries';
import { formatarData } from '@/lib/datas';
import type { UserRole } from '@/types/supabase';

const PAGE_SIZES = [10, 25, 50] as const;

export type UsuarioListItem = {
  id: string;
  name: string;
  email: string;
  cpf_cnpj: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  papeis: UserRole[];
};

type SortKey = 'nome' | 'cadastro';
type SortDir = 'asc' | 'desc';

const PAPEL_LABEL: Record<UserRole, string> = { admin: 'Admin', gestor: 'Gestor', cliente: 'Cliente' };
const PAPEL_BADGE: Record<UserRole, string> = {
  admin: 'bg-purple-50 text-purple-700',
  gestor: 'bg-cyan-50 text-cyan-700',
  cliente: 'bg-slate-100 text-slate-600',
};
const FILTROS: { valor: UserRole | ''; label: string }[] = [
  { valor: '', label: 'Todos' },
  { valor: 'cliente', label: 'Clientes' },
  { valor: 'gestor', label: 'Gestores' },
  { valor: 'admin', label: 'Admins' },
];

function getPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  if (current > 3) pages.push('…');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
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
          <ChevronUp className={`w-2.5 h-2.5 -mb-0.5 ${active && sortDir === 'asc' ? 'text-[#0B2447]' : 'text-slate-300'}`} />
          <ChevronDown className={`w-2.5 h-2.5 ${active && sortDir === 'desc' ? 'text-[#0B2447]' : 'text-slate-300'}`} />
        </span>
      </div>
    </th>
  );
}

/** Lista de contas do admin — somente leitura (SPEC §62). */
export default function UsuariosGrid({ usuarios, total, page, perPage }: {
  usuarios: UsuarioListItem[];
  total: number;
  page: number;
  perPage: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sortKey = (searchParams.get('sort') ?? 'cadastro') as SortKey;
  const sortDir: SortDir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
  const papel = searchParams.get('papel') ?? '';

  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [isNavigating, startNavigation] = useTransition();

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') params.delete(key);
        else params.set(key, value);
      }
      startNavigation(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [router, pathname, searchParams],
  );

  // Busca com debounce: só consulta o servidor após 400ms sem digitação.
  useEffect(() => {
    const current = searchParams.get('q') ?? '';
    if (search === current) return;
    const t = setTimeout(() => setParams({ q: search, page: null }), 400);
    return () => clearTimeout(t);
  }, [search, searchParams, setParams]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setParams({ dir: sortDir === 'asc' ? 'desc' : 'asc', page: null });
    else setParams({ sort: key, dir: key === 'nome' ? 'asc' : 'desc', page: null });
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div>
      <div className="flex flex-col lg:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          {isNavigating ? (
            <Loader2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin pointer-events-none" />
          ) : (
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          )}
          <input
            type="text"
            placeholder="Buscar por nome, e-mail, CPF/CNPJ ou celular..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.valor || 'todos'}
              type="button"
              onClick={() => setParams({ papel: f.valor || null, page: null })}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                papel === f.valor
                  ? 'bg-[#0B2447] border-[#0B2447] text-white'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-[#0B2447]'
              }`}
            >
              {f.label}
            </button>
          ))}
          <label htmlFor="page-size" className="ml-2 text-xs font-semibold text-slate-400 whitespace-nowrap">Exibir</label>
          <select
            id="page-size"
            value={perPage}
            onChange={(e) => setParams({ per: e.target.value === '10' ? null : e.target.value, page: null })}
            className="pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition"
          >
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {usuarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="w-12 h-12 text-slate-200 mb-4" />
            <p className="text-sm font-medium text-slate-500">Nenhum usuário encontrado</p>
            <p className="text-xs text-slate-400 mt-1">Tente outros termos de busca ou outro filtro.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <ThSortable col="nome" label="Usuário" className="pl-6 pt-4" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="pb-3 pt-4 px-4 text-[10px] font-bold text-slate-400 tracking-wider uppercase">Papéis</th>
                  <th className="pb-3 pt-4 px-4 text-[10px] font-bold text-slate-400 tracking-wider uppercase whitespace-nowrap">CPF/CNPJ</th>
                  <th className="pb-3 pt-4 px-4 text-[10px] font-bold text-slate-400 tracking-wider uppercase">Celular</th>
                  <ThSortable col="cadastro" label="Cadastro" className="pr-6 pt-4" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 pl-6 pr-4">
                      <div className="flex items-center gap-3">
                        {u.avatar_url ? (
                          <Image src={u.avatar_url} alt="" width={32} height={32} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                            {(u.name?.[0] ?? '?').toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#0B2447] leading-tight truncate">{u.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {u.papeis.length > 0 ? u.papeis.map((r) => (
                          <span key={r} className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${PAPEL_BADGE[r]}`}>
                            {PAPEL_LABEL[r]}
                          </span>
                        )) : <span className="text-xs text-slate-300">—</span>}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-sm text-slate-600 whitespace-nowrap tabular-nums">
                      {u.cpf_cnpj ? maskCpfCnpj(u.cpf_cnpj) : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-sm text-slate-600 whitespace-nowrap tabular-nums">
                      {formatarTelefoneE164(u.phone)}
                    </td>
                    <td className="py-3.5 px-4 pr-6 text-sm text-slate-600 whitespace-nowrap">{formatarData(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              Mostrando{' '}
              <span className="font-semibold text-slate-600">
                {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)}
              </span>{' '}
              de <span className="font-semibold text-slate-600">{total}</span> usuário{total !== 1 ? 's' : ''}
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setParams({ page: page - 1 <= 1 ? null : String(page - 1) })}
                  disabled={page === 1}
                  title="Página anterior"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronDown className="w-3.5 h-3.5 rotate-90" />
                </button>
                {getPageNumbers(page, totalPages).map((n, i) =>
                  n === '…' ? (
                    <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-slate-400">…</span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setParams({ page: n <= 1 ? null : String(n) })}
                      className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
                        n === page ? 'bg-[#0B2447] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {n}
                    </button>
                  ),
                )}
                <button
                  onClick={() => setParams({ page: String(Math.min(totalPages, page + 1)) })}
                  disabled={page === totalPages}
                  title="Próxima página"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
