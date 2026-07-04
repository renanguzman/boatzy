'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Loader2 } from 'lucide-react';
import { alternarFavorito } from '@/lib/favoritos-actions';

export default function RemoverFavoritoButton({ roteiroId }: { roteiroId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remover() {
    startTransition(async () => {
      await alternarFavorito(roteiroId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={remover}
      disabled={pending}
      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-60 transition-colors"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" />
      )}
      Remover dos favoritos
    </button>
  );
}
