'use client';

import { createContext, useContext } from 'react';

/**
 * Modo pré-visualização das páginas públicas (`/preview/*`, aberto pelo
 * painel). Os componentes do site continuam interativos (galeria, calendário,
 * seletor de pessoas…), mas as ações que saem da página ou gravam algo —
 * reservar, favoritar, compartilhar, abrir chat — consultam este contexto e
 * apenas avisam o gestor.
 *
 * Fora da prévia não há provider: `ativo` é false e nada muda.
 */
type ModoPreview = { ativo: boolean; avisar: () => void };

const Ctx = createContext<ModoPreview>({ ativo: false, avisar: () => {} });

export const ModoPreviewProvider = Ctx.Provider;

export function useModoPreview(): ModoPreview {
  return useContext(Ctx);
}
