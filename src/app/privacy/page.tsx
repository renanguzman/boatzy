import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CabecalhoLegal from '@/components/legal/CabecalhoLegal';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PoliticaPrivacidade');
  return { title: t('metaTitulo'), description: t('metaDescricao') };
}

const tituloClass = 'text-xl font-semibold text-grafite';
const listaClass = 'mt-3 list-disc space-y-1 pl-5';
const linkClass = 'text-marinho underline hover:no-underline';

const marcacao = {
  b: (texto: ReactNode) => <strong>{texto}</strong>,
  em: (texto: ReactNode) => <em>{texto}</em>,
  email: (texto: ReactNode) => <a href="mailto:adm@boatzy.app" className={linkClass}>{texto}</a>,
};

const LINHAS_BASE_LEGAL = ['conta', 'login', 'operar', 'personalizar', 'avisos', 'legal', 'fraude'] as const;

/** Itens da tabela de cookies: nome técnico (não se traduz), origem, categoria e duração. */
const COOKIES = [
  { nome: 'sb-…-auth-token', item: 'auth', origem: 'supabase', categoria: 'necessario', duracao: 'propria' },
  { nome: 'NEXT_LOCALE', item: 'idioma', origem: 'boatzy', categoria: 'necessario', duracao: 'propria' },
  { nome: 'boatzy_recent_locations', item: 'locais', origem: 'navegador', categoria: 'necessario', duracao: 'ateLimpar' },
  { nome: 'boatzy:tutorial-painel:v1', item: 'tutorial', origem: 'navegador', categoria: 'necessario', duracao: 'ateLimpar' },
  { nome: 'ga:…', item: 'gaLocal', origem: 'navegador', categoria: 'medicao', duracao: 'ateLimpar' },
  { nome: '_ga', item: 'ga', origem: 'ga', categoria: 'medicao', duracao: 'doisAnos' },
  { nome: '_ga_4QJF8H6EDJ', item: 'gaSessao', origem: 'ga', categoria: 'medicao', duracao: 'doisAnos' },
] as const;

