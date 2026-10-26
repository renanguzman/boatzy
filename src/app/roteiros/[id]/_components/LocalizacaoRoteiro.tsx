'use client';

import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Map as MapaIcone, Navigation } from 'lucide-react';
import LocalizacaoMap from './LocalizacaoMap';

type Props = {
  lat: number;
  lng: number;
  /** Bloco do endereço textual (montado na view). */
  endereco: ReactNode;
};

const DESKTOP = '(min-width: 1024px)';

function assinarDesktop(aoMudar: () => void) {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener('change', aoMudar);
  return () => mq.removeEventListener('change', aoMudar);
}

/**
 * Ponto de embarque: endereço + atalhos para Google Maps e Waze. O mapa interativo
 * (Google Maps JS, pesado) carrega direto no desktop; no celular, só quando a
 * pessoa pede — a rolagem até a reserva fica mais curta e leve.
 */
export default function LocalizacaoRoteiro({ lat, lng, endereco }: Props) {
  const t = useTranslations('Roteiro.localizacao');
  const [pediuMapa, setPediuMapa] = useState(false);
  // Desktop (lg+): mapa aberto direto. No servidor (e na hidratação) conta como celular.
  const ehDesktop = useSyncExternalStore(assinarDesktop, () => window.matchMedia(DESKTOP).matches, () => false);
  const mostrarMapa = ehDesktop || pediuMapa;

  const googleMaps = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  const waze = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  const atalho = 'flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-marinho hover:bg-slate-50 transition-colors';

  return (
    <div>
      {mostrarMapa && (
        <div className="mb-4">
          <LocalizacaoMap lat={lat} lng={lng} />
        </div>
      )}

      {endereco}

      <div className="mt-3 flex gap-2">
        <a href={googleMaps} target="_blank" rel="noopener noreferrer" className={atalho}>
          <MapaIcone className="h-4 w-4" />
          Google Maps
        </a>
        <a href={waze} target="_blank" rel="noopener noreferrer" className={atalho}>
          <Navigation className="h-4 w-4" />
          Waze
        </a>
      </div>

      {!mostrarMapa && (
        <button
          type="button"
          onClick={() => setPediuMapa(true)}
          className="mt-2 w-full text-center text-sm font-semibold text-turquesa-escuro hover:underline underline-offset-4 py-2"
        >
          {t('verNoMapa')}
        </button>
      )}
    </div>
  );
}
