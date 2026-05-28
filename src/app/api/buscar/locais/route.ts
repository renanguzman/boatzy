import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export type LocalResult = {
  id: number;
  nome: string;
  uf: string;
  estado: string;
  latitude: number | null;
  longitude: number | null;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  const supabase = await createClient();

  // Busca municipios que possuem roteiros cadastrados
  const { data: roteiroData, error: roteiroError } = await supabase
    .from('roteiro')
    .select('municipio_id')
    .not('municipio_id', 'is', null);

  if (roteiroError) {
    return NextResponse.json({ error: roteiroError.message }, { status: 500 });
  }

  const municipioIds = [
    ...new Set(
      (roteiroData ?? []).map((r) => r.municipio_id).filter((id): id is number => id !== null),
    ),
  ];

  if (municipioIds.length === 0) {
    return NextResponse.json([]);
  }

  let municipioQuery = supabase
    .from('municipios')
    .select('id, nome, latitude, longitude, estado_id')
    .in('id', municipioIds);

  if (q) {
    municipioQuery = municipioQuery.ilike('nome', `%${q}%`);
  }

  municipioQuery = municipioQuery.limit(20);

  const { data: municipios, error: municipioError } = await municipioQuery;

  if (municipioError) {
    return NextResponse.json({ error: municipioError.message }, { status: 500 });
  }

  if (!municipios || municipios.length === 0) {
    return NextResponse.json([]);
  }

  const estadoIds = [...new Set(municipios.map((m) => m.estado_id))];
  const { data: estados } = await supabase
    .from('estados')
    .select('id, uf, nome')
    .in('id', estadoIds);

  const estadoMap = new Map(estados?.map((e) => [e.id, e]) ?? []);

  let results: LocalResult[] = municipios.map((m) => ({
    id: m.id,
    nome: m.nome,
    uf: estadoMap.get(m.estado_id)?.uf ?? '',
    estado: estadoMap.get(m.estado_id)?.nome ?? '',
    latitude: m.latitude,
    longitude: m.longitude,
  }));

  if (lat && lng) {
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    results = results
      .filter((r) => r.latitude != null && r.longitude != null)
      .sort((a, b) => {
        const distA = Math.hypot(a.latitude! - userLat, a.longitude! - userLng);
        const distB = Math.hypot(b.latitude! - userLat, b.longitude! - userLng);
        return distA - distB;
      })
      .slice(0, 6);
  } else {
    results = results.sort((a, b) => a.nome.localeCompare(b.nome, 'pt')).slice(0, 10);
  }

  return NextResponse.json(results);
}
