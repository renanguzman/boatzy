'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Heart, Share2, Link2, Check, MessageCircle } from 'lucide-react';
import { alternarFavorito } from '@/lib/favoritos-actions';

// Ícones de marca (a lucide-react removeu os brand icons).
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

type Props = {
  roteiroId: string;
  roteiroNome: string;
  /** Estado inicial resolvido no servidor (false quando deslogado). */
  initialFavorito: boolean;
};

/** Botões Favoritar + Compartilhar do detalhe do roteiro (rodapé da sidebar). */
export default function RoteiroAcoes({ roteiroId, roteiroNome, initialFavorito }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  // Favoritar (otimista: alterna na hora e reverte se a action falhar)
  const [favorito, setFavorito] = useState(initialFavorito);

  // Compartilhar
  const [shareOpen, setShareOpen] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShareOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function handleFavoritar() {
    const anterior = favorito;
    setFavorito(!anterior);
    startTransition(async () => {
      const res = await alternarFavorito(roteiroId);
      if (!res.ok) {
        setFavorito(anterior);
        if (res.error === 'nao_autenticado') {
          router.push(`/entrar?redirect_to=${encodeURIComponent(pathname)}`);
        }
      } else {
        setFavorito(res.favorito);
      }
    });
  }

  function shareUrl(): string {
    return window.location.href;
  }

  function shareText(): string {
    return `Confira o roteiro "${roteiroNome}" no Boatzy!`;
  }

  async function copiarLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Clipboard indisponível (http/permissão): mantém o dropdown aberto sem feedback.
    }
  }

  function compartilharWhatsApp() {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${shareText()} ${shareUrl()}`)}`,
      '_blank',
      'noopener',
    );
    setShareOpen(false);
  }

  function compartilharFacebook() {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl())}`,
      '_blank',
      'noopener,width=600,height=500',
    );
    setShareOpen(false);
  }

  // O Instagram não tem endpoint web de compartilhamento por URL: copiamos o
  // link (para colar no story/direct) e abrimos o Instagram.
  async function compartilharInstagram() {
    await copiarLink();
    window.open('https://www.instagram.com/', '_blank', 'noopener');
  }

  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={handleFavoritar}
        aria-pressed={favorito}
        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-colors ${
          favorito
            ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
        }`}
      >
        <Heart className={`h-4 w-4 ${favorito ? 'fill-red-500 text-red-500' : ''}`} />
        {favorito ? 'Favoritado' : 'Favoritar'}
      </button>

      <div className="relative flex-1" ref={shareRef}>
        <button
          type="button"
          onClick={() => setShareOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={shareOpen}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Share2 className="h-4 w-4" />
          Compartilhar
        </button>

        {shareOpen && (
          <div
            role="menu"
            className="absolute bottom-full right-0 mb-2 w-56 rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-900/10 overflow-hidden z-50 py-1.5"
          >
            <button
              type="button"
              role="menuitem"
              onClick={compartilharWhatsApp}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <MessageCircle className="h-4 w-4 text-emerald-500" />
              WhatsApp
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={compartilharFacebook}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <FacebookIcon className="h-4 w-4 text-blue-600" />
              Facebook
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={compartilharInstagram}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <InstagramIcon className="h-4 w-4 text-pink-500" />
              <span className="text-left leading-tight">
                Instagram
                <span className="block text-[10px] text-slate-400">copia o link para o story/direct</span>
              </span>
            </button>
            <div className="my-1 border-t border-slate-100" />
            <button
              type="button"
              role="menuitem"
              onClick={copiarLink}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {copiado ? (
                <>
                  <Check className="h-4 w-4 text-emerald-500" />
                  <span className="text-emerald-600 font-medium">Link copiado!</span>
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 text-slate-400" />
                  Copiar link
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
