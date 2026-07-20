import { notFound, redirect } from 'next/navigation';
import Header from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import ChatBox, { type Mensagem } from '@/components/chat/ChatBox';

export default async function ChatGestorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: reservaId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?redirect_to=/minhas-reservas/${reservaId}/chat`);

  // A reserva precisa pertencer ao cliente logado (valida acesso) e dá o gestor.
  const { data: reserva } = await supabaseAdmin
    .from('reserva')
    .select('id, owner_id, tipo, item_nome, embarcacao_id, roteiro_id')
    .eq('id', reservaId)
    .eq('cliente_id', user.id)
    .single();

  if (!reserva) notFound();

  // Origem da conversa = o objeto da reserva (embarcação ou roteiro).
  const origemTipo = reserva.tipo === 'roteiro' ? 'roteiro' : 'embarcacao';
  const origemId = reserva.roteiro_id ?? reserva.embarcacao_id ?? null;
  const origemLabel = reserva.item_nome;

  // Dados do gestor (interlocutor).
  const { data: gestor } = await supabaseAdmin
    .from('users')
    .select('id, name, email, avatar_url')
    .eq('id', reserva.owner_id)
    .single();

  if (!gestor) notFound();

  // Garante (idempotente) a conversa gestor ↔ cliente, registrando a origem
  // (última a abrir o chat) = o objeto desta reserva.
  const { data: conversa } = await supabaseAdmin
    .from('conversa')
    .upsert(
      {
        gestor_id: reserva.owner_id,
        cliente_id: user.id,
        origem_tipo: origemTipo,
        origem_id: origemId,
        origem_label: origemLabel,
      },
      { onConflict: 'gestor_id,cliente_id', ignoreDuplicates: false },
    )
    .select('id')
    .single();

  if (!conversa) notFound();
  const conversaId = conversa.id;

  // Ao abrir, zera as não lidas enviadas pelo gestor (inline, sem revalidate).
  await supabaseAdmin
    .from('mensagem')
    .update({ lida_em: new Date().toISOString() })
    .eq('conversa_id', conversaId)
    .neq('remetente_id', user.id)
    .is('lida_em', null);

  const { data: mensagens } = await supabaseAdmin
    .from('mensagem')
    .select('id, remetente_id, conteudo, lida_em, created_at')
    .eq('conversa_id', conversaId)
    .order('created_at', { ascending: true });

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 min-h-0">
        <ChatBox
          conversaId={conversaId}
          meId={user.id}
          interlocutor={{ name: gestor.name, email: gestor.email, avatar_url: gestor.avatar_url }}
          voltarHref="/minhas-reservas"
          voltarLabel="Voltar para Minhas reservas"
          mensagensIniciais={(mensagens ?? []) as Mensagem[]}
          contexto={{ tipo: origemTipo, label: origemLabel }}
        />
      </div>
    </div>
  );
}
