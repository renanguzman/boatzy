'use client';

import { useEffect, useRef } from 'react';
import { rastrear, rastrearUmaVez } from '@/lib/analytics';

/**
 * Dispara um evento do GA4 ao montar — para páginas server-side (detalhe do
 * roteiro, busca, pagamento). Reenvia quando `chave` muda (nova busca);
 * `umaVez` deduplica por navegador (ex.: compra).
 */
export default function EventoAnalytics({
  evento,
  params,
  chave,
  umaVez = false,
}: {
  evento: string;
  params?: Record<string, unknown>;
  /** Identidade do evento; muda → envia de novo. */
  chave: string;
  umaVez?: boolean;
}) {
  // Uma vez por `chave`, mesmo se o efeito rodar de novo (StrictMode, remontagem).
  const enviado = useRef<string | null>(null);
  useEffect(() => {
    const id = `${evento}:${chave}`;
    if (enviado.current === id) return;
    enviado.current = id;
    if (umaVez) rastrearUmaVez(`${evento}:${chave}`, evento, params);
    else rastrear(evento, params);
    // `params` acompanha `chave` — não reenviar a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evento, chave, umaVez]);

  return null;
}
