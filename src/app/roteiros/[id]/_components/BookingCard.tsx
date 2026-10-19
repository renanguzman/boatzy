'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Headphones, ShieldCheck, MessageCircle } from 'lucide-react';
import GuestPicker from '@/components/home/search/GuestPicker';
import { formatCurrency } from '@/lib/utils';
import { useCart } from './CartContext';
import { useDataReserva } from './DataReservaContext';
import AddonsAccordion from './AddonsAccordion';
import RoteiroAcoes from './RoteiroAcoes';
import CalendarioReserva from './CalendarioReserva';
import { useModoPreview } from '@/components/preview/ModoPreview';
import { FUSO_HORARIO, formatarData } from '@/lib/datas';
import { capacidadeMaxima, mensagemCapacidadeExcedida } from '@/lib/capacidade';
import { valoresParaCliente } from '@/lib/pagamentos/valores';
import { decomporPreco } from '@/lib/precos-calendario';
import {
  mensagemIndisponivel, periodoIndisponivel, type CalendarioCliente, type StatusPublico,
} from '@/lib/disponibilidade';

type ActivePanel = 'date' | 'guests' | null;
type Modalidade = 'roteiro' | 'diaria';

type Props = {
  roteiroId: string;
  /** Nome do roteiro (texto do compartilhamento). */
  roteiroNome: string;
  /** Dono vendo o próprio roteiro: oculta o CTA de chat (não conversa consigo mesmo). */
  ehDono?: boolean;
  /**
   * Modelo "Roteiro": preço da diária única (`roteiro.preco_base`). Define se
   * o modelo existe; o preço de cada dia (com as regras do gestor) vem do
   * calendário.
   */
  preco: number | null;
  /**
   * Calendário do roteiro — o mesmo que o gestor configura: disponibilidade,
   * preço e total com a taxa de cada dia, e a janela de reservas.
   */
  calendario: CalendarioCliente;
  /** Se o usuário logado já favoritou este roteiro (false quando deslogado). */
  initialFavorito?: boolean;
  /** Pré-preenchimento vindo da busca: nº de pessoas (a data vem do DataReservaContext). */
  initialPessoas?: number;

  /** Modelo "Por Diária": passeio de vários dias, cobrado por diária. */
  precoDiariaAtivo?: boolean;
  precoDiariaValor?: number | null;
  precoDiariaMinimo?: number;

  /**
   * Máximo de pessoas do roteiro: menor entre a capacidade do roteiro e a da
   * embarcação vinculada (`capacidadeMaxima`, src/lib/capacidade.ts). null = sem limite.
   */
  capacidade?: number | null;
};

const MODALIDADE_INFO: Record<Modalidade, { label: string; unidade: string; linha: string }> = {
  roteiro: { label: 'Roteiro', unidade: '/dia', linha: 'Passeio' },
  diaria: { label: 'Por Diária', unidade: '/diária', linha: 'Diárias' },
};

const FLEX_OPCOES = [
  { label: 'Data exata', value: 0 },
  { label: '±1 dia', value: 1 },
  { label: '±2 dias', value: 2 },
  { label: '±3 dias', value: 3 },
  { label: '±7 dias', value: 7 },
];

/** Soma `dias` dias a uma data ISO (aritmética em UTC), devolvendo outra data ISO. */
function somarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

