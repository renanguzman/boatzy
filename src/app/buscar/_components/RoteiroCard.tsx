'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin, Users, Clock, Ship, Star } from 'lucide-react';
import { alternarFavorito } from '@/lib/favoritos-actions';

export type AvaliacaoResumoCard = { media: number; total: number };

export type RoteiroCardData = {
  id: string;
  nome: string;
  descricao: string;
  quantidade_pessoas: number | null;
  preco_base: number | null;
  duracao: string | null;
  municipios: { nome: string; estados: { uf: string } | null } | null;
  roteiro_imagens: { url_imagem: string; principal: boolean }[];
  embarcacao: { embarcacao_tipo: { nome: string } | null } | null;
};

function getPrimaryImage(imgs: RoteiroCardData['roteiro_imagens']): string | null {
  return (imgs.find((i) => i.principal) ?? imgs[0])?.url_imagem ?? null;
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

export default function RoteiroCard({
  roteiro,
  query,
  initialFavorito = false,
  avaliacaoResumo = null,
}: {
  roteiro: RoteiroCardData;
  /** Querystring (sem '?') com os filtros da busca (data/flex/pessoas) para pré-preencher o detalhe. */
  query?: string;
  /** Se o usuário logado já favoritou este roteiro (false quando deslogado). */
  initialFavorito?: boolean;
  /** Média/total de avaliações do roteiro; null = sem avaliações (exibe o badge "Novo"). */
  avaliacaoResumo?: AvaliacaoResumoCard | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [favorito, setFavorito] = useState(initialFavorito);

  function handleFavoritar(e: React.MouseEvent) {
    // O coração fica dentro do <Link> do card — não navegar ao clicar.
    e.preventDefault();
    e.stopPropagation();
    const anterior = favorito;
    setFavorito(!anterior);
    startTransition(async () => {
      const res = await alternarFavorito(roteiro.id);
      if (!res.ok) {
        setFavorito(anterior);
        if (res.error === 'nao_autenticado') {
          router.push(
            `/entrar?redirect_to=${encodeURIComponent(window.location.pathname + window.location.search)}`,
          );
        }
      } else {
        setFavorito(res.favorito);
      }
    });
  }

  const img = getPrimaryImage(roteiro.roteiro_imagens);
  const localidade = roteiro.municipios
    ? roteiro.municipios.estados
      ? `${roteiro.municipios.nome}, ${roteiro.municipios.estados.uf}`
      : roteiro.municipios.nome
    : null;

  const href = query ? `/roteiros/${roteiro.id}?${query}` : `/roteiros/${roteiro.id}`;

  return (
    <Link
      href={href}
      className="group block rounded-2xl overflow-hidden bg-white border border-slate-100 hover:border-slate-200 hover:shadow-xl transition-all duration-300"
    >
      {/* Image */}
      <div className="relative h-52 overflow-hidden bg-slate-100">
        {img ? (
          <Image
            src={img}
            alt={roteiro.nome}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MapPin className="w-10 h-10 text-slate-200" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Location tag */}
        {localidade && (
          <div className="absolute bottom-3 left-3">
            <span className="bg-[#0B2447]/85 backdrop-blur-sm text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">
              {localidade}
            </span>
          </div>
        )}

        {/* Favorite */}
        <button
          type="button"
          onClick={handleFavoritar}
          aria-label={favorito ? 'Remover dos favoritos' : 'Favoritar'}
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Meta row */}
        <div className="flex items-center gap-3 mb-2 text-xs text-slate-500">
          {roteiro.embarcacao?.embarcacao_tipo && (
            <span className="flex items-center gap-1">
              <Ship className="h-3 w-3" />
              {roteiro.embarcacao.embarcacao_tipo.nome}
            </span>
          )}
          {roteiro.quantidade_pessoas && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {roteiro.quantidade_pessoas} pessoas
            </span>
          )}
          {roteiro.duracao && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {roteiro.duracao}
            </span>
          )}
        </div>

        <h3 className="text-sm font-semibold text-[#0B2447] leading-snug line-clamp-2 group-hover:text-[#0B3D91] transition-colors mb-3">
          {roteiro.nome}
        </h3>

        {/* Price row */}
        <div className="flex items-end justify-between pt-3 border-t border-slate-50">
          {roteiro.preco_base ? (
            <div>
              <span className="text-base font-bold text-[#0B3D91]">
                {formatPrice(roteiro.preco_base)}
              </span>
              <span className="text-xs text-slate-400 ml-1">/dia</span>
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">Consulte o preço</span>
          )}
          {avaliacaoResumo ? (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B2447]"
              title={`${avaliacaoResumo.total} ${avaliacaoResumo.total === 1 ? 'avaliação' : 'avaliações'}`}
            >
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {avaliacaoResumo.media.toLocaleString('pt-BR', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
              <span className="font-normal text-slate-400">({avaliacaoResumo.total})</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-cyan-50 text-cyan-700 px-2 py-1 rounded-full">
              Novo
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
