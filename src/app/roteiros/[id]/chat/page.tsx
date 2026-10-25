import { notFound, redirect } from 'next/navigation';
import Header from '@/components/layout/Header';
import EventoAnalytics from '@/components/analytics/EventoAnalytics';
import { createClient } from '@/lib/supabase/server';
import { carregarChatRoteiro } from '@/lib/chat-roteiro';
import ChatBox from '@/components/chat/ChatBox';

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

  const resultado = await carregarChatRoteiro(id, user.id);
  if (!resultado.ok) {
    // Dono não conversa consigo mesmo.
    if (resultado.motivo === 'dono') redirect(`/roteiros/${id}`);
    notFound();
  }
  const { conversaId, interlocutor, mensagens, avisoCiente, roteiroNome } = resultado.dados;

  // Rascunho: o texto que o cliente começou no detalhe do roteiro; sem ele, a mensagem
  // contextual padrão, apenas em conversa ainda vazia.
  const rascunhoInicial =
    mensagemDigitada ??
    (mensagens.length === 0
      ? `Olá! Tenho interesse no roteiro "${roteiroNome}". Podemos conversar?`
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
          interlocutor={interlocutor}
          voltarHref={`/roteiros/${id}`}
          voltarLabel="Voltar para o roteiro"
          mensagensIniciais={mensagens}
          rascunhoInicial={rascunhoInicial}
          contexto={{ tipo: 'roteiro', label: roteiroNome }}
          avisoCienteInicial={avisoCiente}
        />
      </div>
    </div>
  );
}
