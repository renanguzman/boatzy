import 'server-only';

import { formatarData } from '@/lib/datas';
import { baseUrl, esc, montarEmailHtml } from './layout';

/**
 * E-mail ao gestor com os documentos que chegaram a um marco de vencimento
 * hoje (60, 30, 7 dias ou no dia/vencido) — um e-mail por gestor, enviado pelo
 * cron /api/cron/documentos-validade (SPEC §95.7).
 */

export type ItemVencimento = {
  sigla: string;
  alvo: string; // embarcação ou condutor
  validade: string; // AAAA-MM-DD
  dias: number; // negativo = vencido
  renovacao: string | null;
};

function prazo(dias: number): string {
  if (dias < 0) return `venceu há ${-dias} dia${dias === -1 ? '' : 's'}`;
  if (dias === 0) return 'vence hoje';
  return `vence em ${dias} dia${dias === 1 ? '' : 's'}`;
}

export function montarEmailVencimentos(nome: string, itens: ItemVencimento[]): { assunto: string; html: string } {
  const vencidos = itens.filter((i) => i.dias <= 0).length;
  const assunto =
    itens.length === 1
      ? `${itens[0].sigla} de ${itens[0].alvo}: ${prazo(itens[0].dias)}`
      : vencidos > 0
        ? `${itens.length} documentos pedem atenção (${vencidos} vencido${vencidos === 1 ? '' : 's'})`
        : `${itens.length} documentos vencem em breve`;

  const orientacoes = [...new Set(itens.map((i) => i.renovacao).filter((r): r is string => !!r))];

  const html = montarEmailHtml({
    nome,
    paragrafos: [
      itens.length === 1
        ? 'Um documento cadastrado no Boatzy está perto de vencer — ou já venceu. Navegar com a documentação em dia evita multa e apreensão da embarcação.'
        : 'Alguns documentos cadastrados no Boatzy estão perto de vencer — ou já venceram. Navegar com a documentação em dia evita multa e apreensão da embarcação.',
      ...orientacoes.map((o) => esc(o)),
    ],
    blocos: [
      {
        titulo: 'Documentos',
        linhas: itens.map((i) => [`${i.sigla} · ${i.alvo}`, `${formatarData(i.validade)} — ${prazo(i.dias)}`]),
      },
    ],
    botao: { texto: 'Ver documentos', url: `${baseUrl()}/painel/documentos` },
    aposBotao: 'Depois de renovar, envie o documento novo no painel — os avisos param e o anterior fica no histórico.',
    rodape: 'Você recebe este aviso porque cadastrou documentos no painel do Boatzy. Avisamos 60, 30 e 7 dias antes e no dia do vencimento.',
  });

  return { assunto, html };
}
