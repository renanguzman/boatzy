'use client';

import { useState, useMemo, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  ChevronUp,
  ChevronDown,
  Eye,
  Pencil,
  Ship,
  Tag,
  Users,
  CheckCircle2,
  Ban,
  Filter,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import type { AnuncioVendaStatus } from '@/types/supabase';
import { alterarStatusAnuncio } from '../actions';

const PAGE_SIZE = 10;

export type AnuncioListItem = {
  id: string;
  fabricante: string;
  ano_modelo: number;
  ano_fabricacao: number;
  preco: number;
  status: AnuncioVendaStatus;
  visualizacoes: number;
  created_at: string;
  embarcacao: {
    id: string;
    nome: string;
    embarcacao_imagens: { url_imagem: string; principal: boolean }[];
  } | null;
  leads: number;
};

type SortKey = 'nome' | 'fabricante' | 'ano_modelo' | 'preco' | 'visualizacoes' | 'leads' | 'status' | 'created_at';
type SortDir = 'asc' | 'desc';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function getImage(a: AnuncioListItem): string | null {
  const imgs = a.embarcacao?.embarcacao_imagens ?? [];
  return (imgs.find((i) => i.principal) ?? imgs[0])?.url_imagem ?? null;
}

function getSortValue(item: AnuncioListItem, key: SortKey): string | number {
  switch (key) {
    case 'nome':          return (item.embarcacao?.nome ?? '').toLowerCase();
    case 'fabricante':    return item.fabricante.toLowerCase();
    case 'ano_modelo':    return item.ano_modelo;
    case 'preco':         return Number(item.preco);
    case 'visualizacoes': return item.visualizacoes;
    case 'leads':         return item.leads;
    case 'status':        return item.status;
    case 'created_at':    return item.created_at;
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

/** Encerramento (vendido/cancelado) exige confirmação — é terminal. */
type Encerramento = { anuncio: AnuncioListItem; novoStatus: Extract<AnuncioVendaStatus, 'vendido' | 'cancelado'> };

export default function VendasGrid({ anuncios }: { anuncios: AnuncioListItem[] }) {
  const router = useRouter();
  const [search, setSearch]   = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage]       = useState(1);

  const [confirming, setConfirming] = useState<Encerramento | null>(null);
  const [pendingId, setPendingId]   = useState<string | null>(null);
  const [, startTransition]         = useTransition();

  function runStatus(id: string, novoStatus: AnuncioVendaStatus) {
    setPendingId(id);
    startTransition(async () => {
      await alterarStatusAnuncio(id, novoStatus);
      setConfirming(null);
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
    if (!q) return anuncios;
    return anuncios.filter(
      (a) =>
        (a.embarcacao?.nome ?? '').toLowerCase().includes(q) ||
        a.fabricante.toLowerCase().includes(q),
    );
  }, [anuncios, search]);

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
          placeholder="Buscar por embarcação ou fabricante..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Tag className="w-12 h-12 text-slate-200 mb-4" />
            <p className="text-sm font-medium text-slate-500">
              {search ? 'Nenhum anúncio encontrado' : 'Nenhum anúncio de venda cadastrado'}
            </p>
            {search ? (
              <p className="text-xs text-slate-400 mt-1">Tente outros termos de busca.</p>
            ) : (
              <Link
                href="/painel/vendas/novo"
                className="mt-4 text-sm font-semibold text-[#0B3D91] hover:text-[#0B2447] transition-colors"
              >
                Anunciar uma embarcação →
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <ThSortable col="nome"          label="Embarcação"    className="pl-6" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="fabricante"    label="Fabricante"    sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="ano_modelo"    label="Ano"           sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="preco"         label="Preço"         sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="visualizacoes" label="Visualizações" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="leads"         label="Leads"         sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="status"        label="Status"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="pb-3 px-4 pr-6 text-[10px] font-bold text-slate-400 tracking-wider uppercase text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {paged.map((a) => {
                  const img = getImage(a);
                  const vigente = a.status === 'ativo' || a.status === 'pausado';
                  const isPending = pendingId === a.id;

                  return (
                    <tr
                      key={a.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors"
                    >
                      {/* Embarcação */}
                      <td className="py-4 pl-6 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100">
                            {img ? (
                              <Image
                                src={img}
                                alt={a.embarcacao?.nome ?? 'Embarcação'}
                                width={44}
                                height={44}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Ship className="w-5 h-5 text-slate-300" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#0B2447] leading-tight">
                              {a.embarcacao?.nome ?? '—'}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5 tracking-wide">
                              ID: {a.id.slice(0, 8).toUpperCase()}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Fabricante */}
                      <td className="py-4 px-4">
                        <span className="text-sm text-slate-600 whitespace-nowrap">{a.fabricante}</span>
                      </td>

                      {/* Ano modelo/fabricação */}
                      <td className="py-4 px-4">
                        <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
                          {a.ano_modelo}
                          {a.ano_fabricacao !== a.ano_modelo && (
                            <span className="text-xs text-slate-400"> / fab. {a.ano_fabricacao}</span>
                          )}
                        </span>
                      </td>

                      {/* Preço */}
                      <td className="py-4 px-4">
                        <span className="text-sm font-semibold text-[#0B2447] whitespace-nowrap">
                          {brl.format(Number(a.preco))}
                        </span>
                      </td>

                      {/* Visualizações */}
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          {a.visualizacoes}
                        </span>
                      </td>

                      {/* Leads */}
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center gap-1.5 text-sm ${a.leads > 0 ? 'font-semibold text-[#0B3D91]' : 'text-slate-600'}`}>
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {a.leads}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {vigente ? (
                          (() => {
                            const isAtivo = a.status === 'ativo';
                            return (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={isAtivo}
                                  disabled={isPending}
                                  onClick={() => runStatus(a.id, isAtivo ? 'pausado' : 'ativo')}
                                  title={isAtivo ? 'Pausar anúncio (sai do site)' : 'Reativar anúncio'}
                                  className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                    isAtivo ? 'bg-emerald-500' : 'bg-slate-300'
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                      isAtivo ? 'translate-x-4' : 'translate-x-0.5'
                                    }`}
                                  />
                                </button>
                                {isPending ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                                ) : (
                                  <span className={`text-[11px] font-semibold ${isAtivo ? 'text-emerald-700' : 'text-slate-500'}`}>
                                    {isAtivo ? 'Ativo' : 'Pausado'}
                                  </span>
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          <span
                            className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                              a.status === 'vendido'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {a.status === 'vendido' ? 'Vendido' : 'Cancelado'}
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-4 px-4 pr-6">
                        {vigente ? (
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/painel/vendas/funil?anuncio=${a.id}`}
                              title="Ver funil de leads"
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#0B2447] hover:bg-slate-100 transition-colors"
                            >
                              <Filter className="w-4 h-4" />
                            </Link>
                            <Link
                              href={`/painel/vendas/${a.id}/editar`}
                              title="Editar anúncio"
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#0B2447] hover:bg-slate-100 transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </Link>
                            <button
                              title="Marcar como vendido"
                              disabled={isPending}
                              onClick={() => setConfirming({ anuncio: a, novoStatus: 'vendido' })}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              title="Cancelar anúncio"
                              disabled={isPending}
                              onClick={() => setConfirming({ anuncio: a, novoStatus: 'cancelado' })}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          // Encerrado: só o funil (os leads ficam preservados).
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/painel/vendas/funil?anuncio=${a.id}`}
                              title="Ver funil de leads"
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#0B2447] hover:bg-slate-100 transition-colors"
                            >
                              <Filter className="w-4 h-4" />
                            </Link>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
              anúncios
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

      {/* Modal de confirmação de encerramento (vendido/cancelado) */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => pendingId || setConfirming(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                confirming.novoStatus === 'vendido' ? 'bg-emerald-50' : 'bg-amber-50'
              }`}>
                {confirming.novoStatus === 'vendido' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0B2447]">
                  {confirming.novoStatus === 'vendido' ? 'Marcar como vendido?' : 'Cancelar anúncio?'}
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  O anúncio de <strong>{confirming.anuncio.embarcacao?.nome}</strong> será encerrado.
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-500 mb-5">
              Essa ação é definitiva: o anúncio sai do site e não pode ser reaberto — mas o
              histórico de preço e os interessados ficam preservados, e a embarcação fica livre
              para um novo anúncio.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={!!pendingId}
                onClick={() => setConfirming(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={!!pendingId}
                onClick={() => runStatus(confirming.anuncio.id, confirming.novoStatus)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                  confirming.novoStatus === 'vendido'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {pendingId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {confirming.novoStatus === 'vendido' ? 'Marcar vendido' : 'Cancelar anúncio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
