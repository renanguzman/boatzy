import Link from 'next/link';
import { SlidersHorizontal, X } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { getFiltrosVenda } from '@/lib/vendas-filtros';
import { anoVendaLabel, valorVendaLabel } from '@/components/home/search/venda/labels';
import type { LocalidadeVendaValue } from '@/components/home/search/venda/LocalidadeVendaPicker';
import VendasSearchBar from './_components/VendasSearchBar';
import AnuncioVendaCard, { type AnuncioVendaCardData } from './_components/AnuncioVendaCard';

const POR_PAGINA = 24;

type SearchParams = {
  tipo?: string;
  estado?: string;
  cidade?: string;
  ano_min?: string;
  ano_max?: string;
  preco_min?: string;
  preco_max?: string;
  pagina?: string;
};

type AnuncioDetalheRow = {
  id: string;
  fabricante: string;
  ano_modelo: number;
  ano_fabricacao: number;
  preco: number;
  embarcacao: {
    nome: string;
    capacidade: number | null;
    comprimento: number | null;
    embarcacao_tipo: { nome: string } | null;
    municipios: { nome: string; estados: { uf: string } | null } | null;
    embarcacao_imagens: { url_imagem: string; principal: boolean }[];
  } | null;
};

function buildPageUrl(current: SearchParams, overrides: Partial<SearchParams>) {
  const merged = { ...current, ...overrides };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v != null && v !== '') params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/vendas?${qs}` : '/vendas';
}

function getPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  if (current > 3) pages.push('…');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

export default async function VendasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  const tipoId = params.tipo || null;
  const estadoId = params.estado ? parseInt(params.estado) : null;
  const municipioId = params.cidade ? parseInt(params.cidade) : null;
  const anoMin = params.ano_min ? parseInt(params.ano_min) : null;
  const anoMax = params.ano_max ? parseInt(params.ano_max) : null;
  const precoMin = params.preco_min ? parseFloat(params.preco_min) : null;
  const precoMax = params.preco_max ? parseFloat(params.preco_max) : null;
  const pagina = params.pagina ? Math.max(1, parseInt(params.pagina)) : 1;
  const from = (pagina - 1) * POR_PAGINA;

  // Opções dos filtros (tipos/locais com anúncio ativo) — alimentam a barra
  // compacta e resolvem os rótulos dos chips/título sem query extra.
  const filtros = await getFiltrosVenda();
  const tipo = tipoId ? filtros.tipos.find((t) => t.id === tipoId) ?? null : null;
  const localSelecionado = (() => {
    if (municipioId != null) {
      const l = filtros.locais.find((l) => l.municipioId === municipioId);
      if (l) {
        return {
          estadoId: l.estadoId, estadoNome: l.estadoNome, uf: l.uf,
          municipioId: l.municipioId, municipioNome: l.municipioNome,
        } satisfies LocalidadeVendaValue;
      }
    }
    if (estadoId != null) {
      const l = filtros.locais.find((l) => l.estadoId === estadoId);
      if (l) {
        return {
          estadoId: l.estadoId, estadoNome: l.estadoNome, uf: l.uf,
          municipioId: null, municipioNome: null,
        } satisfies LocalidadeVendaValue;
      }
    }
    return null;
  })();

  // Busca paginada: a RPC devolve ids ordenados + total; os detalhes vêm por
  // select/embed preservando a ordem (mesmo padrão de /buscar).
  const { data: rpcRows, error: rpcError } = await supabaseAdmin.rpc('buscar_anuncios_venda', {
    p_tipo_id: tipoId,
    p_estado_id: estadoId,
    p_municipio_id: municipioId,
    p_ano_min: anoMin,
    p_ano_max: anoMax,
    p_preco_min: precoMin,
    p_preco_max: precoMax,
    p_limit: POR_PAGINA,
    p_offset: from,
  });

  if (rpcError) {
    console.error('[buscar_anuncios_venda] falha na RPC:', rpcError);
  }

  const rows = rpcRows ?? [];
  const total = rows.length > 0 ? Number(rows[0].total) : 0;
  const ids = rows.map((r) => r.id);

  let anuncios: AnuncioVendaCardData[] = [];
  if (ids.length > 0) {
    const [{ data: detalhes }, { data: precos }] = await Promise.all([
      supabaseAdmin
        .from('anuncio_venda')
        .select(`
          id, fabricante, ano_modelo, ano_fabricacao, preco,
          embarcacao (
            nome, capacidade, comprimento,
            embarcacao_tipo ( nome ),
            municipios ( nome, estados ( uf ) ),
            embarcacao_imagens ( url_imagem, principal )
          )
        `)
        .in('id', ids),
      // Histórico dos anúncios da página: o 2º registro mais recente é o
      // preço anterior (selo "Preço reduzido" quando vigente < anterior).
      supabaseAdmin
        .from('anuncio_venda_preco')
        .select('anuncio_id, preco, created_at')
        .in('anuncio_id', ids)
        .order('created_at', { ascending: false }),
    ]);

    const precoAnterior = new Map<string, number>();
    const vistos = new Map<string, number>();
    for (const p of precos ?? []) {
      const n = (vistos.get(p.anuncio_id) ?? 0) + 1;
      vistos.set(p.anuncio_id, n);
      if (n === 2) precoAnterior.set(p.anuncio_id, Number(p.preco));
    }

    const byId = new Map(
      ((detalhes ?? []) as unknown as AnuncioDetalheRow[]).map((d) => [d.id, d]),
    );
    anuncios = ids.flatMap((id) => {
      const d = byId.get(id);
      if (!d) return [];
      const imgs = d.embarcacao?.embarcacao_imagens ?? [];
      const m = d.embarcacao?.municipios;
      return [{
        id: d.id,
        nome: d.embarcacao?.nome ?? 'Embarcação',
        fabricante: d.fabricante,
        ano_modelo: d.ano_modelo,
        ano_fabricacao: d.ano_fabricacao,
        preco: Number(d.preco),
        precoAnterior: precoAnterior.get(d.id) ?? null,
        tipo: d.embarcacao?.embarcacao_tipo?.nome ?? null,
        localidade: m ? (m.estados ? `${m.nome}, ${m.estados.uf}` : m.nome) : null,
        capacidade: d.embarcacao?.capacidade ?? null,
        comprimento: d.embarcacao?.comprimento != null ? Number(d.embarcacao.comprimento) : null,
        imagem: (imgs.find((i) => i.principal) ?? imgs[0])?.url_imagem ?? null,
      }];
    });
  }

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  // Favoritos do usuário logado entre os resultados (coração preenchido no card).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let favoritosSet = new Set<string>();
  if (user && ids.length > 0) {
    const { data: favs } = await supabaseAdmin
      .from('favorito')
      .select('anuncio_venda_id')
      .eq('user_id', user.id)
      .in('anuncio_venda_id', ids);
    favoritosSet = new Set(
      (favs ?? []).flatMap((f) => (f.anuncio_venda_id ? [f.anuncio_venda_id] : [])),
    );
  }

  // Título contextual
  const sujeito = tipo ? `${tipo.nome} à venda` : 'Embarcações à venda';
  let titulo = sujeito;
  if (localSelecionado) {
    titulo = localSelecionado.municipioNome
      ? `${sujeito} em ${localSelecionado.municipioNome}, ${localSelecionado.uf}`
      : `${sujeito} em ${localSelecionado.estadoNome}`;
  }

  // Chips de filtros ativos
  const anoLabel = anoVendaLabel({ min: params.ano_min ?? '', max: params.ano_max ?? '' });
  const valorLabel = valorVendaLabel({ min: params.preco_min ?? '', max: params.preco_max ?? '' });
  const chips: { label: string; remove: Partial<Record<keyof SearchParams, undefined>> }[] = [];
  if (tipo) chips.push({ label: `Tipo: ${tipo.nome}`, remove: { tipo: undefined } });
  if (localSelecionado) {
    chips.push({
      label: localSelecionado.municipioNome
        ? `${localSelecionado.municipioNome}, ${localSelecionado.uf}`
        : localSelecionado.estadoNome,
      remove: { estado: undefined, cidade: undefined },
    });
  }
  if (anoLabel) chips.push({ label: `Ano: ${anoLabel}`, remove: { ano_min: undefined, ano_max: undefined } });
  if (valorLabel) chips.push({ label: `Valor: ${valorLabel}`, remove: { preco_min: undefined, preco_max: undefined } });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      {/* Search bar section */}
      <div className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <VendasSearchBar
            tipos={filtros.tipos}
            locais={filtros.locais}
            initialTipo={tipo}
            initialLocalidade={localSelecionado}
            initialAno={{ min: params.ano_min ?? '', max: params.ano_max ?? '' }}
            initialValor={{ min: params.preco_min ?? '', max: params.preco_max ?? '' }}
          />
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
        {/* Filters row */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {chips.length > 0 && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-600 border border-slate-300 rounded-full px-3 py-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtros
                <span className="h-4 w-4 rounded-full bg-[#0B2447] text-white text-[10px] font-bold flex items-center justify-center">
                  {chips.length}
                </span>
              </span>
            )}

            {chips.map((chip) => {
              const removeParams: SearchParams = { ...params, ...chip.remove, pagina: undefined };
              return (
                <Link
                  key={chip.label}
                  href={buildPageUrl(removeParams, {})}
                  className="flex items-center gap-1.5 text-sm text-slate-700 bg-white border border-slate-300 rounded-full px-3 py-1.5 hover:bg-slate-50 transition-colors group"
                >
                  {chip.label}
                  <X className="h-3 w-3 text-slate-400 group-hover:text-slate-700 transition-colors" />
                </Link>
              );
            })}
          </div>

          <p className="text-sm text-slate-500 shrink-0">
            {total > 0 ? `${total} resultado${total !== 1 ? 's' : ''}` : 'Nenhum resultado'}
          </p>
        </div>

        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#0B2447]">{titulo}</h1>
          {total > 0 && (
            <p className="text-sm text-slate-500 mt-1">
              Página {pagina} de {totalPaginas} · {total} anúncio{total !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Results grid */}
        {anuncios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <SlidersHorizontal className="h-8 w-8 text-slate-300" />
            </div>
            <h2 className="text-lg font-semibold text-slate-700 mb-2">
              Nenhuma embarcação à venda encontrada
            </h2>
            <p className="text-sm text-slate-400 max-w-sm">
              Tente outro tipo, ampliar a faixa de valor/ano ou explorar outras localidades.
            </p>
            {chips.length > 0 && (
              <Link
                href="/vendas"
                className="mt-6 px-5 py-2.5 bg-[#0B3D91] hover:bg-[#0B2447] text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Limpar filtros
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {anuncios.map((a) => (
              <AnuncioVendaCard key={a.id} anuncio={a} initialFavorito={favoritosSet.has(a.id)} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPaginas > 1 && (
          <div className="mt-12 flex items-center justify-center gap-1">
            {pagina > 1 && (
              <Link
                href={buildPageUrl(params, { pagina: String(pagina - 1) })}
                className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-white hover:shadow-sm transition-all text-sm"
              >
                ‹
              </Link>
            )}

            {getPageNumbers(pagina, totalPaginas).map((n, i) =>
              n === '…' ? (
                <span key={`e-${i}`} className="h-9 w-9 flex items-center justify-center text-sm text-slate-400">
                  …
                </span>
              ) : (
                <Link
                  key={n}
                  href={buildPageUrl(params, { pagina: String(n) })}
                  className={`h-9 w-9 flex items-center justify-center rounded-xl text-sm font-semibold transition-all ${
                    n === pagina
                      ? 'bg-[#0B2447] text-white shadow-md'
                      : 'border border-slate-200 text-slate-600 hover:bg-white hover:shadow-sm'
                  }`}
                >
                  {n}
                </Link>
              ),
            )}

            {pagina < totalPaginas && (
              <Link
                href={buildPageUrl(params, { pagina: String(pagina + 1) })}
                className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-white hover:shadow-sm transition-all text-sm"
              >
                ›
              </Link>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
