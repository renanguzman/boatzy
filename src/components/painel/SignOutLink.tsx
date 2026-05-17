'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

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

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(redirectUrl);
  }

  return (
    <button onClick={handleSignOut} className={className}>
      {children}
    </button>
  );
}
