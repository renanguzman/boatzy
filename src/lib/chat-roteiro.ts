import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import type { Mensagem } from '@/components/chat/ChatBox';

/**
 * Abre o chat cliente ↔ dono de um roteiro: garante (idempotente) a conversa
 * única gestor↔cliente (§21) registrando o roteiro como origem, zera as não
 * lidas enviadas pelo dono e devolve o necessário para o `ChatBox`. Usado pela
 * página `/roteiros/[id]/chat` e pela modal de chat da confirmação da reserva.
 */

export type ChatRoteiroDados = {
  conversaId: string;
  meId: string;
  /** Sem e-mail: a conversa é só pelo Boatzy (o contato direto do dono não vai ao navegador). */
  interlocutor: { name: string; descricao: string; avatar_url: string | null };
  mensagens: Mensagem[];
  /** O cliente já confirmou o aviso "converse pela plataforma". */
  avisoCiente: boolean;
  roteiroNome: string;
};

export type ResultadoChatRoteiro =
  | { ok: true; dados: ChatRoteiroDados }
  | { ok: false; motivo: 'nao_encontrado' | 'dono' };

export async function carregarChatRoteiro(roteiroId: string, userId: string): Promise<ResultadoChatRoteiro> {
  const [{ data: usuarioDb }, { data: roteiro }] = await Promise.all([
    supabaseAdmin.from('users').select('chat_aviso_ciente_em').eq('id', userId).single(),
    supabaseAdmin.from('roteiro').select('id, owner_id, nome, ativo').eq('id', roteiroId).eq('ativo', true).single(),
  ]);
  if (!roteiro) return { ok: false, motivo: 'nao_encontrado' };

  // Dono não conversa consigo mesmo (a CHECK de `conversa` também bloqueia).
  if (roteiro.owner_id === userId) return { ok: false, motivo: 'dono' };

  const { data: dono } = await supabaseAdmin
    .from('users')
    .select('id, name, avatar_url')
    .eq('id', roteiro.owner_id)
    .single();
  if (!dono) return { ok: false, motivo: 'nao_encontrado' };

  // Garante a conversa, registrando a origem (última a abrir o chat) = este roteiro.
  const { data: conversa } = await supabaseAdmin
    .from('conversa')
    .upsert(
      {
        gestor_id: roteiro.owner_id,
        cliente_id: userId,
        origem_tipo: 'roteiro',
        origem_id: roteiroId,
        origem_label: roteiro.nome,
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
    .neq('remetente_id', userId)
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
      meId: userId,
      interlocutor: { name: dono.name, descricao: 'Dono da embarcação · conversa pelo Boatzy', avatar_url: dono.avatar_url },
      mensagens: (mensagens ?? []) as Mensagem[],
      avisoCiente: usuarioDb?.chat_aviso_ciente_em != null,
      roteiroNome: roteiro.nome,
    },
  };
}
