'use client';

import { useState, useMemo, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search, ChevronUp, ChevronDown, Eye, Pencil, Trash2, MapPin,
  ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { alternarStatusRoteiro } from '../actions';

const PAGE_SIZE = 10;

export type RoteiroListItem = {
  id: string;
  nome: string;
  descricao: string;
  duracao: string | null;
  quantidade_pessoas: number | null;
  origem: string | null;
  destino: string | null;
  ativo: boolean;
  created_at: string;
  embarcacao: { nome: string } | null;
  municipios: { nome: string; estados: { uf: string } | null } | null;
  roteiro_imagens: { url_imagem: string; principal: boolean }[];
};

type SortKey = 'nome' | 'embarcacao' | 'localidade' | 'duracao' | 'pessoas' | 'status' | 'created_at';
type SortDir = 'asc' | 'desc';

function getImage(imgs: { url_imagem: string; principal: boolean }[]): string | null {
  return (imgs.find((i) => i.principal) ?? imgs[0])?.url_imagem ?? null;
}

function getLocalidade(m: RoteiroListItem['municipios']): string {
  if (!m) return '';
  return m.estados ? `${m.nome} / ${m.estados.uf}` : m.nome;
}

function getSortValue(item: RoteiroListItem, key: SortKey): string | number {
  switch (key) {
    case 'nome':       return item.nome.toLowerCase();
    case 'embarcacao': return (item.embarcacao?.nome ?? '').toLowerCase();
    case 'localidade': return getLocalidade(item.municipios).toLowerCase();
    case 'duracao':    return (item.duracao ?? '').toLowerCase();
    case 'pessoas':    return item.quantidade_pessoas ?? -1;
    case 'status':     return item.ativo ? 1 : 0;
    case 'created_at': return item.created_at;
  }
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
          <ChevronUp   className={`w-2.5 h-2.5 -mb-0.5 ${active && sortDir === 'asc'  ? 'text-[#0B2447]' : 'text-slate-300'}`} />
          <ChevronDown className={`w-2.5 h-2.5         ${active && sortDir === 'desc' ? 'text-[#0B2447]' : 'text-slate-300'}`} />
        </span>
      </div>
    </th>
  );
}

export default function RoteirosGrid({ roteiros }: { roteiros: RoteiroListItem[] }) {
  const router = useRouter();
  const [search, setSearch]   = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage]       = useState(1);

  // Toggle de status (ativo/inativo) — direto, sem cascata (roteiro é folha).
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition]       = useTransition();

  function handleToggle(item: RoteiroListItem) {
    if (pendingId) return;
    setPendingId(item.id);
    startTransition(async () => {
      await alternarStatusRoteiro(item.id, !item.ativo);
      setPendingId(null);
      router.refresh();
    });
  }

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
    if (!q) return roteiros;
    return roteiros.filter(
      (r) =>
        r.nome.toLowerCase().includes(q) ||
        (r.embarcacao?.nome ?? '').toLowerCase().includes(q) ||
        getLocalidade(r.municipios).toLowerCase().includes(q) ||
        (r.origem ?? '').toLowerCase().includes(q) ||
        (r.destino ?? '').toLowerCase().includes(q),
    );
  }, [roteiros, search]);

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
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por nome, embarcação, origem, destino ou localização..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {paged.length === 0 ? (
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
                  <ThSortable col="nome"       label="Roteiro"     className="pl-6" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="embarcacao" label="Embarcação"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="localidade" label="Localização" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="duracao"    label="Duração"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="pessoas"    label="Pessoas"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="status"     label="Status"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="pb-3 px-4 pr-6 text-[10px] font-bold text-slate-400 tracking-wider uppercase text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => {
                  const img       = getImage(r.roteiro_imagens);
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
                          <button
                            title="Visualizar"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#0B2447] hover:bg-slate-100 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <Link
                            href={`/painel/roteiros/${r.id}/editar`}
                            title="Editar"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#0B2447] hover:bg-slate-100 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>
                          <button
                            title="Excluir"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
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

        {sorted.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              Mostrando{' '}
              <span className="font-semibold text-slate-600">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)}
              </span>{' '}
              de{' '}
              <span className="font-semibold text-slate-600">{sorted.length}</span>{' '}
              roteiros
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={page === 1} title="Primeira página"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} title="Página anterior"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {getPageNumbers(page, totalPages).map((n, i) =>
                  n === '…' ? (
                    <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-slate-400">…</span>
                  ) : (
                    <button key={n} onClick={() => setPage(n)}
                      className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
                        n === page ? 'bg-[#0B2447] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
                      }`}>
                      {n}
                    </button>
                  ),
                )}

                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} title="Próxima página"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages} title="Última página"
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
