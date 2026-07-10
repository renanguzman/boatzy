import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getEmbarcacoesTopAvaliadas, getFavoritosEmbarcacaoSet } from '@/lib/embarcacoes-top';
import TopRatedBoats, { type TopRatedItem } from './TopRatedBoats';

export default async function TopRatedSection() {
  // Lista global (SSR). Se o navegador do usuário já tem permissão de
  // geolocalização, o client (TopRatedBoats) troca pela lista próxima a ele.
  const embarcacoes = await getEmbarcacoesTopAvaliadas({ limit: 4 });

  // Sem nenhuma embarcação avaliada na plataforma, a seção não aparece.
  if (embarcacoes.length === 0) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const favoritos = user
    ? await getFavoritosEmbarcacaoSet(
        user.id,
        embarcacoes.map((e) => e.id),
      )
    : new Set<string>();

  const inicial: TopRatedItem[] = embarcacoes.map((e) => ({
    ...e,
    favorito: favoritos.has(e.id),
  }));

  return (
    <section className="py-16 bg-white" id="top-rated-section">
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
            href="/buscar?tipo=embarcacao"
            className="hidden md:flex items-center gap-1.5 text-sm font-medium text-[#0B3D91] hover:text-cyan-600 transition-colors group"
          >
            Ver Todas
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Cards Grid */}
        <TopRatedBoats inicial={inicial} />

        {/* Mobile CTA */}
        <div className="md:hidden mt-6 text-center">
          <Link
            href="/buscar?tipo=embarcacao"
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
