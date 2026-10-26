'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarDays, Check, ChevronDown, Package, Plus, Wrench } from 'lucide-react';
import { useCart, type CartAddon } from './CartContext';
import { useDataReserva } from './DataReservaContext';
import { useFormatos } from '@/i18n/formatos';
import { rastrear } from '@/lib/analytics';

type Props = {
  roteiroId: string;
  /**
   * `conteudo`: seção "Turbine seu passeio" no corpo da página (abaixo de "Sobre a Embarcação"),
   * com botão "Adicionar" por item. `card`: lista compacta dentro do card de reserva, com marcação.
   * As duas usam o mesmo carrinho — adicionar num lugar marca no outro e soma no total.
   */
  variante: 'conteudo' | 'card';
  /**
   * Card: chamado quando o cliente tenta incluir um opcional sem ter escolhido a data — sem data
   * não há subtotal, então o card abre o calendário em vez de aceitar o opcional.
   */
  onFaltaData?: () => void;
};

/** Itens visíveis antes do "Ver mais" em cada variante. */
const VISIVEIS = { conteudo: 4, card: 3 } as const;

/** Tempo que o bloco precisa ficar à vista antes de animar — passar rolando rápido não dispara. */
const ESPERA_VISIVEL_MS = 450;

/**
 * Liga a animação de atenção na primeira vez que o bloco fica à vista (metade dele, por
 * ESPERA_VISIVEL_MS) — e só nessa vez.
 */
function useApareceuUmaVez<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [apareceu, setApareceu] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observador = new IntersectionObserver(([entrada]) => {
      clearTimeout(timer);
      if (entrada.isIntersecting) {
        timer = setTimeout(() => {
          setApareceu(true);
          observador.disconnect();
        }, ESPERA_VISIVEL_MS);
      }
    }, { threshold: 0.5 });
    observador.observe(el);
    return () => {
      clearTimeout(timer);
      observador.disconnect();
    };
  }, []);
  return { ref, apareceu };
}

/**
 * Opcionais do roteiro (produtos/serviços do catálogo do dono) sempre à vista, com nome e preço —
 * antes ficavam num accordion fechado com cara de anúncio, que quase ninguém abria.
 */
