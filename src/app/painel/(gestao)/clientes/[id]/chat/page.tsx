import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { abrirConversa } from '../../actions';
import ChatBox, { type Mensagem } from '@/components/chat/ChatBox';

export default async function ChatClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clienteId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  // Carrega o cliente.
  const { data: cliente } = await supabaseAdmin
    .from('users')
    .select('id, name, email, avatar_url')
    .eq('id', clienteId)
    .single();

  if (!cliente) notFound();

  // Garante (idempotente) a conversa gestor ↔ cliente.
  const conversaResult = await abrirConversa(clienteId);
  if (!conversaResult.ok) notFound();
  const { conversaId } = conversaResult;

  // Ao abrir, zera as não lidas enviadas pelo cliente (inline, sem revalidate —
  // não é permitido revalidar durante o render de um Server Component).
  await supabaseAdmin
    .from('mensagem')
    .update({ lida_em: new Date().toISOString() })
    .eq('conversa_id', conversaId)
    .neq('remetente_id', user.id)
    .is('lida_em', null);

  // Mensagens da conversa, em ordem cronológica (já com lida_em atualizado).
  const { data: mensagens } = await supabaseAdmin
    .from('mensagem')
    .select('id, remetente_id, conteudo, lida_em, created_at')
    .eq('conversa_id', conversaId)
    .order('created_at', { ascending: true });

  return (
    <ChatBox
      conversaId={conversaId}
      meId={user.id}
      interlocutor={{ name: cliente.name, email: cliente.email, avatar_url: cliente.avatar_url }}
      voltarHref="/painel/clientes"
      voltarLabel="Voltar para Clientes"
      mensagensIniciais={(mensagens ?? []) as Mensagem[]}
    />
  );
}
