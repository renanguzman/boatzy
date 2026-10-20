'use client';

import { Fragment, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { MapPin, Ship, Tag } from 'lucide-react';

type Item = 'roteiros' | 'embarcacoes' | 'vendas';

// Mesmos ícones do seletor de busca do hero (SearchTypeToggle).
const ITENS: { id: Item; href: string; label: string; icon: typeof MapPin }[] = [
  { id: 'roteiros', href: '/buscar', label: 'Roteiros', icon: MapPin },
  { id: 'embarcacoes', href: '/buscar?tipo=embarcacao', label: 'Embarcações', icon: Ship },
  { id: 'vendas', href: '/vendas', label: 'Vendas', icon: Tag },
];

/**
 * Menu principal do header (desktop): pílula segmentada com ícone por item e
 * divisórias finas. Hover e página atual viram um "botão" branco elevado com o
 * texto na cor da marca — deixa claro que é link sem pesar no header. No
 * tablet (md–lg) mostra só os ícones (nome no tooltip/aria-label).
 */
export default function NavPrincipal() {
  return (
    // useSearchParams exige Suspense (a página pode ser pré-renderizada); o
    // fallback é o mesmo menu, só sem o item ativo.
    <Suspense fallback={<Menu ativo={null} />}>
      <MenuComAtivo />
    </Suspense>
  );
}

function MenuComAtivo() {
  const pathname = usePathname();
  const tipo = useSearchParams().get('tipo');
  const ativo: Item | null =
    pathname.startsWith('/vendas') ? 'vendas'
    : pathname.startsWith('/embarcacoes') || (pathname === '/buscar' && tipo === 'embarcacao') ? 'embarcacoes'
    : pathname === '/buscar' || pathname.startsWith('/roteiros') ? 'roteiros'
    : null;
  return <Menu ativo={ativo} />;
}

function Menu({ ativo }: { ativo: Item | null }) {
  return (
    <nav
      aria-label="Menu principal"
      className="hidden md:flex items-center rounded-full border border-slate-200/80 bg-slate-50/80 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
      id="main-nav"
    >
      {ITENS.map(({ id, href, label, icon: Icone }, i) => {
        const atual = ativo === id;
        // Divisória some ao lado do item destacado (atual), para a pílula branca respirar.
        const divisoriaVisivel = i > 0 && ativo !== id && ativo !== ITENS[i - 1].id;
        return (
          <Fragment key={id}>
            {i > 0 && (
              <span aria-hidden className={`h-4 w-px bg-slate-200 transition-opacity ${divisoriaVisivel ? 'opacity-100' : 'opacity-0'}`} />
            )}
            <Link
              href={href}
              aria-current={atual ? 'page' : undefined}
              aria-label={label}
              title={label}
              className={`group flex items-center gap-2 rounded-full px-3 xl:px-4 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3D91] ${
                atual
                  ? 'bg-white text-[#0B3D91] shadow-sm ring-1 ring-slate-200/70'
                  : 'text-slate-600 hover:bg-white hover:text-[#0B3D91] hover:shadow-sm'
              }`}
            >
              <Icone
                className={`h-4 w-4 transition-colors ${atual ? 'text-cyan-600' : 'text-slate-400 group-hover:text-cyan-600'}`}
                strokeWidth={1.75}
              />
              {/* Tablet (md–lg): só ícones, para caber ao lado do logo e das ações. */}
              <span className="hidden lg:inline">{label}</span>
            </Link>
          </Fragment>
        );
      })}
    </nav>
  );
}
