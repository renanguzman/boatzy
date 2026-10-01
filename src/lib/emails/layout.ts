import 'server-only';

import { sendEmail } from '@/lib/email';

/**
 * Layout padrão dos e-mails transacionais do Boatzy (cabeçalho navy, saudação,
 * parágrafos, tabelas de rótulo/valor, botão e rodapé) — o mesmo visual do
 * aviso de novas conversas (`src/lib/notificacoes-conversa.ts`).
 */

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** URL pública do site (links dos e-mails). */
export function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://boatzy.app').trim().replace(/\/+$/, '');
}

export type BlocoEmail = {
  titulo?: string;
  linhas: [string, string][]; // rótulo, valor (texto puro — escapado aqui)
  /** Última linha em destaque (ex.: total). */
  destacarUltima?: boolean;
};

export function montarEmailHtml(input: {
  nome: string;
  paragrafos: string[]; // HTML já escapado por quem chama
  blocos?: BlocoEmail[];
  botao?: { texto: string; url: string };
  /** Texto pequeno logo abaixo do botão (ex.: "Responda em até…"). HTML já escapado. */
  aposBotao?: string;
  rodape: string;
}): string {
  const primeiroNome = esc((input.nome ?? '').split(' ')[0] || 'Olá');

  const blocos = (input.blocos ?? [])
    .filter((b) => b.linhas.length > 0)
    .map((b) => {
      const linhas = b.linhas
        .map(([rotulo, valor], i) => {
          const destaque = b.destacarUltima && i === b.linhas.length - 1;
          const borda = i === b.linhas.length - 1 ? '' : 'border-bottom:1px solid #eef2f7;';
          // Rótulos curtos numa linha só; longos (ex.: nome de um adicional) podem quebrar.
          const quebra = rotulo.length <= 22 ? 'white-space:nowrap;' : '';
          return `<tr>
        <td style="padding:10px 16px;${borda}${quebra}color:${destaque ? '#0B2447' : '#64748b'};font-size:13px;${destaque ? 'font-weight:bold;' : ''}">${esc(rotulo)}</td>
        <td style="padding:10px 16px;${borda}color:#0B2447;font-size:${destaque ? '15px' : '13px'};font-weight:bold;text-align:right;">${esc(valor)}</td>
      </tr>`;
        })
        .join('');
      const titulo = b.titulo
        ? `<p style="margin:0 0 8px;color:#94a3b8;font-size:11px;font-weight:bold;letter-spacing:0.06em;text-transform:uppercase;">${esc(b.titulo)}</p>`
        : '';
      return `${titulo}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eef2f7;border-radius:12px;overflow:hidden;margin-bottom:20px;">${linhas}</table>`;
    })
    .join('');

  const botao = input.botao
    ? `<a href="${esc(input.botao.url)}" style="display:inline-block;background:#0B3D91;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 24px;border-radius:12px;">${esc(input.botao.texto)}</a>`
    : '';
  const aposBotao = input.aposBotao
    ? `<p style="margin:12px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">${input.aposBotao}</p>`
    : '';

  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#0B2447;padding:20px 24px;color:#ffffff;font-size:18px;font-weight:bold;">Boatzy</td></tr>
        <tr><td style="padding:24px;">
          <h1 style="margin:0 0 8px;color:#0B2447;font-size:18px;">Olá, ${primeiroNome}!</h1>
          ${input.paragrafos.map((p) => `<p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.5;">${p}</p>`).join('')}
          ${blocos}
          ${botao}
          ${aposBotao}
        </td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid #eef2f7;color:#94a3b8;font-size:12px;line-height:1.5;">${esc(input.rodape)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Envia e só loga falhas — e-mail nunca interrompe o fluxo que o disparou. */
export async function enviarEmail(to: string | null | undefined, subject: string, html: string, contexto: string) {
  if (!to) return;
  const r = await sendEmail({ to, subject, html });
  if (!r.ok && r.error !== 'no_provider') console.error(`[emails] ${contexto}:`, r.error);
}
