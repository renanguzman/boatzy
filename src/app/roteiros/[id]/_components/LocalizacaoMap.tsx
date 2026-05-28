'use client';

import { useJsApiLoader, GoogleMap, Marker } from '@react-google-maps/api';
import { Loader2 } from 'lucide-react';

const CONTAINER_STYLE = { width: '100%', height: '320px' };
const LIBRARIES: ('places')[] = ['places'];

type Props = { lat: number; lng: number };

export default function LocalizacaoMap({ lat, lng }: Props) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: LIBRARIES,
  });

  const position = { lat, lng };

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-20 rounded-xl border border-red-200 bg-red-50 text-sm text-red-600">
        Erro ao carregar o mapa. Verifique a chave da API.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-[320px] rounded-xl bg-slate-100 gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando mapa...
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
