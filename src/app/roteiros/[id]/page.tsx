import { notFound } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import RoteiroDetalheView, { type RoteiroDetalheDados } from './_components/RoteiroDetalheView';
import type { AvaliacaoPublica } from '@/components/avaliacoes/AvaliacoesSection';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { getDisponibilidadeRoteiro } from '@/lib/reservas';

type RoteiroDetalhe = RoteiroDetalheDados & {
  owner_id: string;
  embarcacao_id: string | null;
  roteiro_disponibilidade_bloqueio: { data: string }[];
};


export default async function RoteiroDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ data?: string; flex?: string; pessoas?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const { data, error } = await supabaseAdmin
    .from('roteiro')
    .select(`
      id, owner_id, embarcacao_id, nome, descricao, origem, destino, duracao, quantidade_pessoas, preco_base,
      preco_diaria_ativo, preco_diaria_valor, preco_diaria_minimo,
      preco_pessoa_ativo, preco_pessoa_valor, preco_pessoa_capacidade_minima,
      preco_pessoa_capacidade_maxima, preco_pessoa_modo_capacidade,
      disponibilidade_dias_semana,
      latitude, longitude, cep, bairro, logradouro, logradouro_numero, complemento,
      municipios ( nome, estados ( uf, nome ) ),
      roteiro_imagens ( id, url_imagem, titulo, principal, ordem ),
      roteiro_disponibilidade_bloqueio ( data ),
      roteiro_parada ( nome ),
      embarcacao ( nome, capacidade, comprimento, comprimento_unidade, quartos, tripulacao, modalidade_capitao,
        embarcacao_tipo ( nome ),
        embarcacao_comodidades ( comodidade ( nome ) ),
        embarcacao_imagens ( id, url_imagem, titulo, principal, ordem )
      ),
      roteiro_catalogo (
        id, valor_customizado,
        catalogo ( id, descricao, valor, tipo )
      )
    `)
    .eq('id', id)
    .eq('ativo', true)
    .order('ordem', { referencedTable: 'roteiro_parada' })
    .single();

  if (error || !data) notFound();

  const roteiro = data as unknown as RoteiroDetalhe;

  // Disponibilidade nos 3 modelos de cobrança: datas exclusivamente ocupadas
  // (reserva confirmada do próprio roteiro, da embarcação vinculada, ou de
  // outro roteiro que a compartilhe) + vagas já ocupadas do modelo Por
  // Pessoa quando ele opera em capacidade compartilhada.
  const disponibilidade = await getDisponibilidadeRoteiro({
    roteiroId: roteiro.id,
    embarcacaoId: roteiro.embarcacao_id,
    pessoaModoCapacidade: roteiro.preco_pessoa_modo_capacidade,
  });

  // Avaliações de reservas concluídas deste roteiro (mais recentes primeiro).
  const { data: avaliacoesData } = await supabaseAdmin
    .from('avaliacao')
    .select('id, nota, comentario, created_at, cliente:users!avaliacao_cliente_id_fkey ( name, avatar_url )')
    .eq('roteiro_id', id)
    .eq('status', 'aprovada')
    .order('created_at', { ascending: false });
  const avaliacoes = (avaliacoesData ?? []) as unknown as AvaliacaoPublica[];

  // Estado inicial do favorito (false quando deslogado).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let isFavorito = false;
  if (user) {
    const { data: fav } = await supabaseAdmin
      .from('favorito')
      .select('id')
      .eq('user_id', user.id)
      .eq('roteiro_id', id)
      .maybeSingle();
    isFavorito = fav != null;
  }
  // Dono vendo o próprio roteiro: sem CTA de chat (não conversa consigo mesmo).
  const ehDono = user?.id === roteiro.owner_id;

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <RoteiroDetalheView
        roteiro={roteiro}
        avaliacoes={avaliacoes}
        ehDono={ehDono}
        isFavorito={isFavorito}
        datasBloqueadas={[
          ...(roteiro.roteiro_disponibilidade_bloqueio?.map((b) => b.data) ?? []),
          ...disponibilidade.datasExclusivasOcupadas,
        ]}
        vagasPessoaOcupadas={disponibilidade.vagasPessoaOcupadas}
        initialData={sp.data}
        initialFlex={sp.flex ? parseInt(sp.flex) : undefined}
        initialPessoas={sp.pessoas ? parseInt(sp.pessoas) : undefined}
      />
      <Footer />
    </div>
  );
}
