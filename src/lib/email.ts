import 'server-only';

// Envio de e-mail transacional via Resend (REST API, sem dependência extra).
//
// Env necessárias:
//   RESEND_API_KEY  — chave da API do Resend
//   EMAIL_FROM      — remetente verificado, ex.: "Boatzy <no-reply@boatzy.app>"
//
// Sem RESEND_API_KEY configurada, o envio é um no-op logado (não quebra o
// build/dev e permite rodar o cron sem provedor até as chaves existirem).

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

export type SendEmailResult = { ok: true; id?: string } | { ok: false; error: string };

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? 'Boatzy <no-reply@boatzy.app>';

  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY ausente — e-mail para ${to} não enviado (no-op): "${subject}"`);
    return { ok: false, error: 'no_provider' };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, error: `resend_${res.status}: ${detail.slice(0, 200)}` };
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}
