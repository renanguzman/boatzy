import { enviarArquivoRascunho } from '@/lib/documentos/envio';
import { erroConferencia, payloadDoRascunho, type RascunhoDocumento } from '@/lib/documentos/rascunho';
import { TIPOS_DOCUMENTO } from '@/lib/documentos/tipos';
import { criarDocumento } from '../actions';

/**
 * Documentos embutidos nos cadastros do painel (SPEC §95.10): conferem, sobem o arquivo
 * antes de gravar o cadastro (se falhar, nada é salvo) e registram o documento quando a
 * embarcação/o membro já existe.
 */

type Rascunhos = (RascunhoDocumento | null | undefined)[];

const presentes = (rs: Rascunhos) => rs.filter((r): r is RascunhoDocumento => !!r);

/** Primeiro problema de conferência entre os rascunhos, ou null. */
export function erroDosRascunhos(rs: Rascunhos): string | null {
  for (const r of presentes(rs)) {
    const erro = erroConferencia(r.tipo, r.escopo, r.campos);
    if (erro) return erro;
  }
  return null;
}

/** Sobe os arquivos (uma vez só por arquivo). Devolve a mensagem de erro ou null. */
export async function enviarArquivosDosRascunhos(rs: Rascunhos, onProgresso?: (texto: string) => void): Promise<string | null> {
  for (const r of presentes(rs)) {
    const sigla = TIPOS_DOCUMENTO[r.tipo].sigla;
    const env = await enviarArquivoRascunho(r, (pct) => onProgresso?.(`Enviando o ${sigla}… ${pct}%`));
    if (!env.ok) return `${sigla}: ${env.erro}`;
  }
  return null;
}

/**
 * Grava os documentos para o alvo já salvo. Devolve as falhas ("TIE: motivo") e os ids
 * gravados — que saem do formulário, para uma nova tentativa não repetir o registro.
 */
export async function registrarRascunhos(
  rs: Rascunhos,
  alvo: { embarcacaoId: string } | { membroId: string },
): Promise<{ falhas: string[]; salvos: string[] }> {
  const falhas: string[] = [];
  const salvos: string[] = [];
  for (const r of presentes(rs)) {
    const sigla = TIPOS_DOCUMENTO[r.tipo].sigla;
    const env = await enviarArquivoRascunho(r);
    if (!env.ok) {
      falhas.push(`${sigla}: ${env.erro}`);
      continue;
    }
    const res = await criarDocumento(payloadDoRascunho(r, env.arquivo, alvo));
    if (res.ok) salvos.push(r.id);
    else falhas.push(`${sigla}: ${res.error}`);
  }
  return { falhas, salvos };
}
