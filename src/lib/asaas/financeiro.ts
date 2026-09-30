import 'server-only';

import { asaasRequest } from './client';
import type { AsaasSaldo } from './tipos';

/** Saldo disponível da conta Boatzy no Asaas (`GET /finance/balance`). */
export async function consultarSaldo(): Promise<number> {
  const { balance } = await asaasRequest<AsaasSaldo>('/finance/balance');
  return Number(balance);
}
