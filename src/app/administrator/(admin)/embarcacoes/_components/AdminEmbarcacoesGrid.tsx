'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Search,
  ChevronUp,
  ChevronDown,
  Pencil,
  Ship,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ClipboardCheck,
  UserRound,
} from 'lucide-react';
import type { PublicacaoStatus } from '@/types/supabase';
import { formatarData } from '@/lib/datas';
import StatusPublicacaoBadge from '@/components/publicacao/StatusPublicacaoBadge';
import { SeloValidade } from '@/components/painel/documentos/SeloValidade';
import type { DocumentacaoEmbarcacao } from '@/lib/documentos/admin';
import { nomeCurtoDocumento } from '@/lib/documentos/tipos';
import { textoPrazo } from '@/lib/documentos/validade';

const PAGE_SIZES = [10, 25, 50];

export type EmbarcacaoStatus = PublicacaoStatus;

export type AdminEmbarcacaoListItem = {
  id: string;
  nome: string;
  status: EmbarcacaoStatus;
  enviado_analise_em: string | null;
  revisao: number;
  capacidade: number | null;
  created_at: string;
  gestor: { name: string; email: string } | null;
  embarcacao_tipo: { nome: string } | null;
  municipios: { nome: string; estados: { uf: string } | null } | null;
  embarcacao_imagens: { url_imagem: string; principal: boolean }[];
  roteiro: { id: string; nome: string }[];
  documentacao: DocumentacaoEmbarcacao;
};

// Colunas ordenáveis no servidor (colunas diretas da tabela embarcacao).
type SortKey = 'nome' | 'status' | 'capacidade' | 'created_at';

type Props = {
  embarcacoes: AdminEmbarcacaoListItem[];
  total: number;
  page: number;
  perPage: number;
};

function getImage(imgs: { url_imagem: string; principal: boolean }[]): string | null {
  return (imgs.find((i) => i.principal) ?? imgs[0])?.url_imagem ?? null;
}

