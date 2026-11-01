import { TIPOS_DOCUMENTO, TIPOS_INSCRICAO } from './tipos';
import { situacaoValidade } from './validade';
import type { DocumentoAtual } from './rascunho';

/**
 * Regra de aprovação da embarcação (SPEC §95.11): a equipe Boatzy só aprova uma
 * embarcação com o documento de inscrição na Capitania — TIE, TIEM ou PRPM —
 * enviado e em dia (a PRPM não vence). O admin confere o documento ao aprovar.
 * O seguro DPEM segue recomendado, sem bloquear. Módulo neutro (servidor e navegador).
 */

export type PendenciaInscricao = 'nao_enviado' | 'vencido' | null;

/** Entre os documentos ativos da embarcação, o de inscrição que vale: o em dia, na ordem TIE > TIEM > PRPM. */
export function escolherInscricao<T extends Pick<DocumentoAtual, 'tipo' | 'data_validade'>>(docs: T[]): T | null {
  const inscricoes = TIPOS_INSCRICAO.flatMap((t) => docs.filter((d) => d.tipo === t));
  return inscricoes.find((d) => situacaoValidade(d.data_validade) !== 'vencido') ?? inscricoes[0] ?? null;
}

export function pendenciaInscricao(doc: Pick<DocumentoAtual, 'data_validade'> | null | undefined): PendenciaInscricao {
  if (!doc) return 'nao_enviado';
  return situacaoValidade(doc.data_validade) === 'vencido' ? 'vencido' : null;
}

/** Texto curto da pendência para o gestor ("Falta o TIE" / "TIE vencido"). */
export function rotuloPendenciaInscricao(p: PendenciaInscricao, doc?: Pick<DocumentoAtual, 'tipo'> | null): string | null {
  if (p === 'nao_enviado') return 'Falta o TIE';
  if (p === 'vencido') return `${doc ? TIPOS_DOCUMENTO[doc.tipo].sigla : 'TIE'} vencido`;
  return null;
}
