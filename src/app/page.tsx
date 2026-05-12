import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import HeroSection from '@/components/home/HeroSection';
import TrustBadges from '@/components/home/TrustBadges';
import TopRatedSection from '@/components/home/TopRatedSection';
import FeaturedChartersSection from '@/components/home/FeaturedChartersSection';
import BenefitsSection from '@/components/home/BenefitsSection';
import MomentsSection from '@/components/home/MomentsSection';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <HeroSection />
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
