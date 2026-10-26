'use client';

import { GoogleMap, Marker } from '@react-google-maps/api';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { useGoogleMaps } from '@/lib/google-maps';

const CONTAINER_STYLE = { width: '100%', height: '320px' };

type Props = { lat: number; lng: number };

export default function LocalizacaoMap({ lat, lng }: Props) {
  const { isLoaded, loadError } = useGoogleMaps();
  const t = useTranslations('Busca.mapa');

  const position = { lat, lng };

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-20 rounded-xl border border-red-200 bg-red-50 text-sm text-red-600">
        {t('erro')}
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-[320px] rounded-xl bg-slate-100 gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('carregando')}
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      <GoogleMap
        mapContainerStyle={CONTAINER_STYLE}
        center={position}
        zoom={15}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          zoomControlOptions: { position: 7 },
          gestureHandling: 'cooperative',
          clickableIcons: false,
        }}
      >
        <Marker position={position} />
      </GoogleMap>
    </div>
  );
}
