import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import HeroSection from '@/components/home/HeroSection';
import HeroVitrine, { type VarianteVitrine } from '@/components/home/vitrine/HeroVitrine';
import TopRatedSection from '@/components/home/TopRatedSection';
import FeaturedChartersSection from '@/components/home/FeaturedChartersSection';
import AvaliacoesHomeSection from '@/components/home/AvaliacoesHomeSection';
import BenefitsSection from '@/components/home/BenefitsSection';
import MomentsSection from '@/components/home/MomentsSection';
import { getTiposEmbarcacaoComRoteiro } from '@/lib/tipos-embarcacao';
import { getFiltrosVenda } from '@/lib/vendas-filtros';
import { getRoteirosRecentes, getFavoritosRoteiroSet } from '@/lib/roteiros-top';
import { createClient } from '@/lib/supabase/server';

/**
 * Topo da home. No lançamento há poucos passeios, e a busca completa
 * (`HeroSection`: destino + data + pessoas) levava a "nenhum resultado" — por
 * isso a home abre com a vitrine de todos os passeios. A busca completa fica
 * guardada: para voltar a ela, `HERO_PADRAO = 'busca'`.
 *
 * Para comparar as opções sem deploy: `/?hero=mar`, `/?hero=areia`, `/?hero=busca`.
 */
type ModoHero = 'busca' | VarianteVitrine;
const HERO_PADRAO: ModoHero = 'mar';
const MODOS_HERO: ModoHero[] = ['busca', 'mar', 'areia'];

/** Teto da vitrine: com mais que isso, é hora de voltar à busca completa. */
const LIMITE_VITRINE = 24;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ hero?: string }>;
}) {
  const { hero } = await searchParams;
  const modo: ModoHero = MODOS_HERO.includes(hero as ModoHero) ? (hero as ModoHero) : HERO_PADRAO;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {modo === 'busca' ? <HeroBusca /> : <HeroVitrineServidor variante={modo} />}
        {/* "Novos Roteiros" repetiria a vitrine — só aparece com a busca completa. */}
        {modo === 'busca' && <FeaturedChartersSection />}
        <TopRatedSection />
        <AvaliacoesHomeSection />
        <BenefitsSection />
        <MomentsSection />
      </main>
      <Footer />
    </div>
  );
}

async function HeroBusca() {
  const [tiposEmbarcacao, filtrosVenda] = await Promise.all([
    getTiposEmbarcacaoComRoteiro(),
    getFiltrosVenda(),
  ]);
  return (
    <HeroSection
      tiposEmbarcacao={tiposEmbarcacao}
      tiposVenda={filtrosVenda.tipos}
      locaisVenda={filtrosVenda.locais}
    />
  );
}

async function HeroVitrineServidor({ variante }: { variante: VarianteVitrine }) {
  const roteiros = await getRoteirosRecentes(LIMITE_VITRINE);
  // Sem nenhum passeio ativo, a vitrine não teria o que mostrar.
  if (roteiros.length === 0) return <HeroBusca />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const favoritos = user
    ? await getFavoritosRoteiroSet(user.id, roteiros.map((r) => r.id))
    : new Set<string>();

  return (
    <HeroVitrine
      variante={variante}
      roteiros={roteiros.map((r) => ({ ...r, favorito: favoritos.has(r.id) }))}
    />
  );
}
