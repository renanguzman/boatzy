import { notFound } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import EmbarcacaoDetalheView, { type EmbarcacaoDetalheDados } from './_components/EmbarcacaoDetalheView';
import type { AvaliacaoPublica } from '@/components/avaliacoes/AvaliacoesSection';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { getDatasReservadasEmbarcacao } from '@/lib/reservas';

type EmbarcacaoDetalhe = EmbarcacaoDetalheDados & {
  owner_id: string;
  embarcacao_disponibilidade_bloqueio: { data: string }[];
};

export default async function EmbarcacaoDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ data?: string; flex?: string; pessoas?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const { data, error } = await supabaseAdmin
    .from('embarcacao')
    .select(`
      id, owner_id, nome, descricao, capacidade, comprimento, comprimento_unidade, quartos, suites, banheiros,
      tripulacao, modalidade_capitao, preco_base, disponibilidade_dias_semana,
      latitude, longitude, cep, bairro, logradouro, logradouro_numero, complemento,
      embarcacao_tipo ( nome ),
      municipios ( nome, estados ( uf, nome ) ),
      embarcacao_comodidades ( comodidade ( nome ) ),
      embarcacao_imagens ( id, url_imagem, titulo, principal, ordem ),
      embarcacao_disponibilidade_bloqueio ( data )
    `)
    .eq('id', id)
    .eq('status', 'ativo')
    .single();

  if (error || !data) notFound();

  const embarcacao = data as unknown as EmbarcacaoDetalhe;

  // Datas com reserva CONFIRMADA (direta ou via qualquer roteiro que usa
  // esta embarcação) — mescladas aos bloqueios manuais antes do BookingCard.
  const datasReservadas = await getDatasReservadasEmbarcacao(embarcacao.id);

  // Avaliações da embarcação (inclui reservas de roteiros feitos nela).
  const { data: avaliacoesData } = await supabaseAdmin
    .from('avaliacao')
    .select('id, nota, comentario, created_at, cliente:users!avaliacao_cliente_id_fkey ( name, avatar_url )')
    .eq('embarcacao_id', id)
    .eq('status', 'aprovada')
    .order('created_at', { ascending: false });
  const avaliacoes = (avaliacoesData ?? []) as unknown as AvaliacaoPublica[];

  // Dono vendo a própria embarcação: sem CTA de chat (não conversa consigo mesmo).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ehDono = user?.id === embarcacao.owner_id;

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <EmbarcacaoDetalheView
        embarcacao={embarcacao}
        avaliacoes={avaliacoes}
        ehDono={ehDono}
        datasBloqueadas={[
          ...(embarcacao.embarcacao_disponibilidade_bloqueio?.map((b) => b.data) ?? []),
          ...datasReservadas,
        ]}
        initialData={sp.data}
        initialFlex={sp.flex ? parseInt(sp.flex) : undefined}
        initialPessoas={sp.pessoas ? parseInt(sp.pessoas) : undefined}
      />
      <Footer />
    </div>
  );
}

