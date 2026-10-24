'use client';

import { useEffect, useState } from 'react';
import EmbarcacaoCard, { type EmbarcacaoCardData } from '@/components/ui/EmbarcacaoCard';

export type TopRatedItem = EmbarcacaoCardData & {
  media: number;
  total: number;
  favorito: boolean;
};

/**
 * Grid da seção de embarcações da home. Recebe a lista do servidor e, com
 * `porProximidade` (ranking "Mais Bem Avaliadas"), se o navegador já tem
 * permissão de geolocalização concedida, troca silenciosamente pela lista
 * próxima ao usuário (sem disparar o prompt de permissão na home).
 */
export default function TopRatedBoats({
  inicial,
  porProximidade = true,
}: {
  inicial: TopRatedItem[];
  porProximidade?: boolean;
}) {
  const [items, setItems] = useState(inicial);

  useEffect(() => {
    if (!porProximidade) return;
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
                `/api/embarcacoes/top-avaliadas?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`,
              );
              if (!res.ok) return;
              const json: { items: TopRatedItem[] } = await res.json();
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
  }, [porProximidade]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {items.map((item) => (
        <EmbarcacaoCard
          key={item.id}
          embarcacao={item}
          initialFavorito={item.favorito}
          avaliacaoResumo={item.total > 0 ? { media: item.media, total: item.total } : null}
        />
      ))}
    </div>
  );
}
