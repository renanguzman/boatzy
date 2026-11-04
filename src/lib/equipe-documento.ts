/**
 * Documento do membro da equipe: CPF ou, para estrangeiro, passaporte / registro de
 * identificação + país emissor — SPEC §104. Puro (navegador e servidor). Reaproveita a
 * normalização e a lista de países do pagador estrangeiro (SPEC §100).
 */
import { nomePais, validarDocumentoEstrangeiro } from '@/lib/pagamentos/estrangeiro';

export const TIPOS_DOCUMENTO_EQUIPE = ['passaporte', 'registro_identificacao'] as const;
export type TipoDocumentoEquipe = (typeof TIPOS_DOCUMENTO_EQUIPE)[number];

export const ROTULO_TIPO_DOCUMENTO_EQUIPE: Record<TipoDocumentoEquipe, string> = {
  passaporte: 'Passaporte',
  registro_identificacao: 'Registro de Identificação',
};

export const tipoDocumentoEquipeValido = (v: unknown): v is TipoDocumentoEquipe =>
  typeof v === 'string' && (TIPOS_DOCUMENTO_EQUIPE as readonly string[]).includes(v);

export type DocumentoEstrangeiroEquipe = { tipo: TipoDocumentoEquipe | ''; pais: string; documento: string };

/** Valida o trio tipo + país + número; `campo` diz o que corrigir. */
export function validarDocumentoEquipe(
  e: Partial<DocumentoEstrangeiroEquipe> | null | undefined,
): { ok: true; valor: { tipo: TipoDocumentoEquipe; pais: string; documento: string } } | { ok: false; erro: string } {
  if (!tipoDocumentoEquipeValido(e?.tipo)) return { ok: false, erro: 'Escolha o tipo do documento (passaporte ou registro de identificação).' };
  const v = validarDocumentoEstrangeiro({ pais: e?.pais, documento: e?.documento });
  if (!v.ok) {
    return { ok: false, erro: v.campo === 'pais' ? 'Escolha o país emissor do documento.' : 'Documento inválido — use de 4 a 20 letras ou números.' };
  }
  return { ok: true, valor: { tipo: e.tipo, ...v.valor } };
}

type MembroDocumento = {
  cpf?: string | null;
  documento_estrangeiro?: string | null;
  tipo_documento_estrangeiro?: string | null;
  pais_documento?: string | null;
};

/** Tem CPF ou documento estrangeiro — base do aviso "cadastro incompleto". */
export const membroTemDocumento = (m: MembroDocumento): boolean => !!m.cpf || !!m.documento_estrangeiro;

/** "Passaporte AB123456 · Argentina" (nome do país em pt-BR). */
export function documentoEstrangeiroEquipeRotulo(m: MembroDocumento): string | null {
  if (!m.documento_estrangeiro) return null;
  const tipo = tipoDocumentoEquipeValido(m.tipo_documento_estrangeiro) ? ROTULO_TIPO_DOCUMENTO_EQUIPE[m.tipo_documento_estrangeiro] : 'Documento';
  const pais = m.pais_documento ? ` · ${nomePais(m.pais_documento, 'pt-BR')}` : '';
  return `${tipo} ${m.documento_estrangeiro}${pais}`;
}
