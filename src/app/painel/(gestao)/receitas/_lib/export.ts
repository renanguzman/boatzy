import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrencyPrecise } from '@/lib/utils';
import { STATUS_LABEL, TIPO_LABEL } from './constants';
import type { ReservaReceita } from './types';

function formatDataCurta(iso: string): string {
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function linhas(rows: ReservaReceita[]) {
  return rows.map((r) => ({
    Data: formatDataCurta(r.data_reserva),
    Cliente: r.cliente?.name ?? '—',
    Item: r.roteiro?.nome ?? r.embarcacao?.nome ?? r.item_nome,
    Tipo: TIPO_LABEL[r.tipo],
    Pessoas: r.quantidade_pessoas,
    Status: STATUS_LABEL[r.status],
    Valor: r.total_estimado ?? 0,
  }));
}

export function exportReceitasExcel(rows: ReservaReceita[], filename: string): void {
  const dados = linhas(rows);
  const sheet = XLSX.utils.json_to_sheet(dados);
  sheet['!cols'] = [
    { wch: 12 }, // Data
    { wch: 28 }, // Cliente
    { wch: 28 }, // Item
    { wch: 12 }, // Tipo
    { wch: 9 },  // Pessoas
    { wch: 14 }, // Status
    { wch: 14 }, // Valor
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Receitas');
  XLSX.writeFile(workbook, filename);
}

export function exportReceitasPdf(
  rows: ReservaReceita[],
  filename: string,
  meta: { periodo: string; total: number },
): void {
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.setTextColor(11, 36, 71); // #0B2447
  doc.text('Boatzy — Relatório de Receitas', 14, 16);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Período: ${meta.periodo}`, 14, 23);
  doc.text(`Total: ${formatCurrencyPrecise(meta.total)}`, 14, 29);

  autoTable(doc, {
    startY: 35,
    head: [['Data', 'Cliente', 'Item', 'Tipo', 'Pessoas', 'Status', 'Valor']],
    body: linhas(rows).map((l) => [
      l.Data,
      l.Cliente,
      l.Item,
      l.Tipo,
      String(l.Pessoas),
      l.Status,
      formatCurrencyPrecise(l.Valor),
    ]),
    headStyles: { fillColor: [11, 36, 71] },
    styles: { fontSize: 8 },
    columnStyles: { 6: { halign: 'right' } },
  });

  doc.save(filename);
}
