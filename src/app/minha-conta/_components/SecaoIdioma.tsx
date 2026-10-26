'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Languages, Loader2 } from 'lucide-react';
import { alterarIdioma } from '@/i18n/actions';
import { IDIOMAS, NOMES_IDIOMA, type Idioma } from '@/i18n/config';
import { rastrear } from '@/lib/analytics';
import BandeiraIdioma from '@/components/layout/BandeiraIdioma';

/**
 * "Idioma" em Minha conta (SPEC §94.4): o mesmo efeito do seletor do Header — grava o cookie e
 * `users.idioma` e recarrega a página no idioma escolhido.
 */
export default function SecaoIdioma() {
  const t = useTranslations('MinhaConta');
  const tSeletor = useTranslations('SeletorIdioma');
  const atual = useLocale();
  const [trocandoPara, setTrocandoPara] = useState<Idioma | null>(null);

  async function escolher(idioma: Idioma) {
    if (idioma === atual || trocandoPara) return;
    setTrocandoPara(idioma);
    const resultado = await alterarIdioma(idioma);
    if (!resultado.ok) {
      setTrocandoPara(null);
      return;
    }
    rastrear('troca_idioma', { de: atual, para: idioma, origem: 'minha_conta' });
    window.location.reload();
  }

  return (
    <div id="idioma" className="scroll-mt-32 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-center gap-2">
        <Languages className="h-5 w-5 text-marinho" />
        <h3 className="text-base font-bold text-marinho">{t('secoes.idioma')}</h3>
      </div>
      <p className="mt-0.5 text-sm text-slate-500">{t('idioma.subtitulo')}</p>

      <div role="radiogroup" aria-label={tSeletor('titulo')} className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {IDIOMAS.map((idioma) => {
          const selecionado = idioma === atual;
          return (
            <button
              key={idioma}
              type="button"
              role="radio"
              aria-checked={selecionado}
              lang={idioma}
              disabled={trocandoPara !== null}
              onClick={() => escolher(idioma)}
              className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm transition-colors disabled:cursor-wait ${
                selecionado
                  ? 'border-marinho bg-marinho/[0.04] font-semibold text-marinho'
                  : 'border-slate-200 text-slate-700 hover:border-marinho/40'
              }`}
            >
              <BandeiraIdioma idioma={idioma} tamanho={22} />
              <span className="flex-1">{NOMES_IDIOMA[idioma].nome}</span>
              {trocandoPara === idioma ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label={tSeletor('alterando')} />
              ) : (
                selecionado && <Check className="h-4 w-4 text-turquesa-escuro" />
              )}
            </button>
          );
        })}
      </div>

      {atual !== 'pt-BR' && (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
          {t('idioma.emailsPt')}
        </p>
      )}
    </div>
  );
}
