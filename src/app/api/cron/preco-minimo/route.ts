import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Recalcula `roteiro.preco_minimo` de todos os roteiros (Vercel Cron, ver
// vercel.json). Os triggers já mantêm a coluna em dia quando o gestor muda
// preços ou regras; este job existe porque a janela de 365 dias desliza com o
// calendário: um preço de alta temporada entra na janela, uma regra de data
// fixa vence e sai. Sem isso o "A partir de R$ X" do card envelhece.
// Protegido por CRON_SECRET, no mesmo padrão de /api/cron/pagamentos.

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

  const { data, error } = await supabaseAdmin.rpc('recalcular_precos_minimos_roteiros');

  if (error) {
    console.error('[cron/preco-minimo]', error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, roteirosAtualizados: data ?? 0 });
}

// A Vercel aciona via GET; POST fica disponível para testes manuais.
export const GET = handler;
export const POST = handler;
