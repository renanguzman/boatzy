// Log estruturado do fluxo de autenticação/cadastro. Funciona no servidor e no navegador.
// Prefixo único `[auth]` para filtrar no terminal, no console do navegador e nos logs da Vercel.
// Nunca registra senha, token, CPF completo nem e-mail completo (mascarados).

type Nivel = 'info' | 'warn' | 'error';

export function mascararEmail(email?: string | null): string {
  if (!email) return '(vazio)';
  const [u, d] = email.split('@');
  return `${u.slice(0, 2)}***@${d ?? '?'}`;
}

/** Extrai o que importa de qualquer erro (AuthError do Supabase, PostgrestError, Error, string). */
export function detalharErro(err: unknown): Record<string, unknown> {
  if (!err || typeof err !== 'object') return { mensagem: String(err) };
  const e = err as Record<string, unknown>;
  return {
    nome: e.name,
    mensagem: e.message,
    status: e.status,
    codigo: e.code,
    detalhes: e.details,
    dica: e.hint,
  };
}

export function logAuth(etapa: string, nivel: Nivel = 'info', dados: Record<string, unknown> = {}) {
  const linha = `[auth] ${etapa}`;
  const payload = { ts: new Date().toISOString(), ...dados };
  if (nivel === 'error') console.error(linha, payload);
  else if (nivel === 'warn') console.warn(linha, payload);
  else console.log(linha, payload);
}
