import { NextResponse } from 'next/server';
import { processarLembretesPasseio } from '@/lib/comunicacao/lembretes';

// Lembretes do passeio confirmado — véspera (D-1, 10h) e dia (H-3) — por e-mail e aviso no
// sino, para cliente e gestor (SPEC §96). Acionado pelo cron-job.org a cada 15 min (o plano
// Hobby da Vercel só permite cron diário); a Vercel roda 1×/dia às 10h como reserva do D-1.
// Idempotente: rodar de novo não repete envios. Protegido por CRON_SECRET, no mesmo padrão
// de /api/cron/pagamentos.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function autorizado(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // sem secret configurado, não roda (fail-safe)
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

async function handler(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const resultado = await processarLembretesPasseio();
    return NextResponse.json({ ok: true, ...resultado });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'erro';
    console.error('[cron/lembretes-passeio]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// cron-job.org e a Vercel acionam via GET; POST fica disponível para testes manuais.
export const GET = handler;
export const POST = handler;
