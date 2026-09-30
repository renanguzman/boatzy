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
