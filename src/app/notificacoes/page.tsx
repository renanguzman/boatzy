import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { createClient } from '@/lib/supabase/server';
import ListaNotificacoes from './_components/ListaNotificacoes';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('Notificacoes'))('metaTitulo') };
}

export default async function NotificacoesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar?redirect_to=/notificacoes');
  const t = await getTranslations('Notificacoes');

  return (
    <div className="min-h-screen flex flex-col bg-areia">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-marinho">{t('titulo')}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('subtitulo')}
        </p>

        <ListaNotificacoes userId={user.id} />
      </main>

      <Footer />
    </div>
  );
}
