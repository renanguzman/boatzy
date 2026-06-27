import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UserCog } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { createClient } from '@/lib/supabase/server';

export default async function MinhaContaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/entrar?redirect_to=/minha-conta');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-[#0B2447]">Minha conta</h1>
        <p className="text-sm text-slate-500 mt-1">Gerencie seus dados pessoais e preferências.</p>

        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white p-12 flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <UserCog className="h-7 w-7 text-slate-300" />
          </div>
          <h2 className="text-lg font-semibold text-slate-700">Em breve</h2>
          <p className="text-sm text-slate-400 mt-1 max-w-sm">
            A edição dos dados da sua conta estará disponível em breve.
          </p>
          <Link
            href="/minhas-reservas"
            className="mt-6 px-5 py-2.5 bg-[#0B3D91] hover:bg-[#0B2447] text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Ver minhas reservas
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
