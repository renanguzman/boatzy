'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Ship, Users, Ruler } from 'lucide-react';

export type EmbarcacaoCardData = {
  id: string;
  nome: string;
  descricao: string | null;
  capacidade: number | null;
  comprimento: number | null;
  preco_base: number | null;
  embarcacao_tipo: { nome: string } | null;
  municipios: { nome: string; estados: { uf: string } | null } | null;
  embarcacao_imagens: { url_imagem: string; principal: boolean }[];
};

function getPrimaryImage(imgs: EmbarcacaoCardData['embarcacao_imagens']): string | null {
  return (imgs.find((i) => i.principal) ?? imgs[0])?.url_imagem ?? null;
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

export default function EmbarcacaoCard({ embarcacao }: { embarcacao: EmbarcacaoCardData }) {
  const img = getPrimaryImage(embarcacao.embarcacao_imagens);
  const localidade = embarcacao.municipios
    ? embarcacao.municipios.estados
      ? `${embarcacao.municipios.nome}, ${embarcacao.municipios.estados.uf}`
      : embarcacao.municipios.nome
    : null;

  return (
    <Link
      href={`/embarcacoes/${embarcacao.id}`}
      className="group block rounded-2xl overflow-hidden bg-white border border-slate-100 hover:border-slate-200 hover:shadow-xl transition-all duration-300"
    >
      {/* Image */}
      <div className="relative h-52 overflow-hidden bg-slate-100">
        {img ? (
          <Image
            src={img}
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

        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Type tag */}
        {embarcacao.embarcacao_tipo && (
          <div className="absolute top-3 left-3">
            <span className="bg-white/85 backdrop-blur-sm text-[#0B2447] text-[10px] font-semibold px-2.5 py-1 rounded-full">
              {embarcacao.embarcacao_tipo.nome}
            </span>
          </div>
        )}

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
          onClick={(e) => e.preventDefault()}
          aria-label="Favoritar"
          className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-white hover:scale-110 transition-all"
        >
          <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Meta row */}
        <div className="flex items-center gap-3 mb-2 text-xs text-slate-500">
          {embarcacao.capacidade && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {embarcacao.capacidade} pessoas
            </span>
          )}
          {embarcacao.comprimento && (
            <span className="flex items-center gap-1">
              <Ruler className="h-3 w-3" />
              {embarcacao.comprimento}m
            </span>
          )}
        </div>

        <h3 className="text-sm font-semibold text-[#0B2447] leading-snug line-clamp-2 group-hover:text-[#0B3D91] transition-colors mb-3">
          {embarcacao.nome}
        </h3>

        {/* Price row */}
        <div className="flex items-end justify-between pt-3 border-t border-slate-50">
          {embarcacao.preco_base ? (
            <div>
              <span className="text-base font-bold text-[#0B3D91]">
                {formatPrice(embarcacao.preco_base)}
              </span>
              <span className="text-xs text-slate-400 ml-1">/dia</span>
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">Consulte o preço</span>
          )}
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-cyan-50 text-cyan-700 px-2 py-1 rounded-full">
            Novo
          </span>
        </div>
      </div>
    </Link>
  );
}
