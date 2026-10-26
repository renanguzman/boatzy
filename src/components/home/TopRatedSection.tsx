import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { getEmbarcacoesRecentes, getFavoritosEmbarcacaoSet } from '@/lib/embarcacoes-top';
import TopRatedBoats, { type TopRatedItem } from './TopRatedBoats';

export default async function TopRatedSection() {
  // TODO(avaliações): no lançamento ainda não há avaliações, então a seção
  // mostra as últimas embarcações cadastradas ("Novas Embarcações"). Quando
  // houver avaliações suficientes, voltar ao ranking: trocar por
  // `getEmbarcacoesTopAvaliadas({ limit: 4 })`, tirar `porProximidade={false}`
  // do <TopRatedBoats> e restaurar o título "Embarcações Mais Bem Avaliadas".
  const [embarcacoes, t] = await Promise.all([getEmbarcacoesRecentes(4), getTranslations('Home.novasEmbarcacoes')]);

  // Sem nenhuma embarcação ativa com roteiro, a seção não aparece.
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
    <section className="pt-8 pb-16 bg-white" id="top-rated-section">
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
            href="/buscar?tipo=embarcacao"
            className="hidden md:flex items-center gap-1.5 text-sm font-medium text-marinho hover:text-turquesa-escuro transition-colors group"
          >
            {t('verTodas')}
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Cards Grid */}
        <TopRatedBoats inicial={inicial} porProximidade={false} />

        {/* Mobile CTA */}
        <div className="md:hidden mt-6 text-center">
          <Link
            href="/buscar?tipo=embarcacao"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-marinho"
          >
            {t('verTodasEmbarcacoes')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
