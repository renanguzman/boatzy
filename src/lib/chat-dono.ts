import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import type { Mensagem } from '@/components/chat/ChatBox';
import type { OrigemTipo } from '@/lib/conversa-origem';

/**
 * Abre o chat cliente ↔ dono: garante (idempotente) a conversa única gestor↔cliente (§21)
 * registrando a origem (roteiro/embarcação), zera as não lidas enviadas pelo dono e devolve o
 * necessário para o `ChatBox`. Pontos de entrada: um roteiro (`carregarChatRoteiro` — páginas
 * `/roteiros/[id]/chat` e modal do detalhe/confirmação) ou uma reserva do cliente
 * (`carregarChatReserva` — página `/minhas-reservas/[id]/chat` e modal das reservas).
 */

export type ChatDonoDados = {
  conversaId: string;
  meId: string;
  /** Sem e-mail: a conversa é só pelo Boatzy (o contato direto do dono não vai ao navegador). */
  interlocutor: { name: string; descricao: string; avatar_url: string | null };
  mensagens: Mensagem[];
  /** O cliente já confirmou o aviso "converse pela plataforma". */
  avisoCiente: boolean;
  /** A que a conversa se refere (selo no cabeçalho). */
  origemTipo: OrigemTipo;
  origemLabel: string;
};

export type ResultadoChatDono =
  | { ok: true; dados: ChatDonoDados }
  | { ok: false; motivo: 'nao_encontrado' | 'dono' };

const DESCRICAO_DONO = 'Dono da embarcação · conversa pelo Boatzy';

async function abrirConversa(params: {
  gestorId: string;
  clienteId: string;
  origemTipo: OrigemTipo;
  origemId: string | null;
  origemLabel: string;
}): Promise<ResultadoChatDono> {
  const { gestorId, clienteId } = params;
  // Dono não conversa consigo mesmo (a CHECK de `conversa` também bloqueia).
  if (gestorId === clienteId) return { ok: false, motivo: 'dono' };

  const [{ data: usuarioDb }, { data: dono }] = await Promise.all([
    supabaseAdmin.from('users').select('chat_aviso_ciente_em').eq('id', clienteId).single(),
    supabaseAdmin.from('users').select('id, name, avatar_url').eq('id', gestorId).single(),
  ]);
  if (!dono) return { ok: false, motivo: 'nao_encontrado' };

  // Garante a conversa, registrando a origem (última a abrir o chat).
  const { data: conversa } = await supabaseAdmin
    .from('conversa')
    .upsert(
      {
        gestor_id: gestorId,
        cliente_id: clienteId,
        origem_tipo: params.origemTipo,
        origem_id: params.origemId,
        origem_label: params.origemLabel,
      },
      { onConflict: 'gestor_id,cliente_id', ignoreDuplicates: false },
    )
    .select('id')
    .single();
  if (!conversa) return { ok: false, motivo: 'nao_encontrado' };

  // Ao abrir, zera as não lidas enviadas pelo dono (inline, sem revalidate).
  await supabaseAdmin
    .from('mensagem')
    .update({ lida_em: new Date().toISOString() })
    .eq('conversa_id', conversa.id)
    .neq('remetente_id', clienteId)
    .is('lida_em', null);

  const { data: mensagens } = await supabaseAdmin
    .from('mensagem')
    .select('id, remetente_id, conteudo, lida_em, created_at')
    .eq('conversa_id', conversa.id)
    .order('created_at', { ascending: true });

  return {
    ok: true,
    dados: {
      conversaId: conversa.id,
      meId: clienteId,
      interlocutor: { name: dono.name, descricao: DESCRICAO_DONO, avatar_url: dono.avatar_url },
      mensagens: (mensagens ?? []) as Mensagem[],
      avisoCiente: usuarioDb?.chat_aviso_ciente_em != null,
      origemTipo: params.origemTipo,
      origemLabel: params.origemLabel,
    },
  };
}

/** Conversa a partir de um roteiro ativo. */
export async function carregarChatRoteiro(roteiroId: string, clienteId: string): Promise<ResultadoChatDono> {
  const { data: roteiro } = await supabaseAdmin
    .from('roteiro')
    .select('id, owner_id, nome')
    .eq('id', roteiroId)
    .eq('ativo', true)
    .single();
  if (!roteiro) return { ok: false, motivo: 'nao_encontrado' };
  return abrirConversa({
    gestorId: roteiro.owner_id, clienteId, origemTipo: 'roteiro', origemId: roteiroId, origemLabel: roteiro.nome,
  });
}

/** Conversa a partir de uma reserva — que precisa ser do cliente (valida o acesso). */
export async function carregarChatReserva(reservaId: string, clienteId: string): Promise<ResultadoChatDono> {
  const { data: reserva } = await supabaseAdmin
    .from('reserva')
    .select('id, owner_id, tipo, item_nome, embarcacao_id, roteiro_id')
    .eq('id', reservaId)
    .eq('cliente_id', clienteId)
    .single();
  if (!reserva) return { ok: false, motivo: 'nao_encontrado' };
  // Origem da conversa = o objeto da reserva (embarcação ou roteiro).
  return abrirConversa({
    gestorId: reserva.owner_id,
    clienteId,
    origemTipo: reserva.tipo === 'roteiro' ? 'roteiro' : 'embarcacao',
    origemId: reserva.roteiro_id ?? reserva.embarcacao_id ?? null,
    origemLabel: reserva.item_nome,
  });
}
