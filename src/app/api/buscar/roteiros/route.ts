import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export type RoteiroSugestao = {
  id: string;
  nome: string;
  /** "Cidade, UF" do ponto de saída; null se o roteiro não tem município. */
  localidade: string | null;
  imagem: string | null;
};

/**
 * Sugestões de roteiro pelo título no campo "Destino" da home (`?q=texto`).
 * O título costuma trazer o destino ("Passeio à Ilha do Mel"), inclusive
 * lugares que não são município — a busca por cidade não os acharia.
 *
 * Sem diferenciar acentos nem maiúsculas, e cada palavra digitada precisa
 * estar no título, em qualquer ordem ("mel ilha" acha "Ilha do Mel"). Só
 * roteiros ativos — os mesmos que `/roteiros/[id]` exibe.
 *
 * Lê pelo servidor (`supabaseAdmin`): o RLS não deixa o público ler `roteiro`.
 */

type RoteiroIndexado = { id: string; nome: string; chave: string; localidade: string | null };

type RoteiroRow = {
  id: string;
  nome: string;
  municipios: { nome: string; estados: { uf: string } | null } | null;
};

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Cache em memória por instância, como as ofertas de `/api/buscar/locais`.
const TTL_MS = 5 * 60 * 1000;
const POR_PAGINA = 1000; // limite de linhas por requisição da Data API
const MAX_SUGESTOES = 5;
let cache: { em: number; lista: RoteiroIndexado[] } | null = null;

async function carregarRoteiros(): Promise<RoteiroIndexado[]> {
  if (cache && Date.now() - cache.em < TTL_MS) return cache.lista;

  const linhas: RoteiroRow[] = [];
  for (let de = 0; ; de += POR_PAGINA) {
    const { data, error } = await supabaseAdmin
      .from('roteiro')
      .select('id, nome, municipios ( nome, estados ( uf ) )')
      .eq('ativo', true)
      .order('id')
      .range(de, de + POR_PAGINA - 1);
    if (error) throw error;
    linhas.push(...((data ?? []) as unknown as RoteiroRow[]));
    if ((data ?? []).length < POR_PAGINA) break;
  }

  const lista = linhas.map((r) => ({
    id: r.id,
    nome: r.nome,
    chave: normalizar(r.nome),
    localidade: r.municipios
      ? r.municipios.estados ? `${r.municipios.nome}, ${r.municipios.estados.uf}` : r.municipios.nome
      : null,
  }));
  cache = { em: Date.now(), lista };
  return lista;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = normalizar(searchParams.get('q') ?? '');
  if (q.length < 2) return NextResponse.json([]);
  const palavras = q.split(/\s+/);

  try {
    // Ordem: título que começa com o texto; depois A–Z.
    const encontrados = (await carregarRoteiros())
      .filter((r) => palavras.every((p) => r.chave.includes(p)))
      .sort((a, b) =>
        Number(b.chave.startsWith(q)) - Number(a.chave.startsWith(q))
        || a.nome.localeCompare(b.nome, 'pt'))
      .slice(0, MAX_SUGESTOES);
    if (encontrados.length === 0) return NextResponse.json([]);

    // Imagem só dos que vão aparecer (não vale manter todas em cache).
    const { data: imagens } = await supabaseAdmin
      .from('roteiro_imagens')
      .select('roteiro_id, url_imagem, principal')
      .in('roteiro_id', encontrados.map((r) => r.id));
    const imagemPorRoteiro = new Map<string, string>();
    for (const img of imagens ?? []) {
      if (img.principal || !imagemPorRoteiro.has(img.roteiro_id)) imagemPorRoteiro.set(img.roteiro_id, img.url_imagem);
    }

    const resultados: RoteiroSugestao[] = encontrados.map((r) => ({
      id: r.id,
      nome: r.nome,
      localidade: r.localidade,
      imagem: imagemPorRoteiro.get(r.id) ?? null,
    }));
    return NextResponse.json(resultados);
  } catch (error) {
    console.error('[api/buscar/roteiros]', error);
    return NextResponse.json({ error: 'Falha ao buscar roteiros.' }, { status: 500 });
  }
}