export default async function PrivacyPage() {
  const t = await getTranslations('PoliticaPrivacidade');
  const r = (chave: Parameters<typeof t.rich>[0]) => t.rich(chave, marcacao);

  return (
    <>
      <Header />

      <main className="flex-1 bg-areia">
        <CabecalhoLegal titulo={t('titulo')} atualizadoEm="2026-10-26" />

        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
          {/* Aviso de status */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>{r('status')}</p>
          </div>

          <article className="mt-10 space-y-10 text-slate-700 leading-relaxed">
            <section>
              <h2 className={tituloClass}>{t('s1.titulo')}</h2>
              <p className="mt-3">{r('s1.p1')}</p>
              <p className="mt-3">{r('s1.p2')}</p>
              <ul className={listaClass}>
                <li>{r('s1.controlador')}</li>
                <li>{r('s1.canal')}</li>
                <li>{r('s1.site')}</li>
              </ul>
            </section>

            <section>
              <h2 className={tituloClass}>{t('s2.titulo')}</h2>
              <p className="mt-3">{t('s2.p1')}</p>
              <p className="mt-3 font-medium text-grafite">{t('s2.a')}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {(['a1', 'a2', 'a3', 'a4', 'a5'] as const).map((i) => <li key={i}>{t(`s2.${i}`)}</li>)}
              </ul>
              <p className="mt-3 font-medium text-grafite">{t('s2.b')}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {(['b1', 'b2', 'b3'] as const).map((i) => <li key={i}>{t(`s2.${i}`)}</li>)}
              </ul>
              <blockquote className="mt-4 border-l-4 border-slate-300 pl-4 italic text-slate-600">
                {r('s2.minimizacao')}
              </blockquote>
            </section>

            <section>
              <h2 className={tituloClass}>{t('s3.titulo')}</h2>
              <p className="mt-3">{t('s3.p1')}</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-left">
                      <th className="border border-slate-200 px-3 py-2 font-semibold text-grafite">{t('s3.finalidade')}</th>
                      <th className="border border-slate-200 px-3 py-2 font-semibold text-grafite">{t('s3.base')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LINHAS_BASE_LEGAL.map((linha) => (
                      <tr key={linha}>
                        <td className="border border-slate-200 px-3 py-2 align-top">{t(`s3.linhas.${linha}.f`)}</td>
                        <td className="border border-slate-200 px-3 py-2 align-top">{t(`s3.linhas.${linha}.b`)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4">
                <strong>{t('s3.naoVendemos')}</strong>
              </p>
            </section>

            <section>
              <h2 className={tituloClass}>{t('s4.titulo')}</h2>
              <p className="mt-3">{t('s4.p1')}</p>
              <ul className={listaClass}>
                <li>{r('s4.i1')}</li>
                <li>{r('s4.i2')}</li>
                <li>{r('s4.i3')}</li>
              </ul>
              <p className="mt-3">{t('s4.p2')}</p>
            </section>

            <section>
              <h2 className={tituloClass}>{t('s5.titulo')}</h2>
              <p className="mt-3">{r('s5.p')}</p>
            </section>

            <section id="cookies" className="scroll-mt-24">
              <h2 className={tituloClass}>{t('s6.titulo')}</h2>
              <p className="mt-3">{t('s6.p1')}</p>
              <ul className="mt-3 list-disc pl-6 space-y-2">
                <li>{r('s6.necessarios')}</li>
                <li>{r('s6.medicao')}</li>
              </ul>

              <h3 className="mt-6 font-semibold text-grafite">{t('s6.controlarTitulo')}</h3>
              <p className="mt-3">{t('s6.controlar')}</p>

              <h3 className="mt-6 font-semibold text-grafite">{t('s6.tabelaTitulo')}</h3>
              <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2 pl-3 pr-3 font-semibold">{t('s6.colunas.nome')}</th>
                      <th className="py-2 pr-3 font-semibold">{t('s6.colunas.deQuem')}</th>
                      <th className="py-2 pr-3 font-semibold">{t('s6.colunas.categoria')}</th>
                      <th className="py-2 pr-3 font-semibold">{t('s6.colunas.paraQue')}</th>
                      <th className="py-2 pr-3 font-semibold">{t('s6.colunas.duracao')}</th>
                    </tr>
                  </thead>
                  <tbody className="[&_td:first-child]:pl-3">
                    {COOKIES.map((c) => (
                      <tr key={c.nome} className="border-t border-slate-100 align-top">
                        <td className="py-2 pr-3 font-mono text-xs text-grafite">{c.nome}</td>
                        <td className="py-2 pr-3">{t(`s6.origem.${c.origem}`)}</td>
                        <td className="py-2 pr-3">{t(`s6.categorias.${c.categoria}`)}</td>
                        <td className="py-2 pr-3">{t(`s6.itens.${c.item}.para`)}</td>
                        <td className="py-2">
                          {c.duracao === 'propria'
                            ? t(`s6.itens.${c.item as 'auth' | 'idioma'}.duracao`)
                            : t(`s6.${c.duracao}`)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm text-slate-500">{t('s6.google')}</p>
            </section>

            {(['s7', 's8'] as const).map((s) => (
              <section key={s}>
                <h2 className={tituloClass}>{t(`${s}.titulo`)}</h2>
                <p className="mt-3">{t(`${s}.p`)}</p>
              </section>
            ))}

            <section>
              <h2 className={tituloClass}>{t('s9.titulo')}</h2>
              <p className="mt-3">{t('s9.p1')}</p>
              <ul className={listaClass}>
                {(['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7'] as const).map((i) => <li key={i}>{t(`s9.${i}`)}</li>)}
              </ul>
              <p className="mt-3">{r('s9.p2')}</p>
            </section>

            {(['s10', 's11'] as const).map((s) => (
              <section key={s}>
                <h2 className={tituloClass}>{t(`${s}.titulo`)}</h2>
                <p className="mt-3">{t(`${s}.p`)}</p>
              </section>
            ))}

            <section>
              <h2 className={tituloClass}>{t('s12.titulo')}</h2>
              <p className="mt-3">{t('s12.p')}</p>
              <p className="mt-3">
                {'📧 '}
                <a
                  href="mailto:adm@boatzy.app"
                  className="font-semibold text-marinho underline hover:no-underline"
                >
                  {'adm@boatzy.app'}
                </a>
              </p>
              <p className="mt-3 text-sm italic text-slate-500">{t('s12.dpo')}</p>
            </section>
          </article>
        </div>
      </main>

      <Footer />
    </>
  );
}