export default function OpcionaisRoteiro({ roteiroId, variante, onFaltaData }: Props) {
  const t = useTranslations('Opcionais');
  const f = useFormatos();
  const { addons, selectedIds, toggle, selectedAddons, precoCliente } = useCart();
  const { data } = useDataReserva();
  const [verTodos, setVerTodos] = useState(false);
  const [avisoData, setAvisoData] = useState(false);
  const { ref, apareceu } = useApareceuUmaVez<HTMLDivElement>();
  // Card sem data escolhida: opcionais esmaecidos e travados para inclusão (remover continua livre).
  const travadoSemData = variante === 'card' && !data;

  if (addons.length === 0) return null;

  const limite = VISIVEIS[variante];
  const visiveis = verTodos ? addons : addons.slice(0, limite);
  const ocultos = addons.length - visiveis.length;
  const totalSelecionado = selectedAddons.reduce((soma, a) => soma + precoCliente(a.preco), 0);

  function alternar(item: CartAddon) {
    if (travadoSemData && !selectedIds.has(item.id)) {
      setAvisoData(true);
      onFaltaData?.();
      return;
    }
    setAvisoData(false);
    rastrear(selectedIds.has(item.id) ? 'opcional_removido' : 'opcional_adicionado', {
      item_id: roteiroId, opcional: item.descricao, origem: variante,
    });
    toggle(item.id);
  }

  const preco = (item: CartAddon) => (item.preco > 0 ? f.moeda(precoCliente(item.preco)) : t('incluso'));
  const verMais = ocultos > 0 && (
    <button
      type="button"
      onClick={() => setVerTodos(true)}
      className="w-full flex items-center justify-center gap-1 py-2.5 text-xs font-semibold text-turquesa-escuro hover:underline underline-offset-4"
    >
      {t('verMais', { count: ocultos })}
      <ChevronDown className="h-3.5 w-3.5" />
    </button>
  );

  // ── Card de reserva: lista compacta com marcação, no fluxo dos campos (Data, Pessoas…) ──
  if (variante === 'card') {
    return (
      <div ref={ref} className="mb-4">
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            {t('adicioneAoPasseio')}
          </p>
          {travadoSemData && (
            <span className="text-[11px] text-slate-400">{t('escolhaDataPrimeiro')}</span>
          )}
        </div>
        {/* `key`: ao escolher a data, o bloco remonta e a animação de atenção roda de novo — é o
            momento em que o cliente está decidindo. */}
        <div
          key={data ? 'com-data' : 'sem-data'}
          className={`rounded-xl border border-turquesa/40 bg-turquesa/[0.04] px-3 ${apareceu ? 'animate-opcionais' : ''}`}
        >
          <ul className="divide-y divide-slate-100">
            {visiveis.map((item, i) => {
              const marcado = selectedIds.has(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => alternar(item)}
                    aria-pressed={marcado}
                    aria-disabled={travadoSemData && !marcado}
                    className={`w-full flex items-center gap-3 py-2.5 text-left transition-opacity ${
                      travadoSemData && !marcado ? 'opacity-55' : ''
                    }`}
                  >
                    <span
                      className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                        marcado ? 'border-marinho bg-marinho text-white' : 'border-slate-300 bg-white text-transparent'
                      } ${apareceu && i === 0 && !marcado ? 'animate-opcionais-pulso' : ''}`}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className={`min-w-0 flex-1 text-sm leading-snug ${marcado ? 'font-semibold text-marinho' : 'text-slate-700'}`}>
                      {item.descricao}
                    </span>
                    <span className={`shrink-0 text-sm tabular-nums ${marcado ? 'font-bold text-marinho' : 'font-medium text-slate-600'}`}>
                      {item.preco > 0 ? `+ ${preco(item)}` : preco(item)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {verMais && <div className="border-t border-slate-100">{verMais}</div>}
        </div>
        {avisoData && travadoSemData && (
          <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-700">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            {t('escolhaDataParaOpcionais')}
          </p>
        )}
      </div>
    );
  }

  // ── Conteúdo: seção própria com botão "Adicionar" por item ──
  return (
    <div ref={ref} className="mb-8">
      <h2 className="text-xl font-bold text-marinho">{t('titulo')}</h2>
      <p className="mt-1 mb-4 text-sm text-slate-500">
        {t('subtitulo')}
      </p>
      <div
        className={`rounded-2xl border border-slate-200 bg-white overflow-hidden ${apareceu ? 'animate-opcionais' : ''}`}
      >
        <ul className="divide-y divide-slate-100">
          {visiveis.map((item, i) => {
            const marcado = selectedIds.has(item.id);
            const Icone = item.tipo === 'servico' ? Wrench : Package;
            return (
              <li key={item.id} className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${marcado ? 'bg-turquesa/[0.06]' : ''}`}>
                <span className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${marcado ? 'bg-marinho/10' : 'bg-slate-100'}`}>
                  <Icone className={`h-4 w-4 ${marcado ? 'text-marinho' : 'text-slate-500'}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-grafite leading-snug">{item.descricao}</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {item.tipo === 'servico' ? t('servico') : t('produto')}
                    <span className="normal-case tracking-normal text-sm font-bold text-marinho sm:hidden"> · {preco(item)}</span>
                  </p>
                </div>
                <span className="hidden sm:block shrink-0 text-sm font-bold text-marinho tabular-nums">{preco(item)}</span>
                <button
                  type="button"
                  onClick={() => alternar(item)}
                  aria-pressed={marcado}
                  aria-label={marcado ? t('removerItem', { item: item.descricao }) : t('adicionarItem', { item: item.descricao })}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                    marcado
                      ? 'bg-marinho text-white hover:bg-marinho-escuro'
                      : 'border border-marinho/25 text-marinho hover:bg-marinho/5'
                  }`}
                >
                  {marcado ? <Check className="h-3.5 w-3.5" /> : <Plus className={`h-3.5 w-3.5 ${apareceu && i === 0 ? 'animate-opcionais-pulso' : ''}`} />}
                  {marcado ? t('adicionado') : t('adicionar')}
                </button>
              </li>
            );
          })}
        </ul>
        {verMais && <div className="border-t border-slate-100">{verMais}</div>}
        {selectedAddons.length > 0 && (
          <p className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-xs text-slate-600" aria-live="polite">
            <span className="font-semibold text-marinho">
              {t('resumoSelecionados', { count: selectedAddons.length })}
            </span>
            {totalSelecionado > 0 && t('noTotal', { valor: f.moeda(totalSelecionado) })}
          </p>
        )}
      </div>
    </div>
  );
}
