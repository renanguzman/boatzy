import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { enviosDoHook } from '@/lib/emails/conta';
import { logAuth, mascararEmail } from '@/lib/log-auth';
import { verificarAssinaturaHook, type PayloadEmailHook } from '@/lib/supabase/email-hook';

// Send Email Hook do Supabase Auth (SPEC §98): com o hook ligado (Dashboard → Authentication → Hooks →
// Send Email → HTTPS), o Supabase não envia mais os e-mails da conta — chama esta rota, que monta o
// e-mail com o layout do Boatzy no idioma do usuário e envia pelo Resend.
//
// Responde 200 `{}` quando enviou. Erro → `{ error: { http_code, message } }`: o Supabase repassa a falha a
// quem pediu (o cadastro/recuperação mostra erro e a pessoa pode tentar de novo) em vez de "enviar" nada.

export const dynamic = 'force-dynamic';

function erro(status: number, message: string) {
  return NextResponse.json({ error: { http_code: status, message } }, { status });
}

export async function POST(request: Request) {
  logAuth('email-hook:recebido', 'info', {
    temWebhookId: !!request.headers.get('webhook-id'),
    temAssinatura: !!request.headers.get('webhook-signature'),
    segredoConfigurado: !!process.env.SEND_EMAIL_HOOK_SECRET,
    resendConfigurado: !!process.env.RESEND_API_KEY,
  });
  const segredo = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!segredo) {
    console.error('[auth/email-hook] SEND_EMAIL_HOOK_SECRET ausente');
    return erro(500, 'Hook de e-mail não configurado.');
  }

  const corpo = await request.text();
  if (!verificarAssinaturaHook(corpo, request.headers, segredo)) {
    logAuth('email-hook:assinatura-invalida', 'error', { dica: 'SEND_EMAIL_HOOK_SECRET diferente do segredo no Dashboard, ou relógio fora de 5 min' });
    return erro(401, 'Assinatura inválida.');
  }

  let payload: PayloadEmailHook;
  try {
    payload = JSON.parse(corpo) as PayloadEmailHook;
    if (!payload?.user?.email || !payload?.email_data?.email_action_type) throw new Error('payload incompleto');
  } catch (err) {
    logAuth('email-hook:payload-invalido', 'error', { mensagem: err instanceof Error ? err.message : String(err) });
    return erro(400, 'Payload inválido.');
  }

  logAuth('email-hook:processando', 'info', {
    acao: payload.email_data.email_action_type, para: mascararEmail(payload.user.email), redirectTo: payload.email_data.redirect_to,
  });
  try {
    const envios = await enviosDoHook(payload);
    for (const e of envios) {
      const r = await sendEmail({ to: e.para, subject: e.assunto, html: e.html });
      if (!r.ok) {
        console.error('[auth/email-hook]', payload.email_data.email_action_type, 'falha no envio:', r.error);
        return erro(500, 'Não foi possível enviar o e-mail agora.');
      }
    }
    logAuth('email-hook:enviado', 'info', { acao: payload.email_data.email_action_type, qtd: envios.length });
    return NextResponse.json({});
  } catch (err) {
    console.error('[auth/email-hook] falha:', err instanceof Error ? err.stack ?? err.message : err);
    return erro(500, 'Não foi possível enviar o e-mail agora.');
  }
}
