import Link from 'next/link';
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
  CheckCircle2,
  Factory,
  CalendarRange,
  ArrowDownRight,
  LogIn,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import GaleriaRoteiro from '../../roteiros/[id]/_components/GaleriaRoteiro';
import LocalizacaoMap from '../../roteiros/[id]/_components/LocalizacaoMap';
import AvaliacoesSection, { type AvaliacaoPublica } from '@/components/avaliacoes/AvaliacoesSection';
import VendaSidebar from './_components/VendaSidebar';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';

type AnuncioDetalhe = {
  id: string;
  owner_id: string;
  fabricante: string;
  ano_modelo: number;
  ano_fabricacao: number;
  preco: number;
  descricao_venda: string | null;
  embarcacao: {
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
    latitude: number | null;
    longitude: number | null;
    bairro: string | null;
    status: string;
    embarcacao_tipo: { nome: string } | null;
    municipios: { nome: string; estados: { uf: string; nome: string } | null } | null;
    embarcacao_comodidades: { comodidade: { nome: string } | null }[];
    embarcacao_imagens: { id: string; url_imagem: string; titulo: string | null; principal: boolean }[];
  } | null;
};

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/** "Renan Guzman" → "R***** G*****" (dados do vendedor ficam ocultos até o clique). */
function mascararNome(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .map((parte) => `${parte[0]}${'*'.repeat(Math.max(parte.length - 1, 3))}`)
    .join(' ');
}

