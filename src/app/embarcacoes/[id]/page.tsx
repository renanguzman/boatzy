import { notFound } from 'next/navigation';
import {
  MapPin,
  Users,
  Anchor,
  Ruler,
  BedDouble,
  DoorOpen,
  Bath,
  LifeBuoy,
  BadgeCheck,
  Award,
  CheckCircle2,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import GaleriaRoteiro from '../../roteiros/[id]/_components/GaleriaRoteiro';
import LocalizacaoMap from '../../roteiros/[id]/_components/LocalizacaoMap';
import EmbarcacaoBookingCard from './_components/EmbarcacaoBookingCard';
import AvaliacoesSection, { type AvaliacaoPublica } from '@/components/avaliacoes/AvaliacoesSection';
import { supabaseAdmin } from '@/lib/supabase';

type EmbarcacaoDetalhe = {
  id: string;
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
      id, nome, descricao, capacidade, comprimento, cabines, quartos, suites, banheiros,
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

  // Avaliações da embarcação (inclui reservas de roteiros feitos nela).
  const { data: avaliacoesData } = await supabaseAdmin
    .from('avaliacao')
    .select('id, nota, comentario, created_at, cliente:users!avaliacao_cliente_id_fkey ( name, avatar_url )')
    .eq('embarcacao_id', id)
    .eq('status', 'aprovada')
    .order('created_at', { ascending: false });
  const avaliacoes = (avaliacoesData ?? []) as unknown as AvaliacaoPublica[];

  const images = [...embarcacao.embarcacao_imagens].sort((a, b) =>
    a.principal === b.principal ? 0 : a.principal ? -1 : 1,
  );

  const localidade = embarcacao.municipios
    ? embarcacao.municipios.estados
      ? `${embarcacao.municipios.nome}, ${embarcacao.municipios.estados.uf}`
      : embarcacao.municipios.nome
    : null;

  const specs: { icon: typeof Users; label: string; value: string }[] = [];
  if (embarcacao.capacidade) specs.push({ icon: Users, label: 'Capacidade', value: `${embarcacao.capacidade} pessoas` });
  if (embarcacao.comprimento) specs.push({ icon: Ruler, label: 'Comprimento', value: `${embarcacao.comprimento}m` });
  if (embarcacao.cabines) specs.push({ icon: DoorOpen, label: 'Cabines', value: String(embarcacao.cabines) });
  if (embarcacao.suites) specs.push({ icon: BedDouble, label: 'Suítes', value: String(embarcacao.suites) });
  if (embarcacao.banheiros) specs.push({ icon: Bath, label: 'Banheiros', value: String(embarcacao.banheiros) });
  if (embarcacao.tripulacao) specs.push({ icon: LifeBuoy, label: 'Tripulação', value: String(embarcacao.tripulacao) });

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
              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 bg-cyan-50 px-3 py-1.5 rounded-full">
                  <Award className="h-3 w-3" />
                  Novo
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full">
                  <BadgeCheck className="h-3 w-3" />
                  Embarcação Verificada
                </span>
                {embarcacao.embarcacao_tipo && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0B3D91] bg-[#0B3D91]/10 px-3 py-1.5 rounded-full">
                    <Anchor className="h-3 w-3" />
                    {embarcacao.embarcacao_tipo.nome}
                  </span>
                )}
                {embarcacao.embarcacao_categoria && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full">
                    {embarcacao.embarcacao_categoria.nome}
                  </span>
                )}
              </div>

              {/* Title & location */}
              <h1 className="text-3xl md:text-4xl font-bold text-[#0B2447] mb-2">
                {embarcacao.nome}
              </h1>
              {localidade && (
                <div className="flex items-center gap-1.5 text-slate-500 text-sm mb-6">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {localidade}
                </div>
              )}

              {/* Description */}
              {embarcacao.descricao && (
                <p className="text-slate-600 text-sm leading-relaxed mb-8 max-w-2xl">
                  {embarcacao.descricao}
                </p>
              )}

              {/* Specs row */}
              {specs.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-slate-100 mb-10">
                  {specs.map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-[#0B3D91]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{label}</p>
                        <p className="text-sm font-semibold text-slate-800 truncate">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Comodidades */}
              {embarcacao.embarcacao_comodidades.length > 0 && (
                <div className="mb-10">
                  <h2 className="text-xl font-bold text-[#0B2447] mb-4">Comodidades a bordo</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {embarcacao.embarcacao_comodidades.map((ec, i) =>
                      ec.comodidade ? (
                        <div
                          key={i}
                          className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 bg-slate-50/60"
                        >
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span className="text-sm text-slate-700 leading-tight">{ec.comodidade.nome}</span>
                        </div>
                      ) : null,
                    )}
                  </div>
                </div>
              )}

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
                preco={embarcacao.preco_base}
                modalidadeLabel={modalidadeLabel[embarcacao.modalidade_capitao] ?? embarcacao.modalidade_capitao}
                diasOperacao={embarcacao.disponibilidade_dias_semana}
                datasBloqueadas={embarcacao.embarcacao_disponibilidade_bloqueio?.map((b) => b.data) ?? []}
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
