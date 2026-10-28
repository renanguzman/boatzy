import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import type { Json, PedidoEventoAtor } from '@/types/supabase';

/**
 * Linha do tempo de negócio do pedido (`pedido_evento`, append-only — SPEC §34.16).
 * Complementa `pagamento_transacao` (movimentos do Asaas) e `financeiro_auditoria`
 * (ações do admin). Falha ao registrar é logada e nunca desfaz a ação.
 */
export async function registrarEventoPedido(input: {
  pedidoId: string;
  evento: string;
  atorId?: string | null;
  atorPapel?: PedidoEventoAtor;
  dados?: Record<string, unknown> | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('pedido_evento').insert({
    pedido_id: input.pedidoId,
    evento: input.evento,
    ator_id: input.atorId ?? null,
    ator_papel: input.atorPapel ?? 'sistema',
    dados: (input.dados ?? null) as Json | null,
  });
  if (error) console.error('[pagamentos/historico] falha ao registrar evento', input.pedidoId, input.evento, error.message);
}
