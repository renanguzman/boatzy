import { notFound } from 'next/navigation';
import Link from 'next/link';
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
};

function formatPrice(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

const modalidadeLabel: Record<string, string> = {
  com_capitao: 'Com Capitão',
  sem_capitao: 'Sem Capitão',
  opcional: 'Capitão Opcional',
};

export default async function EmbarcacaoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('embarcacao')
    .select(`
      id, nome, descricao, capacidade, comprimento, cabines, quartos, suites, banheiros,
      tripulacao, modalidade_capitao, preco_base,
      latitude, longitude, cep, bairro, logradouro, logradouro_numero, complemento,
      embarcacao_tipo ( nome ),
      embarcacao_categoria ( nome ),
      municipios ( nome, estados ( uf, nome ) ),
      embarcacao_comodidades ( comodidade ( nome ) ),
      embarcacao_imagens ( id, url_imagem, titulo, principal )
    `)
    .eq('id', id)
    .single();

  if (error || !data) notFound();

  const embarcacao = data as unknown as EmbarcacaoDetalhe;

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

              {/* Reviews placeholder */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-[#0B2447]">Avaliações</h2>
                </div>
                <div className="rounded-2xl border border-dashed border-slate-200 p-10 flex flex-col items-center text-center">
                  <p className="text-sm text-slate-400 font-medium">Ainda não há avaliações para esta embarcação.</p>
                  <p className="text-xs text-slate-300 mt-1">Seja o primeiro a avaliar!</p>
                </div>
              </div>
            </div>

            {/* ── Right sidebar ── */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 rounded-2xl border border-slate-200 shadow-lg p-6">
                <div className="flex items-end gap-1 mb-1">
                  {embarcacao.preco_base ? (
                    <>
                      <span className="text-2xl font-bold text-[#0B2447]">{formatPrice(embarcacao.preco_base)}</span>
                      <span className="text-sm text-slate-400 mb-0.5">/dia</span>
                    </>
                  ) : (
                    <span className="text-lg font-semibold text-slate-500">Consulte o preço</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mb-5">
                  {modalidadeLabel[embarcacao.modalidade_capitao] ?? embarcacao.modalidade_capitao}
                </p>

                <Link
                  href={`/entrar?redirect_to=${encodeURIComponent(`/embarcacoes/${embarcacao.id}`)}`}
                  className="block w-full text-center bg-[#0B3D91] hover:bg-[#0B2447] text-white font-semibold py-3.5 rounded-xl transition-colors"
                >
                  Solicitar reserva
                </Link>

                <p className="text-center text-xs text-slate-400 mt-3">
                  Você ainda não será cobrado.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
