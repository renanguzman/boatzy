import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { getRoteirosRecentes, getFavoritosRoteiroSet } from '@/lib/roteiros-top';
import FeaturedRoteiros, { type FeaturedRoteiroItem } from './FeaturedRoteiros';

export default async function FeaturedChartersSection() {
  // TODO(avaliações): no lançamento ainda não há avaliações, então a seção
  // mostra os últimos roteiros cadastrados ("Novos Roteiros"). Quando houver
  // avaliações suficientes, voltar ao ranking: trocar por
  // `getRoteirosTopAvaliados({ limit: 3 })`, tirar `porProximidade={false}`
  // do <FeaturedRoteiros> e restaurar o título "Roteiros Mais Bem Avaliados".
  const [roteiros, t] = await Promise.all([getRoteirosRecentes(3), getTranslations('Home.novosRoteiros')]);

  // Sem nenhum roteiro ativo na plataforma, a seção não aparece.
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
    <section className="py-8 bg-areia" id="featured-charters-section">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-semibold text-turquesa-escuro uppercase tracking-widest mb-1">
              {t('sobretitulo')}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-marinho">
              {t.rich('titulo', { destaque: (texto) => <span className="bg-gradient-to-r from-marinho to-turquesa bg-clip-text text-transparent">{texto}</span> })}
            </h2>
          </div>
          <Link
            href="/buscar"
            className="hidden md:flex items-center gap-1.5 text-sm font-medium text-marinho hover:text-turquesa-escuro transition-colors group"
          >
            {t('verMais')}
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Cards Grid */}
        <FeaturedRoteiros inicial={inicial} porProximidade={false} />

        {/* Mobile CTA */}
        <div className="md:hidden mt-6 text-center">
          <Link
            href="/buscar"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-marinho"
          >
            {t('verTodos')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
