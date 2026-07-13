'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Heart,
  Share2,
  Link2,
  Check,
  MessageCircle,
  ArrowDownRight,
  User,
  Mail,
  Loader2,
  Eye,
  ShieldCheck,
  Pencil,
} from 'lucide-react';
import { alternarFavoritoAnuncio } from '@/lib/favoritos-actions';
import { revelarContatoVendedor, registrarCompartilhamentoAnuncio } from '@/lib/vendas-actions';

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

type Vendedor = { nome: string; email: string; avatar_url: string | null };

type Props = {
  anuncioId: string;
  anuncioNome: string;
  preco: number;
  precoAnterior: number | null;
  reduzidoEm: string | null;
  /** Nome já mascarado no servidor — o nome completo só sai pela action. */
  vendedorNomeMascarado: string;
  initialFavorito: boolean;
  /** Dono vendo o próprio anúncio: sem revelar/chat/favorito (não é lead). */
  ehDono: boolean;
};

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export default function VendaSidebar({
  anuncioId,
  anuncioNome,
  preco,
  precoAnterior,
  reduzidoEm,
  vendedorNomeMascarado,
  initialFavorito,
  ehDono,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const [favorito, setFavorito] = useState(initialFavorito);
  const [vendedor, setVendedor] = useState<Vendedor | null>(null);
  const [revelando, setRevelando] = useState(false);

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
      const res = await alternarFavoritoAnuncio(anuncioId);
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

  async function handleRevelar() {
    if (revelando) return;
    setRevelando(true);
    const res = await revelarContatoVendedor(anuncioId);
    setRevelando(false);
    if (res.ok) {
      setVendedor(res.vendedor);
    } else if (res.error === 'nao_autenticado') {
      router.push(`/entrar?redirect_to=${encodeURIComponent(pathname)}`);
    }
  }

  // Evento do funil (idempotente); o compartilhamento em si roda no client.
  function pontuarCompartilhamento() {
    startTransition(async () => {
      await registrarCompartilhamentoAnuncio(anuncioId);
    });
  }

  function shareUrl(): string {
    return window.location.href;
  }

  function shareText(): string {
    return `Confira a "${anuncioNome}" à venda no Boatzy por ${brl.format(preco)}!`;
  }

  async function copiarLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Clipboard indisponível (http/permissão): mantém o dropdown aberto sem feedback.
    }
    pontuarCompartilhamento();
  }

  function compartilharWhatsApp() {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${shareText()} ${shareUrl()}`)}`,
      '_blank',
      'noopener',
    );
    pontuarCompartilhamento();
    setShareOpen(false);
  }

  function compartilharFacebook() {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl())}`,
      '_blank',
      'noopener,width=600,height=500',
    );
    pontuarCompartilhamento();
    setShareOpen(false);
  }

  // O Instagram não tem endpoint web de compartilhamento por URL: copiamos o
  // link (para colar no story/direct) e abrimos o Instagram.
  async function compartilharInstagram() {
    await copiarLink();
    window.open('https://www.instagram.com/', '_blank', 'noopener');
  }

  const dataReducao = reduzidoEm
    ? new Date(reduzidoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  return (
    <div className="lg:sticky lg:top-24 rounded-2xl border border-slate-200 shadow-xl shadow-slate-900/5 p-6 bg-white">
      {/* Preço */}
      {precoAnterior != null && (
        <p className="text-sm text-slate-400">
          De <span className="line-through">{brl.format(precoAnterior)}</span> por
        </p>
      )}
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-[#0B2447]">{brl.format(preco)}</span>
      </div>
      {precoAnterior != null && dataReducao && (
        <p className="flex items-center gap-1 text-xs font-semibold text-emerald-600 mt-1">
          <ArrowDownRight className="h-3.5 w-3.5" />
          Preço reduzido em {dataReducao}
        </p>
      )}

      <div className="my-5 border-t border-slate-100" />

      {ehDono ? (
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-center">
          <p className="text-sm font-semibold text-slate-700">Este é o seu anúncio</p>
          <p className="text-xs text-slate-400 mt-1">
            Interações suas não contam no funil de vendas.
          </p>
          <Link
            href={`/painel/vendas/${anuncioId}/editar`}
            className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-[#0B3D91] hover:text-[#0B2447] transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Gerenciar anúncio no painel
          </Link>
        </div>
      ) : (
        <>
          {/* Vendedor */}
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Vendedor</p>
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-slate-400" />
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold truncate ${vendedor ? 'text-slate-800' : 'text-slate-400 tracking-wider'}`}>
                  {vendedor ? vendedor.nome : vendedorNomeMascarado}
                </p>
                {vendedor && (
                  <a
                    href={`mailto:${vendedor.email}`}
                    className="flex items-center gap-1 text-xs text-[#0B3D91] hover:underline truncate"
                  >
                    <Mail className="h-3 w-3 shrink-0" />
                    {vendedor.email}
                  </a>
                )}
              </div>
            </div>

            {!vendedor && (
              <button
                type="button"
                onClick={handleRevelar}
                disabled={revelando}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-xs font-semibold transition-colors disabled:opacity-60"
              >
                {revelando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                Revelar contato do vendedor
              </button>
            )}
          </div>

          {/* Chat */}
          <Link
            href={`/vendas/${anuncioId}/chat`}
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0B3D91] hover:bg-[#092E6E] text-white text-sm font-semibold transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            Conversar com o vendedor
          </Link>

          <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 mt-3">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Negocie por dentro da plataforma com mais segurança
          </p>
        </>
      )}

      <div className="my-5 border-t border-slate-100" />

      {/* Favoritar + Compartilhar */}
      <div className="flex gap-3">
        {!ehDono && (
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
        )}

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
    </div>
  );
}