export default function BookingCard({
  roteiroId,
  roteiroNome,
  ehDono = false,
  preco,
  calendario,
  initialFavorito = false,
  initialPessoas,
  precoDiariaAtivo = false,
  precoDiariaValor = null,
  precoDiariaMinimo = 1,
  capacidade = null,
}: Props) {
  // Modelos disponíveis para este roteiro, na ordem em que aparecem nas abas.
  const modalidadesDisponiveis: { id: Modalidade; label: string }[] = [
    ...(preco != null ? [{ id: 'roteiro' as const, label: MODALIDADE_INFO.roteiro.label }] : []),
    ...(precoDiariaAtivo && precoDiariaValor != null
      ? [{ id: 'diaria' as const, label: MODALIDADE_INFO.diaria.label }]
      : []),
  ];

  // Escolhas da reserva (data, flexibilidade, modelo, diárias) — vêm pré-preenchidas
  // da busca pelo DataReservaContext.
  const {
    data: dateISO, flex, setData, setFlex,
    modalidade: modalidadeEscolhida, setModalidade, diarias, setDiarias,
  } = useDataReserva();
  const modalidade: Modalidade = modalidadesDisponiveis.some((m) => m.id === modalidadeEscolhida)
    ? modalidadeEscolhida
    : modalidadesDisponiveis[0]?.id ?? 'roteiro';

  /** Máximo de pessoas: capacidade do roteiro/embarcação (null = sem limite). */
  const limitePessoas = capacidadeMaxima(capacidade);

  // Pessoas vindas da busca acima da capacidade são ajustadas ao máximo, com aviso.
  const pessoasPedidas = initialPessoas && initialPessoas > 0 ? initialPessoas : 1;
  const [guests, setGuests] = useState(limitePessoas != null ? Math.min(pessoasPedidas, limitePessoas) : pessoasPedidas);
  const [ajustadoPara, setAjustadoPara] = useState<number | null>(
    limitePessoas != null && pessoasPedidas > limitePessoas ? limitePessoas : null,
  );
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

  // Calendário do gestor: status e preço (com a taxa) de cada dia.
  const porData = useMemo(() => new Map(calendario.dias.map((d) => [d.data, d])), [calendario.dias]);
  const statusDe = (iso: string): StatusPublico => porData.get(iso)?.status ?? 'indisponivel';
  const taxaPercent = calendario.taxaPercent;

  // Preço unitário do modelo escolhido: no Roteiro, o do dia (regras do gestor
  // já resolvidas no calendário); no Por Diária, o valor fixo.
  const precoNaData = dateISO ? porData.get(dateISO)?.preco ?? null : null;
  const unitario = modalidade === 'roteiro' ? precoNaData ?? (dateISO ? null : preco) : precoDiariaValor;
  const multiplicador = modalidade === 'diaria' ? diarias : 1;
  const subtotalModelo = unitario != null ? unitario * multiplicador : null;
  // Mesma conta do pedido (`calcularValoresPedido`), com a taxa embutida nas
  // linhas: o cliente nunca vê a taxa de serviço separada.
  const valores = subtotalModelo != null && (modalidade === 'diaria' || dateISO)
    ? valoresParaCliente({
        precoUnitario: unitario!, multiplicador, totalAdicionais, taxaPercent, descontoCupom: 0,
      })
    : null;

  // Cabeçalho: sempre o valor que o cliente paga (com a taxa). Roteiro sem data
  // escolhida anuncia o menor total entre os dias disponíveis ("a partir de").
  const menorTotal = useMemo(() => {
    const totais = calendario.dias.filter((d) => d.status === 'disponivel' && d.total != null).map((d) => d.total!);
    return totais.length > 0 ? Math.min(...totais) : null;
  }, [calendario.dias]);
  const precoVariaPorData = modalidade === 'roteiro';
  const mostrarAPartirDe = precoVariaPorData && !dateISO;
  const precoCabecalho = modalidade === 'diaria'
    ? (precoDiariaValor != null ? decomporPreco(precoDiariaValor, taxaPercent).clientePaga : null)
    : dateISO
      ? porData.get(dateISO)?.total ?? null
      : menorTotal;

  const checkout = modalidade === 'diaria' && dateISO ? somarDias(dateISO, diarias - 1) : null;

  function handleReserve() {
    // Data e Pessoas são obrigatórios para solicitar a reserva.
    if (!dateISO) {
      setError('Selecione a data da reserva.');
      setActive('date');
      return;
    }
    const problema = periodoIndisponivel(statusDe, dateISO, checkout ?? dateISO);
    if (problema) {
      setError(problema === 'indisponivel' && modalidade === 'diaria'
        ? 'Este período inclui uma data indisponível. Escolha outra data ou reduza as diárias.'
        : mensagemIndisponivel(problema, calendario.dataMaxima));
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

    const params = new URLSearchParams({ roteiro: roteiroId, modalidade });
    params.set('data', dateISO);
    if (flex) params.set('flex', String(flex));
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
        <div className="mb-5">
          {precoCabecalho != null ? (
            <>
              {mostrarAPartirDe && (
                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                  a partir de
                </span>
              )}
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-[#0B2447]">{formatCurrency(precoCabecalho)}</span>
                <span className="text-sm text-slate-500">{MODALIDADE_INFO[modalidade].unidade}</span>
              </div>
              {precoVariaPorData && (
                <p className="mt-1 text-xs text-slate-400">
                  {dateISO ? 'Valor para a data selecionada.' : 'O preço varia conforme a data.'}
                </p>
              )}
            </>
          ) : (
            <span className="text-lg font-semibold text-slate-500">Consulte o preço</span>
          )}
        </div>

        {/* Date field — abre o calendário do roteiro (o mesmo que o gestor configura) */}
        <div className="mb-3 relative">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            {modalidade === 'diaria' ? 'Check-in' : 'Data'}
          </p>
          <button type="button" onClick={() => open('date')} aria-expanded={active === 'date'}
            className={`w-full flex items-center gap-2 text-left rounded-xl border px-4 py-3 transition-all ${
              active === 'date' ? 'border-slate-800 ring-2 ring-slate-800 bg-white' : 'border-slate-200 hover:bg-slate-50'
            }`}>
            <CalendarDays className="h-4 w-4 text-slate-400 shrink-0" />
            {dateISO ? (
              <span className="text-sm font-medium text-slate-800 truncate">
                {formatarData(dateISO, { weekday: 'short', day: '2-digit', month: 'short' })}
                {flex > 0 && <span className="text-slate-500"> · ±{flex} {flex === 1 ? 'dia' : 'dias'}</span>}
              </span>
            ) : (
              <span className="text-sm text-slate-400">Escolha a data</span>
            )}
          </button>
          {active === 'date' && (
            <div className="absolute right-0 top-full z-50 mt-2 w-[min(680px,calc(100vw-2rem))] rounded-2xl border border-slate-100 bg-white p-4 shadow-2xl">
              <CalendarioReserva
                calendario={calendario}
                selecionada={dateISO}
                onSelecionar={(iso) => {
                  setData(iso);
                  setError(null);
                  setActive(null);
                }}
                modalidade={modalidade}
                diarias={diarias}
              />
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                {FLEX_OPCOES.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => setFlex(opt.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      flex === opt.value
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'
                    }`}>
                    {opt.label}
                  </button>
                ))}
                <div className="flex-1" />
                <button type="button" onClick={() => { setData(null); setFlex(0); setActive(null); }}
                  className="text-xs text-slate-500 underline hover:text-slate-800 transition-colors">
                  Limpar data
                </button>
              </div>
            </div>
          )}
          {modalidade === 'diaria' && checkout && (
            <p className="mt-1.5 text-xs text-slate-500">
              Check-out em{' '}
              <span className="font-medium text-slate-700">
                {new Date(`${checkout}T12:00:00`).toLocaleDateString('pt-BR', { timeZone: FUSO_HORARIO, day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
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
              Este passeio comporta até {ajustadoPara} {ajustadoPara === 1 ? 'pessoa' : 'pessoas'} — ajustamos o tamanho do grupo.
            </p>
          ) : limitePessoas != null ? (
            <p className="mt-1.5 text-xs text-slate-400">
              Capacidade máxima: {limitePessoas} {limitePessoas === 1 ? 'pessoa' : 'pessoas'}.
            </p>
          ) : null}
        </div>

        {/* Adicionais (produtos/serviços do catálogo) — accordion */}
        <AddonsAccordion />

        {/* Detalhamento — valores com a taxa embutida (somam o total) */}
        {valores && (
          <div className="space-y-2 py-4 border-t border-slate-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">
                {MODALIDADE_INFO[modalidade].linha}
                {multiplicador > 1 ? ` × ${multiplicador}` : ''}
              </span>
              <span className="font-medium text-slate-800">{formatCurrency(valores.passeio)}</span>
            </div>
            {totalAdicionais > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Adicionais</span>
                <span className="font-medium text-slate-800">{formatCurrency(valores.adicionais)}</span>
              </div>
            )}
          </div>
        )}

        {valores && (
          <div className="py-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-[#0B2447]">Total</span>
              <span className="text-xl font-bold text-[#0B2447]">{formatCurrency(valores.total)}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Cupom de desconto pode ser aplicado na confirmação.
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
