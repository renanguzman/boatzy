'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Search, ChevronUp, ChevronDown, Eye, ShieldCheck, MapPin, Monitor, Smartphone, Tablet,
  ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import type { DispositivoTipo, GeoGpsStatus } from '@/lib/termos/tipos';
import { TERMOS_IDENTIFICADORES, type TermoIdentificador, termoIdentificadorLabel } from '@/lib/termos/identificadores';
import { formatarDataHoraBR, protocoloAceite } from '@/lib/termos/formato';

const PAGE_SIZES = [10, 25, 50];

export type AdminAceiteListItem = {
  id: string;
  sequencia: number;
  aceito_em: string;
  evidencia_hash: string;
  termo_identificador: string;
  termo_versao: number;
  usuario_nome: string | null;
  usuario_email: string | null;
  contexto_tipo: string;
  contexto_id: string | null;
  dispositivo_tipo: DispositivoTipo | null;
  navegador: string | null;
  geo_gps_status: GeoGpsStatus;
  geo_ip_cidade: string | null;
  geo_ip_regiao: string | null;
};

type SortKey = 'aceito_em' | 'usuario_nome';

type Props = {
  aceites: AdminAceiteListItem[];
  total: number;
  page: number;
  perPage: number;
};

const CONTEXTO_LABEL: Record<string, string> = { reserva: 'Reserva', embarcacao: 'Embarcação' };

const DISPOSITIVO_ICON: Record<DispositivoTipo, React.ElementType> = {
  desktop: Monitor, smartphone: Smartphone, tablet: Tablet, desconhecido: Monitor,
};

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
          <ChevronUp className={`w-2.5 h-2.5 -mb-0.5 ${active && sortDir === 'asc' ? 'text-[#0B2447]' : 'text-slate-300'}`} />
          <ChevronDown className={`w-2.5 h-2.5 ${active && sortDir === 'desc' ? 'text-[#0B2447]' : 'text-slate-300'}`} />
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

export default function AdminAceitesGrid({ aceites, total, page, perPage }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sortKey = (searchParams.get('sort') ?? 'aceito_em') as SortKey;
  const sortDir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
  const termoFiltro = searchParams.get('termo') ?? '';

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
  const filtrando = !!search || !!termoFiltro;

  return (
    <div>
      {/* Busca + filtro de termo */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          {isNavigating ? (
            <Loader2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin pointer-events-none" />
          ) : (
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          )}
          <input
            type="text"
            placeholder="Buscar por nome, e-mail, CPF/CNPJ, protocolo ou id da reserva..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition"
          />
        </div>
        <select
          value={termoFiltro}
          onChange={(e) => setParams({ termo: e.target.value, page: null })}
          className="sm:w-64 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 cursor-pointer"
        >
          <option value="">Todos os termos</option>
          {(Object.keys(TERMOS_IDENTIFICADORES) as TermoIdentificador[]).map((id) => (
            <option key={id} value={id}>{TERMOS_IDENTIFICADORES[id].label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {aceites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ShieldCheck className="w-12 h-12 text-slate-200 mb-4" />
            <p className="text-sm font-medium text-slate-500">
              {filtrando ? 'Nenhum aceite encontrado' : 'Nenhum aceite registrado ainda'}
            </p>
            {filtrando && <p className="text-xs text-slate-400 mt-1">Tente outros termos de busca ou outro filtro.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <ThPlain label="Protocolo" className="pl-6" />
                  <ThSortable col="aceito_em"    label="Data / hora" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="usuario_nome" label="Pessoa"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThPlain label="Termo" />
                  <ThPlain label="Ação" />
                  <ThPlain label="Dispositivo" />
                  <ThPlain label="Localização" />
                  <th className="pb-3 px-4 pr-6 text-[10px] font-bold text-slate-400 tracking-wider uppercase text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {aceites.map((a) => {
                  const DispIcon = DISPOSITIVO_ICON[a.dispositivo_tipo ?? 'desconhecido'];
                  const local = [a.geo_ip_cidade, a.geo_ip_regiao].filter(Boolean).join(' / ');
                  return (
                    <tr key={a.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 pl-6 pr-4">
                        <Link href={`/administrator/termos/aceites/${a.id}`} className="font-mono text-xs font-semibold text-[#0B2447] hover:underline">
                          {protocoloAceite(a.evidencia_hash)}
                        </Link>
                        <p className="text-[10px] text-slate-400 mt-0.5">#{a.sequencia}</p>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-slate-600 whitespace-nowrap">{formatarDataHoraBR(a.aceito_em)}</span>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-sm font-medium text-slate-700 whitespace-nowrap">{a.usuario_nome ?? '—'}</p>
                        <p className="text-[11px] text-slate-400">{a.usuario_email}</p>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-sm text-slate-700 whitespace-nowrap">{termoIdentificadorLabel(a.termo_identificador)}</p>
                        <p className="text-[11px] text-slate-400">Versão {a.termo_versao}</p>
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 whitespace-nowrap">
                          {CONTEXTO_LABEL[a.contexto_tipo] ?? a.contexto_tipo}
                        </span>
                        {a.contexto_id && (
                          <p className="text-[10px] text-slate-400 font-mono mt-1">{a.contexto_id.slice(0, 8).toUpperCase()}</p>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 text-sm text-slate-600 whitespace-nowrap">
                          <DispIcon className="w-3.5 h-3.5 text-slate-400" />
                          {a.navegador ?? '—'}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 text-sm text-slate-600 whitespace-nowrap">
                          <MapPin className={`w-3.5 h-3.5 ${a.geo_gps_status === 'concedida' ? 'text-emerald-500' : 'text-slate-300'}`} />
                          {local || (a.geo_gps_status === 'concedida' ? 'GPS' : '—')}
                        </div>
                      </td>
                      <td className="py-4 px-4 pr-6">
                        <div className="flex items-center justify-end">
                          <Link
                            href={`/administrator/termos/aceites/${a.id}`}
                            title="Ver evidências"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#0B2447] hover:bg-slate-100 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
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

        {total > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <p className="text-xs text-slate-400">
                Mostrando{' '}
                <span className="font-semibold text-slate-600">
                  {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)}
                </span>{' '}
                de <span className="font-semibold text-slate-600">{total}</span> aceites
              </p>
              <label className="flex items-center gap-1.5 text-xs text-slate-400">
                Por página:
                <select
                  value={perPage}
                  onChange={(ev) => setParams({ per: ev.target.value === '10' ? null : ev.target.value, page: null })}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 cursor-pointer"
                >
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
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
