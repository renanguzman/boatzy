import 'server-only';
import { createHmac, randomInt } from 'crypto';

// Verificador "é humano" simples e sem dependências externas (sem chave de
// serviço de captcha): um desafio de soma de dois números pequenos, assinado
// com HMAC para que o servidor valide a resposta sem precisar guardar estado
// (sessão/DB). O token viaja no próprio formulário — não expõe o segredo, só
// prova que (a, b) não foram adulterados entre a geração e o envio.

const SECRET =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.RESEND_API_KEY ||
  'boatzy-contato-captcha-fallback';

export type DesafioCaptcha = { a: number; b: number; token: string };

export function gerarDesafioCaptcha(): DesafioCaptcha {
  const a = randomInt(1, 10);
  const b = randomInt(1, 10);
  return { a, b, token: assinar(a, b) };
}

/** True quando o token bate com (a, b) e a soma informada está correta. */
export function verificarDesafioCaptcha(
  a: number,
  b: number,
  token: string,
  resposta: number
): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(resposta)) return false;
  if (assinar(a, b) !== token) return false;
  return a + b === resposta;
}

function assinar(a: number, b: number): string {
  return createHmac('sha256', SECRET).update(`${a}:${b}`).digest('hex');
}
