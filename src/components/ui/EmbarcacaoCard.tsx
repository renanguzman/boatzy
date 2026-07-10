'use client';

import { useEffect, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin, Star, Ship, Users } from 'lucide-react';
import { alternarFavoritoEmbarcacao } from '@/lib/favoritos-actions';

export type EmbarcacaoCardData = {
  id: string;
  nome: string;
  preco_base: number | null;
  capacidade: number | null;
  tipo: string | null;
  localidade: string | null;
  imagem: string | null;
};

export type AvaliacaoResumoCard = { media: number; total: number };

export default function EmbarcacaoCard({
  embarcacao,
  initialFavorito = false,
  avaliacaoResumo = null,
}: {
  embarcacao: EmbarcacaoCardData;
  /** Se o usuário logado já favoritou esta embarcação (false quando deslogado). */
  initialFavorito?: boolean;
  /** Média/total de avaliações (de roteiros feitos na embarcação); null = sem avaliações. */
  avaliacaoResumo?: AvaliacaoResumoCard | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [favorito, setFavorito] = useState(initialFavorito);

  function favoritar(anterior: boolean) {
    setFavorito(!anterior);
    startTransition(async () => {
      const res = await alternarFavoritoEmbarcacao(embarcacao.id);
      if (!res.ok) {
        setFavorito(anterior);
        if (res.error === 'nao_autenticado') {
          // Volta para a página atual com fav_emb=<id>: após o login, o card
          // detecta o parâmetro e conclui o favorito automaticamente.
          const sp = new URLSearchParams(window.location.search);
          sp.set('fav_emb', embarcacao.id);
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

  // Conclui o favorito iniciado antes do login (fav_emb na URL vindo do
  // redirect_to) e limpa o parâmetro para não repetir em navegações futuras.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('fav_emb') !== embarcacao.id) return;
    sp.delete('fav_emb');
    const query = sp.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    if (!favorito) favoritar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Link
      href={`/embarcacoes/${embarcacao.id}`}
      className="group block rounded-2xl overflow-hidden bg-white border border-slate-100 hover:border-slate-200 hover:shadow-xl transition-all duration-300"
      id={`embarcacao-card-${embarcacao.id}`}
    >
      {/* Image */}
      <div className="relative h-52 overflow-hidden bg-slate-100">
        {embarcacao.imagem ? (
          <Image
            src={embarcacao.imagem}
            alt={embarcacao.nome}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Ship className="w-10 h-10 text-slate-200" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Type badge */}
        {embarcacao.tipo && (
          <div className="absolute bottom-3 left-3">
            <span className="bg-[#0B3D91]/90 backdrop-blur-sm text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">
              {embarcacao.tipo}
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
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-800 text-sm truncate group-hover:text-[#0B3D91] transition-colors">
              {embarcacao.nome}
            </h3>
            {embarcacao.localidade && (
              <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{embarcacao.localidade}</span>
              </div>
            )}
            {embarcacao.capacidade && (
              <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                <Users className="h-3 w-3 shrink-0" />
                <span className="truncate">até {embarcacao.capacidade} pessoas</span>
              </div>
            )}
          </div>
          {avaliacaoResumo ? (
            <span
              className="flex items-center gap-1 shrink-0"
              title={`${avaliacaoResumo.total} ${avaliacaoResumo.total === 1 ? 'avaliação' : 'avaliações'}`}
            >
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="text-sm font-semibold text-slate-800">
                {avaliacaoResumo.media.toLocaleString('pt-BR', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
              </span>
              <span className="text-xs font-normal text-slate-400">({avaliacaoResumo.total})</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-cyan-50 text-cyan-700 px-2 py-1 rounded-full shrink-0">
              Novo
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
