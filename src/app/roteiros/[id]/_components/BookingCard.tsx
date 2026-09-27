'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Headphones, ShieldCheck, MessageCircle } from 'lucide-react';
import DatePicker, { type DateValue } from '@/components/home/search/DatePicker';
import GuestPicker from '@/components/home/search/GuestPicker';
import { formatCurrency } from '@/lib/utils';
import { useCart } from './CartContext';
import AddonsAccordion from './AddonsAccordion';
import RoteiroAcoes from './RoteiroAcoes';
import { useModoPreview } from '@/components/preview/ModoPreview';

type ActivePanel = 'date' | 'guests' | null;
type Modalidade = 'roteiro' | 'diaria' | 'pessoa';

type Props = {
  roteiroId: string;
  /** Nome do roteiro (texto do compartilhamento). */
  roteiroNome: string;
  /** Dono vendo o próprio roteiro: oculta o CTA de chat (não conversa consigo mesmo). */
  ehDono?: boolean;
  /** Modelo "Roteiro": preço da diária única (`roteiro.preco_base`). */
  preco: number | null;
  /** Se o usuário logado já favoritou este roteiro (false quando deslogado). */
  initialFavorito?: boolean;
  /** Dias da semana em que o roteiro opera (0=Dom..6=Sáb). Vazio/null = todos os dias. */
  diasOperacao?: number[] | null;
  /** Datas indisponíveis para qualquer reserva exclusiva (bloqueios manuais + reservas confirmadas). */
  datasBloqueadas?: string[];
  /** Pré-preenchimento vindo da busca: data ('yyyy-mm-dd'), flexibilidade e nº de pessoas. */
  initialData?: string;
  initialFlex?: number;
  initialPessoas?: number;

  /** Modelo "Por Diária": passeio de vários dias, cobrado por diária. */
  precoDiariaAtivo?: boolean;
  precoDiariaValor?: number | null;
  precoDiariaMinimo?: number;

  /** Modelo "Por Pessoa": bilheteria, valor fixo por pessoa. */
  precoPessoaAtivo?: boolean;
  precoPessoaValor?: number | null;
  precoPessoaCapacidadeMinima?: number | null;
  precoPessoaCapacidadeMaxima?: number | null;
  precoPessoaModoCapacidade?: 'compartilhado' | 'exclusivo';
  /** Vagas já ocupadas por data (soma de pessoas de reservas confirmadas), só relevante no modo compartilhado. */
  vagasPessoaOcupadas?: Record<string, number>;
};

