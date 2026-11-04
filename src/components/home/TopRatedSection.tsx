import Link from 'next/link';
import { ArrowRight, Anchor } from 'lucide-react';
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
    <section className="pt-8 md:pb-16 bg-white" id="top-rated-section">
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

        {/* CTA ao proprietário — celular: faixa marinho de ponta a ponta, encostada na próxima seção */}
        <Link
          href="/painel/login"
          className="md:hidden group -mx-4 mt-8 flex items-center gap-3 bg-gradient-to-r from-marinho to-marinho-escuro px-4 py-4 text-white active:opacity-90"
        >
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destaque/15 ring-1 ring-destaque/40">
            <Anchor className="h-4 w-4 text-destaque" />
          </span>
          <span className="flex-1 text-sm font-semibold leading-snug">{t('ctaProprietario')}</span>
          <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-destaque transition-transform group-active:translate-x-0.5" />
        </Link>

        {/* CTA ao proprietário — desktop: botão amarelo (destaque) centralizado sob a grade */}
        <div className="hidden md:flex justify-center mt-10">
          <Link
            href="/painel/login"
            className="group inline-flex items-center gap-3 rounded-full bg-destaque py-2 pl-2 pr-6 text-sm font-semibold text-marinho shadow-lg shadow-destaque/30 ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-destaque/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marinho"
          >
            <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-marinho text-destaque transition-transform duration-500 group-hover:rotate-[-12deg]">
              <Anchor className="h-4 w-4" />
            </span>
            {t('ctaProprietario')}
            <ArrowRight aria-hidden className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
