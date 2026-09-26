import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatarDataHoraBR } from '@/lib/termos/formato';
import type { ComprovanteAceite } from './ficha';

const NAVY: [number, number, number] = [11, 36, 71]; // #0B2447
const MARGEM = 14;

// As fontes padrão do jsPDF usam WinAnsi: caracteres fora dele (emoji, setas…)
// sairiam corrompidos — setas viram "->", o resto é descartado.
const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
function paraWinAnsi(s: string): string {
  return Array.from(s.replace(/[→⟶➔]/g, '->'))
    .filter((c) => c.charCodeAt(0) <= 0xff || WIN_ANSI_EXTRA.includes(c))
    .join('');
}

type LinhaTexto = { texto: string; titulo: boolean; recuo: number };

/** Markdown → linhas de texto simples (títulos em negrito, citações recuadas). */
function markdownParaLinhas(md: string): LinhaTexto[] {
  return md.split('\n').map((bruta) => {
    const titulo = /^#{1,6}\s/.test(bruta);
    const citacao = /^>\s?/.test(bruta);
    const texto = bruta
      .replace(/^#{1,6}\s*/, '')
      .replace(/^>\s?/, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1$2')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
      .replace(/^(\s*)[-*]\s+/, '$1• ');
    return { texto: paraWinAnsi(texto), titulo, recuo: citacao ? 6 : 0 };
  });
}

/**
 * Gera o comprovante de aceite eletrônico em PDF (A4): ficha completa de
 * evidências + íntegra do termo aceito, com protocolo e hashes em todas as páginas.
 */
export function gerarComprovantePdf(c: ComprovanteAceite): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const geradoEm = formatarDataHoraBR(new Date().toISOString(), { segundos: true });

  // ── Cabeçalho ──────────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, largura, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('COMPROVANTE DE ACEITE ELETRÔNICO', MARGEM, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Boatzy — registro de manifestação de vontade em meio eletrônico', MARGEM, 20);
  doc.setFont('helvetica', 'bold');
  doc.text(`Protocolo ${c.protocolo}`, MARGEM, 27);

  // ── Seções de evidências ──────────────────────────────────────
  let y = 40;
  for (const secao of c.secoes) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGEM, right: MARGEM },
      head: [[{ content: paraWinAnsi(secao.titulo.toUpperCase()), colSpan: 2 }]],
      body: secao.linhas.map((l) => [paraWinAnsi(l.rotulo), paraWinAnsi(l.valor)]),
      theme: 'grid',
      headStyles: { fillColor: NAVY, fontSize: 8.5, cellPadding: 2 },
      styles: { fontSize: 8, cellPadding: 1.8, overflow: 'linebreak', lineColor: [226, 232, 240] },
      columnStyles: { 0: { cellWidth: 48, fontStyle: 'bold', textColor: [71, 85, 105] } },
      didParseCell: (data) => {
        if (data.section !== 'body' || data.column.index !== 1) return;
        const linha = secao.linhas[data.row.index];
        if (linha?.mono) {
          data.cell.styles.font = 'courier';
          data.cell.styles.fontSize = 7.5;
        }
        if (linha?.destaque === 'ok') data.cell.styles.textColor = [4, 120, 87];
        if (linha?.destaque === 'alerta') data.cell.styles.textColor = [185, 28, 28];
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  // ── Declaração ────────────────────────────────────────────────
  const declaracao = paraWinAnsi(
    'Este comprovante reproduz um registro de aceite armazenado de forma imutável (sem possibilidade de ' +
    'alteração ou exclusão) e encadeado criptograficamente aos demais aceites por hash SHA-256. A ' +
    'integridade do registro pode ser verificada recalculando o hash a partir dos dados armazenados. ' +
    'O texto integral do termo aceito, na versão exata indicada, segue anexo.',
  );
  const linhasDecl = doc.splitTextToSize(declaracao, largura - MARGEM * 2);
  if (y + linhasDecl.length * 4 > altura - 20) {
    doc.addPage();
    y = 20;
  }
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(linhasDecl, MARGEM, y + 2);

  // ── Íntegra do termo ─────────────────────────────────────────
  if (c.termo) {
    doc.addPage();
    y = 20;
    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('ANEXO — ÍNTEGRA DO TERMO ACEITO', MARGEM, y);
    y += 6;
    doc.setFontSize(10);
    doc.text(paraWinAnsi(`${c.termo.titulo} (versão ${c.termo.versao})`), MARGEM, y);
    y += 3;
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.4);
    doc.line(MARGEM, y, largura - MARGEM, y);
    y += 6;

    doc.setTextColor(30, 41, 59);
    for (const linha of markdownParaLinhas(c.termo.conteudo)) {
      if (!linha.texto.trim()) {
        y += 2.5;
        continue;
      }
      doc.setFont('helvetica', linha.titulo ? 'bold' : 'normal');
      doc.setFontSize(linha.titulo ? 10 : 9);
      const quebradas: string[] = doc.splitTextToSize(linha.texto, largura - MARGEM * 2 - linha.recuo);
      const alturaLinha = linha.titulo ? 5 : 4.2;
      if (linha.titulo) y += 2;
      for (const q of quebradas) {
        if (y > altura - 20) {
          doc.addPage();
          y = 20;
        }
        doc.text(q, MARGEM + linha.recuo, y);
        y += alturaLinha;
      }
    }
  }

  // ── Rodapé em todas as páginas ────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      paraWinAnsi(`Protocolo ${c.protocolo} · Hash do registro ${c.evidenciaHash}`),
      MARGEM,
      altura - 10,
    );
    doc.text(paraWinAnsi(`Gerado em ${geradoEm} por ${c.geradoPor}`), MARGEM, altura - 6);
    doc.text(`Página ${i} de ${total}`, largura - MARGEM, altura - 6, { align: 'right' });
  }

  doc.save(`comprovante-aceite-${c.protocolo}.pdf`);
}
