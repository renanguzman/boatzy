import { NextResponse } from 'next/server';
import { reprocessarPendentes } from '@/lib/asaas/eventos';

// Job agendado (Vercel Cron, ver vercel.json) que reprocessa eventos de
// webhook do Asaas pendentes, com erro ou travados — rede de segurança caso
// o after() do endpoint não tenha concluído. Protegido por CRON_SECRET, no
// mesmo padrão de /api/cron/notificar-conversas.

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
    const resultado = await reprocessarPendentes();
    return NextResponse.json({ ok: true, ...resultado });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'erro';
    console.error('[cron/asaas-webhooks]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// A Vercel aciona via GET; POST fica disponível para testes manuais.
export const GET = handler;
export const POST = handler;
