'use client';

import { useJsApiLoader } from '@react-google-maps/api';

// Mesmas opções em todos os mapas: o loader do @react-google-maps é um
// singleton por página e lança erro se for chamado com opções diferentes numa
// navegação client-side (/buscar → /roteiros/[id] → painel).
const LIBRARIES: 'places'[] = ['places'];

// Idioma do site → código do Google Maps (rótulos do mapa).
const IDIOMA_MAPS: Record<string, string> = { 'pt-BR': 'pt-BR', 'en-US': 'en', es: 'es-419' };

let idiomaDoDocumento: string | undefined;

/**
 * Loader único do Google Maps (SPEC §94.4). O idioma é o do `<html lang>` na
 * primeira carga e vale até a página recarregar — a troca de idioma recarrega a
 * página, e o painel aberto por navegação client-side herda o mesmo loader.
 */
export function useGoogleMaps() {
  if (typeof document !== 'undefined') {
    idiomaDoDocumento ??= IDIOMA_MAPS[document.documentElement.lang] ?? 'pt-BR';
  }
  return useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: LIBRARIES,
    language: idiomaDoDocumento,
  });
}
