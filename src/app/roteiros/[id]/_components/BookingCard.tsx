'use client';

import { useRef, useState } from 'react';
import { Headphones, ShieldCheck, Heart, Share2, ShoppingCart, X } from 'lucide-react';
import DatePicker, { type DateValue } from '@/components/home/search/DatePicker';
import GuestPicker from '@/components/home/search/GuestPicker';
import { formatCurrency } from '@/lib/utils';
import { useCart } from './CartContext';

type ActivePanel = 'date' | 'guests' | null;

type Props = {
  roteiroId: string;
  preco: number | null;
  /** Dias da semana em que o roteiro opera (0=Dom..6=Sáb). Vazio/null = todos os dias. */
  diasOperacao?: number[] | null;
  /** Datas bloqueadas (exceções), em formato ISO 'yyyy-mm-dd'. */
  datasBloqueadas?: string[];
};

const SERVICE_FEE_RATE = 0.12;

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function BookingCard({ roteiroId, preco, diasOperacao, datasBloqueadas }: Props) {
  const [date, setDate] = useState<DateValue | null>(null);
  const [guests, setGuests] = useState(1);
  const [active, setActive] = useState<ActivePanel>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { selectedAddons, totalAdicionais, toggle } = useCart();

  function open(panel: ActivePanel) {
    setActive((p) => (p === panel ? null : panel));
  }

  const bloqueadasSet = new Set(datasBloqueadas ?? []);
  const operaTodos = !diasOperacao || diasOperacao.length === 0;

  function isDateDisabled(d: Date): boolean {
    if (!operaTodos && !diasOperacao!.includes(d.getDay())) return true;
    return bloqueadasSet.has(toISO(d));
  }

  const subtotal = (preco ?? 0) + totalAdicionais;
  const serviceFee = preco ? Math.round(subtotal * SERVICE_FEE_RATE) : null;
  const total = preco && serviceFee !== null ? subtotal + serviceFee : null;

  function handleReserve() {
    const params = new URLSearchParams({ roteiro: roteiroId });
    if (date) params.set('data', date.date.toISOString().slice(0, 10));
    if (date?.flexibility) params.set('flex', String(date.flexibility));
    if (guests > 0) params.set('pessoas', String(guests));
    if (selectedAddons.length > 0) params.set('adicionais', selectedAddons.map((a) => a.id).join(','));
    window.location.href = `/reservas/novo?${params.toString()}`;
  }

  return (
    <div ref={containerRef} className="sticky top-24 space-y-4">
      {/* Price Card */}
      <div className="rounded-2xl border border-slate-200 p-6 shadow-sm">
        {/* Price header */}
        <div className="flex items-baseline gap-1 mb-5">
          {preco ? (
            <>
              <span className="text-3xl font-bold text-[#0B2447]">{formatCurrency(preco)}</span>
              <span className="text-sm text-slate-500">/dia</span>
            </>
          ) : (
            <span className="text-lg font-semibold text-slate-500">Consulte o preço</span>
          )}
        </div>

        {/* Date field */}
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Data
          </p>
          <div className="border border-slate-200 rounded-xl overflow-visible">
            <DatePicker
              value={date}
              onChange={setDate}
              isOpen={active === 'date'}
              onOpen={() => open('date')}
              onClose={() => setActive(null)}
              isDateDisabled={isDateDisabled}
            />
          </div>
        </div>

        {/* Guests field */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Pessoas
          </p>
          <div className="border border-slate-200 rounded-xl overflow-visible">
            <GuestPicker
              value={guests}
              onChange={(v) => setGuests(Math.max(1, v))}
              isOpen={active === 'guests'}
              onOpen={() => open('guests')}
              onClose={() => setActive(null)}
            />
          </div>
        </div>

        {/* Mini-cart: selected addons */}
        {selectedAddons.length > 0 && (
          <div className="mb-4 rounded-xl bg-[#0B3D91]/5 border border-[#0B3D91]/20 p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5 text-[#0B3D91]" />
              <span className="text-xs font-semibold text-[#0B3D91]">
                {selectedAddons.length} adicional{selectedAddons.length !== 1 ? 'is' : ''} selecionado{selectedAddons.length !== 1 ? 's' : ''}
              </span>
            </div>
            {selectedAddons.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-600 truncate">{a.descricao}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-medium text-slate-700">{formatCurrency(a.preco)}</span>
                  <button
                    type="button"
                    onClick={() => toggle(a.id)}
                    className="h-4 w-4 rounded-full bg-slate-200 hover:bg-red-100 hover:text-red-500 flex items-center justify-center transition-colors"
                    aria-label={`Remover ${a.descricao}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Price breakdown */}
        {preco && (
          <div className="space-y-2 py-4 border-t border-slate-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Diária</span>
              <span className="font-medium text-slate-800">{formatCurrency(preco)}</span>
            </div>
            {totalAdicionais > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Adicionais</span>
                <span className="font-medium text-slate-800">{formatCurrency(totalAdicionais)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Taxa de serviço</span>
              <span className="font-medium text-slate-800">{formatCurrency(serviceFee!)}</span>
            </div>
          </div>
        )}

        {total && (
          <div className="flex items-center justify-between py-4 border-t border-slate-200">
            <span className="text-base font-bold text-[#0B2447]">Total estimado</span>
            <span className="text-xl font-bold text-[#0B2447]">{formatCurrency(total)}</span>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleReserve}
          className="w-full bg-[#0B3D91] hover:bg-[#092E6E] text-white font-semibold py-3.5 rounded-xl transition-all hover:shadow-lg hover:shadow-[#0B3D91]/25 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer mt-4"
        >
          Solicitar Reserva →
        </button>

        {/* Trust badges */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>Garantia de pagamento seguro</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Headphones className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
            <span>Suporte 24/7 durante sua experiência</span>
          </div>
        </div>
      </div>

      {/* Why Boatzy Card */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0B3D91] to-[#0B2447] p-6 text-white">
        <h3 className="text-base font-bold mb-4">Por que reservar no Boatzy?</h3>
        <div className="space-y-3">
          {[
            'Embarcações inspecionadas e verificadas',
            'Operadores com antecedentes verificados',
            'Cancelamento flexível na maioria dos roteiros',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2.5">
              <div className="h-5 w-5 rounded-full bg-emerald-400/20 flex items-center justify-center shrink-0">
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
              </div>
              <span className="text-sm text-slate-200">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
          <Heart className="h-4 w-4" />
          Favoritar
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
          <Share2 className="h-4 w-4" />
          Compartilhar
        </button>
      </div>
    </div>
  );
}
