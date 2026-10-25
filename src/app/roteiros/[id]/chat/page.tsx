import { notFound, redirect } from 'next/navigation';
import Header from '@/components/layout/Header';
import EventoAnalytics from '@/components/analytics/EventoAnalytics';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import ChatBox, { type Mensagem } from '@/components/chat/ChatBox';

/**
 * Chat cliente ↔ dono a partir do detalhe do roteiro. Reutiliza a conversa
 * única gestor↔cliente (§21); a primeira mensagem vem pré-preenchida citando
 * o roteiro — ou com o texto que o cliente começou no bloco "Fale com o dono"
 * do detalhe (`?mensagem=`), que não é enviado sozinho: fica como rascunho.
 */
export default async function ChatRoteiroPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mensagem?: string | string[] }>;
}) {
  const { id } = await params;
  const { mensagem: mensagemParam } = await searchParams;
  // Mesmo teto do envio (`enviarMensagem`, 4000 caracteres).
  const mensagemDigitada = (Array.isArray(mensagemParam) ? mensagemParam[0] : mensagemParam)?.trim().slice(0, 4000) || undefined;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // Volta do login com a mensagem digitada preservada.
    const destino = `/roteiros/${id}/chat${mensagemDigitada ? `?mensagem=${encodeURIComponent(mensagemDigitada)}` : ''}`;
    redirect(`/entrar?redirect_to=${encodeURIComponent(destino)}`);
  }

  // Aviso "converse pela plataforma": só exibido enquanto o cliente não confirmou ciência.
  const { data: usuarioDb } = await supabaseAdmin
    .from('users')
    .select('chat_aviso_ciente_em')
    .eq('id', user.id)
    .single();
  const avisoCienteInicial = usuarioDb?.chat_aviso_ciente_em != null;

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

  // Rascunho: o texto que o cliente começou no detalhe do roteiro; sem ele, a mensagem
  // contextual padrão, apenas em conversa ainda vazia.
  const rascunhoInicial =
    mensagemDigitada ??
    ((mensagens ?? []).length === 0
      ? `Olá! Tenho interesse no roteiro "${roteiro.nome}". Podemos conversar?`
      : undefined);

  return (
    <div className="h-screen flex flex-col">
      <Header />
      {/* GA4: contato com o dono (1x por item e navegador) — SPEC §65 */}
      <EventoAnalytics evento="iniciar_conversa" chave={`roteiro:${id}`} umaVez params={{ origem: 'roteiro', item_id: id }} />
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
          avisoCienteInicial={avisoCienteInicial}
        />
      </div>
    </div>
  );
}
