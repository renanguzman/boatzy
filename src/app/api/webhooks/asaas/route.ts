import { createHash, timingSafeEqual } from 'node:crypto';
import { after, NextResponse } from 'next/server';
import { lerTokenWebhook } from '@/lib/asaas/config';
import { processarEvento, registrarEvento, validarPayloadEvento } from '@/lib/asaas/eventos';

// Webhook do Asaas (cobranças e transferências). Só valida, grava e responde
// 200 — o processamento roda depois da resposta (after) para não estourar o
// tempo de resposta esperado pelo Asaas nem pausar a fila (15 falhas seguidas).
// Rede de segurança: /api/cron/asaas-webhooks. Ver SPEC §34.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function tokenValido(recebido: string | null): boolean {
  const esperado = lerTokenWebhook();
  if (!esperado || !recebido) return false; // sem token configurado, recusa tudo (fail-safe)
  // Compara os hashes para que o tempo não dependa do tamanho nem do conteúdo.
  const a = createHash('sha256').update(recebido).digest();
  const b = createHash('sha256').update(esperado).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!tokenValido(request.headers.get('asaas-access-token'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const evento = validarPayloadEvento(corpo);
  if (!evento) return NextResponse.json({ error: 'invalid payload' }, { status: 400 });

  try {
    await registrarEvento(evento);
  } catch (err) {
    // Sem persistência não confirmamos: o Asaas reenvia depois.
    console.error('[webhooks/asaas]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'storage' }, { status: 500 });
  }

  // Também em duplicatas: se a 1ª tentativa ficou pendente/com erro, recupera agora.
  after(() => processarEvento(evento.id));

  return NextResponse.json({ ok: true });
}
