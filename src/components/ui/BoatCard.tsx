'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Star, MapPin } from 'lucide-react';
import { Boat } from '@/types';
import { formatCurrency, getBoatTypeLabel } from '@/lib/utils';

interface BoatCardProps {
  boat: Boat;
  variant?: 'default' | 'featured';
}

export default function BoatCard({ boat, variant = 'default' }: BoatCardProps) {
  const isFeatured = variant === 'featured';

  return (
    <Link
      href={`/boats/${boat.id}`}
      className="group block rounded-2xl overflow-hidden bg-white border border-slate-100 hover:border-slate-200 hover:shadow-xl transition-all duration-300"
      id={`boat-card-${boat.id}`}
    >
      {/* Image */}
      <div className={`relative overflow-hidden ${isFeatured ? 'h-64' : 'h-52'}`}>
        <Image
          src={boat.images[0]}
          alt={boat.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Badges */}
        {boat.badges && boat.badges.length > 0 && (
          <div className="absolute top-3 left-3 flex gap-1.5">
            {boat.badges.map((badge, i) => (
              <span
                key={i}
                className="bg-white/90 backdrop-blur-sm text-[10px] font-semibold text-[#0B3D91] px-2.5 py-1 rounded-full"
              >
                {badge}
              </span>
            ))}
          </div>
        )}

        {/* Type badge */}
        <div className="absolute bottom-3 left-3">
          <span className="bg-[#0B3D91]/90 backdrop-blur-sm text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">
            {getBoatTypeLabel(boat.type)}
          </span>
        </div>

        {/* Favorite button */}
        <button
          className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-white hover:scale-110 transition-all"
          onClick={(e) => {
            e.preventDefault();
            // Will integrate with Supabase later
          }}
          aria-label="Adicionar aos favoritos"
        >
          <svg
            className="h-4 w-4 text-slate-600"
            fill="none"
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
              {boat.name}
            </h3>
            <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{boat.location}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="text-sm font-semibold text-slate-800">{boat.rating}</span>
          </div>
        </div>

        <div className="flex items-end justify-between mt-3 pt-3 border-t border-slate-50">
          <div>
            <span className="text-lg font-bold text-[#0B3D91]">
              {formatCurrency(boat.pricePerDay)}
            </span>
            <span className="text-xs text-slate-500">/dia</span>
          </div>
          {boat.capacity && (
            <span className="text-xs text-slate-400">
              até {boat.capacity} pessoas
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
