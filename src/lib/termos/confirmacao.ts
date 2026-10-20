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

/** As primeiras `n` letras do nome (espaços preservados), ex.: "Renan Guzman" → "Renan". */
export function inicioDoNome(nome: string, n = 5): string {
  let letras = 0;
  let fim = 0;
  const t = nome.trim().replace(/\s+/g, ' ');
  for (const c of t) {
    if (/\S/.test(c)) letras++;
    fim += c.length;
    if (letras === n) break;
  }
  return t.slice(0, fim);
}

/** Qual confirmação pedir para este usuário: documento se houver, senão nome completo. */
export function definirConfirmacao(usuario: { name: string | null; cpf_cnpj: string | null }): ConfirmacaoExigida | null {
  const doc = somenteDigitos(usuario.cpf_cnpj ?? '');
  if (doc.length === 11) return { tipo: 'cpf', rotulo: 'seu CPF', dica: `${doc.slice(0, 3)}...` };
  if (doc.length === 14) return { tipo: 'cnpj', rotulo: 'o CNPJ cadastrado', dica: `${doc.slice(0, 4)}...` };
  if (usuario.name && normalizarNome(usuario.name)) {
    return { tipo: 'nome', rotulo: 'seu nome completo, como está no cadastro', dica: `${inicioDoNome(usuario.name)}...` };
  }
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
