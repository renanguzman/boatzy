import { notFound } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import EmbarcacaoDetalheView, { type EmbarcacaoDetalheDados } from '../_components/EmbarcacaoDetalheView';
import { type RoteiroCarouselItem } from '@/components/ui/RoteirosCarousel';
import { type RoteiroCardData } from '@/app/buscar/_components/RoteiroCard';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { getAvaliacoesResumoPorRoteiro } from '@/lib/avaliacoes';
import { precoNaDataDeLinha, type PrecoNaData } from '@/lib/precos-roteiro';

const ROTEIRO_SELECT = `id, nome, descricao, quantidade_pessoas, preco_minimo_cliente, preco_minimo_modelo,
   duracao, duracao_horas,
   municipios ( nome, estados ( uf ) ),
   roteiro_imagens ( url_imagem, principal ),
   embarcacao ( embarcacao_tipo ( nome ) )`;

export default async function RoteirosDaEmbarcacaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ voltar?: string; data?: string; flex?: string; pessoas?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const voltarHref = sp.voltar ? decodeURIComponent(sp.voltar) : '/buscar?tipo=embarcacao';

  // Filtros vindos da busca (data ± flex, pessoas): os cards mostram o preço na
  // data e levam esses filtros ao detalhe do roteiro — mesmo comportamento da busca.
  const dataBusca = sp.data && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : null;
  const flex = Math.max(0, parseInt(sp.flex ?? '0') || 0);
  const pessoas = Math.max(0, parseInt(sp.pessoas ?? '0') || 0);
  const query = (() => {
    const q = new URLSearchParams();
    if (dataBusca) q.set('data', dataBusca);
    if (flex > 0) q.set('flex', String(flex));
    if (pessoas > 0) q.set('pessoas', String(pessoas));
    return q.toString();
  })();

  const { data, error } = await supabaseAdmin
    .from('embarcacao')
    .select(`
      id, owner_id, nome, descricao, capacidade, comprimento, comprimento_unidade, quartos, banheiros, tripulacao, regras,
      embarcacao_tipo ( nome ),
      municipios ( nome, estados ( uf ) ),
      embarcacao_comodidades ( comodidade ( nome ) ),
      embarcacao_equipamentos_seguranca ( equipamentos_seguranca ( nome ) ),
      embarcacao_acessorios ( acessorios ( nome ) ),
      embarcacao_imagens ( id, url_imagem, titulo, principal, ordem )
    `)
    .eq('id', id)
    .eq('status', 'ativo')
    .single();

  if (error || !data) notFound();

  const embarcacao = data as unknown as EmbarcacaoDetalheDados & { owner_id: string };

  const { data: roteirosData, error: roteirosError } = await supabaseAdmin
    .from('roteiro')
    .select(ROTEIRO_SELECT)
    .eq('embarcacao_id', id)
    .eq('ativo', true)
    .order('created_at', { ascending: false });

  if (roteirosError) {
    console.error('[embarcacoes/[id]/roteiros] falha ao buscar roteiros:', roteirosError);
  }
  const todosRoteiros = (roteirosData ?? []) as unknown as RoteiroCardData[];
  const roteiroIds = todosRoteiros.map((r) => r.id);

  // Preço de cada roteiro na data da busca (mesma função da busca). Os que não
  // têm dia reservável no intervalo mostram o "a partir de" e vão para o fim.
  const precoNaDataPorId = new Map<string, PrecoNaData>();
  if (dataBusca) {
    const linhas = await Promise.all(
      roteiroIds.map((roteiroId) =>
        supabaseAdmin.rpc('roteiro_preco_exibicao', { p_roteiro_id: roteiroId, p_data: dataBusca, p_flex: flex }),
      ),
    );
    linhas.forEach(({ data: linha, error: erroPreco }, i) => {
      if (erroPreco) console.error('[embarcacoes/[id]/roteiros] falha no preço na data:', erroPreco);
      const preco = precoNaDataDeLinha(linha?.[0]);
      if (preco) precoNaDataPorId.set(roteiroIds[i], preco);
    });
  }
  const roteiros = dataBusca
    ? [...todosRoteiros.filter((r) => precoNaDataPorId.has(r.id)), ...todosRoteiros.filter((r) => !precoNaDataPorId.has(r.id))]
    : todosRoteiros;

  const avaliacoesResumo = await getAvaliacoesResumoPorRoteiro(roteiroIds);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let favoritosSet = new Set<string>();
  if (user && roteiroIds.length > 0) {
    const { data: favs } = await supabaseAdmin
      .from('favorito')
      .select('roteiro_id')
      .eq('user_id', user.id)
      .in('roteiro_id', roteiroIds);
    favoritosSet = new Set((favs ?? []).flatMap((f) => (f.roteiro_id ? [f.roteiro_id] : [])));
  }

  const carouselItems: RoteiroCarouselItem[] = roteiros.map((roteiro) => ({
    roteiro,
    initialFavorito: favoritosSet.has(roteiro.id),
    avaliacaoResumo: avaliacoesResumo.get(roteiro.id) ?? null,
    precoNaData: precoNaDataPorId.get(roteiro.id) ?? null,
  }));

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <EmbarcacaoDetalheView
        embarcacao={embarcacao}
        roteiros={carouselItems}
        query={query}
        voltarHref={voltarHref}
        ehDono={user?.id === embarcacao.owner_id}
      />

      <Footer />
    </div>
  );
}
