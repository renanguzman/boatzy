'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations, type Messages } from 'next-intl';
import { Search, ChevronDown, MessageCircle, X } from 'lucide-react';

/** Perguntas (`Ajuda.faq.<id>`) por categoria (`Ajuda.categorias.<id>`), na ordem de exibição. */
const FAQ: { id: IdPergunta; categoria: IdCategoria }[] = [
  { id: 'reservar', categoria: 'reservas' },
  { id: 'confirmacao', categoria: 'reservas' },
  { id: 'cancelar', categoria: 'reservas' },
  { id: 'status', categoria: 'reservas' },
  { id: 'cupom', categoria: 'reservas' },
  { id: 'pagamento', categoria: 'pagamentos' },
  { id: 'criarConta', categoria: 'conta' },
  { id: 'dados', categoria: 'conta' },
  { id: 'senha', categoria: 'conta' },
  { id: 'anunciar', categoria: 'embarcacoes' },
  { id: 'diferenca', categoria: 'embarcacoes' },
  { id: 'conversar', categoria: 'embarcacoes' },
  { id: 'filtros', categoria: 'busca' },
  { id: 'favoritar', categoria: 'busca' },
  { id: 'avaliar', categoria: 'avaliacoes' },
  { id: 'moderacao', categoria: 'avaliacoes' },
  { id: 'responsabilidade', categoria: 'seguranca' },
  { id: 'privacidade', categoria: 'seguranca' },
  { id: 'vendas', categoria: 'vendas' },
];

type IdPergunta = keyof Messages['Ajuda']['faq'];
type IdCategoria = keyof Messages['Ajuda']['categorias'];

const CATEGORIAS = Array.from(new Set(FAQ.map((item) => item.categoria)));

/** Destino de cada tag de link usada nas respostas (`<reservas>…</reservas>`). */
const LINKS = {
  buscar: '/buscar',
  reservas: '/minhas-reservas',
  entrar: '/entrar',
  conta: '/minha-conta',
  painel: '/painel/login',
  conversas: '/minhas-conversas',
  favoritos: '/favoritos',
  termos: '/terms',
  privacidade: '/privacy',
  vendas: '/vendas',
} as const;

const linkClass = 'text-marinho underline hover:no-underline';

export default function FaqContent() {
  const t = useTranslations('Ajuda');
  const tFiltros = useTranslations('Filtros');
  const [busca, setBusca] = useState('');
  const [abertos, setAbertos] = useState<Set<number>>(new Set());

  const termo = busca.trim().toLowerCase();

  // Respostas com links e negrito; para a busca, a mesma resposta em texto puro.
  const tags = {
    b: (texto: ReactNode) => <strong>{texto}</strong>,
    ...Object.fromEntries(
      Object.entries(LINKS).map(([tag, href]) => [
        tag,
        (texto: ReactNode) => <Link href={href} className={linkClass}>{texto}</Link>,
      ]),
    ),
  };
  const tagsTexto = Object.fromEntries(['b', ...Object.keys(LINKS)].map((tag) => [tag, (texto: string) => texto]));

  const itens = FAQ.map((item, index) => ({
    index,
    categoria: item.categoria,
    pergunta: t(`faq.${item.id}.pergunta`),
    resposta: t.rich(`faq.${item.id}.resposta`, tags),
    respostaTexto: t.markup(`faq.${item.id}.resposta`, tagsTexto),
  }));

  const resultados = termo
    ? itens.filter((item) =>
        item.pergunta.toLowerCase().includes(termo) ||
        t(`categorias.${item.categoria}`).toLowerCase().includes(termo) ||
        item.respostaTexto.toLowerCase().includes(termo))
    : itens;

  const porCategoria = CATEGORIAS.map((categoria) => ({
    categoria,
    itens: resultados.filter((item) => item.categoria === categoria),
  })).filter((grupo) => grupo.itens.length > 0);

  function toggle(index: number) {
    setAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <div>
      {/* Busca */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={t('buscaPlaceholder')}
          aria-label={t('buscaRotulo')}
          className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-11 text-sm text-grafite placeholder:text-slate-400 shadow-sm focus:border-marinho focus:outline-none focus:ring-2 focus:ring-marinho/20 transition-all"
        />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca('')}
            aria-label={tFiltros('limparBusca')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {termo && (
        <p className="mt-3 text-sm text-slate-500">
          {resultados.length === 0 ? t('nenhuma') : t('encontradas', { count: resultados.length })}
        </p>
      )}

      {/* Lista por categoria */}
      <div className="mt-8 space-y-10">
        {porCategoria.map(({ categoria, itens }) => (
          <div key={categoria}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-marinho mb-3">
              {t(`categorias.${categoria}`)}
            </h2>
            <div className="space-y-3">
              {itens.map((item) => {
                const { index } = item;
                const aberto = abertos.has(index);
                return (
                  <div
                    key={index}
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(index)}
                      aria-expanded={aberto}
                      className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                    >
                      <span className="text-sm sm:text-base font-medium text-marinho">
                        {item.pergunta}
                      </span>
                      <ChevronDown
                        className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${
                          aberto ? 'rotate-180 text-marinho' : ''
                        }`}
                      />
                    </button>
                    <div
                      className={`grid transition-all duration-200 ease-in-out ${
                        aberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="px-5 pb-5 text-sm text-slate-600 leading-relaxed">
                          {item.resposta}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {termo && resultados.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
            <p className="text-slate-600">{t('semResultado', { busca })}</p>
          </div>
        )}
      </div>

      {/* CTA de contato */}
      <div className="mt-12 rounded-2xl bg-marinho text-white p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-center sm:text-left">
          <div className="h-11 w-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">{t('ctaTitulo')}</p>
            <p className="text-sm text-slate-300">{t('ctaTexto')}</p>
          </div>
        </div>
        <Link
          href="/contact"
          className="shrink-0 bg-white text-marinho font-semibold text-sm px-5 py-3 rounded-xl hover:bg-slate-100 transition-colors"
        >
          {t('ctaBotao')}
        </Link>
      </div>
    </div>
  );
}
