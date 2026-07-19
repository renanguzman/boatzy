import { NextResponse } from 'next/server';
import { processarNotificacoesConversas } from '@/lib/notificacoes-conversa';

// Job agendado (Vercel Cron, ver vercel.json) que agrupa e dispara os
// e-mails de novas conversas. Protegido por CRON_SECRET: a Vercel envia
// automaticamente `Authorization: Bearer <CRON_SECRET>` quando a env existe.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function autorizado(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // sem secret configurado, não roda (fail-safe)
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

async function handler(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const resultado = await processarNotificacoesConversas();
    return NextResponse.json({ ok: true, ...resultado });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'erro';
    console.error('[cron/notificar-conversas]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// A Vercel aciona via GET; POST fica disponível para testes manuais.
export const GET = handler;
export const POST = handler;
