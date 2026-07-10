'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Search, ChevronUp, ChevronDown, Pencil, MapPin,
  ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { alternarStatusRoteiroAdmin } from '../actions';

const PAGE_SIZES = [10, 25, 50];

export type AdminRoteiroListItem = {
  id: string;
  nome: string;
  descricao: string;
  duracao: string | null;
  quantidade_pessoas: number | null;
  origem: string | null;
  destino: string | null;
  ativo: boolean;
  created_at: string;
  gestor: { name: string; email: string } | null;
  embarcacao: { nome: string } | null;
  municipios: { nome: string; estados: { uf: string } | null } | null;
  roteiro_imagens: { url_imagem: string; principal: boolean }[];
};

// Colunas ordenáveis no servidor (colunas diretas da tabela roteiro).
type SortKey = 'nome' | 'duracao' | 'pessoas' | 'status' | 'created_at';

type Props = {
  roteiros: AdminRoteiroListItem[];
  total: number;
  page: number;
  perPage: number;
};

function getImage(imgs: { url_imagem: string; principal: boolean }[]): string | null {
  return (imgs.find((i) => i.principal) ?? imgs[0])?.url_imagem ?? null;
}

function getLocalidade(m: AdminRoteiroListItem['municipios']): string {
  if (!m) return '';
  return m.estados ? `${m.nome} / ${m.estados.uf}` : m.nome;
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

export default function AdminRoteirosGrid({ roteiros, total, page, perPage }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sortKey = (searchParams.get('sort') ?? 'created_at') as SortKey;
  const sortDir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';

  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [isNavigating, startNavigation] = useTransition();

  // Toggle de status (ativo/inativo) — direto, sem cascata (roteiro é folha).
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition]       = useTransition();

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

  function handleToggle(item: AdminRoteiroListItem) {
    if (pendingId) return;
    setPendingId(item.id);
    startTransition(async () => {
      await alternarStatusRoteiroAdmin(item.id, !item.ativo);
      setPendingId(null);
      router.refresh();
    });
  }

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
      <div className="relative mb-5">
        {isNavigating ? (
          <Loader2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin pointer-events-none" />
        ) : (
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        )}
        <input
          type="text"
          placeholder="Buscar por nome, origem, destino ou gestor (nome/e-mail)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {roteiros.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MapPin className="w-12 h-12 text-slate-200 mb-4" />
            <p className="text-sm font-medium text-slate-500">
              {search ? 'Nenhum roteiro encontrado' : 'Nenhum roteiro cadastrado'}
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
                  <ThSortable col="nome"    label="Roteiro" className="pl-6" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThPlain    label="Gestor" />
                  <ThPlain    label="Embarcação" />
                  <ThPlain    label="Localização" />
                  <ThSortable col="duracao" label="Duração" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="pessoas" label="Pessoas" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="status"  label="Status"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="pb-3 px-4 pr-6 text-[10px] font-bold text-slate-400 tracking-wider uppercase text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {roteiros.map((r) => {
                  const img        = getImage(r.roteiro_imagens);
                  const localidade = getLocalidade(r.municipios) || '—';

                  return (
                    <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 pl-6 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100">
                            {img ? (
                              <Image src={img} alt={r.nome} width={44} height={44} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <MapPin className="w-5 h-5 text-slate-300" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#0B2447] leading-tight">{r.nome}</p>
                            {(r.origem || r.destino) && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {[r.origem, r.destino].filter(Boolean).join(' → ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Gestor */}
                      <td className="py-4 px-4">
                        {r.gestor ? (
                          <div>
                            <p className="text-sm font-medium text-slate-700 whitespace-nowrap">{r.gestor.name}</p>
                            <p className="text-[11px] text-slate-400">{r.gestor.email}</p>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        {r.embarcacao ? (
                          <span className="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 whitespace-nowrap">
                            {r.embarcacao.nome}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <span className="text-sm text-slate-600 whitespace-nowrap">{localidade}</span>
                      </td>

                      <td className="py-4 px-4">
                        {r.duracao ? (
                          <span className="text-sm text-slate-700">{r.duracao}</span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        {r.quantidade_pessoas != null ? (
                          <span className="text-sm font-medium text-slate-700">{r.quantidade_pessoas} pax</span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Status — toggle ativo/inativo */}
                      <td className="py-4 px-4">
                        {(() => {
                          const isPending = pendingId === r.id;
                          return (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={r.ativo}
                                disabled={isPending}
                                onClick={() => handleToggle(r)}
                                title={r.ativo ? 'Desativar roteiro' : 'Ativar roteiro'}
                                className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                  r.ativo ? 'bg-emerald-500' : 'bg-slate-300'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                    r.ativo ? 'translate-x-4' : 'translate-x-0.5'
                                  }`}
                                />
                              </button>
                              {isPending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                              ) : (
                                <span className={`text-[11px] font-semibold ${r.ativo ? 'text-emerald-700' : 'text-slate-500'}`}>
                                  {r.ativo ? 'Ativo' : 'Inativo'}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      <td className="py-4 px-4 pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/administrator/roteiros/${r.id}/editar`}
                            title="Editar"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#0B2447] hover:bg-slate-100 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>
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
                roteiros
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
    </div>
  );
}
