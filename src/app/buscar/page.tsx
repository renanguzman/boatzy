import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { getTiposEmbarcacaoComRoteiro } from '@/lib/tipos-embarcacao';
import { getTodasComodidades } from '@/lib/comodidades';
import { getAvaliacoesResumoPorRoteiro, getAvaliacoesResumoPorEmbarcacao } from '@/lib/avaliacoes';
import { getFavoritosEmbarcacaoSet } from '@/lib/embarcacoes-top';
import SearchBarCompact from './_components/SearchBarCompact';
import RoteiroCard, { type RoteiroCardData } from './_components/RoteiroCard';
import FiltrosAvancados from './_components/FiltrosAvancados';
import ComodidadesFiltro from './_components/ComodidadesFiltro';
import OrdenarSelect from './_components/OrdenarSelect';
import MapaResultados, { type PontoMapa } from './_components/MapaResultados';
import EmbarcacaoCard, { type EmbarcacaoCardData } from '@/components/ui/EmbarcacaoCard';
import Link from 'next/link';
import { SlidersHorizontal, X } from 'lucide-react';
import { faixaDuracaoLabel, faixaPrecoLabel } from '@/lib/duracao';
import {
  buildBuscarUrl,
  contarFiltrosAvancados,
  normalizarOrdenacao,
  parseComodidadeIds,
  parseNumeroPositivo,
  type BuscaSearchParams as SearchParams,
} from './_lib/filtros';

const POR_PAGINA = 24;
const RAIO_KM = 50;

