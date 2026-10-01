'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Headphones, ShieldCheck, Heart, Share2, MessageCircle } from 'lucide-react';
import DatePicker, { type DateValue } from '@/components/home/search/DatePicker';
import GuestPicker from '@/components/home/search/GuestPicker';
import { formatCurrency } from '@/lib/utils';
import { useModoPreview } from '@/components/preview/ModoPreview';
import { capacidadeMaxima, mensagemCapacidadeExcedida } from '@/lib/capacidade';

type ActivePanel = 'date' | 'guests' | null;

type Props = {
  embarcacaoId: string;
  /** Dono vendo a própria embarcação: oculta o CTA de chat (não conversa consigo mesmo). */
  ehDono?: boolean;
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
  /** Capacidade de pessoas da embarcação (`embarcacao.capacidade`). null = sem limite cadastrado. */
  capacidade?: number | null;
};

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
  ehDono = false,
  preco,
  modalidadeLabel,
  diasOperacao,
  datasBloqueadas,
  initialData,
  initialFlex,
  initialPessoas,
  capacidade = null,
}: Props) {
  const initialDate = parseISO(initialData);
  const [date, setDate] = useState<DateValue | null>(
    initialDate
      ? { date: initialDate, flexibility: (initialFlex ?? 0) as DateValue['flexibility'] }
      : null,
  );
  // Pessoas vindas da busca acima da capacidade são ajustadas ao máximo, com aviso.
  const limitePessoas = capacidadeMaxima(capacidade);
  const pessoasPedidas = initialPessoas && initialPessoas > 0 ? initialPessoas : 1;
  const [guests, setGuests] = useState(limitePessoas != null ? Math.min(pessoasPedidas, limitePessoas) : pessoasPedidas);
  const [ajustadoPara, setAjustadoPara] = useState<number | null>(
    limitePessoas != null && pessoasPedidas > limitePessoas ? limitePessoas : null,
  );
  const [active, setActive] = useState<ActivePanel>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const preview = useModoPreview();

  function open(panel: ActivePanel) {
    setActive((p) => (p === panel ? null : panel));
  }

  // Fecha o picker aberto (data ou pessoas) ao clicar fora do card — antes só
  // fechava ao clicar de novo no mesmo campo, o que prendia o usuário nele.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActive(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const bloqueadasSet = new Set(datasBloqueadas ?? []);
  const operaTodos = !diasOperacao || diasOperacao.length === 0;

  function isDateDisabled(d: Date): boolean {
    if (!operaTodos && !diasOperacao!.includes(d.getDay())) return true;
    return bloqueadasSet.has(toISO(d));
  }

  // A taxa de serviço não é exibida aqui — só na confirmação (/reservas/novo), que a
  // recalcula no servidor a partir do dono da embarcação (ver SPEC §14).
  const valorEstimado = preco;

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
    if (limitePessoas != null && guests > limitePessoas) {
      setError(mensagemCapacidadeExcedida(limitePessoas));
      setActive('guests');
      return;
    }
    setError(null);

    const params = new URLSearchParams({ embarcacao: embarcacaoId });
    params.set('data', toISO(date.date));
    if (date.flexibility) params.set('flex', String(date.flexibility));
    params.set('pessoas', String(guests));
    // Pré-visualização do painel: valida como no site, mas não reserva.
    if (preview.ativo) { preview.avisar(); return; }
    window.location.href = `/reservas/novo?${params.toString()}`;
  }

  return (
    <div ref={containerRef} className="sticky top-24 space-y-4">
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
                setGuests(Math.max(1, limitePessoas != null ? Math.min(v, limitePessoas) : v));
                setAjustadoPara(null);
                setError(null);
              }}
              isOpen={active === 'guests'}
              onOpen={() => open('guests')}
              onClose={() => setActive(null)}
              min={1}
              max={limitePessoas ?? undefined}
            />
          </div>
          {ajustadoPara != null ? (
            <p className="mt-1.5 text-xs text-amber-700">
              Esta embarcação comporta até {ajustadoPara} {ajustadoPara === 1 ? 'pessoa' : 'pessoas'} — ajustamos o tamanho do grupo.
            </p>
          ) : limitePessoas != null ? (
            <p className="mt-1.5 text-xs text-slate-400">
              Capacidade máxima: {limitePessoas} {limitePessoas === 1 ? 'pessoa' : 'pessoas'}.
            </p>
          ) : null}
        </div>

        {/* Price breakdown */}
        {preco && (
          <div className="space-y-2 py-4 border-t border-slate-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Diária</span>
              <span className="font-medium text-slate-800">{formatCurrency(preco)}</span>
            </div>
          </div>
        )}

        {valorEstimado && (
          <div className="py-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-[#0B2447]">Valor estimado</span>
              <span className="text-xl font-bold text-[#0B2447]">{formatCurrency(valorEstimado)}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              A taxa de serviço é calculada e exibida na confirmação da reserva.
            </p>
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

      {/* Chat com o dono */}
      {!ehDono && (
        <Link
          href={`/embarcacoes/${embarcacaoId}/chat`}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0B3D91] hover:bg-[#092E6E] text-white text-sm font-semibold transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          Converse com o dono
        </Link>
      )}

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
