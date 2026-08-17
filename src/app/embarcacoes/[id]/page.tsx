import { notFound } from 'next/navigation';
import { MapPin } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import GaleriaRoteiro from '../../roteiros/[id]/_components/GaleriaRoteiro';
import LocalizacaoMap from '../../roteiros/[id]/_components/LocalizacaoMap';
import EmbarcacaoBookingCard from './_components/EmbarcacaoBookingCard';
import EmbarcacaoInfoSection from './_components/EmbarcacaoInfoSection';
import AvaliacoesSection, { type AvaliacaoPublica } from '@/components/avaliacoes/AvaliacoesSection';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { getDatasReservadasEmbarcacao } from '@/lib/reservas';

type EmbarcacaoDetalhe = {
  id: string;
  owner_id: string;
  nome: string;
  descricao: string | null;
  capacidade: number | null;
  comprimento: number | null;
  cabines: number | null;
  quartos: number | null;
  suites: number | null;
  banheiros: number | null;
  tripulacao: number | null;
  modalidade_capitao: string;
  preco_base: number | null;
  disponibilidade_dias_semana: number[] | null;
  latitude: number | null;
  longitude: number | null;
  cep: string | null;
  bairro: string | null;
  logradouro: string | null;
  logradouro_numero: string | null;
  complemento: string | null;
  embarcacao_tipo: { nome: string } | null;
  embarcacao_categoria: { nome: string } | null;
  municipios: { nome: string; estados: { uf: string; nome: string } | null } | null;
  embarcacao_comodidades: { comodidade: { nome: string } | null }[];
  embarcacao_imagens: { id: string; url_imagem: string; titulo: string | null; principal: boolean }[];
  embarcacao_disponibilidade_bloqueio: { data: string }[];
};

const modalidadeLabel: Record<string, string> = {
  com_capitao: 'Com Capitão',
  sem_capitao: 'Sem Capitão',
  opcional: 'Capitão Opcional',
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
      id, owner_id, nome, descricao, capacidade, comprimento, cabines, quartos, suites, banheiros,
      tripulacao, modalidade_capitao, preco_base, disponibilidade_dias_semana,
      latitude, longitude, cep, bairro, logradouro, logradouro_numero, complemento,
      embarcacao_tipo ( nome ),
      embarcacao_categoria ( nome ),
      municipios ( nome, estados ( uf, nome ) ),
      embarcacao_comodidades ( comodidade ( nome ) ),
      embarcacao_imagens ( id, url_imagem, titulo, principal ),
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

  const images = [...embarcacao.embarcacao_imagens].sort((a, b) =>
    a.principal === b.principal ? 0 : a.principal ? -1 : 1,
  );

  const localidade = embarcacao.municipios
    ? embarcacao.municipios.estados
      ? `${embarcacao.municipios.nome}, ${embarcacao.municipios.estados.uf}`
      : embarcacao.municipios.nome
    : null;

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <GaleriaRoteiro images={images} nome={embarcacao.nome} voltarHref="/embarcacoes" />

      {/* Content */}
      <section className="pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

            {/* ── Left column ── */}
            <div className="lg:col-span-2">
              <EmbarcacaoInfoSection embarcacao={embarcacao} />

              {/* Localização */}
              {embarcacao.latitude && embarcacao.longitude && (
                <div className="mb-10">
                  <h2 className="text-xl font-bold text-[#0B2447] mb-4">Localização</h2>

                  <LocalizacaoMap lat={Number(embarcacao.latitude)} lng={Number(embarcacao.longitude)} />

                  <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <MapPin className="h-4 w-4 text-[#0B3D91] mt-0.5 shrink-0" />
                    <div className="text-sm text-slate-700 leading-relaxed">
                      {embarcacao.logradouro && (
                        <p className="font-medium text-slate-800">
                          {embarcacao.logradouro}
                          {embarcacao.logradouro_numero && `, ${embarcacao.logradouro_numero}`}
                          {embarcacao.complemento && ` — ${embarcacao.complemento}`}
                        </p>
                      )}
                      {embarcacao.bairro && <p>{embarcacao.bairro}</p>}
                      {localidade && <p>{localidade}</p>}
                      {embarcacao.cep && (
                        <p className="text-slate-500 mt-0.5">
                          CEP {embarcacao.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Avaliações */}
              <AvaliacoesSection
                avaliacoes={avaliacoes}
                emptyLabel="Ainda não há avaliações para esta embarcação."
              />
            </div>

            {/* ── Right sidebar ── */}
            <div className="lg:col-span-1">
              <EmbarcacaoBookingCard
                embarcacaoId={embarcacao.id}
                ehDono={ehDono}
                preco={embarcacao.preco_base}
                modalidadeLabel={modalidadeLabel[embarcacao.modalidade_capitao] ?? embarcacao.modalidade_capitao}
                diasOperacao={embarcacao.disponibilidade_dias_semana}
                datasBloqueadas={[
                  ...(embarcacao.embarcacao_disponibilidade_bloqueio?.map((b) => b.data) ?? []),
                  ...datasReservadas,
                ]}
                initialData={sp.data}
                initialFlex={sp.flex ? parseInt(sp.flex) : undefined}
                initialPessoas={sp.pessoas ? parseInt(sp.pessoas) : undefined}
              />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
