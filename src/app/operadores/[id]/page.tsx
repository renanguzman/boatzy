import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import RoteiroCard, { type RoteiroCardData } from '@/app/buscar/_components/RoteiroCard';
import EmbarcacaoCard, { type EmbarcacaoCardData } from '@/components/ui/EmbarcacaoCard';
import AvaliacoesSection, { type AvaliacaoPublica } from '@/components/avaliacoes/AvaliacoesSection';
import OperadorChatBotao from '@/components/operador/OperadorChatBotao';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { getAvaliacoesResumoPorEmbarcacao, getAvaliacoesResumoPorRoteiro } from '@/lib/avaliacoes';
import { getOperadorPublico } from '@/lib/operador';
import OperadorHero from './_components/OperadorHero';

const ROTEIRO_SELECT = `id, nome, descricao, quantidade_pessoas, preco_minimo_cliente, preco_minimo_modelo,
   duracao, duracao_horas,
   municipios ( nome, estados ( uf ) ),
   roteiro_imagens ( url_imagem, principal ),
   embarcacao ( embarcacao_tipo ( nome ) )`;

type EmbarcacaoRow = {
  id: string;
  nome: string;
  capacidade: number | null;
  embarcacao_tipo: { nome: string } | null;
  municipios: { nome: string; estados: { uf: string } | null } | null;
  embarcacao_imagens: { url_imagem: string; principal: boolean }[];
};

/** Últimas avaliações exibidas; a média e o total do cabeçalho vêm do resumo (todas as aprovadas). */
const AVALIACOES_EXIBIDAS = 12;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const operador = await getOperadorPublico(id);
  if (!operador) return { title: 'Boatzy', robots: { index: false } };

  const t = await getTranslations('Operador.pagina');
  const resumo = operador.bio.replace(/\s+/g, ' ').trim();
  const descricao = resumo.length > 155 ? `${resumo.slice(0, 152).trimEnd()}…` : resumo;
  return {
    title: t('metaTitulo', { nome: operador.nome }),
    description: descricao || t('metaDescricaoPadrao', { nome: operador.nome }),
    openGraph: {
      title: t('metaTitulo', { nome: operador.nome }),
      description: descricao || t('metaDescricaoPadrao', { nome: operador.nome }),
      images: [{ url: operador.fotoUrl, alt: operador.nome }],
    },
  };
}

/**
 * Página pública do operador (SPEC §99): só existe com perfil APROVADO (e não retirado do ar) —
 * a aprovação do admin é o portão; sem ela, 404. Mostra o perfil, as experiências e embarcações
 * ativas e as avaliações que ele recebeu.
 */
