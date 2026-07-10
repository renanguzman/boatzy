import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getRoteirosTopAvaliados, getFavoritosRoteiroSet } from '@/lib/roteiros-top';
import FeaturedRoteiros, { type FeaturedRoteiroItem } from './FeaturedRoteiros';

export default async function FeaturedChartersSection() {
  // Lista global (SSR). Se o navegador do usuário já tem permissão de
  // geolocalização, o client (FeaturedRoteiros) troca pela lista próxima a ele.
  const roteiros = await getRoteirosTopAvaliados({ limit: 3 });

  // Sem nenhum roteiro avaliado na plataforma, a seção não aparece.
  if (roteiros.length === 0) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const favoritos = user
    ? await getFavoritosRoteiroSet(
        user.id,
        roteiros.map((r) => r.id),
      )
    : new Set<string>();

  const inicial: FeaturedRoteiroItem[] = roteiros.map((r) => ({
    ...r,
    favorito: favoritos.has(r.id),
  }));

  return (
    <section className="py-16 bg-slate-50/50" id="featured-charters-section">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-semibold text-cyan-600 uppercase tracking-widest mb-1">
              Roteiros Selecionados
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-[#0B2447]">
              Roteiros Mais Bem{' '}
              <span className="bg-gradient-to-r from-[#0B3D91] to-cyan-500 bg-clip-text text-transparent">
                Avaliados
              </span>
            </h2>
          </div>
          <Link
            href="/buscar"
            className="hidden md:flex items-center gap-1.5 text-sm font-medium text-[#0B3D91] hover:text-cyan-600 transition-colors group"
          >
            Ver Mais
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Cards Grid */}
        <FeaturedRoteiros inicial={inicial} />

        {/* Mobile CTA */}
        <div className="md:hidden mt-6 text-center">
          <Link
            href="/buscar"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0B3D91]"
          >
            Ver Todos os Roteiros
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
