import 'server-only';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { formatarData } from '@/lib/datas';
import { mascararTelefones } from '@/lib/mascarar-telefone';

/** Mesmo teto do envio no chat (`enviarMensagem`). */
const MAX_MENSAGEM = 4000;

/**
 * Recado que o gestor escreve ao aceitar/recusar uma solicitação (`reserva.observacao_gestor`)
 * também vai para o chat gestor ↔ cliente, como mensagem do gestor — tudo fica registrado num
 * ponto só (SPEC §89). Garante a conversa (origem = item da reserva), põe uma linha de contexto
 * ("Sobre sua reserva de … — aceita:") e mascara telefones como o envio normal. Sem texto, ou
 * gestor reservando o próprio item, não faz nada. Nunca lança: a resposta à reserva já valeu.
 */
export async function registrarRecadoReservaNoChat(params: {
  reservaId: string;
  gestorId: string;
  texto: string | null | undefined;
  resposta: 'aceita' | 'recusada';
}): Promise<void> {
  const texto = params.texto?.trim();
  if (!texto) return;

  try {
    const { data: reserva } = await supabaseAdmin
      .from('reserva')
      .select('cliente_id, tipo, roteiro_id, embarcacao_id, item_nome, data_reserva, data_fim_reserva, roteiro ( nome )')
      .eq('id', params.reservaId)
      .maybeSingle();
    if (!reserva || reserva.cliente_id === params.gestorId) return;

    const r = reserva as unknown as {
      cliente_id: string;
      tipo: 'roteiro' | 'embarcacao';
      roteiro_id: string | null;
      embarcacao_id: string | null;
      item_nome: string;
      data_reserva: string;
      data_fim_reserva: string | null;
      roteiro: { nome: string } | null;
    };
    const item = r.roteiro?.nome ?? r.item_nome;
    const periodo = r.data_fim_reserva && r.data_fim_reserva !== r.data_reserva
      ? `${formatarData(r.data_reserva)} a ${formatarData(r.data_fim_reserva)}`
      : formatarData(r.data_reserva);

    // Conversa única gestor ↔ cliente; a origem passa a ser o item desta reserva.
    const ehEmbarcacao = r.tipo === 'embarcacao';
    const { data: conversa, error: erroConversa } = await supabaseAdmin
      .from('conversa')
      .upsert(
        {
          gestor_id: params.gestorId,
          cliente_id: r.cliente_id,
          origem_tipo: ehEmbarcacao ? 'embarcacao' : 'roteiro',
          origem_id: ehEmbarcacao ? r.embarcacao_id : r.roteiro_id,
          origem_label: item,
        },
        { onConflict: 'gestor_id,cliente_id', ignoreDuplicates: false },
      )
      .select('id')
      .single();
    if (erroConversa || !conversa) {
      console.error('[chat-recado-reserva] falha ao garantir a conversa', params.reservaId, erroConversa?.message);
      return;
    }

    const contexto = params.resposta === 'aceita'
      ? `Sobre sua reserva de "${item}" para ${periodo} — aceita:`
      : `Sobre sua solicitação de "${item}" para ${periodo} — não aceita:`;
    const conteudo = `${contexto}\n\n${mascararTelefones(texto)}`.slice(0, MAX_MENSAGEM);

    const { error } = await supabaseAdmin
      .from('mensagem')
      .insert({ conversa_id: conversa.id, remetente_id: params.gestorId, conteudo });
    if (error) {
      console.error('[chat-recado-reserva] falha ao gravar a mensagem', params.reservaId, error.message);
      return;
    }

    revalidatePath('/painel/clientes');
    revalidatePath('/minhas-reservas');
  } catch (err) {
    console.error('[chat-recado-reserva] erro', params.reservaId, err instanceof Error ? err.message : err);
  }
}
