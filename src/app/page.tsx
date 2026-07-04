import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import HeroSection from '@/components/home/HeroSection';
import TrustBadges from '@/components/home/TrustBadges';
import TopRatedSection from '@/components/home/TopRatedSection';
import FeaturedChartersSection from '@/components/home/FeaturedChartersSection';
import BenefitsSection from '@/components/home/BenefitsSection';
import MomentsSection from '@/components/home/MomentsSection';
import { getTiposEmbarcacaoComRoteiro } from '@/lib/tipos-embarcacao';

export default async function HomePage() {
  const tiposEmbarcacao = await getTiposEmbarcacaoComRoteiro();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <HeroSection tiposEmbarcacao={tiposEmbarcacao} />
        <TrustBadges />
        <TopRatedSection />
        <FeaturedChartersSection />
        <BenefitsSection />
        <MomentsSection />
      </main>
      <Footer />
    </div>
  );
}
