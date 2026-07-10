'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Search,
  ChevronUp,
  ChevronDown,
  Star,
  MapPin,
  Ship,
  Check,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { aprovarAvaliacao, editarAvaliacao, excluirAvaliacao } from '../actions';

const PAGE_SIZES = [10, 25, 50] as const;

export type AvaliacaoListItem = {
  id: string;
  nota: number;
  comentario: string | null;
  status: 'pendente' | 'aprovada';
  created_at: string;
  cliente: { name: string; email: string } | null;
  roteiro: { id: string; nome: string } | null;
  embarcacao: { id: string; nome: string } | null;
};

// Colunas ordenáveis no servidor (colunas diretas da tabela avaliacao).
type SortKey = 'data' | 'nota' | 'status';
type SortDir = 'asc' | 'desc';

type Props = {
  avaliacoes: AvaliacaoListItem[];
  total: number;
  page: number;
  perPage: number;
};

function vinculoNome(a: AvaliacaoListItem): string {
  return a.roteiro?.nome ?? a.embarcacao?.nome ?? '';
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

function Estrelas({ nota }: { nota: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-3.5 h-3.5 ${n <= nota ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
        />
      ))}
    </span>
  );
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

export default function AvaliacoesGrid({ avaliacoes, total, page, perPage }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sortKey = (searchParams.get('sort') ?? 'data') as SortKey;
  const sortDir: SortDir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';

  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [isNavigating, startNavigation] = useTransition();

  const [pendingId, setPendingId]   = useState<string | null>(null);
  const [editing, setEditing]       = useState<AvaliacaoListItem | null>(null);
  const [deleting, setDeleting]     = useState<AvaliacaoListItem | null>(null);
  const [, startTransition]         = useTransition();

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

  function handleAprovar(id: string) {
    if (pendingId) return;
    setPendingId(id);
    startTransition(async () => {
      await aprovarAvaliacao(id);
      setPendingId(null);
      router.refresh();
    });
  }

  function handleExcluir() {
    if (!deleting || pendingId) return;
    const id = deleting.id;
    setPendingId(id);
    startTransition(async () => {
      await excluirAvaliacao(id);
      setPendingId(null);
      setDeleting(null);
      router.refresh();
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div>
      {/* Search bar + tamanho da página */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          {isNavigating ? (
            <Loader2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin pointer-events-none" />
          ) : (
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          )}
          <input
            type="text"
            placeholder="Buscar por cliente, e-mail, roteiro, embarcação ou comentário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition"
          />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <label htmlFor="page-size" className="text-xs font-semibold text-slate-400 whitespace-nowrap">
            Exibir
          </label>
          <select
            id="page-size"
            value={perPage}
            onChange={(e) => setParams({ per: e.target.value === '10' ? null : e.target.value, page: null })}
            className="pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {avaliacoes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Star className="w-12 h-12 text-slate-200 mb-4" />
            <p className="text-sm font-medium text-slate-500">
              {search ? 'Nenhuma avaliação encontrada' : 'Nenhuma avaliação ainda'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {search
                ? 'Tente outros termos de busca.'
                : 'As avaliações aparecem aqui assim que os clientes as enviam.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <ThSortable col="data"    label="Data"     className="pl-6" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="pb-3 px-4 text-[10px] font-bold text-slate-400 tracking-wider uppercase whitespace-nowrap">
                    Cliente
                  </th>
                  <th className="pb-3 px-4 text-[10px] font-bold text-slate-400 tracking-wider uppercase whitespace-nowrap">
                    Vínculo
                  </th>
                  <ThSortable col="nota"   label="Nota"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="pb-3 px-4 text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                    Comentário
                  </th>
                  <ThSortable col="status" label="Status"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="pb-3 px-4 pr-6 text-[10px] font-bold text-slate-400 tracking-wider uppercase text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {avaliacoes.map((a) => {
                  const isAprovada = a.status === 'aprovada';
                  const isPending  = pendingId === a.id;
                  const vinculo    = vinculoNome(a);

                  return (
                    <tr
                      key={a.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors align-top"
                    >
                      {/* Data */}
                      <td className="py-4 pl-6 pr-4">
                        <span className="text-sm text-slate-600 whitespace-nowrap">{formatDate(a.created_at)}</span>
                      </td>

                      {/* Cliente */}
                      <td className="py-4 px-4">
                        <p className="text-sm font-semibold text-[#0B2447] leading-tight">
                          {a.cliente?.name ?? '—'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{a.cliente?.email ?? '—'}</p>
                      </td>

                      {/* Vínculo */}
                      <td className="py-4 px-4">
                        {vinculo ? (
                          <span
                            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                              a.roteiro ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {a.roteiro ? <MapPin className="w-3 h-3" /> : <Ship className="w-3 h-3" />}
                            {a.roteiro ? 'Roteiro' : 'Embarcação'}: {vinculo}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Nota */}
                      <td className="py-4 px-4">
                        <Estrelas nota={a.nota} />
                      </td>

                      {/* Comentário */}
                      <td className="py-4 px-4 max-w-xs">
                        {a.comentario ? (
                          <p className="text-sm text-slate-600 line-clamp-2" title={a.comentario}>
                            {a.comentario}
                          </p>
                        ) : (
                          <span className="text-slate-300 text-xs">Sem comentário</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                            isAprovada ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {isAprovada ? 'Aprovada' : 'Pendente'}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-4 px-4 pr-6">
                        <div className="flex items-center justify-end gap-1">
                          {isPending ? (
                            <span className="w-8 h-8 flex items-center justify-center">
                              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                            </span>
                          ) : (
                            <>
                              {!isAprovada && (
                                <button
                                  title="Aprovar"
                                  onClick={() => handleAprovar(a.id)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                title="Editar"
                                onClick={() => setEditing(a)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#0B2447] hover:bg-slate-100 transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                title="Excluir"
                                onClick={() => setDeleting(a)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
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

        {/* Footer: count + pagination */}
        {total > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              Mostrando{' '}
              <span className="font-semibold text-slate-600">
                {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)}
              </span>{' '}
              de{' '}
              <span className="font-semibold text-slate-600">{total}</span>{' '}
              avaliaç{total !== 1 ? 'ões' : 'ão'}
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  title="Página anterior"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronDown className="w-3.5 h-3.5 rotate-90" />
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
                  <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de edição */}
      {editing && (
        <EditarAvaliacaoModal
          avaliacao={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
        />
      )}

      {/* Modal de confirmação de exclusão */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => pendingId || setDeleting(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0B2447]">Excluir avaliação?</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  A avaliação de <strong>{deleting.cliente?.name ?? 'cliente'}</strong> será removida
                  permanentemente e deixará de aparecer no site.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={!!pendingId}
                onClick={() => setDeleting(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!!pendingId}
                onClick={handleExcluir}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {pendingId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditarAvaliacaoModal({ avaliacao, onClose, onSaved }: {
  avaliacao: AvaliacaoListItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nota, setNota]           = useState(avaliacao.nota);
  const [hover, setHover]         = useState(0);
  const [comentario, setComentario] = useState(avaliacao.comentario ?? '');
  const [erro, setErro]           = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const res = await editarAvaliacao(avaliacao.id, { nota, comentario });
      if (!res.ok) {
        setErro(res.error ?? 'Não foi possível salvar as alterações.');
        return;
      }
      onSaved();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => pending || onClose()} />
      <div className="relative bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-[#0B2447]">Editar avaliação</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {avaliacao.cliente?.name ?? 'Cliente'} — {avaliacao.roteiro?.nome ?? avaliacao.embarcacao?.nome ?? ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => pending || onClose()}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Nota
        </label>
        <div className="flex items-center gap-1 mb-4" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNota(n)}
              onMouseEnter={() => setHover(n)}
              aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
              className="p-0.5 transition-transform hover:scale-110"
            >
              <Star
                className={`h-7 w-7 transition-colors ${
                  n <= (hover || nota) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                }`}
              />
            </button>
          ))}
        </div>

        <label htmlFor="comentario" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Comentário
        </label>
        <textarea
          id="comentario"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Comentário do cliente (opcional)"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 resize-none"
        />

        {erro && <p className="mt-2 text-xs font-medium text-red-600">{erro}</p>}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={salvar}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B3D91] hover:bg-[#092E6E] text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
