import Image from 'next/image';
import Link from 'next/link';
import { Quote, Star, MapPin, ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getAvaliacoesCincoEstrelas } from '@/lib/avaliacoes';
import { getFormatos } from '@/i18n/formatos-servidor';

/**
 * Prova social da home: avaliações reais nota 5 (aprovadas, com comentário),
 * cada uma ligada ao roteiro avaliado. Sem nenhuma, a seção não aparece.
 */
export default async function AvaliacoesHomeSection() {
  const avaliacoes = await getAvaliacoesCincoEstrelas(6);
  if (avaliacoes.length === 0) return null;
  const [t, f] = await Promise.all([getTranslations('Home.avaliacoes'), getFormatos()]);

  return (
    <section className="py-16 bg-areia" id="avaliacoes-section">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-xs font-semibold text-turquesa-escuro uppercase tracking-widest mb-1">
            {t('sobretitulo')}
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-marinho">
            {t.rich('titulo', { destaque: (texto) => <span className="bg-gradient-to-r from-marinho to-turquesa bg-clip-text text-transparent">{texto}</span> })}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {t('descricao')}
          </p>
        </div>

        {/* Centralizado: com 1 ou 2 avaliações o grid não fica torto */}
        <div className="flex flex-wrap justify-center gap-6">
          {avaliacoes.map((a) => (
            <article
              key={a.id}
              className="flex flex-col w-full md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-0.5" aria-label={t('nota5')}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className="h-4 w-4 fill-destaque text-destaque" />
                  ))}
                </span>
                <Quote aria-hidden className="h-6 w-6 text-turquesa/30" />
              </div>

              <p className="mt-4 flex-1 text-sm text-slate-600 leading-relaxed whitespace-pre-line line-clamp-6">
                {a.comentario}
              </p>

              <div className="mt-5 flex items-center gap-3">
                <div className="relative h-10 w-10 shrink-0 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center">
                  {a.avatarUrl ? (
                    <Image src={a.avatarUrl} alt="" fill className="object-cover" sizes="40px" />
                  ) : (
                    <span className="text-sm font-bold text-slate-400">{a.autor.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-marinho truncate">{a.autor}</p>
                  <p className="text-xs text-slate-400">
                    {f.data(a.created_at, { month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {a.roteiro && (
                <Link
                  href={`/roteiros/${a.roteiro.id}`}
                  className="group mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500 hover:text-marinho transition-colors"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <MapPin aria-hidden className="h-3.5 w-3.5 shrink-0 text-turquesa-escuro" />
                    <span className="truncate" title={a.roteiro.localidade ? `${a.roteiro.nome} · ${a.roteiro.localidade}` : a.roteiro.nome}>
                      <span className="font-semibold text-slate-700 group-hover:text-marinho">{a.roteiro.nome}</span>
                      {a.roteiro.localidade && ` · ${a.roteiro.localidade}`}
                    </span>
                  </span>
                  <ArrowRight aria-hidden className="h-3.5 w-3.5 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
