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
import { FUSO_HORARIO, MESES_ANTECEDENCIA_RESERVA, dataMaximaReservaISO } from '@/lib/datas';
import { capacidadeMaxima, mensagemCapacidadeExcedida } from '@/lib/capacidade';
import { getPrecoRoteiroNaData } from '@/lib/precos-roteiro-actions';

type ActivePanel = 'date' | 'guests' | null;
type Modalidade = 'roteiro' | 'diaria';

type Props = {
  roteiroId: string;
  /** Nome do roteiro (texto do compartilhamento). */
  roteiroNome: string;
  /** Dono vendo o próprio roteiro: oculta o CTA de chat (não conversa consigo mesmo). */
  ehDono?: boolean;
  /**
   * Modelo "Roteiro": preço da diária única (`roteiro.preco_base`). É o
   * fallback — ao escolher a data, as regras do gestor podem resolver outro
   * valor (ver `getPrecoRoteiroNaData`).
   */
  preco: number | null;
  /**
   * Menor preço do modelo Roteiro na janela de 365 dias
   * (`roteiro.preco_minimo_roteiro`), exibido como "A partir de" enquanto
   * nenhuma data foi escolhida.
   */
  precoMinimoRoteiro?: number | null;
  /** Se o usuário logado já favoritou este roteiro (false quando deslogado). */
  initialFavorito?: boolean;
  /** Dias da semana em que o roteiro opera (0=Dom..6=Sáb). Vazio/null = todos os dias. */
  diasOperacao?: number[] | null;
  /** Datas indisponíveis (bloqueios manuais + reservas confirmadas). */
  datasBloqueadas?: string[];
  /** Pré-preenchimento vindo da busca: data ('yyyy-mm-dd'), flexibilidade e nº de pessoas. */
  initialData?: string;
  initialFlex?: number;
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
  roteiro: { label: 'Roteiro', unidade: '/dia', linha: 'Diária' },
  diaria: { label: 'Por Diária', unidade: '/diária', linha: 'Diária' },
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
  precoMinimoRoteiro = null,
  initialFavorito = false,
  diasOperacao,
  datasBloqueadas,
  initialData,
  initialFlex,
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

  const [modalidade, setModalidade] = useState<Modalidade>(modalidadesDisponiveis[0]?.id ?? 'roteiro');

  /** Máximo de pessoas: capacidade do roteiro/embarcação (null = sem limite). */
  const limitePessoas = capacidadeMaxima(capacidade);

  // Reserva aceita no máximo MESES_ANTECEDENCIA_RESERVA meses à frente; data
  // vinda da busca além desse limite é descartada.
  const dataMaximaISO = dataMaximaReservaISO();
  const dataMaxima = parseISO(dataMaximaISO)!;
  const initialDate = initialData && initialData <= dataMaximaISO ? parseISO(initialData) : null;
  const [date, setDate] = useState<DateValue | null>(
    initialDate
      ? { date: initialDate, flexibility: (initialFlex ?? 0) as DateValue['flexibility'] }
      : null,
  );
  // Pessoas vindas da busca acima da capacidade são ajustadas ao máximo, com aviso.
  const pessoasPedidas = initialPessoas && initialPessoas > 0 ? initialPessoas : 1;
  const [guests, setGuests] = useState(limitePessoas != null ? Math.min(pessoasPedidas, limitePessoas) : pessoasPedidas);
  const [ajustadoPara, setAjustadoPara] = useState<number | null>(
    limitePessoas != null && pessoasPedidas > limitePessoas ? limitePessoas : null,
  );
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

  function diaOperacional(d: Date): boolean {
    return operaTodos || diasOperacao!.includes(d.getDay());
  }

  function isDateDisabled(d: Date): boolean {
    return !diaOperacional(d) || bloqueadasSet.has(toISO(d));
  }

  const dateISO = date ? toISO(date.date) : null;

  // Preço do modelo Roteiro na data escolhida: as regras do gestor (alta/baixa
  // temporada, fim de semana, feriado) podem sobrepor `preco_base`, então o
  // valor vem do servidor — mesma função que `/reservas/novo` usa para cobrar.
  // Guarda a data junto com o valor: assim o preço de uma data anterior é
  // descartado por derivação, sem limpar estado dentro do efeito.
  const [precoBuscado, setPrecoBuscado] = useState<{ iso: string; valor: number | null } | null>(null);
  useEffect(() => {
    // Na prévia do painel o roteiro ainda não existe no banco (id 'preview'):
    // mantém o preço digitado no formulário em vez de consultar a RPC.
    if (!dateISO || preview.ativo) return;
    let cancelado = false;
    getPrecoRoteiroNaData(roteiroId, dateISO).then((valor) => {
      if (!cancelado) setPrecoBuscado({ iso: dateISO, valor });
    });
    return () => {
      cancelado = true;
    };
  }, [roteiroId, dateISO, preview.ativo]);
  const precoNaData = dateISO && precoBuscado?.iso === dateISO ? precoBuscado.valor : null;

  // Preço unitário e multiplicador do modelo escolhido — mesma fórmula do
  // servidor (`/reservas/novo`), só para a prévia exibida aqui.
  const unitario = modalidade === 'roteiro' ? precoNaData ?? preco : precoDiariaValor;
  const multiplicador = modalidade === 'diaria' ? diarias : 1;
  const subtotalModelo = unitario != null ? unitario * multiplicador : null;
  const valorEstimado = subtotalModelo != null ? subtotalModelo + totalAdicionais : null;

  // Só o modelo Roteiro varia por data: sem data escolhida ele anuncia o menor
  // preço da janela ("a partir de"); Por Diária tem valor fixo.
  const precoVariaPorData = modalidade === 'roteiro';
  const mostrarAPartirDe = precoVariaPorData && !dateISO;
  const precoCabecalho = mostrarAPartirDe ? precoMinimoRoteiro ?? preco : unitario;

  const checkout = modalidade === 'diaria' && dateISO ? somarDias(dateISO, diarias - 1) : null;

  function handleReserve() {
    // Data e Pessoas são obrigatórios para solicitar a reserva.
    if (!date) {
      setError('Selecione a data da reserva.');
      setActive('date');
      return;
    }
    if (toISO(date.date) > dataMaximaISO) {
      setError(`As reservas ficam abertas até ${MESES_ANTECEDENCIA_RESERVA} meses à frente. Escolha uma data até ${dataMaximaISO.split('-').reverse().join('/')}.`);
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

    if (modalidade === 'diaria') {
      const fim = somarDias(dateISO!, diarias - 1);
      const intervalo = expandirIntervalo(dateISO!, fim);
      if (intervalo.some((d) => bloqueadasSet.has(d) || !diaOperacional(parseISO(d)!))) {
        setError('Este período inclui uma data indisponível. Escolha outra data ou reduza as diárias.');
        setActive('date');
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
                  {dateISO
                    ? 'Preço para a data selecionada.'
                    : 'O preço varia conforme a data escolhida.'}
                </p>
              )}
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
              dataMaxima={dataMaxima}
            />
          </div>
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