function buildPageUrl(current: SearchParams, overrides: Partial<SearchParams & { pagina: string }>) {
  return buildBuscarUrl(current, overrides);
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

type EmbarcacaoDetalheRow = {
  id: string;
  nome: string;
  preco_base: number | null;
  capacidade: number | null;
  latitude: number | null;
  longitude: number | null;
  embarcacao_tipo: { nome: string } | null;
  municipios: { nome: string; estados: { uf: string } | null } | null;
  embarcacao_imagens: { url_imagem: string; principal: boolean }[];
};

/** Linha de `roteiro` com o que o card usa + o que o mapa precisa. */
type RoteiroDetalheRow = RoteiroCardData & {
  latitude: number | null;
  longitude: number | null;
  embarcacao: { nome: string; embarcacao_tipo: { nome: string } | null } | null;
};

function localidadeDe(m: { nome: string; estados: { uf: string } | null } | null): string | null {
  if (!m) return null;
  return m.estados ? `${m.nome}, ${m.estados.uf}` : m.nome;
}

/** Só entram no mapa os resultados com coordenada cadastrada. */
function temCoordenada(lat: number | null, lng: number | null): boolean {
  return lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

function mapEmbarcacaoRow(d: EmbarcacaoDetalheRow): EmbarcacaoCardData {
  const imagem = (d.embarcacao_imagens.find((i) => i.principal) ?? d.embarcacao_imagens[0])?.url_imagem ?? null;
  const localidade = localidadeDe(d.municipios);
  return {
    id: d.id,
    nome: d.nome,
    preco_base: d.preco_base,
    capacidade: d.capacidade,
    tipo: d.embarcacao_tipo?.nome ?? null,
    localidade,
    imagem,
  };
}

const ROTEIRO_SELECT = `id, nome, descricao, quantidade_pessoas, preco_base, duracao, latitude, longitude,
   municipios ( nome, estados ( uf ) ),
   roteiro_imagens ( url_imagem, principal ),
   embarcacao ( nome, embarcacao_tipo ( nome ) )`;

export default async function BuscarPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  const municipioId = params.municipio ? parseInt(params.municipio) : null;
  const lat = params.lat ? parseFloat(params.lat) : null;
  const lng = params.lng ? parseFloat(params.lng) : null;
  const pessoas = params.pessoas ? parseInt(params.pessoas) : 0;
  const pagina = params.pagina ? Math.max(1, parseInt(params.pagina)) : 1;
  const flex = params.flex ? parseInt(params.flex) : 0;
  const from = (pagina - 1) * POR_PAGINA;
  const tipoEmbarcacaoId = params.tipo_embarcacao || null;
  const abaEmbarcacao = params.tipo === 'embarcacao' || tipoEmbarcacaoId != null;

  // Filtros avançados (faixa de preço e de duração) + ordenação escolhida.
  // Tudo resolvido no banco pelas RPCs — a paginação continua server-side.
  const precoMin = parseNumeroPositivo(params.preco_min);
  const precoMax = parseNumeroPositivo(params.preco_max);
  const duracaoMin = parseNumeroPositivo(params.duracao_min);
  const duracaoMax = parseNumeroPositivo(params.duracao_max);
  const ordenar = normalizarOrdenacao(params.ordenar);
  // Comodidades: só filtra a busca de embarcações (é um atributo da embarcação).
  const comodidadeIds = parseComodidadeIds(params.comodidades);

  // Dois modos dentro da mesma página:
  //  - roteiro (default): busca de roteiros, como sempre foi.
  //  - lista de embarcações: aba "Embarcações" — mostra as embarcações que
  //    atendem o critério (com foto); clicar leva para /embarcacoes/[id]/roteiros,
  //    que mostra a embarcação em detalhe + o carrossel dos roteiros ativos dela.
  const modoListaEmbarcacoes = abaEmbarcacao;

  // Tipos com roteiro ativo vinculado — alimentam o seletor da aba "Embarcações".
  const tiposEmbarcacao = await getTiposEmbarcacaoComRoteiro();
  // Comodidades — só usadas (buscadas e exibidas) na aba "Embarcações".
  const comodidades = modoListaEmbarcacoes ? await getTodasComodidades() : [];

  let roteiros: RoteiroCardData[] = [];
  let embarcacoes: EmbarcacaoCardData[] = [];
  let total = 0;
  let ids: string[] = [];
  // Linhas cruas (com coordenadas) da página atual — alimentam o mapa abaixo
  // do grid, que é montado depois porque depende dos hrefs dos cards.
  let roteirosRows: RoteiroDetalheRow[] = [];
  let embarcacoesRows: EmbarcacaoDetalheRow[] = [];

  if (modoListaEmbarcacoes) {
    const { data: rpcRows, error: rpcError } = await supabaseAdmin.rpc('buscar_embarcacoes', {
      p_municipio_id: municipioId,
      p_lat: lat,
      p_lng: lng,
      p_raio_km: RAIO_KM,
      p_data: params.data ?? null,
      p_flex: flex,
      p_pessoas: pessoas,
      p_limit: POR_PAGINA,
      p_offset: from,
      p_tipo_id: tipoEmbarcacaoId,
      p_preco_min: precoMin,
      p_preco_max: precoMax,
      p_duracao_min: duracaoMin,
      p_duracao_max: duracaoMax,
      p_ordenar: ordenar,
      p_comodidade_ids: comodidadeIds.length > 0 ? comodidadeIds : null,
    });

    if (rpcError) {
      console.error('[buscar_embarcacoes] falha na RPC:', rpcError);
    }

    const rows = rpcRows ?? [];
    total = rows.length > 0 ? Number(rows[0].total) : 0;
    ids = rows.map((r) => r.id);

    if (ids.length > 0) {
      const { data: detalhes } = await supabaseAdmin
        .from('embarcacao')
        .select(
          `id, nome, preco_base, capacidade, latitude, longitude,
           embarcacao_tipo ( nome ),
           municipios ( nome, estados ( uf ) ),
           embarcacao_imagens ( url_imagem, principal )`,
        )
        .in('id', ids);

      const byId = new Map((detalhes ?? []).map((d) => [d.id, d as unknown as EmbarcacaoDetalheRow]));
      embarcacoesRows = ids.flatMap((id) => {
        const d = byId.get(id);
        return d ? [d] : [];
      });
      embarcacoes = embarcacoesRows.map(mapEmbarcacaoRow);
    }
  } else {
    // Resolve filtros (localização/raio + disponibilidade na data + capacidade da
    // embarcação vinculada) e ordenação por proximidade no banco, retornando ids
    // ordenados + total (paginação).
    const { data: rpcRows, error: rpcError } = await supabaseAdmin.rpc('buscar_roteiros', {
      p_municipio_id: municipioId,
      p_lat: lat,
      p_lng: lng,
      p_raio_km: RAIO_KM,
      p_data: params.data ?? null,
      p_flex: flex,
      p_pessoas: pessoas,
      p_limit: POR_PAGINA,
      p_offset: from,
      p_tipo_id: tipoEmbarcacaoId,
      p_preco_min: precoMin,
      p_preco_max: precoMax,
      p_duracao_min: duracaoMin,
      p_duracao_max: duracaoMax,
      p_ordenar: ordenar,
    });

    // Não silenciar falhas da RPC: um erro aqui deixa a busca vazia sem motivo
    // aparente. Logamos para diagnóstico em vez de mostrar "nenhum resultado".
    if (rpcError) {
      console.error('[buscar_roteiros] falha na RPC:', rpcError);
    }

    const rows = rpcRows ?? [];
    total = rows.length > 0 ? Number(rows[0].total) : 0;
    ids = rows.map((r) => r.id);

    // Busca os detalhes (com joins) preservando a ordem retornada pela RPC.
    if (ids.length > 0) {
      const { data: detalhes } = await supabaseAdmin.from('roteiro').select(ROTEIRO_SELECT).in('id', ids);

      const byId = new Map((detalhes ?? []).map((d) => [d.id, d]));
      roteirosRows = ids
        .map((id) => byId.get(id))
        .filter((d): d is NonNullable<typeof d> => d != null) as unknown as RoteiroDetalheRow[];
      roteiros = roteirosRows;
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  // Favoritos do usuário logado + avaliações entre os resultados.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const avaliacoesResumoRoteiro = modoListaEmbarcacoes
    ? new Map<string, { media: number; total: number }>()
    : await getAvaliacoesResumoPorRoteiro(ids);
  const avaliacoesResumoEmbarcacao = modoListaEmbarcacoes
    ? await getAvaliacoesResumoPorEmbarcacao(ids)
    : new Map<string, { media: number; total: number }>();

  let favoritosRoteiroSet = new Set<string>();
  let favoritosEmbarcacaoSet = new Set<string>();
  if (user && ids.length > 0) {
    if (modoListaEmbarcacoes) {
      favoritosEmbarcacaoSet = await getFavoritosEmbarcacaoSet(user.id, ids);
    } else {
      const { data: favs } = await supabaseAdmin
        .from('favorito')
        .select('roteiro_id')
        .eq('user_id', user.id)
        .in('roteiro_id', ids);
      favoritosRoteiroSet = new Set((favs ?? []).flatMap((f) => (f.roteiro_id ? [f.roteiro_id] : [])));
    }
  }

  // Querystring repassada ao detalhe do roteiro para pré-preencher data/pessoas.
  const detalheQuery = (() => {
    const sp = new URLSearchParams();
    if (params.data) sp.set('data', params.data);
    if (flex > 0) sp.set('flex', String(flex));
    if (pessoas > 0) sp.set('pessoas', String(pessoas));
    return sp.toString();
  })();

  // Pontos do mapa (mesma página de resultados, mesmos hrefs dos cards).
  // Itens sem coordenada cadastrada simplesmente não entram — o cabeçalho do
  // mapa informa "X de Y com localização".
  const voltarParaBusca = encodeURIComponent(buildBuscarUrl(params, {}));
  const pontosMapa: PontoMapa[] = modoListaEmbarcacoes
    ? embarcacoesRows.flatMap((d) =>
        temCoordenada(d.latitude, d.longitude)
          ? [
              {
                id: d.id,
                nome: d.nome,
                lat: Number(d.latitude),
                lng: Number(d.longitude),
                href: `/embarcacoes/${d.id}/roteiros?voltar=${voltarParaBusca}`,
                subtitulo: d.embarcacao_tipo?.nome ?? null,
                localidade: localidadeDe(d.municipios),
                preco: d.preco_base,
                imagem:
                  (d.embarcacao_imagens.find((i) => i.principal) ?? d.embarcacao_imagens[0])
                    ?.url_imagem ?? null,
              },
            ]
          : [],
      )
    : roteirosRows.flatMap((d) =>
        temCoordenada(d.latitude, d.longitude)
          ? [
              {
                id: d.id,
                nome: d.nome,
                lat: Number(d.latitude),
                lng: Number(d.longitude),
                href: detalheQuery ? `/roteiros/${d.id}?${detalheQuery}` : `/roteiros/${d.id}`,
                subtitulo: d.embarcacao?.nome ?? null,
                localidade: localidadeDe(d.municipios),
                preco: d.preco_base,
                imagem:
                  (d.roteiro_imagens.find((i) => i.principal) ?? d.roteiro_imagens[0])?.url_imagem ??
                  null,
              },
            ]
          : [],
      );

  // Resolve municipio name for initial state
  let initialLocation: { id: number; nome: string; uf: string } | null = null;
  if (municipioId && params.local) {
    const [nome, uf] = params.local.split(', ');
    initialLocation = { id: municipioId, nome, uf: uf ?? '' };
  }

  const tipoNome = tipoEmbarcacaoId ? params.tipo_nome : undefined;

  // Build page title
  const sujeito = modoListaEmbarcacoes
    ? tipoNome
      ? `Embarcações com ${tipoNome}`
      : 'Embarcações'
    : tipoNome
      ? `Roteiros com ${tipoNome}`
      : 'Roteiros';
  let titulo = `${sujeito} disponíveis`;
  if (params.local) {
    titulo = `${sujeito} em ${params.local}`;
  } else if (params.lat && params.lng) {
    titulo = `${sujeito} próximos a você`;
  }

  // Active filter chips
  const chips: { label: string; removeKey: string }[] = [];
  if (tipoNome) {
    chips.push({ label: `Tipo: ${tipoNome}`, removeKey: 'tipo_embarcacao' });
  }
  if (params.local && params.municipio) {
    chips.push({ label: params.local, removeKey: 'local_municipio' });
  }
  if (params.data) {
    const dateLabel = new Date(params.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    chips.push({ label: flex > 0 ? `${dateLabel} ± ${flex} dia${flex > 1 ? 's' : ''}` : dateLabel, removeKey: 'data' });
  }
  if (pessoas > 0) {
    chips.push({ label: `Grupo: ${pessoas} ${pessoas === 1 ? 'pessoa' : 'pessoas'}`, removeKey: 'pessoas' });
  }
  const precoLabel = faixaPrecoLabel(precoMin, precoMax);
  if (precoLabel) {
    chips.push({ label: `Preço: ${precoLabel}`, removeKey: 'preco' });
  }
  const duracaoLabel = faixaDuracaoLabel(duracaoMin, duracaoMax);
  if (duracaoLabel) {
    chips.push({ label: `Duração: ${duracaoLabel}`, removeKey: 'duracao' });
  }
  if (comodidadeIds.length > 0) {
    chips.push({
      label: `Comodidades: ${comodidadeIds.length}`,
      removeKey: 'comodidades',
    });
  }

  const filtrosAvancadosAtivos = contarFiltrosAvancados(params);

  // Saída do estado vazio quando preço/duração é que zeraram o resultado.
  const semFiltrosAvancadosHref = buildBuscarUrl(params, {
    preco_min: null,
    preco_max: null,
    duracao_min: null,
    duracao_max: null,
    comodidades: null,
    pagina: null,
  });

  const itemLabel = modoListaEmbarcacoes ? 'embarcação' : 'roteiro';
  const itemLabelPlural = modoListaEmbarcacoes ? 'embarcações' : 'roteiros';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      {/* Search bar section */}
      <div className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-center gap-4">
          <SearchBarCompact
            initialLocation={initialLocation}
            initialDate={params.data ? { date: params.data, flex } : null}
            initialGuests={pessoas}
            tipo={abaEmbarcacao ? 'embarcacao' : 'roteiro'}
            tiposEmbarcacao={tiposEmbarcacao}
            initialTipoEmbarcacao={
              tipoEmbarcacaoId && tipoNome ? { id: tipoEmbarcacaoId, nome: tipoNome } : null
            }
            filtrosPreservados={{
              ...(params.preco_min ? { preco_min: params.preco_min } : {}),
              ...(params.preco_max ? { preco_max: params.preco_max } : {}),
              ...(params.duracao_min ? { duracao_min: params.duracao_min } : {}),
              ...(params.duracao_max ? { duracao_max: params.duracao_max } : {}),
              ...(params.comodidades ? { comodidades: params.comodidades } : {}),
              ...(params.ordenar ? { ordenar: params.ordenar } : {}),
            }}
          />
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
        {/* Filters row */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <FiltrosAvancados params={params} ativos={filtrosAvancadosAtivos} />
            {modoListaEmbarcacoes && (
              <ComodidadesFiltro params={params} comodidades={comodidades} />
            )}

            {chips.map((chip) => {
              const removeParams = { ...params };
              if (chip.removeKey === 'local_municipio') {
                delete removeParams.local;
                delete removeParams.municipio;
              } else if (chip.removeKey === 'preco') {
                delete removeParams.preco_min;
                delete removeParams.preco_max;
              } else if (chip.removeKey === 'duracao') {
                delete removeParams.duracao_min;
                delete removeParams.duracao_max;
              } else {
                delete removeParams[chip.removeKey as keyof SearchParams];
                if (chip.removeKey === 'data') delete removeParams.flex;
                // Remover o tipo mantém a aba "Embarcações" ativa (param tipo).
                if (chip.removeKey === 'tipo_embarcacao') delete removeParams.tipo_nome;
              }
              delete removeParams.pagina;
              const removeHref = buildPageUrl(removeParams, {});

              return (
                <Link
                  key={chip.label}
                  href={removeHref}
                  className="flex items-center gap-1.5 text-sm text-slate-700 bg-white border border-slate-300 rounded-full px-3 py-1.5 hover:bg-slate-50 transition-colors group"
                >
                  {chip.label}
                  <X className="h-3 w-3 text-slate-400 group-hover:text-slate-700 transition-colors" />
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <OrdenarSelect params={params} valor={ordenar} />
            <p className="text-sm text-slate-500 shrink-0">
              {total > 0
                ? `${total} resultado${total !== 1 ? 's' : ''}`
                : 'Nenhum resultado'}
            </p>
          </div>
        </div>

        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#0B2447]">{titulo}</h1>
          {total > 0 && (
            <p className="text-sm text-slate-500 mt-1">
              Página {pagina} de {totalPaginas} · {total} {total !== 1 ? itemLabelPlural : itemLabel}
            </p>
          )}
        </div>

        {/* Results grid */}
        {modoListaEmbarcacoes ? (
          embarcacoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <SlidersHorizontal className="h-8 w-8 text-slate-300" />
              </div>
              <h2 className="text-lg font-semibold text-slate-700 mb-2">
                {tipoNome ? `Nenhuma embarcação com ${tipoNome} encontrada` : 'Nenhuma embarcação encontrada'}
              </h2>
              <p className="text-sm text-slate-400 max-w-sm">
                {tipoNome
                  ? 'Tente outro tipo de embarcação, ajustar os filtros ou explorar outros destinos.'
                  : 'Tente ajustar os filtros ou explorar outros destinos.'}
              </p>
              <div className="mt-6 flex items-center gap-3 flex-wrap justify-center">
                {(filtrosAvancadosAtivos > 0 || comodidadeIds.length > 0) && (
                  <Link
                    href={semFiltrosAvancadosHref}
                    className="px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    {comodidadeIds.length > 0 ? 'Limpar filtros' : 'Limpar preço e duração'}
                  </Link>
                )}
                {tipoNome && (
                  <Link
                    href={buildPageUrl(
                      (() => {
                        const semTipo = { ...params };
                        delete semTipo.tipo_embarcacao;
                        delete semTipo.tipo_nome;
                        delete semTipo.pagina;
                        return semTipo;
                      })(),
                      {},
                    )}
                    className="px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    Limpar filtro de tipo
                  </Link>
                )}
                <Link
                  href="/buscar?tipo=embarcacao"
                  className="px-5 py-2.5 bg-[#0B3D91] hover:bg-[#0B2447] text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Ver todas as embarcações
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {embarcacoes.map((e) => (
                <EmbarcacaoCard
                  key={e.id}
                  embarcacao={e}
                  initialFavorito={favoritosEmbarcacaoSet.has(e.id)}
                  avaliacaoResumo={avaliacoesResumoEmbarcacao.get(e.id) ?? null}
                  href={`/embarcacoes/${e.id}/roteiros?voltar=${encodeURIComponent(buildPageUrl(params, {}))}`}
                />
              ))}
            </div>
          )
        ) : roteiros.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <SlidersHorizontal className="h-8 w-8 text-slate-300" />
            </div>
            <h2 className="text-lg font-semibold text-slate-700 mb-2">
              {tipoNome ? `Nenhum roteiro com ${tipoNome} encontrado` : 'Nenhum roteiro encontrado'}
            </h2>
            <p className="text-sm text-slate-400 max-w-sm">
              {tipoNome
                ? 'Tente outro tipo de embarcação, ajustar os filtros ou explorar outros destinos.'
                : 'Tente ajustar os filtros ou explorar outros destinos.'}
            </p>
            <div className="mt-6 flex items-center gap-3 flex-wrap justify-center">
              {filtrosAvancadosAtivos > 0 && (
                <Link
                  href={semFiltrosAvancadosHref}
                  className="px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Limpar preço e duração
                </Link>
              )}
              {tipoNome && (
                <Link
                  href={buildPageUrl(
                    (() => {
                      const semTipo = { ...params };
                      delete semTipo.tipo_embarcacao;
                      delete semTipo.tipo_nome;
                      delete semTipo.pagina;
                      return semTipo;
                    })(),
                    {},
                  )}
                  className="px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Limpar filtro de tipo
                </Link>
              )}
              <Link
                href="/buscar"
                className="px-5 py-2.5 bg-[#0B3D91] hover:bg-[#0B2447] text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Ver todos os roteiros
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {roteiros.map((r) => (
              <RoteiroCard
                key={r.id}
                roteiro={r}
                query={detalheQuery}
                initialFavorito={favoritosRoteiroSet.has(r.id)}
                avaliacaoResumo={avaliacoesResumoRoteiro.get(r.id) ?? null}
              />
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

        {/* Mapa dos resultados desta página */}
        <MapaResultados
          pontos={pontosMapa}
          totalResultados={modoListaEmbarcacoes ? embarcacoes.length : roteiros.length}
          itemLabelPlural={itemLabelPlural}
        />
      </main>

      <Footer />
    </div>
  );
}
