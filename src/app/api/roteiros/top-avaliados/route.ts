import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRoteirosTopAvaliados, getFavoritosRoteiroSet } from '@/lib/roteiros-top';

/**
 * GET /api/roteiros/top-avaliados?lat=&lng=
 * Roteiros mais bem avaliados próximos ao usuário (raio de 100 km,
 * completando com o topo da plataforma se preciso). Usada pela home para
 * trocar a lista global pela localizada quando o navegador já tem permissão
 * de geolocalização. Inclui o estado de favorito do usuário logado.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = sp.get('lat') ? parseFloat(sp.get('lat')!) : null;
  const lng = sp.get('lng') ? parseFloat(sp.get('lng')!) : null;
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: 'lat/lng obrigatórios' }, { status: 400 });
  }

  const items = await getRoteirosTopAvaliados({ lat, lng, limit: 3 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const favoritos = user
    ? await getFavoritosRoteiroSet(
        user.id,
        items.map((i) => i.id),
      )
    : new Set<string>();

  return NextResponse.json({
    items: items.map((i) => ({ ...i, favorito: favoritos.has(i.id) })),
  });
}
