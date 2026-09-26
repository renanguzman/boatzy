/**
 * Confirmação digitada do aceite: o usuário digita o próprio CPF/CNPJ
 * (quando cadastrado) ou, na falta dele, o nome completo como cadastrado.
 * Módulo puro — usado no servidor (validação) e no cliente (instrução).
 */
import type { ConfirmacaoExigida, ConfirmacaoTipo } from './tipos';

export function somenteDigitos(v: string): string {
  return v.replace(/\D/g, '');
}

/** Minúsculas, sem acentos, espaços colapsados — tolera diferenças de digitação irrelevantes. */
export function normalizarNome(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Qual confirmação pedir para este usuário: documento se houver, senão nome completo. */
export function definirConfirmacao(usuario: { name: string | null; cpf_cnpj: string | null }): ConfirmacaoExigida | null {
  const doc = somenteDigitos(usuario.cpf_cnpj ?? '');
  if (doc.length === 11) return { tipo: 'cpf', rotulo: 'seu CPF' };
  if (doc.length === 14) return { tipo: 'cnpj', rotulo: 'o CNPJ cadastrado' };
  if (usuario.name && normalizarNome(usuario.name)) return { tipo: 'nome', rotulo: 'seu nome completo, como está no cadastro' };
  return null;
}

export function confereConfirmacao(
  tipo: ConfirmacaoTipo,
  digitado: string,
  usuario: { name: string | null; cpf_cnpj: string | null },
): boolean {
  if (tipo === 'nome') {
    const esperado = normalizarNome(usuario.name ?? '');
    return !!esperado && normalizarNome(digitado) === esperado;
  }
  const esperado = somenteDigitos(usuario.cpf_cnpj ?? '');
  return !!esperado && somenteDigitos(digitado) === esperado;
}
