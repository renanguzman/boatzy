import { redirect } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { createClient } from '@/lib/supabase/server';
import ListaNotificacoes from './_components/ListaNotificacoes';

export const metadata = { title: 'Notificações | Boatzy' };

export default async function NotificacoesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar?redirect_to=/notificacoes');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-[#0B2447]">Notificações</h1>
        <p className="text-sm text-slate-500 mt-1">
          Tudo o que acontece com suas reservas, pagamentos e conversas com os gestores, em tempo real.
          Os avisos importantes também chegam por e-mail.
        </p>

        <ListaNotificacoes userId={user.id} />
      </main>

      <Footer />
    </div>
  );
}
