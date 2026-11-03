'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import * as XLSX from 'xlsx';
import { Download, Loader2 } from 'lucide-react';
import { hojeISO } from '@/lib/datas';

type Linhas = Record<string, string | number>[];

/**
 * Exporta a lista atual para XLSX ou CSV: a server action recebe a querystring da tela (mesmos
 * filtros) e devolve as linhas; o arquivo é montado no navegador (padrão de Pedidos).
 */
export default function ExportarPlanilha({
  acao, arquivo, aba,
}: {
  acao: (querystring: string) => Promise<{ ok: true; linhas: Linhas } | { ok: false; error: string }>;
  /** Prefixo do nome do arquivo (a data é acrescentada). */
  arquivo: string;
  aba: string;
}) {
  const searchParams = useSearchParams();
  const [exportando, setExportando] = useState<'xlsx' | 'csv' | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function exportar(formato: 'xlsx' | 'csv') {
    setExportando(formato);
    setErro(null);
    const r = await acao(searchParams.toString());
    setExportando(null);
    if (!r.ok) { setErro(r.error); return; }
    const sheet = XLSX.utils.json_to_sheet(r.linhas);
    const nome = `${arquivo}-${hojeISO()}`;
    if (formato === 'csv') {
      // BOM para o Excel abrir os acentos corretamente.
      const csv = `﻿${XLSX.utils.sheet_to_csv(sheet, { FS: ';' })}`;
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${nome}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, aba);
    XLSX.writeFile(wb, `${nome}.xlsx`);
  }

  const btn = 'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => exportar('xlsx')} disabled={!!exportando} className={btn}>
        {exportando === 'xlsx' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Excel
      </button>
      <button type="button" onClick={() => exportar('csv')} disabled={!!exportando} className={btn}>
        {exportando === 'csv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} CSV
      </button>
      {erro && <span role="alert" className="text-xs font-medium text-red-600">{erro}</span>}
    </div>
  );
}
