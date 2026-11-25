import { createHash, timingSafeEqual } from 'node:crypto';
import { after, NextResponse } from 'next/server';
import { lerCredenciaisWebhook } from '@/lib/pagarme/config';
import { processarEventoPagarme, registrarEventoPagarme, validarPayloadPagarme } from '@/lib/pagarme/eventos';

// Webhook da Pagar.me (cartão de crédito, SPEC §109). Autenticado por Basic
// Auth (usuário/senha cadastrados no dashboard da Pagar.me). Só valida, grava
// e responde 200 — o processamento roda depois da resposta (after) e
// reconsulta o pedido na API antes de aplicar. Rede de segurança: o cron
// /api/cron/pagamentos reprocessa pendentes.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const hash = (v: string) => createHash('sha256').update(v).digest();

function autorizado(header: string | null): boolean {
  const cred = lerCredenciaisWebhook();
  if (!cred || !header?.startsWith('Basic ')) return false; // sem credencial configurada, recusa tudo (fail-safe)
  let recebido: string;
  try {
    recebido = Buffer.from(header.slice(6).trim(), 'base64').toString('utf8');
  } catch {
    return false;
  }
  // Compara os hashes para que o tempo não dependa do tamanho nem do conteúdo.
  return timingSafeEqual(hash(recebido), hash(`${cred.usuario}:${cred.senha}`));
}

export async function POST(request: Request) {
  if (!autorizado(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="boatzy"' } });
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const evento = validarPayloadPagarme(corpo);
  if (!evento) return NextResponse.json({ error: 'invalid payload' }, { status: 400 });

  try {
    await registrarEventoPagarme(evento);
  } catch (err) {
    // Sem persistência não confirmamos: a Pagar.me reenvia depois.
    console.error('[webhooks/pagarme]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'storage' }, { status: 500 });
  }

  // Também em duplicatas: se a 1ª tentativa ficou pendente/com erro, recupera agora.
  after(() => processarEventoPagarme(evento.id));

  return NextResponse.json({ ok: true });
}
