'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Search, ChevronUp, ChevronDown, Pencil, Trash2, Eye, Send, CopyPlus, FileText,
  ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import type { TermoUsoStatus } from '@/types/supabase';
import {
  TERMO_PUBLICO_ALVO_LABEL,
  TERMOS_IDENTIFICADORES,
  isTermoIdentificador,
  termoIdentificadorLabel,
} from '@/lib/termos/identificadores';
import TermoStatusBadge from './TermoStatusBadge';
import { useTermoAcoes } from './useTermoAcoes';

const PAGE_SIZES = [10, 25, 50];

export type AdminTermoListItem = {
  id: string;
  identificador: string;
  versao: number;
  titulo: string;
  status: TermoUsoStatus;
  publicado_em: string | null;
  data_cadastro: string;
};

// Colunas ordenáveis no servidor (colunas diretas da tabela termos_uso_plataforma).
type SortKey = 'identificador' | 'titulo' | 'versao' | 'status' | 'data_cadastro';

type Props = {
  termos: AdminTermoListItem[];
  total: number;
  page: number;
  perPage: number;
};

function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
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

function ThPlain({ label, className = '' }: { label: string; className?: string }) {
  return (
    <th className={`pb-3 px-4 text-[10px] font-bold text-slate-400 tracking-wider uppercase whitespace-nowrap ${className}`}>
      {label}
    </th>
  );
}

const iconBtn =
  'w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

export default function AdminTermosGrid({ termos, total, page, perPage }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sortKey = (searchParams.get('sort') ?? 'data_cadastro') as SortKey;
  const sortDir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
  const statusFiltro = searchParams.get('status') ?? '';

  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [isNavigating, startNavigation] = useTransition();
  const { confirmar, novaVersao, novaVersaoId, modal } = useTermoAcoes();

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
  const filtrando = !!search || !!statusFiltro;

  return (
    <div>
      {/* Busca + filtro de status */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          {isNavigating ? (
            <Loader2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin pointer-events-none" />
          ) : (
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          )}
          <input
            type="text"
            placeholder="Buscar por título ou identificador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition"
          />
        </div>
        <select
          value={statusFiltro}
          onChange={(e) => setParams({ status: e.target.value, page: null })}
          className="sm:w-48 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 cursor-pointer"
        >
          <option value="">Todos os status</option>
          <option value="publicado">Vigentes</option>
          <option value="rascunho">Rascunhos</option>
          <option value="arquivado">Arquivados</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {termos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="w-12 h-12 text-slate-200 mb-4" />
            <p className="text-sm font-medium text-slate-500">
              {filtrando ? 'Nenhum termo encontrado' : 'Nenhum termo cadastrado'}
            </p>
            {filtrando && (
              <p className="text-xs text-slate-400 mt-1">Tente outros termos de busca ou outro status.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <ThSortable col="titulo"        label="Termo"         className="pl-6" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="identificador" label="Identificador" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThPlain    label="Público" />
                  <ThSortable col="versao"        label="Versão"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="status"        label="Status"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThPlain    label="Publicado em" />
                  <ThSortable col="data_cadastro" label="Cadastro"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="pb-3 px-4 pr-6 text-[10px] font-bold text-slate-400 tracking-wider uppercase text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {termos.map((t) => {
                  const publico = isTermoIdentificador(t.identificador)
                    ? TERMO_PUBLICO_ALVO_LABEL[TERMOS_IDENTIFICADORES[t.identificador].publicoAlvo]
                    : '—';
                  const rascunho = t.status === 'rascunho';

                  return (
                    <tr
                      key={t.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors"
                    >
                      {/* Termo */}
                      <td className="py-4 pl-6 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-[#0B2447]/5 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-5 h-5 text-[#0B2447]" />
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/administrator/termos/${t.id}`}
                              className="text-sm font-semibold text-[#0B2447] leading-tight hover:underline line-clamp-2"
                            >
                              {t.titulo}
                            </Link>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5 tracking-wide">
                              ID: {t.id.slice(0, 8).toUpperCase()}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Identificador */}
                      <td className="py-4 px-4">
                        <p className="text-sm font-medium text-slate-700 whitespace-nowrap">
                          {termoIdentificadorLabel(t.identificador)}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">{t.identificador}</p>
                      </td>

                      {/* Público */}
                      <td className="py-4 px-4">
                        <span className="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 whitespace-nowrap">
                          {publico}
                        </span>
                      </td>

                      {/* Versão */}
                      <td className="py-4 px-4">
                        <span className="text-sm font-semibold text-slate-700">v{t.versao}</span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <TermoStatusBadge status={t.status} />
                      </td>

                      {/* Publicado em */}
                      <td className="py-4 px-4">
                        {t.publicado_em ? (
                          <span className="text-sm text-slate-600 whitespace-nowrap">{fmtDataHora(t.publicado_em)}</span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Cadastro */}
                      <td className="py-4 px-4">
                        <span className="text-sm text-slate-600 whitespace-nowrap">{fmtDataHora(t.data_cadastro)}</span>
                      </td>

                      {/* Ações */}
                      <td className="py-4 px-4 pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/administrator/termos/${t.id}`}
                            title="Visualizar"
                            className={`${iconBtn} hover:text-[#0B2447] hover:bg-slate-100`}
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          {rascunho ? (
                            <>
                              <Link
                                href={`/administrator/termos/${t.id}/editar`}
                                title="Editar rascunho"
                                className={`${iconBtn} hover:text-[#0B2447] hover:bg-slate-100`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => confirmar('publicar', t)}
                                title="Publicar versão"
                                className={`${iconBtn} hover:text-emerald-600 hover:bg-emerald-50`}
                              >
                                <Send className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => confirmar('excluir', t)}
                                title="Excluir rascunho"
                                className={`${iconBtn} hover:text-red-600 hover:bg-red-50`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => novaVersao(t)}
                              disabled={!!novaVersaoId}
                              title="Criar nova versão a partir desta"
                              className={`${iconBtn} hover:text-[#0B2447] hover:bg-slate-100`}
                            >
                              {novaVersaoId === t.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <CopyPlus className="w-4 h-4" />}
                            </button>
                          )}
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
                termos
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
                <button
                  onClick={() => goToPage(1)}
                  disabled={page === 1}
                  title="Primeira página"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => goToPage(Math.max(1, page - 1))}
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
                      onClick={() => goToPage(n)}
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
                  onClick={() => goToPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  title="Próxima página"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => goToPage(totalPages)}
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

      {modal}
    </div>
  );
}
