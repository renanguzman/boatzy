import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import AdminSidebar from '@/components/administrator/AdminSidebar';
import AdminHeader from '@/components/administrator/AdminHeader';
import SignOutLink from '@/components/painel/SignOutLink';
import { createClient } from '@/lib/supabase/server';
import { checkRoleInDb } from '@/lib/roles';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/administrator/login');

  // A role `admin` é validada exclusivamente no banco (user_roles) e só pode
  // ser concedida via SQL direto — nenhum fluxo da aplicação a atribui.
  const isAdmin = await checkRoleInDb(user.id, ['admin']);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-[#0B2447] mb-2">Acesso Restrito</h1>
          <p className="text-sm text-slate-500 mb-6">
            Esta área é exclusiva para administradores da plataforma Boatzy.
            Sua conta não possui essa permissão.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="w-full bg-slate-100 hover:bg-slate-200 text-[#0B2447] font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              Voltar ao Site
            </Link>
            <SignOutLink redirectUrl="/administrator/login" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FB]">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-auto">
        <AdminHeader />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
