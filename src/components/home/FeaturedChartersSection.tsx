import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import BoatCard from '@/components/ui/BoatCard';
import { featuredCharters } from '@/lib/mock-data';

export default function FeaturedChartersSection() {
  return (
    <section className="py-16 bg-white" id="featured-charters-section">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-semibold text-cyan-600 uppercase tracking-widest mb-1">
              Charters Selecionados
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-[#0B2447]">
              Featured{' '}
              <span className="bg-gradient-to-r from-[#0B3D91] to-cyan-500 bg-clip-text text-transparent">
                Charters
              </span>
            </h2>
          </div>
          <Link
            href="/charters"
            className="hidden md:flex items-center gap-1.5 text-sm font-medium text-[#0B3D91] hover:text-cyan-600 transition-colors group"
          >
            Ver Mais
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredCharters.map((boat) => (
            <BoatCard key={boat.id} boat={boat} variant="featured" />
          ))}
        </div>
      </div>
    </section>
  );
}
