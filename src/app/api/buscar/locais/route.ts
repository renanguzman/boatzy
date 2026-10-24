import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export type LocalResult = {
  id: number;
  nome: string;
  uf: string;
  estado: string;
  latitude: number | null;
  longitude: number | null;
  /** Tem roteiro ativo saindo daqui ou embarcação ativa localizada aqui. */
  temOfertas: boolean;
  /** Quantidade de roteiros ativos com ponto de saída aqui. */
  totalRoteiros: number;
};

/**
 * Sugestões do campo "Destino" (home e /buscar).
 *
 *  - `?q=texto` — municípios cujo nome contém o texto, sem diferenciar acentos
 *    nem maiúsculas ("florianopolis" acha "Florianópolis"). Lista TODOS os
 *    municípios do país: o cliente pode buscar um lugar onde ainda não há
 *    oferta — a busca então avisa "O Boatzy ainda não possui…". Os que têm
 *    roteiro (ponto de saída) ou embarcação (localização) ativos vêm primeiro.
 *  - `?populares=1` — os 5 municípios com mais roteiros ativos (ponto de
 *    saída), mostrados assim que o campo abre, antes de digitar.
 *
 * O "Próximo de mim" não passa por aqui: a busca usa a coordenada do usuário com
 * raio (o município de centro mais próximo nem sempre é o município onde ele
 * está, então não serve de rótulo).
 *
 * Lê pelo servidor (`supabaseAdmin`): o RLS não deixa o público ler `roteiro`,
 * e antes a consulta com o cliente anônimo voltava vazia — o campo nunca
 * sugeria nada. Só devolve dados públicos de município.
 */

type Municipio = { id: number; nome: string; chave: string; uf: string; estado: string; latitude: number | null; longitude: number | null };

/** Sem acento e minúsculo, para comparar "Florianópolis" com "florianopolis". */
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Cache em memória por instância: os ~5,6 mil municípios mudam raramente; as
// ofertas (quem tem roteiro/embarcação ativo) mudam mais, então expiram antes.
const TTL_MUNICIPIOS_MS = 24 * 60 * 60 * 1000;
const TTL_OFERTAS_MS = 5 * 60 * 1000;
let cacheMunicipios: { em: number; lista: Municipio[] } | null = null;
type Ofertas = { ids: Set<number>; roteirosPorMunicipio: Map<number, number> };
let cacheOfertas: { em: number; ofertas: Ofertas } | null = null;

async function carregarMunicipios(): Promise<Municipio[]> {
  if (cacheMunicipios && Date.now() - cacheMunicipios.em < TTL_MUNICIPIOS_MS) return cacheMunicipios.lista;

  const { data: estados, error: erroEstados } = await supabaseAdmin.from('estados').select('id, uf, nome');
  if (erroEstados) throw erroEstados;
  const estadoPorId = new Map((estados ?? []).map((e) => [e.id, e]));

  // A Data API devolve no máximo 1.000 linhas por requisição — busca as
  // páginas em paralelo (a primeira sugestão não espera 6 idas ao banco).
  const { count, error: erroContagem } = await supabaseAdmin
    .from('municipios')
    .select('id', { count: 'exact', head: true });
  if (erroContagem) throw erroContagem;
  const paginas = await Promise.all(
    Array.from({ length: Math.ceil((count ?? 0) / 1000) }, (_, i) =>
      supabaseAdmin
        .from('municipios')
        .select('id, nome, estado_id, latitude, longitude')
        .order('id')
        .range(i * 1000, i * 1000 + 999),
    ),
  );
  const linhas = paginas.flatMap(({ data, error }) => {
    if (error) throw error;
    return data ?? [];
  });

  const lista = linhas.map((m) => ({
    id: m.id,
    nome: m.nome,
    chave: normalizar(m.nome),
    uf: estadoPorId.get(m.estado_id)?.uf ?? '',
    estado: estadoPorId.get(m.estado_id)?.nome ?? '',
    latitude: m.latitude != null ? Number(m.latitude) : null,
    longitude: m.longitude != null ? Number(m.longitude) : null,
  }));
  cacheMunicipios = { em: Date.now(), lista };
  return lista;
}

/**
 * Municípios com roteiro ativo (ponto de saída) ou embarcação ativa
 * (localização), e quantos roteiros ativos saem de cada um.
 */
async function municipiosComOfertas(): Promise<Ofertas> {
  if (cacheOfertas && Date.now() - cacheOfertas.em < TTL_OFERTAS_MS) return cacheOfertas.ofertas;
  const [roteiros, embarcacoes] = await Promise.all([
    supabaseAdmin.from('roteiro').select('municipio_id').eq('ativo', true).not('municipio_id', 'is', null),
    supabaseAdmin.from('embarcacao').select('municipio_id').eq('status', 'ativo').not('municipio_id', 'is', null),
  ]);
  const ids = new Set<number>();
  const roteirosPorMunicipio = new Map<number, number>();
  for (const r of roteiros.data ?? []) {
    if (r.municipio_id == null) continue;
    ids.add(r.municipio_id);
    roteirosPorMunicipio.set(r.municipio_id, (roteirosPorMunicipio.get(r.municipio_id) ?? 0) + 1);
  }
  for (const e of embarcacoes.data ?? []) {
    if (e.municipio_id != null) ids.add(e.municipio_id);
  }
  const ofertas = { ids, roteirosPorMunicipio };
  cacheOfertas = { em: Date.now(), ofertas };
  return ofertas;
}

function paraResultado(m: Municipio, ofertas: Ofertas): LocalResult {
  return {
    id: m.id, nome: m.nome, uf: m.uf, estado: m.estado,
    latitude: m.latitude, longitude: m.longitude,
    temOfertas: ofertas.ids.has(m.id),
    totalRoteiros: ofertas.roteirosPorMunicipio.get(m.id) ?? 0,
  };
}

const TOTAL_POPULARES = 5;

/** Os municípios com mais roteiros ativos; empate → A–Z. */
async function populares(): Promise<LocalResult[]> {
  const [municipios, ofertas] = await Promise.all([carregarMunicipios(), municipiosComOfertas()]);
  const porId = new Map(municipios.map((m) => [m.id, m]));
  return [...ofertas.roteirosPorMunicipio.keys()]
    .flatMap((id) => {
      const m = porId.get(id);
      return m ? [paraResultado(m, ofertas)] : [];
    })
    .sort((a, b) => b.totalRoteiros - a.totalRoteiros || a.nome.localeCompare(b.nome, 'pt'))
    .slice(0, TOTAL_POPULARES);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = normalizar(searchParams.get('q') ?? '');
  const querPopulares = searchParams.get('populares') === '1';
  if (!querPopulares && q.length < 2) return NextResponse.json([]);

  try {
    if (querPopulares) return NextResponse.json(await populares());

    const [municipios, ofertas] = await Promise.all([carregarMunicipios(), municipiosComOfertas()]);

    // Ordem: com oferta primeiro; depois quem começa com o texto; depois A–Z.
    const resultados = municipios
      .filter((m) => m.chave.includes(q))
      .sort((a, b) =>
        Number(ofertas.ids.has(b.id)) - Number(ofertas.ids.has(a.id))
        || Number(b.chave.startsWith(q)) - Number(a.chave.startsWith(q))
        || a.nome.localeCompare(b.nome, 'pt'))
      .slice(0, 8)
      .map((m) => paraResultado(m, ofertas));
    return NextResponse.json(resultados);
  } catch (error) {
    console.error('[api/buscar/locais]', error);
    return NextResponse.json({ error: 'Falha ao buscar destinos.' }, { status: 500 });
  }
}
