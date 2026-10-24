import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import HeroSection from '@/components/home/HeroSection';
import TopRatedSection from '@/components/home/TopRatedSection';
import FeaturedChartersSection from '@/components/home/FeaturedChartersSection';
import AvaliacoesHomeSection from '@/components/home/AvaliacoesHomeSection';
import BenefitsSection from '@/components/home/BenefitsSection';
import MomentsSection from '@/components/home/MomentsSection';
import { getTiposEmbarcacaoComRoteiro } from '@/lib/tipos-embarcacao';
import { getFiltrosVenda } from '@/lib/vendas-filtros';

export default async function HomePage() {
  const [tiposEmbarcacao, filtrosVenda] = await Promise.all([
    getTiposEmbarcacaoComRoteiro(),
    getFiltrosVenda(),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <HeroSection
          tiposEmbarcacao={tiposEmbarcacao}
          tiposVenda={filtrosVenda.tipos}
          locaisVenda={filtrosVenda.locais}
        />
        <FeaturedChartersSection />
        <TopRatedSection />
        <AvaliacoesHomeSection />
        <BenefitsSection />
        <MomentsSection />
      </main>
      <Footer />
    </div>
  );
}
