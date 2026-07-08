'use client';

import { useMemo, useState } from 'react';
import {
  ChevronUp, ChevronDown, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight,
  FileSpreadsheet, FileText, Receipt,
} from 'lucide-react';
import { formatCurrencyPrecise } from '@/lib/utils';
import { STATUS_BADGE, STATUS_LABEL, TIPO_LABEL } from '../_lib/constants';
import { exportReceitasExcel, exportReceitasPdf } from '../_lib/export';
import type { ReservaReceita } from '../_lib/types';

const PAGE_SIZE = 10;

type SortKey = 'data' | 'cliente' | 'item' | 'pessoas' | 'status' | 'valor';
type SortDir = 'asc' | 'desc';

function getSortValue(r: ReservaReceita, key: SortKey): string | number {
  switch (key) {
    case 'data': return r.data_reserva;
    case 'cliente': return (r.cliente?.name ?? '').toLowerCase();
    case 'item': return (r.roteiro?.nome ?? r.embarcacao?.nome ?? r.item_nome).toLowerCase();
    case 'pessoas': return r.quantidade_pessoas;
    case 'status': return r.status;
    case 'valor': return r.total_estimado ?? 0;
  }
}

function formatDataCurta(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
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

export default function ReceitasGrid({
  reservas,
  periodoLabel,
  totalReceita,
}: {
  reservas: ReservaReceita[];
  periodoLabel: string;
  totalReceita: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('data');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'data' || key === 'valor' ? 'desc' : 'asc');
    }
    setPage(1);
  }

  const sorted = useMemo(() => {
    return [...reservas].sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [reservas, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleExportExcel() {
    exportReceitasExcel(sorted, `receitas_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function handleExportPdf() {
    exportReceitasPdf(sorted, `receitas_${new Date().toISOString().slice(0, 10)}.pdf`, {
      periodo: periodoLabel,
      total: totalReceita,
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-bold text-[#0B2447]">Reservas no período</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={sorted.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={sorted.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            PDF
          </button>
        </div>
      </div>

      {paged.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Receipt className="w-12 h-12 text-slate-200 mb-4" />
          <p className="text-sm font-medium text-slate-500">Nenhuma reserva encontrada</p>
          <p className="text-xs text-slate-400 mt-1">Ajuste os filtros para ver outros resultados.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <ThSortable col="data" label="Data" className="pl-6" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <ThSortable col="cliente" label="Cliente" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <ThSortable col="item" label="Item" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <th className="pb-3 px-4 text-[10px] font-bold text-slate-400 tracking-wider uppercase">Tipo</th>
                <ThSortable col="pessoas" label="Pessoas" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <ThSortable col="status" label="Status" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <ThSortable col="valor" label="Valor" className="pr-6 text-right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 pl-6 pr-4 text-sm text-slate-600 whitespace-nowrap">
                    {formatDataCurta(r.data_reserva)}
                  </td>
                  <td className="py-3.5 px-4 text-sm text-slate-700">{r.cliente?.name ?? '—'}</td>
                  <td className="py-3.5 px-4 text-sm text-slate-700">
                    {r.roteiro?.nome ?? r.embarcacao?.nome ?? r.item_nome}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-500">{TIPO_LABEL[r.tipo]}</td>
                  <td className="py-3.5 px-4 text-sm text-slate-600">{r.quantidade_pessoas}</td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 pr-6 text-sm font-semibold text-[#0B2447] text-right whitespace-nowrap">
                    {formatCurrencyPrecise(r.total_estimado ?? 0)}
                  </td>
                </tr>
              ))}
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
            de <span className="font-semibold text-slate-600">{sorted.length}</span> reserva{sorted.length !== 1 ? 's' : ''}
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
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
                      n === page ? 'bg-[#0B2447] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
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
  );
}
