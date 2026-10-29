'use server';

import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { iniciarPagamento, type IniciarPagamentoResultado } from '@/lib/pagamentos/checkout';
import type { TomadorForm } from '@/lib/pagamentos/tomador';
import { consultarCnpj, type ConsultaCnpj } from '@/lib/cnpj';
import type { FormaPagamentoCodigo, PedidoStatus } from '@/types/supabase';

/**
 * Ações do cliente na página de pagamento — pedido da reserva
 * (`/reservas/[id]/pagar`) ou cobrança avulsa (`/cobrancas/[id]`), SPEC §34.12/§34.16.
 */

async function usuarioLogado(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Gera (ou retoma) a cobrança do pedido. Pix devolve o QR Code; cartão
 * devolve a URL da fatura do Asaas, onde o cartão é digitado — o número
 * nunca passa pelo Boatzy. O pedido precisa ser do cliente logado.
 */
export async function pagarPedido(input: {
  pedidoId: string;
  forma: FormaPagamentoCodigo;
  parcelas: number;
  cpf?: string;
  /** Em nome de quem sai o pagamento (SPEC §97); omitido = o próprio cliente. */
  tomador?: TomadorForm | null;
}): Promise<IniciarPagamentoResultado> {
  const userId = await usuarioLogado();
  if (!userId) return { ok: false, error: (await getTranslations('Pagamento'))('sessao') };
  return iniciarPagamento({ ...input, userId });
}

/**
 * Dados da empresa pelo CNPJ (OpenCNPJ) para preencher o tomador no checkout
 * (SPEC §97). Só para usuário logado — não vira um proxy público da API.
 */
export async function consultarCnpjTomador(cnpj: string): Promise<ConsultaCnpj> {
  if (!(await usuarioLogado())) return { ok: false, motivo: 'indisponivel' };
  return consultarCnpj(cnpj);
}

/** Status do pedido para a tela acompanhar o pagamento (lê o nosso banco, não o Asaas). */
export async function consultarStatusPedido(pedidoId: string): Promise<{ status: PedidoStatus | null }> {
  const userId = await usuarioLogado();
  if (!userId) return { status: null };
  const { data } = await supabaseAdmin
    .from('pedido')
    .select('status')
    .eq('id', pedidoId)
    .eq('cliente_id', userId)
    .maybeSingle();
  return { status: data?.status ?? null };
}
