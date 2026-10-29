import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Send Email Hook do Supabase Auth (SPEC §98): o Supabase deixa de enviar os e-mails da conta
 * (confirmação de cadastro, recuperação de senha…) e chama `POST /api/auth/email-hook`.
 *
 * A requisição é assinada no padrão Standard Webhooks: headers `webhook-id`, `webhook-timestamp`
 * (segundos) e `webhook-signature` ("v1,<base64>", podendo trazer várias separadas por espaço);
 * assinatura = HMAC-SHA256(`<id>.<timestamp>.<corpo cru>`) com o segredo do hook
 * (`SEND_EMAIL_HOOK_SECRET`, formato "v1,whsec_<base64>"). Tolerância de 5 minutos no timestamp.
 */

const TOLERANCIA_SEGUNDOS = 5 * 60;

export function verificarAssinaturaHook(corpo: string, headers: Headers, segredo: string): boolean {
  const id = headers.get('webhook-id');
  const timestamp = headers.get('webhook-timestamp');
  const assinaturas = headers.get('webhook-signature');
  if (!id || !timestamp || !assinaturas) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCIA_SEGUNDOS) return false;

  const chave = Buffer.from(segredo.replace(/^v1,whsec_/, '').replace(/^whsec_/, ''), 'base64');
  if (chave.length === 0) return false;
  const esperada = createHmac('sha256', chave).update(`${id}.${timestamp}.${corpo}`).digest();

  return assinaturas.split(' ').some((item) => {
    const [versao, valor] = item.split(',');
    if (versao !== 'v1' || !valor) return false;
    const recebida = Buffer.from(valor, 'base64');
    return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
  });
}

/** Tipos de e-mail que o Supabase Auth pede ao hook. */
export type AcaoEmailAuth =
  | 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email' | 'reauthentication'
  | 'password_changed_notification' | 'email_changed_notification' | 'phone_changed_notification'
  | 'identity_linked_notification' | 'identity_unlinked_notification'
  | 'mfa_factor_enrolled_notification' | 'mfa_factor_unenrolled_notification';

export type PayloadEmailHook = {
  user: {
    id: string;
    email: string;
    new_email?: string | null;
    user_metadata?: Record<string, unknown> | null;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: AcaoEmailAuth;
    site_url: string;
    token_new: string;
    token_hash_new: string;
    old_email?: string | null;
  };
};
