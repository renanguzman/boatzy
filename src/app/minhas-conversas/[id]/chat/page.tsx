import { notFound, redirect } from 'next/navigation';
import Header from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import ChatBox, { type Mensagem } from '@/components/chat/ChatBox';

/**
 * Chat do cliente por conversaId (hub "Minhas conversas"). Diferente de
 * /minhas-reservas/[id]/chat (indexado por reserva) e /vendas/[id]/chat
 * (indexado por anúncio), aqui o [id] é a própria conversa — cobre qualquer
 * conversa gestor↔cliente, inclusive as de venda sem reserva.
 */
export default async function ChatConversaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: conversaId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?redirect_to=/minhas-conversas/${conversaId}/chat`);

  // A conversa precisa pertencer ao cliente logado (autorização) e dá o gestor.
  const { data: conversa } = await supabaseAdmin
    .from('conversa')
    .select('id, gestor_id')
    .eq('id', conversaId)
    .eq('cliente_id', user.id)
    .single();

  if (!conversa) notFound();

  const { data: gestor } = await supabaseAdmin
    .from('users')
    .select('id, name, email, avatar_url')
    .eq('id', conversa.gestor_id)
    .single();

  if (!gestor) notFound();

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
          voltarHref="/minhas-conversas"
          voltarLabel="Voltar para Minhas conversas"
          mensagensIniciais={(mensagens ?? []) as Mensagem[]}
        />
      </div>
    </div>
  );
}
