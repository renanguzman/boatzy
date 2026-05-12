import { SignUp } from '@clerk/nextjs';
import { Ship } from 'lucide-react';
import Link from 'next/link';

export default function PainelCadastroPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
    <div className="flex flex-col items-center gap-8 w-full max-w-md">
      <div className="text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-2">
          <Ship className="w-8 h-8 text-cyan-400" />
          <span className="text-2xl font-bold text-white tracking-tight">
            Boatzy <span className="text-cyan-400">Painel</span>
          </span>
        </Link>
        <p className="text-slate-400 text-sm mt-1">Crie sua conta de gestor de embarcações</p>
      </div>

      <SignUp
        routing="hash"
        fallbackRedirectUrl="/api/painel/setup-role"
        signInUrl="/painel/login"
      />
    </div>
    </div>
  );
}
