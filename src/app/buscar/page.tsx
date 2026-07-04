import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { getTiposEmbarcacaoComRoteiro } from '@/lib/tipos-embarcacao';
import { getAvaliacoesResumoPorRoteiro } from '@/lib/avaliacoes';
import SearchBarCompact from './_components/SearchBarCompact';
import RoteiroCard, { type RoteiroCardData } from './_components/RoteiroCard';
import Link from 'next/link';
import { SlidersHorizontal, X } from 'lucide-react';

const POR_PAGINA = 24;

type SearchParams = {
  municipio?: string;
  local?: string;
  lat?: string;
  lng?: string;
  data?: string;
  flex?: string;
  pessoas?: string;
  pagina?: string;
  /** Aba ativa da busca ('embarcacao' exibe o seletor de tipo). */
  tipo?: string;
  /** Filtro por tipo da embarcação vinculada ao roteiro (uuid de embarcacao_tipo). */
  tipo_embarcacao?: string;
  /** Rótulo do tipo para chip/título (evita query extra). */
  tipo_nome?: string;
};

function buildPageUrl(current: SearchParams, overrides: Partial<SearchParams & { pagina: string }>) {
  const merged = { ...current, ...overrides };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v != null && v !== '') params.set(k, v);
  }
  return `/buscar?${params.toString()}`;
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

export default async function BuscarPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  const RAIO_KM = 50;

  const municipioId = params.municipio ? parseInt(params.municipio) : null;
  const lat = params.lat ? parseFloat(params.lat) : null;
  const lng = params.lng ? parseFloat(params.lng) : null;
  const pessoas = params.pessoas ? parseInt(params.pessoas) : 0;
  const pagina = params.pagina ? Math.max(1, parseInt(params.pagina)) : 1;
  const flex = params.flex ? parseInt(params.flex) : 0;
  const from = (pagina - 1) * POR_PAGINA;
  const tipoEmbarcacaoId = params.tipo_embarcacao || null;
  const abaEmbarcacao = params.tipo === 'embarcacao' || tipoEmbarcacaoId != null;

  // Tipos com roteiro ativo vinculado — alimentam o seletor da aba "Embarcações".
  const tiposEmbarcacao = await getTiposEmbarcacaoComRoteiro();

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
  });

  // Não silenciar falhas da RPC: um erro aqui deixa a busca vazia sem motivo
  // aparente. Logamos para diagnóstico em vez de mostrar "nenhum resultado".
  if (rpcError) {
    console.error('[buscar_roteiros] falha na RPC:', rpcError);
  }

  const rows = rpcRows ?? [];
  const total = rows.length > 0 ? Number(rows[0].total) : 0;
  const ids = rows.map((r) => r.id);

  // Busca os detalhes (com joins) preservando a ordem retornada pela RPC.
  let roteiros: RoteiroCardData[] = [];
  if (ids.length > 0) {
    const { data: detalhes } = await supabaseAdmin
      .from('roteiro')
      .select(
        `id, nome, descricao, quantidade_pessoas, preco_base, duracao,
         municipios ( nome, estados ( uf ) ),
         roteiro_imagens ( url_imagem, principal ),
         embarcacao ( embarcacao_tipo ( nome ) )`,
      )
      .in('id', ids);

    const byId = new Map((detalhes ?? []).map((d) => [d.id, d]));
    roteiros = ids
      .map((id) => byId.get(id))
      .filter((d): d is NonNullable<typeof d> => d != null) as unknown as RoteiroCardData[];
  }

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  // Média/total de avaliações por roteiro listado (exibida no card quando houver).
  const avaliacoesResumo = await getAvaliacoesResumoPorRoteiro(ids);

  // Favoritos do usuário logado entre os resultados (coração preenchido no card).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let favoritosSet = new Set<string>();
  if (user && ids.length > 0) {
    const { data: favs } = await supabaseAdmin
      .from('favorito')
      .select('roteiro_id')
      .eq('user_id', user.id)
      .in('roteiro_id', ids);
    favoritosSet = new Set((favs ?? []).map((f) => f.roteiro_id));
  }

  // Querystring repassada ao detalhe do roteiro para pré-preencher data/pessoas.
  const detalheQuery = (() => {
    const sp = new URLSearchParams();
    if (params.data) sp.set('data', params.data);
    if (flex > 0) sp.set('flex', String(flex));
    if (pessoas > 0) sp.set('pessoas', String(pessoas));
    return sp.toString();
  })();

  // Resolve municipio name for initial state
  let initialLocation: { id: number; nome: string; uf: string } | null = null;
  if (municipioId && params.local) {
    const [nome, uf] = params.local.split(', ');
    initialLocation = { id: municipioId, nome, uf: uf ?? '' };
  }

  // Build page title
  const tipoNome = tipoEmbarcacaoId ? params.tipo_nome : undefined;
  const sujeito = tipoNome ? `Roteiros com ${tipoNome}` : 'Roteiros';
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

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      {/* Search bar section */}
      <div className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <SearchBarCompact
            initialLocation={initialLocation}
            initialDate={params.data ? { date: params.data, flex } : null}
            initialGuests={pessoas}
            tipo={abaEmbarcacao ? 'embarcacao' : 'roteiro'}
            tiposEmbarcacao={tiposEmbarcacao}
            initialTipoEmbarcacao={
              tipoEmbarcacaoId && tipoNome ? { id: tipoEmbarcacaoId, nome: tipoNome } : null
            }
          />
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
        {/* Filters row */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {chips.length > 0 && (
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm font-medium text-slate-600 border border-slate-300 rounded-full px-3 py-1.5 hover:bg-slate-50 transition-colors"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtros
                <span className="h-4 w-4 rounded-full bg-[#0B2447] text-white text-[10px] font-bold flex items-center justify-center">
                  {chips.length}
                </span>
              </button>
            )}

            {chips.map((chip) => {
              const removeParams = { ...params };
              if (chip.removeKey === 'local_municipio') {
                delete removeParams.local;
                delete removeParams.municipio;
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

          <p className="text-sm text-slate-500 shrink-0">
            {total > 0
              ? `${total} resultado${total !== 1 ? 's' : ''}`
              : 'Nenhum resultado'}
          </p>
        </div>

        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#0B2447]">{titulo}</h1>
          {total > 0 && (
            <p className="text-sm text-slate-500 mt-1">
              Página {pagina} de {totalPaginas} · {total} roteiro{total !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Results grid */}
        {roteiros.length === 0 ? (
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
            <div className="mt-6 flex items-center gap-3">
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
                initialFavorito={favoritosSet.has(r.id)}
                avaliacaoResumo={avaliacoesResumo.get(r.id) ?? null}
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
      </main>

      <Footer />
    </div>
  );
}
