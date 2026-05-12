import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import BoatCard from '@/components/ui/BoatCard';
import { topRatedBoats } from '@/lib/mock-data';

export default function TopRatedSection() {
  return (
    <section className="py-16 bg-slate-50/50" id="top-rated-section">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-semibold text-cyan-600 uppercase tracking-widest mb-1">
              Coleção de Destaque
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-[#0B2447]">
              Embarcações Mais Bem{' '}
              <span className="bg-gradient-to-r from-[#0B3D91] to-cyan-500 bg-clip-text text-transparent">
                Avaliadas
              </span>
            </h2>
          </div>
          <Link
            href="/boats"
            className="hidden md:flex items-center gap-1.5 text-sm font-medium text-[#0B3D91] hover:text-cyan-600 transition-colors group"
          >
            Ver Todas
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {topRatedBoats.map((boat) => (
            <BoatCard key={boat.id} boat={boat} />
          ))}
        </div>

        {/* Mobile CTA */}
        <div className="md:hidden mt-6 text-center">
          <Link
            href="/boats"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0B3D91]"
          >
            Ver Todas as Embarcações
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
