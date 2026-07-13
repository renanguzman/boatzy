'use client';

import { useEffect, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin, Ship, Users, ArrowDownRight, Ruler } from 'lucide-react';
import { alternarFavoritoAnuncio } from '@/lib/favoritos-actions';

export type AnuncioVendaCardData = {
  id: string;
  nome: string;
  fabricante: string;
  ano_modelo: number;
  ano_fabricacao: number;
  preco: number;
  /** Preço imediatamente anterior no histórico; alimenta o selo de redução. */
  precoAnterior: number | null;
  tipo: string | null;
  localidade: string | null;
  capacidade: number | null;
  comprimento: number | null;
  imagem: string | null;
};

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export default function AnuncioVendaCard({
  anuncio,
  initialFavorito = false,
}: {
  anuncio: AnuncioVendaCardData;
  /** Se o usuário logado já favoritou este anúncio (false quando deslogado). */
  initialFavorito?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [favorito, setFavorito] = useState(initialFavorito);

  // Só REDUÇÃO ganha selo — aumento nunca é exibido ao comprador.
  const reduzido = anuncio.precoAnterior != null && Number(anuncio.preco) < Number(anuncio.precoAnterior);

  function favoritar(anterior: boolean) {
    setFavorito(!anterior);
    startTransition(async () => {
      const res = await alternarFavoritoAnuncio(anuncio.id);
      if (!res.ok) {
        setFavorito(anterior);
        if (res.error === 'nao_autenticado') {
          // Volta para a página atual com fav_anuncio=<id>: após o login, o
          // card detecta o parâmetro e conclui o favorito automaticamente.
          const sp = new URLSearchParams(window.location.search);
          sp.set('fav_anuncio', anuncio.id);
          router.push(
            `/entrar?redirect_to=${encodeURIComponent(`${window.location.pathname}?${sp}`)}`,
          );
        }
      } else {
        setFavorito(res.favorito);
      }
    });
  }

  function handleFavoritar(e: React.MouseEvent) {
    // O coração fica dentro do <Link> do card — não navegar ao clicar.
    e.preventDefault();
    e.stopPropagation();
    favoritar(favorito);
  }

  // Conclui o favorito iniciado antes do login (fav_anuncio na URL vindo do
  // redirect_to) e limpa o parâmetro para não repetir em navegações futuras.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('fav_anuncio') !== anuncio.id) return;
    sp.delete('fav_anuncio');
    const query = sp.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    if (!favorito) favoritar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Link
      href={`/vendas/${anuncio.id}`}
      className="group block rounded-2xl overflow-hidden bg-white border border-slate-100 hover:border-slate-200 hover:shadow-xl transition-all duration-300"
      id={`anuncio-card-${anuncio.id}`}
    >
      {/* Image */}
      <div className="relative h-52 overflow-hidden bg-slate-100">
        {anuncio.imagem ? (
          <Image
            src={anuncio.imagem}
            alt={anuncio.nome}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Ship className="w-10 h-10 text-slate-200" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Selo de preço reduzido */}
        {reduzido && (
          <div className="absolute top-3 left-3">
            <span className="flex items-center gap-1 bg-emerald-600/95 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
              <ArrowDownRight className="h-3 w-3" />
              Preço reduzido
            </span>
          </div>
        )}

        {/* Badge de tipo */}
        {anuncio.tipo && (
          <div className="absolute bottom-3 left-3">
            <span className="bg-[#0B3D91]/90 backdrop-blur-sm text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">
              {anuncio.tipo}
            </span>
          </div>
        )}

        {/* Favorite */}
        <button
          type="button"
          onClick={handleFavoritar}
          aria-label={favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          aria-pressed={favorito}
          className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-white hover:scale-110 transition-all"
        >
          <svg
            className={`h-4 w-4 transition-colors ${favorito ? 'text-red-500' : 'text-slate-500'}`}
            fill={favorito ? 'currentColor' : 'none'}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-slate-800 text-sm truncate group-hover:text-[#0B3D91] transition-colors">
          {anuncio.nome}
        </h3>
        <p className="text-xs text-slate-500 mt-0.5 truncate">
          {anuncio.fabricante} · {anuncio.ano_modelo}
          {anuncio.ano_fabricacao !== anuncio.ano_modelo && `/${anuncio.ano_fabricacao}`}
        </p>

        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
          {anuncio.localidade && (
            <span className="flex items-center gap-1 min-w-0">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{anuncio.localidade}</span>
            </span>
          )}
          {anuncio.capacidade != null && (
            <span className="flex items-center gap-1 shrink-0">
              <Users className="h-3 w-3" />
              {anuncio.capacidade}
            </span>
          )}
          {anuncio.comprimento != null && (
            <span className="flex items-center gap-1 shrink-0">
              <Ruler className="h-3 w-3" />
              {Number(anuncio.comprimento).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m
            </span>
          )}
        </div>

        {/* Preço */}
        <div className="flex items-baseline gap-2 mt-3">
          <span className="text-base font-bold text-[#0B2447]">{brl.format(Number(anuncio.preco))}</span>
          {reduzido && (
            <span className="text-xs text-slate-400 line-through">
              {brl.format(Number(anuncio.precoAnterior))}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
