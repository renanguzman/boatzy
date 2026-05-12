'use client';

import { useEffect } from 'react';
import { useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Loader2, Ship } from 'lucide-react';

/**
 * Após o sign-up, o Clerk emite um JWT que ainda não contém o publicMetadata
 * atualizado pelo setup-role. Esta página força o reload da sessão para que
 * o novo token carregue role: 'gestor' antes de entrar no painel protegido.
 */
export default function AtualizandoPage() {
  const { session } = useClerk();
  const router = useRouter();

  useEffect(() => {
    if (!session) return;

    session.reload().then(() => {
      router.replace('/painel');
    });
  }, [session, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 gap-4">
      <Ship className="w-10 h-10 text-cyan-400" />
      <div className="flex items-center gap-2 text-white">
        <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
        <span className="text-sm font-medium">Preparando seu acesso…</span>
      </div>
    </div>
  );
}
