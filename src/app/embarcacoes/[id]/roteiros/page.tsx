import { notFound } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import GaleriaRoteiro from '../../../roteiros/[id]/_components/GaleriaRoteiro';
import EmbarcacaoInfoSection, { type EmbarcacaoInfo } from '../_components/EmbarcacaoInfoSection';
import RoteirosCarousel, { type RoteiroCarouselItem } from '@/components/ui/RoteirosCarousel';
import { type RoteiroCardData } from '@/app/buscar/_components/RoteiroCard';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { getAvaliacoesResumoPorRoteiro } from '@/lib/avaliacoes';

type EmbarcacaoDetalhe = EmbarcacaoInfo & {
  id: string;
  embarcacao_imagens: { id: string; url_imagem: string; titulo: string | null; principal: boolean }[];
};

const ROTEIRO_SELECT = `id, nome, descricao, quantidade_pessoas, preco_base, duracao,
   municipios ( nome, estados ( uf ) ),
   roteiro_imagens ( url_imagem, principal ),
   embarcacao ( embarcacao_tipo ( nome ) )`;

export default async function RoteirosDaEmbarcacaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ voltar?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const voltarHref = sp.voltar ? decodeURIComponent(sp.voltar) : '/buscar?tipo=embarcacao';

  const { data, error } = await supabaseAdmin
    .from('embarcacao')
    .select(`
      id, nome, descricao, capacidade, comprimento, cabines, suites, banheiros, tripulacao,
      embarcacao_tipo ( nome ),
      embarcacao_categoria ( nome ),
      municipios ( nome, estados ( uf ) ),
      embarcacao_comodidades ( comodidade ( nome ) ),
      embarcacao_imagens ( id, url_imagem, titulo, principal )
    `)
    .eq('id', id)
    .eq('status', 'ativo')
    .single();

  if (error || !data) notFound();

  const embarcacao = data as unknown as EmbarcacaoDetalhe;

  const images = [...embarcacao.embarcacao_imagens].sort((a, b) =>
    a.principal === b.principal ? 0 : a.principal ? -1 : 1,
  );

  const { data: roteirosData, error: roteirosError } = await supabaseAdmin
    .from('roteiro')
    .select(ROTEIRO_SELECT)
    .eq('embarcacao_id', id)
    .eq('ativo', true)
    .order('created_at', { ascending: false });

  if (roteirosError) {
    console.error('[embarcacoes/[id]/roteiros] falha ao buscar roteiros:', roteirosError);
  }
  const roteiros = (roteirosData ?? []) as unknown as RoteiroCardData[];
  const roteiroIds = roteiros.map((r) => r.id);

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
  }));

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <GaleriaRoteiro images={images} nome={embarcacao.nome} voltarHref={voltarHref} />

      <section className="pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <EmbarcacaoInfoSection embarcacao={embarcacao} />
          </div>

          <div className="mt-4">
            <RoteirosCarousel title="Roteiros desta embarcação" items={carouselItems} />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
