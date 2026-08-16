'use server';

import { sendEmail } from '@/lib/email';
import { gerarDesafioCaptcha, verificarDesafioCaptcha, type DesafioCaptcha } from '@/lib/contato-captcha';
import { ASSUNTOS_CONTATO, type AssuntoContato } from './constants';

const DESTINATARIO = 'gabriela@boatzy.app';

export type EnviarContatoInput = {
  nome: string;
  email: string;
  assunto: string;
  mensagem: string;
  /** Campo honeypot: deve chegar vazio. Bots costumam preenchê-lo. */
  empresa: string;
  captchaA: number;
  captchaB: number;
  captchaToken: string;
  captchaResposta: string;
};

export type EnviarContatoResult = { ok: true } | { ok: false; error: string };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function enviarContato(input: EnviarContatoInput): Promise<EnviarContatoResult> {
  const nome = input.nome.trim();
  const email = input.email.trim();
  const mensagem = input.mensagem.trim();
  const assunto = input.assunto.trim();

  // Honeypot: campo invisível para humanos; se veio preenchido, é bot.
  // Responde "sucesso" para não dar pista de que foi bloqueado.
  if (input.empresa.trim() !== '') {
    return { ok: true };
  }

  if (!nome || nome.length < 2) {
    return { ok: false, error: 'Informe seu nome.' };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, error: 'Informe um e-mail válido.' };
  }
  if (!ASSUNTOS_CONTATO.includes(assunto as AssuntoContato)) {
    return { ok: false, error: 'Selecione um assunto.' };
  }
  if (!mensagem || mensagem.length < 10) {
    return { ok: false, error: 'Escreva uma mensagem com pelo menos 10 caracteres.' };
  }
  if (mensagem.length > 5000) {
    return { ok: false, error: 'Mensagem muito longa.' };
  }

  const respostaNum = Number(input.captchaResposta);
  const captchaOk = verificarDesafioCaptcha(
    input.captchaA,
    input.captchaB,
    input.captchaToken,
    respostaNum
  );
  if (!captchaOk) {
    return { ok: false, error: 'Verificação de segurança incorreta. Tente novamente.' };
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #0B2447;">Novo contato pelo site — ${escapeHtml(assunto)}</h2>
      <p><strong>Nome:</strong> ${escapeHtml(nome)}</p>
      <p><strong>E-mail:</strong> ${escapeHtml(email)}</p>
      <p><strong>Assunto:</strong> ${escapeHtml(assunto)}</p>
      <p><strong>Mensagem:</strong></p>
      <p style="white-space: pre-wrap; background: #f8fafc; border-radius: 8px; padding: 12px;">${escapeHtml(mensagem)}</p>
    </div>
  `;

  const res = await sendEmail({
    to: DESTINATARIO,
    subject: `[Boatzy · ${assunto}] Mensagem de ${nome}`,
    html,
    replyTo: email,
  });

  if (!res.ok) {
    console.error('[enviarContato] falha ao enviar e-mail:', res.error);
    return { ok: false, error: 'Não foi possível enviar sua mensagem agora. Tente novamente em instantes.' };
  }

  return { ok: true };
}

export async function novoDesafioCaptcha(): Promise<DesafioCaptcha> {
  return gerarDesafioCaptcha();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
