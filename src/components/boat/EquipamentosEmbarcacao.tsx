'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCatalogo } from '@/i18n/CatalogoProvider';
import {
  AirVent, Anchor, ArrowUpFromLine, Bath, Beer, BedDouble, BriefcaseMedical, Check, ChevronDown,
  CloudFog, Compass, CookingPot, Droplets, FireExtinguisher, Fish, Flashlight, Glasses, GlassWater,
  LifeBuoy, ListChecks, Microwave, Navigation, Radio, Refrigerator, Sailboat, Shirt, ShowerHead,
  Siren, Snowflake, Speaker, Sun, Tv, Umbrella, Usb, UtensilsCrossed, Waves, Wifi, Wine,
  type LucideIcon,
} from 'lucide-react';

// Cor de acento por categoria (ponto ao lado do título e ícones dos itens). Vai por chave: a view
// que monta as categorias é Server Component e não pode passar componentes/funções como prop.
const ESTILO = {
  seguranca: { ponto: 'bg-marinho', icone: 'text-marinho' },
  acessorios: { ponto: 'bg-turquesa', icone: 'text-turquesa-escuro' },
  // Amarelo só no ponto (acento pequeno); ícone amarelo sobre fundo claro não teria contraste.
  comodidades: { ponto: 'bg-destaque', icone: 'text-turquesa-escuro' },
};

/**
 * Ícone de cada item pelo nome (catálogos de Cadastros Auxiliares, sem ícone próprio no banco).
 * Comparação sem acento/caixa; a ordem importa (o mais específico primeiro). Sem regra → Check.
 */
const ICONE_POR_NOME: [RegExp, LucideIcon][] = [
  [/colete|boia|salva/, LifeBuoy],
  [/ancora|fundeio/, Anchor],
  [/extintor|incendio/, FireExtinguisher],
  [/gps|navega/, Navigation],
  [/radio|vhf/, Radio],
  [/compasso|bussola/, Compass],
  [/socorro|primeiros/, BriefcaseMedical],
  [/bomba|porao/, Droplets],
  [/fumaca/, CloudFog],
  [/sinalizador|luminoso|lanterna/, Flashlight],
  [/monoxido|detector|alarme|sensor/, Siren],
  [/usb|carregador|tomada/, Usb],
  [/frigobar|geladeira|refrigerador/, Refrigerator],
  [/cooler|termica|gelo/, Snowflake],
  [/escada/, ArrowUpFromLine],
  [/snorkel|mascara|oculos/, Glasses],
  [/mergulho|macarrao|flutuante|tapete/, Waves],
  [/pesca|vara|anzol/, Fish],
  [/toalha|roupao/, Shirt],
  [/ar.?condicionado|climatiz|ventila/, AirVent],
  [/chuveiro|ducha/, ShowerHead],
  [/banheiro|sanitario|\bwc\b/, Bath],
  [/bote|caiaque|\bsup\b|stand.?up/, Sailboat],
  [/cozinha|fogao|churrasq/, CookingPot],
  [/deck|solario/, Sun],
  [/mesa|jantar|talher/, UtensilsCrossed],
  [/micro.?ondas/, Microwave],
  [/\bsom\b|musica|bluetooth|caixa de som/, Speaker],
  [/toldo|cobertura|sombra/, Umbrella],
  [/wi.?fi|internet/, Wifi],
  [/\btv\b|televis/, Tv],
  [/cama|cabine|suite|quarto/, BedDouble],
  [/vinho|taca/, Wine],
  [/cerveja|chopp|copo/, Beer],
  [/agua/, GlassWater],
];

function iconeDoItem(nome: string): LucideIcon {
  const n = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return ICONE_POR_NOME.find(([re]) => re.test(n))?.[1] ?? Check;
}

/** Categoria do catálogo de nomes (`src/i18n/catalogo.ts`) de cada bloco. */
const CATEGORIA_CATALOGO = { seguranca: 'equipamento', acessorios: 'acessorio', comodidades: 'comodidade' } as const;

