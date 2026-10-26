import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Header from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/server';
import { carregarChatReserva } from '@/lib/chat-dono';
import ChatBox from '@/components/chat/ChatBox';

export default async function ChatGestorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: reservaId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?redirect_to=/minhas-reservas/${reservaId}/chat`);

  const resultado = await carregarChatReserva(reservaId, user.id);
  if (!resultado.ok) {
    // Conta que acumula cliente + gestor: não há chat consigo mesma — volta para a lista.
    if (resultado.motivo === 'dono') redirect('/minhas-reservas');
    notFound();
  }
  const { conversaId, interlocutor, mensagens, avisoCiente, origemTipo, origemLabel } = resultado.dados;
  const t = await getTranslations('MinhasReservas.chat');

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 min-h-0">
        <ChatBox
          conversaId={conversaId}
          meId={user.id}
          interlocutor={interlocutor}
          voltarHref={`/minhas-reservas/${reservaId}`}
          voltarLabel={t('voltarReserva')}
          mensagensIniciais={mensagens}
          contexto={{ tipo: origemTipo, label: origemLabel }}
          avisoCienteInicial={avisoCiente}
        />
      </div>
    </div>
  );
}
