import { NextResponse } from 'next/server';
import { reprocessarPendentes } from '@/lib/asaas/eventos';
import { expirarPedidosVencidos } from '@/lib/pagamentos/pedidos';

// Job agendado dos pagamentos (Vercel Cron, ver vercel.json; futuramente o
// agendador do Supabase a cada ~10 min):
//   1) reprocessa eventos de webhook do Asaas pendentes/com erro/travados —
//      antes da expiração, para um pagamento já confirmado não virar "expirado";
//   2) expira pedidos com prazo de pagamento vencido (remove as cobranças no
//      Asaas e libera a data).
// Protegido por CRON_SECRET, no mesmo padrão de /api/cron/notificar-conversas.

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
    const webhooks = await reprocessarPendentes();
    const pedidosExpirados = await expirarPedidosVencidos();
    return NextResponse.json({ ok: true, webhooks, pedidosExpirados });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'erro';
    console.error('[cron/pagamentos]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// A Vercel aciona via GET; POST fica disponível para testes manuais.
export const GET = handler;
export const POST = handler;