export type CategoriaEquipamentos = {
  /** Categoria — define a cor de acento (ponto e ícones) e os textos (`Embarcacao.categorias.<icone>`). */
  icone: keyof typeof ESTILO;
  itens: string[];
};

type Props = {
  categorias: CategoriaEquipamentos[];
};

/**
 * Accordion "O que esta embarcação possui" — no detalhe do roteiro (dentro de "Sobre a Embarcação")
 * e na página da embarcação. Fechado mostra só o resumo das contagens; aberto lista os itens
 * separados por categoria. As categorias vêm de `categoriasDaEmbarcacao` (src/lib/embarcacao-itens.ts).
 */
export default function EquipamentosEmbarcacao({ categorias }: Props) {
  const t = useTranslations('Embarcacao');
  const { traduzir, ordenar } = useCatalogo();
  const [aberto, setAberto] = useState(false);
  const idConteudo = useId();

  const visiveis = categorias.filter((c) => c.itens.length > 0);
  if (visiveis.length === 0) return null;

  const resumo = visiveis
    .map((c) => t(`categorias.${c.icone}.contagem`, { count: c.itens.length }))
    .join(' · ');

  return (
    <div className="rounded-xl border border-slate-100 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls={idConteudo}
        className="group w-full flex items-center gap-3 px-4 py-3.5 text-left rounded-xl transition-colors hover:bg-slate-50/70 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-marinho/25"
      >
        <span className="h-10 w-10 rounded-xl bg-turquesa/10 flex items-center justify-center shrink-0">
          <ListChecks className="h-5 w-5 text-turquesa-escuro" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-marinho leading-snug">
            {t('equipamentos.titulo')}{' '}
            <span className="font-normal text-slate-500">{aberto ? t('equipamentos.recolher') : t('equipamentos.expandir')}</span>
          </span>
          <span className="block text-xs text-slate-500 mt-0.5">{resumo}</span>
        </span>
        <span
          className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
            aberto ? 'bg-marinho text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-marinho/10 group-hover:text-marinho'
          }`}
        >
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {/* Expansão via grid-rows para altura automática, sem JS medindo o conteúdo. */}
      <div
        id={idConteudo}
        inert={!aberto}
        className={`grid transition-all duration-300 ease-in-out ${aberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          {/* Uma placa suave por categoria (ponto de cor + título + contagem) e itens em grade
              compacta — 2 colunas no celular, 3 a partir do sm —, cada um com ícone próprio. */}
          <div className="border-t border-slate-100 p-2 sm:p-4 space-y-2 sm:space-y-3">
            {visiveis.map(({ icone, itens }) => {
              const titulo = t(`categorias.${icone}.titulo`);
              const estilo = ESTILO[icone];
              return (
                <section key={titulo} className="rounded-xl bg-slate-50/80 px-2.5 py-3 sm:px-4">
                  <h3 className="flex items-center gap-2 mb-2.5">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${estilo.ponto}`} />
                    <span className="text-[13px] font-semibold text-marinho">{titulo}</span>
                    <span className="ml-auto text-[11px] font-medium text-slate-400 tabular-nums">
                      {t('equipamentos.itens', { count: itens.length })}
                    </span>
                  </h3>
                  <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 sm:gap-x-4 gap-y-2.5">
                    {ordenar(itens.map((nome) => ({ nome })), CATEGORIA_CATALOGO[icone]).map(({ nome }) => {
                      const IconeItem = iconeDoItem(nome);
                      return (
                        <li key={nome} className="flex items-start gap-2 text-[13px] leading-snug text-slate-700">
                          <IconeItem className={`mt-px h-4 w-4 shrink-0 ${estilo.icone}`} strokeWidth={1.75} />
                          <span>{traduzir(CATEGORIA_CATALOGO[icone], nome)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
