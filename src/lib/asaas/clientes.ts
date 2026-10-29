import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { asaasRequest } from './client';
import type { AsaasAmbiente } from './config';
import type { AsaasCliente } from './tipos';

/**
 * Devolve o customer do Asaas do usuário no ambiente atual, criando se ainda
 * não existir. O vínculo fica em `cliente_asaas` (por ambiente: o customer do
 * sandbox não existe em produção).
 *
 * `notificationDisabled: true` — o Boatzy manda os próprios e-mails; sem isso o
 * Asaas também notificaria o cliente a cada cobrança.
 */
export async function garantirClienteAsaas(input: {
  userId: string;
  ambiente: AsaasAmbiente;
  nome: string;
  cpfCnpj: string; // só dígitos
  email: string | null;
  celular: string | null; // só dígitos
}): Promise<string> {
  const { data: existente } = await supabaseAdmin
    .from('cliente_asaas')
    .select('asaas_customer_id')
    .eq('user_id', input.userId)
    .eq('ambiente', input.ambiente)
    .maybeSingle();
  if (existente) return existente.asaas_customer_id;

  // Idempotência: se uma tentativa anterior criou o customer mas não gravou o
  // vínculo, reaproveita (externalReference = id do usuário interno).
  const busca = await asaasRequest<{ data: AsaasCliente[] }>('/customers', {
    query: { externalReference: input.userId, limit: 1 },
  });
  let cliente = busca.data?.[0];

  if (!cliente) {
    cliente = await asaasRequest<AsaasCliente>('/customers', {
      metodo: 'POST',
      corpo: {
        name: input.nome.trim() || 'Cliente Boatzy',
        cpfCnpj: input.cpfCnpj,
        email: input.email ?? undefined,
        mobilePhone: input.celular && input.celular.length >= 10 ? input.celular : undefined,
        externalReference: input.userId,
        notificationDisabled: true,
      },
    });
  }

  const { error } = await supabaseAdmin
    .from('cliente_asaas')
    .upsert(
      { user_id: input.userId, ambiente: input.ambiente, asaas_customer_id: cliente.id },
      { onConflict: 'user_id,ambiente', ignoreDuplicates: true },
    );
  if (error) console.error('[asaas/clientes] falha ao gravar vínculo', input.userId, error.message);

  return cliente.id;
}

/**
 * Customer do Asaas para pagar em nome de outra pessoa (CPF) ou empresa
 * (CNPJ) — SPEC §97. Um customer por (cliente Boatzy, documento), com
 * `externalReference = "<userId>:<documento>"`: a mesma empresa usada de novo
 * reaproveita o customer e tem os dados atualizados (`PUT /customers/{id}`),
 * já que nome/endereço podem ter mudado. O vínculo do próprio cliente em
 * `cliente_asaas` não é tocado. Endereço completo vai junto — é o que o Asaas
 * usa ao emitir a nota fiscal da cobrança.
 */
export async function garantirClienteAsaasTomador(input: {
  userId: string;
  tomador: {
    nome: string;
    documento: string; // só dígitos
    nome_fantasia: string | null;
    telefone: string | null; // só dígitos
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
  };
}): Promise<string> {
  const t = input.tomador;
  const externalReference = `${input.userId}:${t.documento}`;
  const corpo = {
    name: t.nome,
    cpfCnpj: t.documento,
    company: t.documento.length === 14 ? (t.nome_fantasia ?? t.nome) : undefined,
    phone: t.telefone?.length === 10 ? t.telefone : undefined,
    mobilePhone: t.telefone?.length === 11 ? t.telefone : undefined,
    postalCode: t.cep ?? undefined,
    address: t.logradouro ?? undefined,
    addressNumber: t.numero ?? undefined,
    complement: t.complemento ?? undefined,
    province: t.bairro ?? undefined,
    externalReference,
    notificationDisabled: true,
  };

  const busca = await asaasRequest<{ data: AsaasCliente[] }>('/customers', {
    query: { externalReference, limit: 1 },
  });
  const existente = busca.data?.[0];
  if (existente) {
    await asaasRequest<AsaasCliente>(`/customers/${existente.id}`, { metodo: 'PUT', corpo });
    return existente.id;
  }
  const cliente = await asaasRequest<AsaasCliente>('/customers', { metodo: 'POST', corpo });
  return cliente.id;
}
