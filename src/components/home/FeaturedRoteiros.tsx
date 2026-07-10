'use client';

import { useEffect, useState } from 'react';
import RoteiroCard, { type RoteiroCardData } from '@/app/buscar/_components/RoteiroCard';

export type FeaturedRoteiroItem = RoteiroCardData & {
  media: number;
  total: number;
  favorito: boolean;
};

/**
 * Grid da seção "Roteiros Mais Bem Avaliados". Recebe a lista global (SSR) e,
 * se o navegador já tem permissão de geolocalização concedida, troca
 * silenciosamente pela lista próxima ao usuário (sem disparar o prompt de
 * permissão na home).
 */
export default function FeaturedRoteiros({ inicial }: { inicial: FeaturedRoteiroItem[] }) {
  const [items, setItems] = useState(inicial);

  useEffect(() => {
    if (!('geolocation' in navigator) || !('permissions' in navigator)) return;
    let cancelado = false;

    navigator.permissions
      .query({ name: 'geolocation' })
      .then((perm) => {
        if (perm.state !== 'granted') return;
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              const res = await fetch(
                `/api/roteiros/top-avaliados?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`,
              );
              if (!res.ok) return;
              const json: { items: FeaturedRoteiroItem[] } = await res.json();
              if (!cancelado && json.items.length > 0) setItems(json.items);
            } catch {
              // Falha de rede: mantém a lista global.
            }
          },
          () => {},
          { maximumAge: 10 * 60 * 1000, timeout: 8000 },
        );
      })
      .catch(() => {});

    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((item) => (
        <RoteiroCard
          key={item.id}
          roteiro={item}
          initialFavorito={item.favorito}
          avaliacaoResumo={{ media: item.media, total: item.total }}
        />
      ))}
    </div>
  );
}
