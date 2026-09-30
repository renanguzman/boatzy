'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { iniciarPagamento, type IniciarPagamentoResultado } from '@/lib/pagamentos/checkout';
import type { FormaPagamentoCodigo, PedidoStatus } from '@/types/supabase';

async function usuarioLogado(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Gera (ou retoma) a cobrança do pedido da reserva. Pix devolve o QR Code;
 * cartão devolve a URL da fatura do Asaas, onde o cartão é digitado — o
 * número nunca passa pelo Boatzy.
 */
export async function pagarReserva(input: {
  reservaId: string;
  forma: FormaPagamentoCodigo;
  parcelas: number;
  cpf?: string;
}): Promise<IniciarPagamentoResultado> {
  const userId = await usuarioLogado();
  if (!userId) return { ok: false, error: 'Sua sessão expirou. Entre novamente para pagar.' };
  return iniciarPagamento({ ...input, userId });
}

/** Status do pedido para a tela acompanhar o pagamento (lê o nosso banco, não o Asaas). */
export async function consultarStatusPedido(reservaId: string): Promise<{ status: PedidoStatus | null }> {
  const userId = await usuarioLogado();
  if (!userId) return { status: null };
  const { data } = await supabaseAdmin
    .from('pedido')
    .select('status')
    .eq('reserva_id', reservaId)
    .eq('cliente_id', userId)
    .maybeSingle();
  return { status: data?.status ?? null };
}
