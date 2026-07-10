import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEmbarcacoesTopAvaliadas, getFavoritosEmbarcacaoSet } from '@/lib/embarcacoes-top';

/**
 * GET /api/embarcacoes/top-avaliadas?lat=&lng=
 * Embarcações mais bem avaliadas próximas ao usuário (raio de 100 km,
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

  const items = await getEmbarcacoesTopAvaliadas({ lat, lng, limit: 4 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const favoritos = user
    ? await getFavoritosEmbarcacaoSet(
        user.id,
        items.map((i) => i.id),
      )
    : new Set<string>();

  return NextResponse.json({
    items: items.map((i) => ({ ...i, favorito: favoritos.has(i.id) })),
  });
}
