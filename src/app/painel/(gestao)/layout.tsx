import Sidebar from '@/components/painel/Sidebar';
import Header from '@/components/painel/Header';
import { currentUser } from '@clerk/nextjs/server';
import { Ship } from 'lucide-react';
import Link from 'next/link';
import { SignOutButton } from '@clerk/nextjs';
import type { UserRole } from '@/types/supabase';

export default async function GestaoLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const roles = (user?.publicMetadata?.roles ?? []) as UserRole[];
  const canAccess = roles.includes('gestor') || roles.includes('admin');

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Ship className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-[#0B2447] mb-2">Acesso Restrito</h1>
          <p className="text-sm text-slate-500 mb-6">
            Sua conta ainda não tem permissão de gestor. Você pode ativar o acesso ao painel
            usando o mesmo e-mail — basta confirmar abaixo.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/api/painel/setup-role"
              className="w-full bg-[#0B2447] hover:bg-[#0B3D91] text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              Tornar-me gestor
            </Link>
            <Link
              href="/"
              className="w-full bg-slate-100 hover:bg-slate-200 text-[#0B2447] font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              Voltar ao Site
            </Link>
            <SignOutButton redirectUrl="/painel/login">
              <button className="w-full text-red-500 font-semibold py-3 hover:bg-red-50 rounded-xl transition-colors text-sm">
                Sair da Conta
              </button>
            </SignOutButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FB]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-auto">
        <Header />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