function getLocalidade(m: AdminEmbarcacaoListItem['municipios']): string {
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

const siglas = (docs: { tipo: Parameters<typeof nomeCurtoDocumento>[0]; titulo: string | null }[]) =>
  [...new Set(docs.map((d) => nomeCurtoDocumento(d.tipo, d.titulo)))].join(', ');

/**
 * Documentação da embarcação na lista (SPEC §95.9): Vencida / Não enviada / Em dia.
 * "Vence em breve" só com o filtro `doc=vencendo`. A equipe aparece numa linha
 * discreta abaixo — é informação secundária.
 */
function CelulaDocumentacao({ id, d, mostrarVencendo }: { id: string; d: DocumentacaoEmbarcacao; mostrarVencendo: boolean }) {
  let detalhe: string;
  let selo: React.ReactNode;
  if (mostrarVencendo && d.vencendo.length > 0 && d.situacao !== 'vencida') {
    selo = <SeloValidade situacao="vence_em_breve" />;
    detalhe = `${siglas(d.vencendo)} · ${textoPrazo(d.vencendo[0].data_validade)}`;
  } else if (d.situacao === 'vencida') {
    selo = <SeloValidade situacao="vencido" />;
    detalhe = `${siglas(d.vencidos)} · ${textoPrazo(d.vencidos[0].data_validade)}`;
  } else if (d.situacao === 'nao_enviada') {
    selo = (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 whitespace-nowrap">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" /> Não enviada
      </span>
    );
    detalhe = d.total > 0 ? 'falta TIE/TIEM' : 'nenhum documento';
  } else {
    selo = <SeloValidade situacao="em_dia" />;
    detalhe = `${d.total} ${d.total === 1 ? 'documento' : 'documentos'}`;
  }
  return (
    <Link href={`/administrator/embarcacoes/${id}#documentacao`} title="Ver documentos e equipe" className="group block">
      {selo}
      <p className="mt-1 text-[10px] text-slate-400 whitespace-nowrap group-hover:text-slate-600">{detalhe}</p>
      {d.habilitacoesVencidas > 0 && (
        <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-slate-500 whitespace-nowrap">
          <UserRound className="h-3 w-3 text-red-400" />
          Equipe: {d.habilitacoesVencidas} {d.habilitacoesVencidas === 1 ? 'habilitação vencida' : 'habilitações vencidas'}
        </p>
      )}
    </Link>
  );
}

function ThPlain({ label, className = '' }: { label: string; className?: string }) {
  return (
    <th className={`pb-3 px-4 text-[10px] font-bold text-slate-400 tracking-wider uppercase whitespace-nowrap ${className}`}>
      {label}
    </th>
  );
}

export default function AdminEmbarcacoesGrid({ embarcacoes, total, page, perPage }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sortKey = (searchParams.get('sort') ?? 'created_at') as SortKey;
  const sortDir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
  const mostrarVencendo = searchParams.get('doc') === 'vencendo';
  const mostrarFiltroDoc = !!searchParams.get('doc');

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
      {/* Search bar */}
      <div className="relative mb-5">
        {isNavigating ? (
          <Loader2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin pointer-events-none" />
        ) : (
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        )}
        <input
          type="text"
          placeholder="Buscar por nome da embarcação ou gestor (nome/e-mail)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {embarcacoes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Ship className="w-12 h-12 text-slate-200 mb-4" />
            <p className="text-sm font-medium text-slate-500">
              {mostrarFiltroDoc
                ? 'Nenhuma embarcação nesta situação de documentação'
                : search ? 'Nenhuma embarcação encontrada' : 'Nenhuma embarcação cadastrada'}
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
                  <ThSortable col="nome"       label="Embarcação" className="pl-6" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThPlain    label="Gestor" />
                  <ThPlain    label="Tipo" />
                  <ThSortable col="status"     label="Status"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThPlain    label="Documentação" />
                  <ThPlain    label="Localização" />
                  <ThSortable col="capacidade" label="Capacidade" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThPlain    label="Roteiros" />
                  <th className="pb-3 px-4 pr-6 text-[10px] font-bold text-slate-400 tracking-wider uppercase text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {embarcacoes.map((e) => {
                  const img        = getImage(e.embarcacao_imagens);
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

                      {/* Gestor */}
                      <td className="py-4 px-4">
                        {e.gestor ? (
                          <div>
                            <p className="text-sm font-medium text-slate-700 whitespace-nowrap">{e.gestor.name}</p>
                            <p className="text-[11px] text-slate-400">{e.gestor.email}</p>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
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


                      {/* Status da publicação */}
                      <td className="py-4 px-4">
                        <StatusPublicacaoBadge status={e.status} />
                        {e.status === 'em_analise' && e.enviado_analise_em && (
                          <p className="mt-1 text-[10px] text-slate-400 whitespace-nowrap">
                            desde {formatarData(e.enviado_analise_em)}{e.revisao > 1 ? ` · ${e.revisao}ª análise` : ''}
                          </p>
                        )}
                      </td>

                      {/* Documentação */}
                      <td className="py-4 px-4">
                        <CelulaDocumentacao id={e.id} d={e.documentacao} mostrarVencendo={mostrarVencendo} />
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

                      {/* Roteiros vinculados */}
                      <td className="py-4 px-4">
                        {e.roteiro.length > 0 ? (
                          <span
                            title={e.roteiro.map((r) => r.nome).join('\n')}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-700 whitespace-nowrap"
                          >
                            {e.roteiro.length} {e.roteiro.length === 1 ? 'roteiro' : 'roteiros'}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 whitespace-nowrap">Nenhum</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-4 px-4 pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/administrator/embarcacoes/${e.id}`}
                            title={e.status === 'em_analise' ? 'Analisar' : 'Análise e histórico'}
                            className={`h-8 flex items-center justify-center gap-1 rounded-lg transition-colors ${
                              e.status === 'em_analise'
                                ? 'px-2.5 bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-semibold'
                                : 'w-8 text-slate-400 hover:text-[#0B2447] hover:bg-slate-100'}`}
                          >
                            <ClipboardCheck className="w-4 h-4" />
                            {e.status === 'em_analise' && 'Analisar'}
                          </Link>
                          <Link
                            href={`/administrator/embarcacoes/${e.id}/editar`}
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
                embarcações
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

    </div>
  );
}
