'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Search, ChevronUp, ChevronDown, Pencil, Percent,
  ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import TaxaGestorModal from './TaxaGestorModal';
import { FUSO_HORARIO, hojeISO } from '@/lib/datas';

const PAGE_SIZES = [10, 25, 50];

export type AdminGestorTaxaItem = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  taxaEspecifica: {
    taxaPercent: number;
    ativo: boolean;
    dataValidade: string | null;
    observacao: string | null;
  } | null;
};

// Colunas ordenáveis no servidor (colunas diretas da tabela users).
type SortKey = 'nome' | 'cadastro';

type Props = {
  gestores: AdminGestorTaxaItem[];
  total: number;
  page: number;
  perPage: number;
  taxaGeralPercent: number | null;
};

function fmtPercent(v: number): string {
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: FUSO_HORARIO });
}


/** Resolve qual taxa efetivamente vale pra esse gestor agora — mesma regra de `get_taxa_usuario`. */
function taxaVigente(
  g: AdminGestorTaxaItem,
  taxaGeralPercent: number | null,
): { percent: number | null; origem: 'global' | 'especifica' } {
  const t = g.taxaEspecifica;
  const emVigor = t != null && t.ativo && (!t.dataValidade || t.dataValidade >= hojeISO());
  if (emVigor) return { percent: t!.taxaPercent, origem: 'especifica' };
  return { percent: taxaGeralPercent, origem: 'global' };
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
  sortKey: SortKey; sortDir: 'asc' | 'desc'; onSort: (col: SortKey) => void;
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
          <ChevronUp   className={`w-2.5 h-2.5 -mb-0.5 ${active && sortDir === 'asc'  ? 'text-[#0B2447]' : 'text-slate-300'}`} />
          <ChevronDown className={`w-2.5 h-2.5         ${active && sortDir === 'desc' ? 'text-[#0B2447]' : 'text-slate-300'}`} />
        </span>
      </div>
    </th>
  );
}

function ThPlain({ label, className = '' }: { label: string; className?: string }) {
  return (
    <th className={`pb-3 px-4 text-[10px] font-bold text-slate-400 tracking-wider uppercase whitespace-nowrap ${className}`}>
      {label}
    </th>
  );
}

export default function AdminTaxasGestoresGrid({ gestores, total, page, perPage, taxaGeralPercent }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sortKey = (searchParams.get('sort') ?? 'nome') as SortKey;
  const sortDir = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';

  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [isNavigating, startNavigation] = useTransition();
  const [editando, setEditando] = useState<AdminGestorTaxaItem | null>(null);

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
    if (sortKey === key) {
      setParams({ dir: sortDir === 'asc' ? 'desc' : 'asc', page: null });
    } else {
      setParams({ sort: key, dir: 'asc', page: null });
    }
  }

  function goToPage(n: number) {
    setParams({ page: n <= 1 ? null : String(n) });
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div>
      <p className="mb-3 text-sm font-bold text-[#0B2447]">Taxas específicas por gestor</p>

      <div className="relative mb-5">
        {isNavigating ? (
          <Loader2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin pointer-events-none" />
        ) : (
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        )}
        <input
          type="text"
          placeholder="Buscar gestor por nome ou e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {gestores.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Percent className="w-12 h-12 text-slate-200 mb-4" />
            <p className="text-sm font-medium text-slate-500">
              {search ? 'Nenhum gestor encontrado' : 'Nenhum gestor cadastrado ainda'}
            </p>
            {search && (
              <p className="text-xs text-slate-400 mt-1">Tente outros termos de busca.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <ThSortable col="nome"     label="Gestor"    className="pl-6" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="cadastro" label="Cadastro"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThPlain    label="Taxa aplicada" />
                  <th className="pb-3 px-4 pr-6 text-[10px] font-bold text-slate-400 tracking-wider uppercase text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {gestores.map((g) => {
                  const vigente = taxaVigente(g, taxaGeralPercent);
                  const overrideForaDeVigor = g.taxaEspecifica != null && vigente.origem === 'global';

                  return (
                    <tr key={g.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                      {/* Gestor */}
                      <td className="py-4 pl-6 pr-4">
                        <p className="text-sm font-semibold text-[#0B2447] leading-tight">{g.name}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{g.email}</p>
                      </td>

                      {/* Cadastro */}
                      <td className="py-4 px-4">
                        <span className="text-sm text-slate-600 whitespace-nowrap">{fmtData(g.createdAt)}</span>
                      </td>

                      {/* Taxa aplicada */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                              vigente.origem === 'especifica' ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {vigente.origem === 'especifica' ? 'Específica' : 'Global'}
                            {vigente.percent != null ? ` · ${fmtPercent(vigente.percent)}` : ''}
                          </span>
                          {overrideForaDeVigor && (
                            <span className="text-[10px] text-amber-600">
                              taxa específica de {fmtPercent(g.taxaEspecifica!.taxaPercent)}{' '}
                              {g.taxaEspecifica!.ativo ? 'expirada' : 'inativa'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="py-4 px-4 pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditando(g)}
                            title={g.taxaEspecifica ? 'Editar taxa específica' : 'Definir taxa específica'}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#0B2447] hover:bg-slate-100 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer: count + page size + pagination */}
        {total > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <p className="text-xs text-slate-400">
                Mostrando{' '}
                <span className="font-semibold text-slate-600">
                  {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)}
                </span>{' '}
                de{' '}
                <span className="font-semibold text-slate-600">{total}</span>{' '}
                gestores
              </p>
              <label className="flex items-center gap-1.5 text-xs text-slate-400">
                Por página:
                <select
                  value={perPage}
                  onChange={(ev) => setParams({ per: ev.target.value === '10' ? null : ev.target.value, page: null })}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 cursor-pointer"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => goToPage(1)} disabled={page === 1} title="Primeira página"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => goToPage(Math.max(1, page - 1))} disabled={page === 1} title="Página anterior"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {getPageNumbers(page, totalPages).map((n, i) =>
                  n === '…' ? (
                    <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-slate-400">…</span>
                  ) : (
                    <button key={n} onClick={() => goToPage(n)}
                      className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
                        n === page ? 'bg-[#0B2447] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
                      }`}>
                      {n}
                    </button>
                  ),
                )}

                <button onClick={() => goToPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} title="Próxima página"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => goToPage(totalPages)} disabled={page === totalPages} title="Última página"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {editando && (
        <TaxaGestorModal
          gestor={editando}
          onClose={() => setEditando(null)}
          onSaved={() => {
            setEditando(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
