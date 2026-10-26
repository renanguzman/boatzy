'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { alterarIdioma } from '@/i18n/actions';
import { IDIOMAS, NOMES_IDIOMA, type Idioma } from '@/i18n/config';
import { rastrear } from '@/lib/analytics';
import BandeiraIdioma from './BandeiraIdioma';

/**
 * Seletor de idioma do Header (SPEC §94.4): bandeira discreta ao lado do
 * "Entrar" / menu da conta — no celular, só a bandeira, ao lado do menu. Abre
 * a lista dos idiomas com o nome na própria língua; a escolha grava o cookie
 * (e o perfil, se logado) e recarrega a página.
 */
export default function SeletorIdioma() {
  const locale = useLocale();
  const t = useTranslations('SeletorIdioma');
  const [open, setOpen] = useState(false);
  const [trocandoPara, setTrocandoPara] = useState<Idioma | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  async function escolher(idioma: Idioma) {
    if (idioma === locale || trocandoPara) {
      setOpen(false);
      return;
    }
    setTrocandoPara(idioma);
    const resultado = await alterarIdioma(idioma);
    if (!resultado.ok) {
      setTrocandoPara(null);
      return;
    }
    rastrear('troca_idioma', { de: locale, para: idioma });
    // Recarga completa, e não router.refresh(): o Google Maps não aceita ser
    // carregado de novo com outro idioma na mesma página.
    window.location.reload();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('alterar', { idioma: NOMES_IDIOMA[locale].nome })}
        title={NOMES_IDIOMA[locale].nome}
        id="seletor-idioma"
        className="flex items-center gap-1.5 rounded-full p-2 lg:pr-2.5 text-xs font-semibold tracking-wide text-slate-600 hover:bg-slate-50 hover:text-marinho transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marinho"
      >
        <BandeiraIdioma idioma={locale} />
        <span className="hidden lg:inline">{NOMES_IDIOMA[locale].sigla}</span>
        <ChevronDown className={`hidden lg:block h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t('titulo')}
          className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-900/5 overflow-hidden z-50 animate-in fade-in slide-in-from-top-1"
        >
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-marinho">{t('titulo')}</p>
          </div>

          <div className="py-1.5">
            {IDIOMAS.map((idioma) => {
              const atual = idioma === locale;
              return (
                <button
                  key={idioma}
                  type="button"
                  role="menuitemradio"
                  aria-checked={atual}
                  lang={idioma}
                  disabled={trocandoPara !== null}
                  onClick={() => escolher(idioma)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors disabled:cursor-wait ${
                    atual ? 'font-semibold text-marinho' : 'text-slate-700 hover:bg-slate-50 hover:text-marinho'
                  }`}
                >
                  <BandeiraIdioma idioma={idioma} />
                  <span className="flex-1 text-left">{NOMES_IDIOMA[idioma].nome}</span>
                  {trocandoPara === idioma ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label={t('alterando')} />
                  ) : (
                    atual && <Check className="h-4 w-4 text-turquesa-escuro" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
