'use client';

import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Spinner from '@/components/ui/Spinner';
import { iniciarBarraNavegacao } from '@/components/ui/BarraProgressoNavegacao';

interface Props {
  redirectUrl?: string;
  className?: string;
  children?: React.ReactNode;
}

export default function SignOutLink({
  redirectUrl = '/painel/login',
  className = 'w-full text-red-500 font-semibold py-3 hover:bg-red-50 rounded-xl transition-colors text-sm',
  children = 'Sair da Conta',
}: Props) {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  async function handleSignOut() {
    if (saindo) return;
    setSaindo(true);
    iniciarBarraNavegacao();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(redirectUrl);
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={saindo}
      aria-busy={saindo}
      className={`${className} inline-flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait`}
    >
      {saindo && <Spinner />}
      {children}
    </button>
  );
}