const MODALIDADE_INFO: Record<Modalidade, { label: string; unidade: string; linha: string }> = {
  roteiro: { label: 'Roteiro', unidade: '/dia', linha: 'Diária' },
  diaria: { label: 'Por Diária', unidade: '/diária', linha: 'Diária' },
  pessoa: { label: 'Por Pessoa', unidade: '/pessoa', linha: 'Pessoa' },
};

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Converte 'yyyy-mm-dd' em Date local (meio-dia para evitar deslocamento de fuso). */
function parseISO(iso?: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

/** Soma `dias` dias a uma data ISO, devolvendo outra data ISO. */
function somarDias(iso: string, dias: number): string {
  const d = parseISO(iso)!;
  d.setDate(d.getDate() + dias);
  return toISO(d);
}

/** Expande um intervalo ISO (inclusive) dia a dia — só para validar no cliente. */
function expandirIntervalo(inicio: string, fim: string): string[] {
  const datas: string[] = [];
  let atual = inicio;
  while (atual <= fim) {
    datas.push(atual);
    atual = somarDias(atual, 1);
  }
  return datas;
}

export default function BookingCard({
  roteiroId,
  roteiroNome,
  ehDono = false,
  preco,
  initialFavorito = false,
  diasOperacao,
  datasBloqueadas,
  initialData,
  initialFlex,
  initialPessoas,
  precoDiariaAtivo = false,
  precoDiariaValor = null,
  precoDiariaMinimo = 1,
  precoPessoaAtivo = false,
  precoPessoaValor = null,
  precoPessoaCapacidadeMinima = null,
  precoPessoaCapacidadeMaxima = null,
  precoPessoaModoCapacidade = 'exclusivo',
  vagasPessoaOcupadas,
}: Props) {
  // Modelos disponíveis para este roteiro, na ordem em que aparecem nas abas.
  const modalidadesDisponiveis: { id: Modalidade; label: string }[] = [
    ...(preco != null ? [{ id: 'roteiro' as const, label: MODALIDADE_INFO.roteiro.label }] : []),
    ...(precoDiariaAtivo && precoDiariaValor != null
      ? [{ id: 'diaria' as const, label: MODALIDADE_INFO.diaria.label }]
      : []),
    ...(precoPessoaAtivo && precoPessoaValor != null
      ? [{ id: 'pessoa' as const, label: MODALIDADE_INFO.pessoa.label }]
      : []),
  ];

  const [modalidade, setModalidade] = useState<Modalidade>(modalidadesDisponiveis[0]?.id ?? 'roteiro');

  const initialDate = parseISO(initialData);
  const [date, setDate] = useState<DateValue | null>(
    initialDate
      ? { date: initialDate, flexibility: (initialFlex ?? 0) as DateValue['flexibility'] }
      : null,
  );
  const [guests, setGuests] = useState(initialPessoas && initialPessoas > 0 ? initialPessoas : 1);
  const [diarias, setDiarias] = useState(Math.max(1, precoDiariaMinimo));
  const [active, setActive] = useState<ActivePanel>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const preview = useModoPreview();
  const { selectedAddons, totalAdicionais } = useCart();

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
  const compartilhado = precoPessoaModoCapacidade === 'compartilhado';

  function diaOperacional(d: Date): boolean {
    return operaTodos || diasOperacao!.includes(d.getDay());
  }

  /** Vagas restantes numa data do modelo Por Pessoa (null = sem teto de capacidade a checar aqui). */
  function vagasRestantes(iso: string): number | null {
    if (!compartilhado || precoPessoaCapacidadeMaxima == null) return null;
    const ocupadas = vagasPessoaOcupadas?.[iso] ?? 0;
    return Math.max(0, precoPessoaCapacidadeMaxima - ocupadas);
  }

  function isDateDisabled(d: Date): boolean {
    if (!diaOperacional(d)) return true;
    const iso = toISO(d);
    if (bloqueadasSet.has(iso)) return true;
    if (modalidade === 'pessoa') {
      const restantes = vagasRestantes(iso);
      if (restantes != null && restantes <= 0) return true;
    }
    return false;
  }

  const dateISO = date ? toISO(date.date) : null;
  const restantesNaData = compartilhado && dateISO != null ? vagasRestantes(dateISO) : null;
  const guestsMinPessoa = precoPessoaCapacidadeMinima ?? 1;

  // Preço unitário e multiplicador do modelo escolhido — mesma fórmula do
  // servidor (`/reservas/novo`), só para a prévia exibida aqui.
  const unitario = modalidade === 'roteiro' ? preco : modalidade === 'diaria' ? precoDiariaValor : precoPessoaValor;
  const multiplicador = modalidade === 'diaria' ? diarias : modalidade === 'pessoa' ? guests : 1;
  const subtotalModelo = unitario != null ? unitario * multiplicador : null;
  const valorEstimado = subtotalModelo != null ? subtotalModelo + totalAdicionais : null;

  const checkout = modalidade === 'diaria' && dateISO ? somarDias(dateISO, diarias - 1) : null;

  function handleReserve() {
    // Data e Pessoas são obrigatórios para solicitar a reserva.
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

    if (modalidade === 'diaria') {
      const fim = somarDias(dateISO!, diarias - 1);
      const intervalo = expandirIntervalo(dateISO!, fim);
      if (intervalo.some((d) => bloqueadasSet.has(d) || !diaOperacional(parseISO(d)!))) {
        setError('Este período inclui uma data indisponível. Escolha outra data ou reduza as diárias.');
        setActive('date');
        return;
      }
    }

    if (modalidade === 'pessoa') {
      if (guests < guestsMinPessoa) {
        setError(`Este roteiro exige um grupo mínimo de ${guestsMinPessoa} pessoas.`);
        setActive('guests');
        return;
      }
      if (restantesNaData != null && guests > restantesNaData) {
        setError(`Restam apenas ${restantesNaData} vaga${restantesNaData === 1 ? '' : 's'} nesta data.`);
        setActive('guests');
        return;
      }
    }

    setError(null);

    const params = new URLSearchParams({ roteiro: roteiroId, modalidade });
    params.set('data', dateISO!);
    if (date.flexibility) params.set('flex', String(date.flexibility));
    params.set('pessoas', String(guests));
    if (modalidade === 'diaria') params.set('diarias', String(diarias));
    if (selectedAddons.length > 0) params.set('adicionais', selectedAddons.map((a) => a.id).join(','));
    // Pré-visualização do painel: valida como no site, mas não reserva.
    if (preview.ativo) { preview.avisar(); return; }
    window.location.href = `/reservas/novo?${params.toString()}`;
  }

  return (
    <div ref={containerRef} className="sticky top-24 space-y-4">
      {/* Favoritar + Compartilhar */}
      <RoteiroAcoes roteiroId={roteiroId} roteiroNome={roteiroNome} initialFavorito={initialFavorito} />

      {/* Price Card */}
      <div className="rounded-2xl border border-slate-200 p-6 shadow-sm">
        {/* Abas de modelo de cobrança — só aparecem quando há mais de uma opção */}
        {modalidadesDisponiveis.length > 1 && (
          <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1">
            {modalidadesDisponiveis.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setModalidade(m.id);
                  setError(null);
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
                  modalidade === m.id ? 'bg-white text-[#0B2447] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        {/* Price header */}
        <div className="flex items-baseline gap-1 mb-5">
          {unitario ? (
            <>
              <span className="text-3xl font-bold text-[#0B2447]">{formatCurrency(unitario)}</span>
              <span className="text-sm text-slate-500">{MODALIDADE_INFO[modalidade].unidade}</span>
            </>
          ) : (
            <span className="text-lg font-semibold text-slate-500">Consulte o preço</span>
          )}
        </div>

        {/* Date field */}
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            {modalidade === 'diaria' ? 'Check-in' : 'Data'}
          </p>
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
          {modalidade === 'diaria' && checkout && (
            <p className="mt-1.5 text-xs text-slate-500">
              Check-out em{' '}
              <span className="font-medium text-slate-700">
                {new Date(`${checkout}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
            </p>
          )}
          {modalidade === 'pessoa' && restantesNaData != null && (
            <p className="mt-1.5 text-xs text-slate-500">
              {restantesNaData > 0 ? `${restantesNaData} vaga${restantesNaData === 1 ? '' : 's'} restante${restantesNaData === 1 ? '' : 's'} nesta data.` : 'Data esgotada.'}
            </p>
          )}
        </div>

        {/* Diárias (modelo Por Diária) */}
        {modalidade === 'diaria' && (
          <div className="mb-3 border border-slate-200 rounded-xl overflow-visible">
            <GuestPicker
              value={diarias}
              onChange={setDiarias}
              isOpen={false}
              onOpen={() => {}}
              onClose={() => {}}
              inline
              label="Diárias"
              singular="diária"
              plural="diárias"
              min={Math.max(1, precoDiariaMinimo)}
            />
          </div>
        )}

        {/* Guests field */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Pessoas
          </p>
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
              min={modalidade === 'pessoa' ? guestsMinPessoa : 1}
              max={modalidade === 'pessoa' ? restantesNaData ?? undefined : undefined}
            />
          </div>
        </div>

        {/* Adicionais (produtos/serviços do catálogo) — accordion */}
        <AddonsAccordion />

        {/* Price breakdown */}
        {subtotalModelo != null && (
          <div className="space-y-2 py-4 border-t border-slate-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">
                {MODALIDADE_INFO[modalidade].linha}
                {multiplicador > 1 ? ` (${formatCurrency(unitario!)} × ${multiplicador})` : ''}
              </span>
              <span className="font-medium text-slate-800">{formatCurrency(subtotalModelo)}</span>
            </div>
            {totalAdicionais > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Adicionais</span>
                <span className="font-medium text-slate-800">{formatCurrency(totalAdicionais)}</span>
              </div>
            )}
          </div>
        )}

        {valorEstimado != null && (
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
          href={`/roteiros/${roteiroId}/chat`}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0B3D91] hover:bg-[#092E6E] text-white text-sm font-semibold transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          Converse com o dono
        </Link>
      )}

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
    </div>
  );
}
