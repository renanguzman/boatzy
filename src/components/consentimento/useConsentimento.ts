'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { registrarConsentimento } from '@/lib/consentimento-actions';
import {
  assinarConsentimento,
  parseConsentimento,
  salvarConsentimento,
  snapshotConsentimento,
  type Consentimento,
} from '@/lib/consentimento';

const NO_SERVIDOR = '__servidor__';

/**
 * Escolha de cookies atual, sincronizada entre banner e Minha conta.
 * `pronto` é false no servidor/hidratação (o cookie só é lido no browser) —
 * evita piscar o banner para quem já escolheu.
 */
export function useConsentimento() {
  const bruto = useSyncExternalStore(assinarConsentimento, snapshotConsentimento, () => NO_SERVIDOR);
  const pronto = bruto !== NO_SERVIDOR;
  const consentimento: Consentimento | null = pronto ? parseConsentimento(bruto || null) : null;

  const escolher = useCallback((medicao: boolean, origem: 'banner' | 'minha_conta') => {
    const c = salvarConsentimento(medicao);
    void registrarConsentimento({ visitanteId: c.id, medicao: c.medicao, versaoPolitica: c.v, origem });
  }, []);

  return { pronto, consentimento, escolher };
}
