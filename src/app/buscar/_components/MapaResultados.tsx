'use client';

import { useCallback, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useJsApiLoader, GoogleMap, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { Loader2, Map as MapIcon, ArrowRight } from 'lucide-react';

/** Um resultado da busca com coordenada — roteiro ou embarcação. */
export type PontoMapa = {
  id: string;
  nome: string;
  lat: number;
  lng: number;
  /** Destino do link "Ver detalhes" (o mesmo href do card). */
  href: string;
  /** Linha de apoio: nome da embarcação (aba Roteiros) ou tipo (aba Embarcações). */
  subtitulo: string | null;
  localidade: string | null;
  preco: number | null;
  imagem: string | null;
};

type Props = {
  pontos: PontoMapa[];
  /** Total de resultados na página — usado no "X de Y com localização". */
  totalResultados: number;
  /** Rótulo do item no plural ("roteiros" | "embarcações"). */
  itemLabelPlural: string;
};

const CONTAINER_STYLE = { width: '100%', height: '100%' };

// As mesmas libraries de LocalizacaoMap: o loader do @react-google-maps é um
// singleton por sessão e reclama se for chamado com opções diferentes numa
// navegação client-side (/buscar → /roteiros/[id]).
const LIBRARIES: 'places'[] = ['places'];

const MAP_OPTIONS: google.maps.MapOptions = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  zoomControlOptions: { position: 7 },
  gestureHandling: 'cooperative',
  clickableIcons: false,
  // Menos ruído: sem POIs e sem rótulos de transporte, o pin do resultado é o
  // único elemento que compete pela atenção.
  styles: [
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ],
};

function formatPrice(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

/** Pin no azul do design; o ativo fica maior e no tom claro da marca. */
function pinIcon(ativo: boolean): google.maps.Icon {
  const fill = ativo ? '#0B3D91' : '#0B2447';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38">
    <path d="M15 0C7.27 0 1 6.27 1 14c0 10.5 14 24 14 24s14-13.5 14-24C29 6.27 22.73 0 15 0z" fill="${fill}"/>
    <circle cx="15" cy="14" r="5.2" fill="#ffffff"/>
  </svg>`;
  const escala = ativo ? 1.15 : 1;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(30 * escala, 38 * escala),
    anchor: new google.maps.Point(15 * escala, 38 * escala),
  };
}

export default function MapaResultados({ pontos, totalResultados, itemLabelPlural }: Props) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: LIBRARIES,
  });

  // Ponto com o card aberto. Abre no hover do pin e só fecha no X ou num
  // clique no mapa — fechar ao tirar o mouse impediria clicar no link.
  const [ativoId, setAtivoId] = useState<string | null>(null);
  const ativo = useMemo(() => pontos.find((p) => p.id === ativoId) ?? null, [pontos, ativoId]);

  const centro = useMemo(() => {
    if (pontos.length === 0) return { lat: -22.9068, lng: -43.1729 };
    const soma = pontos.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), {
      lat: 0,
      lng: 0,
    });
    return { lat: soma.lat / pontos.length, lng: soma.lng / pontos.length };
  }, [pontos]);

  // Enquadra todos os resultados. Com um único ponto, fitBounds daria zoom
  // máximo — nesse caso fixamos um zoom de bairro.
  const handleLoad = useCallback(
    (map: google.maps.Map) => {
      if (pontos.length === 0) return;
      if (pontos.length === 1) {
        map.setCenter({ lat: pontos[0].lat, lng: pontos[0].lng });
        map.setZoom(14);
        return;
      }
      const bounds = new google.maps.LatLngBounds();
      for (const p of pontos) bounds.extend({ lat: p.lat, lng: p.lng });
      map.fitBounds(bounds, 64);
    },
    [pontos],
  );

  if (pontos.length === 0) return null;

  return (
    <section className="mt-12 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <MapIcon className="h-4 w-4 text-[#0B3D91]" />
          <h2 className="text-sm font-semibold text-[#0B2447]">Mapa dos resultados</h2>
        </div>
        <p className="text-xs text-slate-400">
          {pontos.length === totalResultados
            ? `${pontos.length} ${pontos.length === 1 ? 'resultado' : itemLabelPlural} nesta página`
            : `${pontos.length} de ${totalResultados} com localização`}
        </p>
      </header>

      <div className="h-[420px] w-full bg-slate-100">
        {loadError ? (
          <div className="h-full flex items-center justify-center text-sm text-slate-500">
            Não foi possível carregar o mapa.
          </div>
        ) : !isLoaded ? (
          <div className="h-full flex items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando mapa…
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={CONTAINER_STYLE}
            center={centro}
            zoom={11}
            options={MAP_OPTIONS}
            onLoad={handleLoad}
            onClick={() => setAtivoId(null)}
          >
            {pontos.map((p) => (
              <MarkerF
                key={p.id}
                position={{ lat: p.lat, lng: p.lng }}
                title={p.nome}
                icon={pinIcon(p.id === ativoId)}
                zIndex={p.id === ativoId ? 10 : 1}
                onMouseOver={() => setAtivoId(p.id)}
                onClick={() => setAtivoId(p.id)}
              />
            ))}

            {ativo && (
              <InfoWindowF
                position={{ lat: ativo.lat, lng: ativo.lng }}
                onCloseClick={() => setAtivoId(null)}
                options={{
                  pixelOffset: new google.maps.Size(0, -38),
                  // O card segue o hover: reposicionar o mapa a cada pin seria
                  // desorientador.
                  disableAutoPan: true,
                }}
              >
                <Link href={ativo.href} className="group flex items-center gap-3 w-[15rem] max-w-full">
                  {ativo.imagem && (
                    <div className="relative h-14 w-14 shrink-0 rounded-xl overflow-hidden bg-slate-100">
                      <Image
                        src={ativo.imagem}
                        alt={ativo.nome}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#0B2447] truncate group-hover:text-[#0B3D91] transition-colors">
                      {ativo.nome}
                    </p>
                    {ativo.subtitulo && (
                      <p className="text-[11px] text-slate-500 truncate">{ativo.subtitulo}</p>
                    )}
                    {ativo.localidade && (
                      <p className="text-[11px] text-slate-400 truncate">{ativo.localidade}</p>
                    )}
                    <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#0B3D91]">
                      {ativo.preco != null ? formatPrice(ativo.preco) : 'Ver detalhes'}
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </InfoWindowF>
            )}
          </GoogleMap>
        )}
      </div>
    </section>
  );
}
