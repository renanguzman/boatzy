import { notFound, redirect } from 'next/navigation';
import Header from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import ChatBox, { type Mensagem } from '@/components/chat/ChatBox';

/**
 * Chat cliente ↔ dono a partir do detalhe do roteiro. Reutiliza a conversa
 * única gestor↔cliente (§21); a primeira mensagem vem pré-preenchida citando
 * o roteiro.
 */
export default async function ChatRoteiroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?redirect_to=/roteiros/${id}/chat`);

  const { data: roteiro } = await supabaseAdmin
    .from('roteiro')
    .select('id, owner_id, nome, ativo')
    .eq('id', id)
    .eq('ativo', true)
    .single();

  if (!roteiro) notFound();

  // Dono não conversa consigo mesmo (a CHECK de `conversa` também bloqueia).
  if (roteiro.owner_id === user.id) redirect(`/roteiros/${id}`);

  const { data: dono } = await supabaseAdmin
    .from('users')
    .select('id, name, email, avatar_url')
    .eq('id', roteiro.owner_id)
    .single();
  if (!dono) notFound();

  // Garante (idempotente) a conversa gestor ↔ cliente, registrando a origem
  // (última a abrir o chat) = este roteiro.
  const { data: conversa } = await supabaseAdmin
    .from('conversa')
    .upsert(
      {
        gestor_id: roteiro.owner_id,
        cliente_id: user.id,
        origem_tipo: 'roteiro',
        origem_id: id,
        origem_label: roteiro.nome,
      },
      { onConflict: 'gestor_id,cliente_id', ignoreDuplicates: false },
    )
    .select('id')
    .single();
  if (!conversa) notFound();
  const conversaId = conversa.id;

  // Ao abrir, zera as não lidas enviadas pelo dono (inline, sem revalidate).
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

  // Mensagem contextual pré-preenchida apenas em conversa ainda vazia.
  const rascunhoInicial =
    (mensagens ?? []).length === 0
      ? `Olá! Tenho interesse no roteiro "${roteiro.nome}". Podemos conversar?`
      : undefined;

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 min-h-0">
        <ChatBox
          conversaId={conversaId}
          meId={user.id}
          interlocutor={{ name: dono.name, email: dono.email, avatar_url: dono.avatar_url }}
          voltarHref={`/roteiros/${id}`}
          voltarLabel="Voltar para o roteiro"
          mensagensIniciais={(mensagens ?? []) as Mensagem[]}
          rascunhoInicial={rascunhoInicial}
          contexto={{ tipo: 'roteiro', label: roteiro.nome }}
        />
      </div>
    </div>
  );
}
