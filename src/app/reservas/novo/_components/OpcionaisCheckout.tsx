'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { Check, Lock, Package, Plus, ShoppingCart, Wrench, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { precoComTaxa } from '@/lib/pagamentos/valores';
import { rastrear } from '@/lib/analytics';

/** Opcional do roteiro (`roteiro_catalogo`), com o valor do gestor (sem a taxa). */
export type OpcionalCheckout = { id: string; descricao: string; valor: number; tipo: string };

type SelecaoOpcionais = {
  opcionais: OpcionalCheckout[];
  /** Ids de `roteiro_catalogo` selecionados, na ordem da lista. */
  selecionados: string[];
  alternar: (id: string) => void;
  /** Soma dos selecionados pelo valor do gestor — entra em `valoresParaCliente` como no card. */
  totalAdicionais: number;
  /**
   * Seleção travada: o envio da solicitação começou (ou já foi feito) — nada pode ser adicionado
   * nem retirado. `ConfirmarReserva` trava ao clicar em "Confirmar solicitação" e destrava se o
   * envio falhar.
   */
  travado: boolean;
  setTravado: (travado: boolean) => void;
};

const Ctx = createContext<SelecaoOpcionais | null>(null);

/**
 * Seleção de opcionais na confirmação da reserva: a lista (dentro do card de data/pessoas) e o
 * resumo com cupom (`ConfirmarReserva`) leem o mesmo estado. A URL acompanha a seleção
 * (`?adicionais=`), para recarregar a página sem perder as escolhas. O servidor recalcula os
 * opcionais a partir dos ids ao validar o cupom e ao criar a reserva.
 */
export function SelecaoOpcionaisProvider({
  opcionais, iniciais, roteiroId, children,
}: {
  opcionais: OpcionalCheckout[];
  iniciais: string[];
  roteiroId: string;
  children: ReactNode;
}) {
  const [selecionados, setSelecionados] = useState<string[]>(() =>
    opcionais.filter((o) => iniciais.includes(o.id)).map((o) => o.id));
  const [travado, setTravado] = useState(false);

  function alternar(id: string) {
    if (travado) return;
    const item = opcionais.find((o) => o.id === id);
    if (!item) return;
    const marcado = selecionados.includes(id);
    rastrear(marcado ? 'opcional_removido' : 'opcional_adicionado', {
      item_id: roteiroId, opcional: item.descricao, origem: 'checkout',
    });
    const proximos = opcionais
      .filter((o) => (o.id === id ? !marcado : selecionados.includes(o.id)))
      .map((o) => o.id);
    setSelecionados(proximos);
    // Mantém a URL em dia sem recarregar (o servidor só relê os ids ao recarregar).
    const url = new URL(window.location.href);
    if (proximos.length > 0) url.searchParams.set('adicionais', proximos.join(','));
    else url.searchParams.delete('adicionais');
    window.history.replaceState(null, '', url);
  }

  const totalAdicionais = opcionais
    .filter((o) => selecionados.includes(o.id))
    .reduce((soma, o) => soma + Number(o.valor), 0);

  return (
    <Ctx.Provider value={{ opcionais, selecionados, alternar, totalAdicionais, travado, setTravado }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSelecaoOpcionais(): SelecaoOpcionais {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSelecaoOpcionais deve ser usado dentro de SelecaoOpcionaisProvider');
  return ctx;
}

/** Lista de opcionais do roteiro na confirmação: adicionar ou retirar sem voltar ao roteiro. */
export default function OpcionaisCheckout({ taxaPercent }: { taxaPercent: number }) {
  const { opcionais, selecionados, alternar, travado } = useSelecaoOpcionais();
  if (opcionais.length === 0) return null;

  return (
    <div className="p-5 border-b border-slate-100">
      <div className="flex items-center gap-1.5">
        <ShoppingCart className="h-4 w-4 text-marinho" />
        <span className="text-sm font-semibold text-marinho">Opcionais do passeio</span>
        <span className="ml-auto text-xs text-slate-400 tabular-nums">
          {selecionados.length} de {opcionais.length} {opcionais.length === 1 ? 'adicionado' : 'adicionados'}
        </span>
      </div>
      {travado ? (
        <p className="mt-0.5 mb-3 flex items-center gap-1 text-xs text-slate-500">
          <Lock className="h-3 w-3 shrink-0" />
          Solicitação enviada com estes opcionais — não é mais possível alterar.
        </p>
      ) : (
        <p className="mt-0.5 mb-3 text-xs text-slate-500">Adicione ou retire antes de enviar a solicitação.</p>
      )}
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
        {opcionais.map((o) => {
          const marcado = selecionados.includes(o.id);
          const Icone = o.tipo === 'servico' ? Wrench : Package;
          return (
            <li
              key={o.id}
              className={`flex items-center gap-3 px-3.5 py-3 transition-colors ${marcado ? 'bg-turquesa/[0.06]' : ''} ${
                travado && !marcado ? 'opacity-50' : ''
              }`}
            >
              <span className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${marcado ? 'bg-marinho/10' : 'bg-slate-100'}`}>
                <Icone className={`h-4 w-4 ${marcado ? 'text-marinho' : 'text-slate-500'}`} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-grafite leading-snug">{o.descricao}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {o.tipo === 'servico' ? 'Serviço' : 'Produto'}
                  <span className="normal-case tracking-normal text-sm font-bold text-marinho sm:hidden">
                    {' · '}{Number(o.valor) > 0 ? formatCurrency(precoComTaxa(Number(o.valor), taxaPercent)) : 'Incluso'}
                  </span>
                </p>
              </div>
              <span className="hidden sm:block shrink-0 text-sm font-bold text-marinho tabular-nums">
                {Number(o.valor) > 0 ? formatCurrency(precoComTaxa(Number(o.valor), taxaPercent)) : 'Incluso'}
              </span>
              {travado ? (
                // Sem botão: depois de enviada, a seleção não muda mais.
                <span className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
                  {marcado ? <Check className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  {marcado ? 'Incluído' : 'Não incluído'}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => alternar(o.id)}
                  aria-pressed={marcado}
                  aria-label={`${marcado ? 'Retirar' : 'Adicionar'} ${o.descricao}`}
                  className={`group shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                    marcado
                      ? 'bg-marinho text-white hover:bg-marinho-escuro'
                      : 'border border-marinho/25 text-marinho hover:bg-marinho/5'
                  }`}
                >
                  {marcado ? (
                    <>
                      {/* No mouse, o "Adicionado" vira "Retirar" — deixa claro que dá para tirar. */}
                      <Check className="h-3.5 w-3.5 group-hover:hidden" />
                      <X className="hidden h-3.5 w-3.5 group-hover:block" />
                      <span className="group-hover:hidden">Adicionado</span>
                      <span className="hidden group-hover:inline">Retirar</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar
                    </>
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
