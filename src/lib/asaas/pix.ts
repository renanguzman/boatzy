import 'server-only';

import { asaasRequest } from './client';
import type { AsaasChavePix, AsaasLista } from './tipos';

/**
 * Chaves Pix da conta. Sem chave ATIVA o Asaas recusa cobranças Pix
 * ("Não há nenhuma chave Pix disponível para receber cobranças").
 */
export async function listarChavesPix(): Promise<AsaasChavePix[]> {
  const lista = await asaasRequest<AsaasLista<AsaasChavePix>>('/pix/addressKeys', { query: { limit: 100 } });
  return lista.data ?? [];
}

/** Cria uma chave Pix aleatória (EVP) — o único tipo que a API permite criar. */
export async function criarChavePixAleatoria(): Promise<AsaasChavePix> {
  return asaasRequest<AsaasChavePix>('/pix/addressKeys', { metodo: 'POST', corpo: { type: 'EVP' } });
}
