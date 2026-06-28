'use client';

import { useState } from 'react';
import { Headphones, ShieldCheck, Heart, Share2 } from 'lucide-react';
import DatePicker, { type DateValue } from '@/components/home/search/DatePicker';
import GuestPicker from '@/components/home/search/GuestPicker';
import { formatCurrency } from '@/lib/utils';

type ActivePanel = 'date' | 'guests' | null;

type Props = {
  embarcacaoId: string;
  preco: number | null;
  modalidadeLabel: string;
  /** Dias da semana em que a embarcação opera (0=Dom..6=Sáb). Vazio/null = todos os dias. */
  diasOperacao?: number[] | null;
  /** Datas bloqueadas (exceções), em formato ISO 'yyyy-mm-dd'. */
  datasBloqueadas?: string[];
  /** Pré-preenchimento vindo da busca. */
  initialData?: string;
  initialFlex?: number;
  initialPessoas?: number;
};

const SERVICE_FEE_RATE = 0.12;

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseISO(iso?: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export default function EmbarcacaoBookingCard({
  embarcacaoId,
  preco,
  modalidadeLabel,
  diasOperacao,
  datasBloqueadas,
  initialData,
  initialFlex,
  initialPessoas,
}: Props) {
  const initialDate = parseISO(initialData);
  const [date, setDate] = useState<DateValue | null>(
    initialDate
      ? { date: initialDate, flexibility: (initialFlex ?? 0) as DateValue['flexibility'] }
      : null,
  );
  const [guests, setGuests] = useState(initialPessoas && initialPessoas > 0 ? initialPessoas : 1);
  const [active, setActive] = useState<ActivePanel>(null);
  const [error, setError] = useState<string | null>(null);

  function open(panel: ActivePanel) {
    setActive((p) => (p === panel ? null : panel));
  }

  const bloqueadasSet = new Set(datasBloqueadas ?? []);
  const operaTodos = !diasOperacao || diasOperacao.length === 0;

  function isDateDisabled(d: Date): boolean {
    if (!operaTodos && !diasOperacao!.includes(d.getDay())) return true;
    return bloqueadasSet.has(toISO(d));
  }

  const serviceFee = preco ? Math.round(preco * SERVICE_FEE_RATE) : null;
  const total = preco && serviceFee !== null ? preco + serviceFee : null;

  function handleReserve() {
    if (!date) {
      setError('Selecione a data da reserva.');
      setActive('date');
      return;
    }
    if (guests < 1) {
      setError('Informe o número de pessoas.');
      setActive('guests');
      return;
    }
    setError(null);

    const params = new URLSearchParams({ embarcacao: embarcacaoId });
    params.set('data', toISO(date.date));
    if (date.flexibility) params.set('flex', String(date.flexibility));
    params.set('pessoas', String(guests));
    window.location.href = `/reservas/novo?${params.toString()}`;
  }

  return (
    <div className="sticky top-24 space-y-4">
      {/* Price Card */}
      <div className="rounded-2xl border border-slate-200 p-6 shadow-sm">
        {/* Price header */}
        <div className="flex items-baseline gap-1 mb-1">
          {preco ? (
            <>
              <span className="text-3xl font-bold text-[#0B2447]">{formatCurrency(preco)}</span>
              <span className="text-sm text-slate-500">/dia</span>
            </>
          ) : (
            <span className="text-lg font-semibold text-slate-500">Consulte o preço</span>
          )}
        </div>
        <p className="text-xs text-slate-400 mb-5">{modalidadeLabel}</p>

        {/* Date field */}
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Data</p>
          <div className="border border-slate-200 rounded-xl overflow-visible">
            <DatePicker
              value={date}
              onChange={(v) => {
                setDate(v);
                if (v) setError(null);
              }}
              isOpen={active === 'date'}
              onOpen={() => open('date')}
              onClose={() => setActive(null)}
              isDateDisabled={isDateDisabled}
            />
          </div>
        </div>

        {/* Guests field */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Pessoas</p>
          <div className="border border-slate-200 rounded-xl overflow-visible">
            <GuestPicker
              value={guests}
              onChange={(v) => {
                setGuests(Math.max(1, v));
                setError(null);
              }}
              isOpen={active === 'guests'}
              onOpen={() => open('guests')}
              onClose={() => setActive(null)}
            />
          </div>
        </div>

        {/* Price breakdown */}
        {preco && (
          <div className="space-y-2 py-4 border-t border-slate-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Diária</span>
              <span className="font-medium text-slate-800">{formatCurrency(preco)}</span>
            </div>
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

        {error && (
          <p className="mt-2 text-xs font-medium text-red-600 text-center" role="alert">
            {error}
          </p>
        )}

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
