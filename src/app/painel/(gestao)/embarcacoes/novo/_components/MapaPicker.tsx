'use client';

import { useCallback, useRef, useState } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { Loader2, MapPin } from 'lucide-react';

const MAP_CONTAINER_STYLE = { width: '100%', height: '320px' };
const LIBRARIES: ('places')[] = ['places'];

// Brasil centralizado como fallback
const DEFAULT_CENTER = { lat: -15.7942, lng: -47.8822 };
const DEFAULT_ZOOM   = 4;
const PINNED_ZOOM    = 15;

type Props = {
  lat: string;
  lng: string;
  onChange: (lat: string, lng: string) => void;
};

export default function MapaPicker({ lat, lng, onChange }: Props) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const position = lat && lng
    ? { lat: parseFloat(lat), lng: parseFloat(lng) }
    : null;

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  function handleMapClick(e: google.maps.MapMouseEvent) {
    if (!e.latLng) return;
    onChange(
      e.latLng.lat().toFixed(7),
      e.latLng.lng().toFixed(7),
    );
  }

  function handleMarkerDragEnd(e: google.maps.MapMouseEvent) {
    if (!e.latLng) return;
    setIsDragging(false);
    onChange(
      e.latLng.lat().toFixed(7),
      e.latLng.lng().toFixed(7),
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-20 rounded-xl border border-red-200 bg-red-50 text-sm text-red-600">
        Erro ao carregar o mapa. Verifique a chave da API.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-20 gap-2 text-sm text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        Carregando mapa...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        <GoogleMap
          mapContainerStyle={MAP_CONTAINER_STYLE}
          center={position ?? DEFAULT_CENTER}
          zoom={position ? PINNED_ZOOM : DEFAULT_ZOOM}
          onLoad={onMapLoad}
          onClick={handleMapClick}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            zoomControlOptions: { position: 7 /* RIGHT_CENTER */ },
          }}
        >
          {position && (
            <Marker
              position={position}
              draggable
              onDragStart={() => setIsDragging(true)}
              onDragEnd={handleMarkerDragEnd}
              title="Arraste para ajustar a posição"
            />
          )}
        </GoogleMap>
      </div>

      {/* Coordenadas exibidas abaixo do mapa */}
      {position ? (
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <MapPin className="w-3 h-3 shrink-0" />
          {isDragging
            ? 'Ajustando posição...'
            : `${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}`}
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          Clique no mapa para marcar o ponto exato de atracação.
        </p>
      )}
    </div>
  );
}