export default async function OperadorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const operador = await getOperadorPublico(id);
  if (!operador) notFound();

  const [t, tPagina] = await Promise.all([getTranslations('Operador'), getTranslations('Operador.pagina')]);

  const [{ data: roteirosData }, { data: embarcacoesData }, { data: avaliacoesData }] = await Promise.all([
    supabaseAdmin.from('roteiro').select(ROTEIRO_SELECT).eq('owner_id', id).eq('ativo', true).order('created_at', { ascending: false }),
    supabaseAdmin
      .from('embarcacao')
      .select('id, nome, capacidade, embarcacao_tipo ( nome ), municipios ( nome, estados ( uf ) ), embarcacao_imagens ( url_imagem, principal )')
      .eq('owner_id', id)
      .eq('status', 'ativo')
      .order('created_at', { ascending: false }),
    // Avaliações aprovadas das reservas deste operador (a avaliação não guarda o gestor: passa pela reserva).
    supabaseAdmin
      .from('avaliacao')
      .select('id, nota, comentario, created_at, cliente:users!avaliacao_cliente_id_fkey ( name, avatar_url ), reserva!inner ( owner_id )')
      .eq('reserva.owner_id', id)
      .eq('status', 'aprovada')
      .order('created_at', { ascending: false })
      .limit(AVALIACOES_EXIBIDAS),
  ]);

  const roteiros = (roteirosData ?? []) as unknown as RoteiroCardData[];
  const embarcacoesRows = (embarcacoesData ?? []) as unknown as EmbarcacaoRow[];
  const avaliacoes = (avaliacoesData ?? []) as unknown as AvaliacaoPublica[];

  const [resumoRoteiros, resumoEmbarcacoes] = await Promise.all([
    getAvaliacoesResumoPorRoteiro(roteiros.map((r) => r.id)),
    getAvaliacoesResumoPorEmbarcacao(embarcacoesRows.map((e) => e.id)),
  ]);

  // Favoritos do cliente logado (vazio quando deslogado).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const favoritosRoteiro = new Set<string>();
  const favoritosEmbarcacao = new Set<string>();
  if (user) {
    const [{ data: favRoteiros }, { data: favEmbarcacoes }] = await Promise.all([
      roteiros.length > 0
        ? supabaseAdmin.from('favorito').select('roteiro_id').eq('user_id', user.id).in('roteiro_id', roteiros.map((r) => r.id))
        : Promise.resolve({ data: [] as { roteiro_id: string | null }[] }),
      embarcacoesRows.length > 0
        ? supabaseAdmin.from('favorito').select('embarcacao_id').eq('user_id', user.id).in('embarcacao_id', embarcacoesRows.map((e) => e.id))
        : Promise.resolve({ data: [] as { embarcacao_id: string | null }[] }),
    ]);
    for (const f of favRoteiros ?? []) if (f.roteiro_id) favoritosRoteiro.add(f.roteiro_id);
    for (const f of favEmbarcacoes ?? []) if (f.embarcacao_id) favoritosEmbarcacao.add(f.embarcacao_id);
  }
  const ehDono = user?.id === id;

  const embarcacoes: EmbarcacaoCardData[] = embarcacoesRows.map((e) => ({
    id: e.id,
    nome: e.nome,
    capacidade: e.capacidade,
    tipo: e.embarcacao_tipo?.nome ?? null,
    localidade: e.municipios ? (e.municipios.estados ? `${e.municipios.nome}, ${e.municipios.estados.uf}` : e.municipios.nome) : null,
    imagem: (e.embarcacao_imagens.find((i) => i.principal) ?? e.embarcacao_imagens[0])?.url_imagem ?? null,
  }));

  // "Conversar": parte do primeiro roteiro ativo; sem roteiro, da primeira embarcação (reaproveita o chat do dono).
  const origemRoteiro = roteiros[0] ? { id: roteiros[0].id, nome: roteiros[0].nome } : undefined;
  const origemEmbarcacao = !origemRoteiro ? embarcacoes[0]?.id : undefined;
  const acao = ehDono ? (
    <Link
      href="/painel/perfil"
      className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-marinho transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turquesa"
    >
      {t('editarPerfil')}
    </Link>
  ) : origemRoteiro || origemEmbarcacao ? (
    <OperadorChatBotao nome={operador.primeiroNome} roteiro={origemRoteiro} embarcacaoId={origemEmbarcacao} />
  ) : undefined;

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <OperadorHero operador={operador} acao={acao} />

      <main className="mx-auto max-w-7xl space-y-14 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {roteiros.length === 0 && embarcacoes.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500">
            {tPagina('semExperiencias', { nome: operador.primeiroNome })}
          </p>
        )}

        {roteiros.length > 0 && (
          <section aria-labelledby="operador-experiencias">
            <div className="mb-6 flex items-end justify-between gap-3">
              <h2 id="operador-experiencias" className="text-xl font-bold tracking-tight text-marinho sm:text-2xl">
                {tPagina('experienciasDe', { nome: operador.primeiroNome })}
              </h2>
              <p className="text-sm text-slate-400">{operador.experiencias} {operador.experiencias === 1 ? t('metricaExperiencia') : t('metricaExperiencias')}</p>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {roteiros.map((roteiro) => (
                <RoteiroCard
                  key={roteiro.id}
                  roteiro={roteiro}
                  initialFavorito={favoritosRoteiro.has(roteiro.id)}
                  avaliacaoResumo={resumoRoteiros.get(roteiro.id) ?? null}
                />
              ))}
            </div>
          </section>
        )}

        {embarcacoes.length > 0 && (
          <section aria-labelledby="operador-embarcacoes">
            <h2 id="operador-embarcacoes" className="mb-6 text-xl font-bold tracking-tight text-marinho sm:text-2xl">
              {tPagina('embarcacoesDe', { nome: operador.primeiroNome })}
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {embarcacoes.map((embarcacao) => (
                <EmbarcacaoCard
                  key={embarcacao.id}
                  embarcacao={embarcacao}
                  initialFavorito={favoritosEmbarcacao.has(embarcacao.id)}
                  avaliacaoResumo={resumoEmbarcacoes.get(embarcacao.id) ?? null}
                />
              ))}
            </div>
          </section>
        )}

        {operador.totalAvaliacoes > 0 && operador.media !== null && (
          <section id="avaliacoes" className="scroll-mt-24 max-w-4xl">
            <AvaliacoesSection
              avaliacoes={avaliacoes}
              emptyLabel=""
              resumo={{ media: operador.media, total: operador.totalAvaliacoes }}
            />
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
