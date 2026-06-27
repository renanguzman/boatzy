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
  Trash2,
  Ship,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { alternarStatusEmbarcacao } from '../actions';

const PAGE_SIZE = 10;

export type EmbarcacaoStatus = 'ativo' | 'inativo' | 'em_manutencao';

export type EmbarcacaoListItem = {
  id: string;
  nome: string;
  status: EmbarcacaoStatus;
  capacidade: number | null;
  created_at: string;
  embarcacao_tipo: { nome: string } | null;
  embarcacao_categoria: { nome: string } | null;
  municipios: { nome: string; estados: { uf: string } | null } | null;
  embarcacao_imagens: { url_imagem: string; principal: boolean }[];
  roteiro: { id: string; nome: string }[];
};

type SortKey = 'nome' | 'tipo' | 'categoria' | 'status' | 'localidade' | 'capacidade' | 'created_at';
type SortDir = 'asc' | 'desc';

function getImage(imgs: { url_imagem: string; principal: boolean }[]): string | null {
  return (imgs.find((i) => i.principal) ?? imgs[0])?.url_imagem ?? null;
}

function getLocalidade(m: EmbarcacaoListItem['municipios']): string {
  if (!m) return '';
  return m.estados ? `${m.nome} / ${m.estados.uf}` : m.nome;
}

function getSortValue(item: EmbarcacaoListItem, key: SortKey): string | number {
  switch (key) {
    case 'nome':      return item.nome.toLowerCase();
    case 'tipo':      return (item.embarcacao_tipo?.nome ?? '').toLowerCase();
    case 'categoria': return (item.embarcacao_categoria?.nome ?? '').toLowerCase();
    case 'status':    return item.status;
    case 'localidade':return getLocalidade(item.municipios).toLowerCase();
    case 'capacidade':return item.capacidade ?? -1;
    case 'created_at':return item.created_at;
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

export default function EmbarcacoesGrid({ embarcacoes }: { embarcacoes: EmbarcacaoListItem[] }) {
  const router = useRouter();
  const [search, setSearch]     = useState('');
  const [sortKey, setSortKey]   = useState<SortKey>('created_at');
  const [sortDir, setSortDir]   = useState<SortDir>('desc');
  const [page, setPage]         = useState(1);

  // Toggle de status (ativo/inativo) com confirmação ao desativar.
  const [confirming, setConfirming] = useState<EmbarcacaoListItem | null>(null);
  const [pendingId, setPendingId]   = useState<string | null>(null);
  const [, startTransition]         = useTransition();

  function runToggle(id: string, novoStatus: 'ativo' | 'inativo') {
    setPendingId(id);
    startTransition(async () => {
      await alternarStatusEmbarcacao(id, novoStatus);
      setConfirming(null);
      setPendingId(null);
      router.refresh();
    });
  }

  function handleToggle(item: EmbarcacaoListItem) {
    if (pendingId) return;
    if (item.status === 'ativo') {
      // Desativar exige confirmação (mostra roteiros vinculados).
      setConfirming(item);
    } else {
      // Reativar é direto (reativa os roteiros vinculados em cascata).
      runToggle(item.id, 'ativo');
    }
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
    if (!q) return embarcacoes;
    return embarcacoes.filter(
      (e) =>
        e.nome.toLowerCase().includes(q) ||
        (e.embarcacao_tipo?.nome ?? '').toLowerCase().includes(q) ||
        (e.embarcacao_categoria?.nome ?? '').toLowerCase().includes(q) ||
        getLocalidade(e.municipios).toLowerCase().includes(q),
    );
  }, [embarcacoes, search]);

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
          placeholder="Buscar por nome, tipo, categoria ou localização..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Ship className="w-12 h-12 text-slate-200 mb-4" />
            <p className="text-sm font-medium text-slate-500">
              {search ? 'Nenhuma embarcação encontrada' : 'Nenhuma embarcação cadastrada'}
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
                  <ThSortable col="nome"       label="Embarcação"  className="pl-6" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="tipo"       label="Tipo"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="categoria"  label="Categoria"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="status"     label="Status"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="localidade" label="Localização" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="capacidade" label="Capacidade"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="pb-3 px-4 pr-6 text-[10px] font-bold text-slate-400 tracking-wider uppercase text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {paged.map((e) => {
                  const img       = getImage(e.embarcacao_imagens);
                  const localidade = getLocalidade(e.municipios) || '—';

                  return (
                    <tr
                      key={e.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors"
                    >
                      {/* Vessel details */}
                      <td className="py-4 pl-6 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100">
                            {img ? (
                              <Image
                                src={img}
                                alt={e.nome}
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
                            <p className="text-sm font-semibold text-[#0B2447] leading-tight">{e.nome}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5 tracking-wide">
                              ID: {e.id.slice(0, 8).toUpperCase()}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Tipo */}
                      <td className="py-4 px-4">
                        {e.embarcacao_tipo ? (
                          <span className="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 whitespace-nowrap">
                            {e.embarcacao_tipo.nome}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Categoria */}
                      <td className="py-4 px-4">
                        {e.embarcacao_categoria ? (
                          <span className="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 whitespace-nowrap">
                            {e.embarcacao_categoria.nome}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Status — toggle ativo/inativo */}
                      <td className="py-4 px-4">
                        {(() => {
                          const isAtivo  = e.status === 'ativo';
                          const isPending = pendingId === e.id;
                          return (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={isAtivo}
                                disabled={isPending}
                                onClick={() => handleToggle(e)}
                                title={isAtivo ? 'Desativar embarcação' : 'Ativar embarcação'}
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
                                  {isAtivo ? 'Ativo' : 'Inativo'}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Localização */}
                      <td className="py-4 px-4">
                        <span className="text-sm text-slate-600 whitespace-nowrap">{localidade}</span>
                      </td>

                      {/* Capacidade */}
                      <td className="py-4 px-4">
                        {e.capacidade != null ? (
                          <span className="text-sm font-medium text-slate-700">{e.capacidade} pax</span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-4 px-4 pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            title="Visualizar"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#0B2447] hover:bg-slate-100 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <Link
                            href={`/painel/embarcacoes/${e.id}/editar`}
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
              embarcações
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

      {/* Modal de confirmação de desativação */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => pendingId || setConfirming(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0B2447]">Desativar embarcação?</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  <strong>{confirming.nome}</strong> deixará de aparecer na busca do site.
                </p>
              </div>
            </div>

            {confirming.roteiro.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 mb-5">
                <p className="text-xs font-semibold text-amber-800 mb-2">
                  {confirming.roteiro.length} roteiro{confirming.roteiro.length !== 1 ? 's' : ''} vinculado{confirming.roteiro.length !== 1 ? 's' : ''} também {confirming.roteiro.length !== 1 ? 'ficarão inativos' : 'ficará inativo'} e {confirming.roteiro.length !== 1 ? 'sairão' : 'sairá'} da busca:
                </p>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {confirming.roteiro.map((r) => (
                    <li key={r.id} className="text-sm text-amber-900 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                      {r.nome}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-500 mb-5">
                Nenhum roteiro está vinculado a esta embarcação.
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={!!pendingId}
                onClick={() => setConfirming(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!!pendingId}
                onClick={() => runToggle(confirming.id, 'inativo')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {pendingId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Desativar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