export default async function VendaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('anuncio_venda')
    .select(`
      id, owner_id, fabricante, ano_modelo, ano_fabricacao, preco, descricao_venda,
      embarcacao (
        id, nome, descricao, capacidade, comprimento, cabines, quartos, suites, banheiros,
        tripulacao, latitude, longitude, bairro, status,
        embarcacao_tipo ( nome ),
        municipios ( nome, estados ( uf, nome ) ),
        embarcacao_comodidades ( comodidade ( nome ) ),
        embarcacao_imagens ( id, url_imagem, titulo, principal )
      )
    `)
    .eq('id', id)
    .eq('status', 'ativo')
    .single();

  const anuncio = data as unknown as AnuncioDetalhe | null;
  // Anúncio pausado/vendido/cancelado ou embarcação desativada → 404.
  if (error || !anuncio?.embarcacao || anuncio.embarcacao.status !== 'ativo') notFound();
  const emb = anuncio.embarcacao;

  // Contador de visualizações: conta anônimo e logado, a cada abertura.
  await supabaseAdmin.rpc('registrar_visualizacao_anuncio', { p_anuncio: id });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const logado = !!user;
  const ehDono = user?.id === anuncio.owner_id;

  // Lead (estágio 1): logado que abriu o detalhe — idempotente; dono não conta.
  if (user && !ehDono) {
    const { error: evErro } = await supabaseAdmin
      .from('anuncio_venda_interacao')
      .insert({ anuncio_id: id, user_id: user.id, tipo: 'visualizou' });
    if (evErro && evErro.code !== '23505') {
      console.error('[vendas] falha ao registrar visualização:', evErro);
    }
  }

  // Histórico de preço: o registro anterior alimenta o selo de redução.
  const { data: historico } = await supabaseAdmin
    .from('anuncio_venda_preco')
    .select('preco, created_at')
    .eq('anuncio_id', id)
    .order('created_at', { ascending: false })
    .limit(2);
  const anterior = historico?.[1] ?? null;
  const reduzido = anterior != null && Number(anuncio.preco) < Number(anterior.preco);

  const images = [...emb.embarcacao_imagens].sort((a, b) =>
    a.principal === b.principal ? 0 : a.principal ? -1 : 1,
  );

  const localidade = emb.municipios
    ? emb.municipios.estados
      ? `${emb.municipios.nome}, ${emb.municipios.estados.uf}`
      : emb.municipios.nome
    : null;

  // ── Teaser (deslogado): galeria + preço + tipo, sem os detalhes ──
  if (!logado) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <GaleriaRoteiro images={images} nome={emb.nome} voltarHref="/vendas" />

        <section className="pb-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <div className="flex flex-wrap gap-2 mb-4">
                {reduzido && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-white bg-emerald-600 px-3 py-1.5 rounded-full">
                    <ArrowDownRight className="h-3 w-3" />
                    Preço reduzido
                  </span>
                )}
                {emb.embarcacao_tipo && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0B3D91] bg-[#0B3D91]/10 px-3 py-1.5 rounded-full">
                    <Anchor className="h-3 w-3" />
                    {emb.embarcacao_tipo.nome}
                  </span>
                )}
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-[#0B2447] mb-2">{emb.nome}</h1>
              {localidade && (
                <div className="flex items-center gap-1.5 text-slate-500 text-sm mb-4">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {localidade}
                </div>
              )}

              <div className="flex items-baseline gap-3 mb-8">
                <span className="text-3xl font-bold text-[#0B2447]">{brl.format(Number(anuncio.preco))}</span>
                {reduzido && (
                  <span className="text-base text-slate-400 line-through">
                    {brl.format(Number(anterior!.preco))}
                  </span>
                )}
              </div>

              {/* Gate de login */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
                <div className="h-14 w-14 rounded-2xl bg-[#0B2447] flex items-center justify-center mx-auto mb-4">
                  <LogIn className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-lg font-bold text-[#0B2447]">
                  Entre para ver os detalhes deste anúncio
                </h2>
                <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
                  Ficha técnica completa, fotos, histórico de preço, dados do vendedor e chat
                  direto pela plataforma — disponíveis para usuários cadastrados.
                </p>
                <Link
                  href={`/entrar?redirect_to=${encodeURIComponent(`/vendas/${id}`)}`}
                  className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl bg-[#0B3D91] hover:bg-[#0B2447] text-white text-sm font-semibold transition-colors"
                >
                  <LogIn className="h-4 w-4" />
                  Entrar ou criar conta
                </Link>
              </div>
            </div>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  // ── Detalhe completo (logado) ──

  // Avaliações da embarcação (histórico de roteiros feitos nela — confiança).
  const { data: avaliacoesData } = await supabaseAdmin
    .from('avaliacao')
    .select('id, nota, comentario, created_at, cliente:users!avaliacao_cliente_id_fkey ( name, avatar_url )')
    .eq('embarcacao_id', emb.id)
    .eq('status', 'aprovada')
    .order('created_at', { ascending: false });
  const avaliacoes = (avaliacoesData ?? []) as unknown as AvaliacaoPublica[];

  // Vendedor (apenas o mascarado vai ao HTML; o completo sai só pela action).
  const { data: vendedor } = await supabaseAdmin
    .from('users')
    .select('name')
    .eq('id', anuncio.owner_id)
    .single();

  // Favorito do usuário no anúncio (estado inicial do botão).
  const { data: fav } = await supabaseAdmin
    .from('favorito')
    .select('id')
    .eq('user_id', user!.id)
    .eq('anuncio_venda_id', id)
    .maybeSingle();

  const specs: { icon: typeof Users; label: string; value: string }[] = [
    { icon: Factory, label: 'Fabricante', value: anuncio.fabricante },
    { icon: CalendarRange, label: 'Ano modelo/fab.', value: `${anuncio.ano_modelo}/${anuncio.ano_fabricacao}` },
  ];
  if (emb.capacidade) specs.push({ icon: Users, label: 'Capacidade', value: `${emb.capacidade} pessoas` });
  if (emb.comprimento) specs.push({ icon: Ruler, label: 'Comprimento', value: `${emb.comprimento}m` });
  if (emb.cabines) specs.push({ icon: DoorOpen, label: 'Cabines', value: String(emb.cabines) });
  if (emb.suites) specs.push({ icon: BedDouble, label: 'Suítes', value: String(emb.suites) });
  if (emb.banheiros) specs.push({ icon: Bath, label: 'Banheiros', value: String(emb.banheiros) });
  if (emb.tripulacao) specs.push({ icon: LifeBuoy, label: 'Tripulação', value: String(emb.tripulacao) });

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <GaleriaRoteiro images={images} nome={emb.nome} voltarHref="/vendas" />

      <section className="pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

            {/* ── Left column ── */}
            <div className="lg:col-span-2">
              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {reduzido && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-white bg-emerald-600 px-3 py-1.5 rounded-full">
                    <ArrowDownRight className="h-3 w-3" />
                    Preço reduzido
                  </span>
                )}
                {emb.embarcacao_tipo && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0B3D91] bg-[#0B3D91]/10 px-3 py-1.5 rounded-full">
                    <Anchor className="h-3 w-3" />
                    {emb.embarcacao_tipo.nome}
                  </span>
                )}
              </div>

              {/* Title & location */}
              <h1 className="text-3xl md:text-4xl font-bold text-[#0B2447] mb-2">{emb.nome}</h1>
              {localidade && (
                <div className="flex items-center gap-1.5 text-slate-500 text-sm mb-6">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {localidade}
                </div>
              )}

              {/* Detalhes da venda */}
              {anuncio.descricao_venda && (
                <div className="mb-8">
                  <h2 className="text-xl font-bold text-[#0B2447] mb-3">Sobre esta venda</h2>
                  <p className="text-slate-600 text-sm leading-relaxed max-w-2xl whitespace-pre-line">
                    {anuncio.descricao_venda}
                  </p>
                </div>
              )}

              {/* Ficha técnica */}
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

              {/* Descrição da embarcação */}
              {emb.descricao && (
                <div className="mb-10">
                  <h2 className="text-xl font-bold text-[#0B2447] mb-3">Sobre a embarcação</h2>
                  <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">{emb.descricao}</p>
                </div>
              )}

              {/* Comodidades */}
              {emb.embarcacao_comodidades.length > 0 && (
                <div className="mb-10">
                  <h2 className="text-xl font-bold text-[#0B2447] mb-4">Comodidades a bordo</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {emb.embarcacao_comodidades.map((ec, i) =>
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

              {/* Localização (cidade/bairro — endereço exato não é exposto na venda) */}
              {emb.latitude && emb.longitude && (
                <div className="mb-10">
                  <h2 className="text-xl font-bold text-[#0B2447] mb-4">Localização</h2>
                  <LocalizacaoMap lat={Number(emb.latitude)} lng={Number(emb.longitude)} />
                  <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <MapPin className="h-4 w-4 text-[#0B3D91] mt-0.5 shrink-0" />
                    <div className="text-sm text-slate-700 leading-relaxed">
                      {emb.bairro && <p>{emb.bairro}</p>}
                      {localidade && <p>{localidade}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Avaliações da embarcação (roteiros feitos nela) */}
              <AvaliacoesSection
                avaliacoes={avaliacoes}
                emptyLabel="Ainda não há avaliações para esta embarcação."
              />
            </div>

            {/* ── Right sidebar ── */}
            <div className="lg:col-span-1">
              <VendaSidebar
                anuncioId={anuncio.id}
                anuncioNome={emb.nome}
                preco={Number(anuncio.preco)}
                precoAnterior={reduzido ? Number(anterior!.preco) : null}
                reduzidoEm={reduzido ? historico![0].created_at : null}
                vendedorNomeMascarado={vendedor ? mascararNome(vendedor.name) : '—'}
                initialFavorito={!!fav}
                ehDono={ehDono}
              />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
