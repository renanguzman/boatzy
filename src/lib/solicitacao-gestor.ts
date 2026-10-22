import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import type { SolicitacaoGestorStatus } from '@/types/supabase';

/**
 * Pedido de acesso de gestor (SPEC §62). O papel `gestor` só é concedido
 * quando o admin aprova — ver `decidir_solicitacao_gestor` no banco.
 */

export type SolicitacaoGestorResumo = {
  id: string;
  status: SolicitacaoGestorStatus;
  nome: string;
  telefone: string;
  documento: string;
  estadoId: number;
  municipioId: number;
  municipio: string;
  uf: string;
  qtdEmbarcacoes: number;
  mensagem: string | null;
  observacao: string | null;
  criadoEm: string;
  decididoEm: string | null;
};

/** Pedido mais recente do usuário (ou null se nunca pediu). */
export async function ultimaSolicitacaoGestor(userId: string): Promise<SolicitacaoGestorResumo | null> {
  const { data } = await supabaseAdmin
    .from('solicitacao_gestor')
    .select(
      `id, status, nome, telefone, documento, estado_id, municipio_id, qtd_embarcacoes, mensagem,
       observacao, created_at, decidido_em,
       municipios ( nome ), estados ( uf )`,
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  const municipio = data.municipios as unknown as { nome: string } | null;
  const estado = data.estados as unknown as { uf: string } | null;
  return {
    id: data.id,
    status: data.status,
    nome: data.nome,
    telefone: data.telefone,
    documento: data.documento,
    estadoId: data.estado_id,
    municipioId: data.municipio_id,
    municipio: municipio?.nome ?? '',
    uf: estado?.uf ?? '',
    qtdEmbarcacoes: data.qtd_embarcacoes,
    mensagem: data.mensagem,
    observacao: data.observacao,
    criadoEm: data.created_at,
    decididoEm: data.decidido_em,
  };
}

/** Pedidos aguardando a decisão do admin (menu e dashboard do admin). */
export async function contarSolicitacoesGestorPendentes(): Promise<number> {
  const { count } = await supabaseAdmin
    .from('solicitacao_gestor')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pendente');
  return count ?? 0;
}
