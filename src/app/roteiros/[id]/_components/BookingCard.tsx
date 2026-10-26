'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BadgeCheck, CalendarDays, ShieldCheck } from 'lucide-react';
import GuestPicker from '@/components/home/search/GuestPicker';
import { useFormatos } from '@/i18n/formatos';
import { useCart } from './CartContext';
import { useDataReserva } from './DataReservaContext';
import OpcionaisRoteiro from './OpcionaisRoteiro';
import RoteiroAcoes from './RoteiroAcoes';
import ContatoDono from './ContatoDono';
import CalendarioReserva from './CalendarioReserva';
import BarraReservaMobile from './BarraReservaMobile';
import { rastrear } from '@/lib/analytics';
import { useModoPreview } from '@/components/preview/ModoPreview';
import { capacidadeMaxima } from '@/lib/capacidade';
import { valoresParaCliente } from '@/lib/pagamentos/valores';
import { decomporPreco } from '@/lib/precos-calendario';
import {
  motivoIndisponivel, periodoIndisponivel, type CalendarioCliente, type StatusPublico,
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

/** Topo da coluna fixa quando o card cabe na tela (abaixo do header) — o antigo `top-24`. */
const TOPO_STICKY = 96;
/** Respiro entre o fim da coluna ("Converse com o dono") e a borda de baixo da tela. */
const RESPIRO_INFERIOR = 16;

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
  const t = useTranslations('Reservar');
  const tDisp = useTranslations('Disponibilidade');
  const tFlex = useTranslations('CamposBusca.data');
  const tCards = useTranslations('Cards');
  const f = useFormatos();

  // Modelos disponíveis para este roteiro, na ordem em que aparecem nas abas
  // (rótulo em `Reservar.modalidade`, unidade em `Formatos.unidadePreco`).
  const modalidadesDisponiveis: Modalidade[] = [
    ...(preco != null ? ['roteiro' as const] : []),
    ...(precoDiariaAtivo && precoDiariaValor != null ? ['diaria' as const] : []),
  ];

  // Escolhas da reserva (data, flexibilidade, modelo, diárias) — vêm pré-preenchidas
  // da busca pelo DataReservaContext.
  const {
    data: dateISO, flex, setData,
    modalidade: modalidadeEscolhida, setModalidade, diarias, setDiarias,
  } = useDataReserva();
  const modalidade: Modalidade = modalidadesDisponiveis.includes(modalidadeEscolhida)
    ? modalidadeEscolhida
    : modalidadesDisponiveis[0] ?? 'roteiro';

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
  const cardRef = useRef<HTMLDivElement>(null);
  const contatoRef = useRef<HTMLDivElement>(null);
  const campoDataRef = useRef<HTMLDivElement>(null);
  const campoPessoasRef = useRef<HTMLDivElement>(null);
  const [topoSticky, setTopoSticky] = useState(TOPO_STICKY);
  const preview = useModoPreview();
  const { selectedAddons, totalAdicionais, precoCliente } = useCart();

  function open(panel: ActivePanel) {
    if (panel === 'date' && active !== 'date') {
      rastrear('reserva_calendario_aberto', { item_id: roteiroId, origem: 'card' });
    }
    setActive((p) => (p === panel ? null : panel));
  }

  // Opcional sem data: leva ao campo de data e abre o calendário (sem data não há subtotal).
  function pedirDataParaOpcionais() {
    const alvo = campoDataRef.current;
    if (alvo) {
      window.scrollTo({ top: alvo.getBoundingClientRect().top + window.scrollY - 88, behavior: 'smooth' });
    }
    rastrear('reserva_calendario_aberto', { item_id: roteiroId, origem: 'opcionais' });
    setActive('date');
  }

  // Barra fixa do celular: leva ao card de reserva e, sem data escolhida, já abre o calendário.
  function abrirReservaPelaBarra() {
    rastrear('reserva_barra_clique', { item_id: roteiroId, com_data: Boolean(dateISO) });
    const alvo = campoDataRef.current;
    if (alvo) {
      window.scrollTo({ top: alvo.getBoundingClientRect().top + window.scrollY - 88, behavior: 'smooth' });
    }
    if (!dateISO) {
      rastrear('reserva_calendario_aberto', { item_id: roteiroId, origem: 'barra' });
      setActive('date');
    }
  }

  // Fecha o picker aberto (data ou pessoas) ao tocar em qualquer lugar fora do próprio campo e
  // da sua janela — inclusive em outras partes do card (antes só fechava fora da coluna inteira,
  // e o de pessoas ficava aberto até tocar de novo no campo). `pointerdown` cobre mouse e toque.
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      const alvo = e.target as Node;
      setActive((atual) => {
        if (atual === 'date' && campoDataRef.current?.contains(alvo)) return atual;
        if (atual === 'guests' && campoPessoasRef.current?.contains(alvo)) return atual;
        return null;
      });
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  // Coluna fixa: se a coluna inteira cabe na tela, prende no topo (abaixo do
  // header). Se não cabe (telas baixas, adicionais abertos), o `top` fica
  // menor/negativo na medida exata para a coluna rolar junto com a página até o
  // fim do "Converse com o dono" aparecer, e só então fixar — antes travava no fim
  // do card de reserva e o contato com o dono (ação principal antes de reservar)
  // ficava escondido abaixo da dobra. Sem o contato (dono vendo o próprio roteiro),
  // mede até o fim do card. Para rever o topo, rola para cima.
  // Remede quando a coluna muda de altura (abas, adicionais, erro, mensagem) ou a janela muda.
  useEffect(() => {
    const container = containerRef.current;
    const card = cardRef.current;
    if (!container || !card) return;
    function atualizar() {
      // offsetTop relativo à coluna (sticky é posicionado → é o offsetParent).
      const fim = contatoRef.current ?? card!;
      const fimDaColuna = fim.offsetTop + fim.offsetHeight;
      setTopoSticky(Math.min(TOPO_STICKY, window.innerHeight - fimDaColuna - RESPIRO_INFERIOR));
    }
    atualizar();
    const observador = new ResizeObserver(atualizar);
    observador.observe(container);
    observador.observe(card);
    window.addEventListener('resize', atualizar);
    return () => {
      observador.disconnect();
      window.removeEventListener('resize', atualizar);
    };
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

  // Barra fixa (celular): com data (ou na diária) é o Total do card — passeio + opcionais com a
  // taxa embutida; sem data, o "a partir de" somado aos opcionais já escolhidos.
  const opcionaisCliente = selectedAddons.reduce((soma, a) => soma + precoCliente(a.preco), 0);
  const valorBarra = valores
    ? valores.total
    : precoCabecalho != null ? precoCabecalho + opcionaisCliente : null;
  const unidadeBarra = selectedAddons.length > 0
    ? t('barra.comOpcionais')
    : modalidade === 'diaria' && multiplicador > 1
      ? t('barra.totalDiarias', { count: multiplicador })
      : f.unidadePreco(modalidade);

  function handleReserve() {
    // Data e Pessoas são obrigatórios para solicitar a reserva.
    if (!dateISO) {
      setError(t('erros.selecioneData'));
      setActive('date');
      return;
    }
    const problema = periodoIndisponivel(statusDe, dateISO, checkout ?? dateISO);
    if (problema) {
      setError(problema === 'indisponivel' && modalidade === 'diaria'
        ? t('erros.periodoIndisponivel')
        : tDisp(motivoIndisponivel(problema), { data: f.data(calendario.dataMaxima) }));
      setActive('date');
      return;
    }
    if (guests < 1) {
      setError(t('erros.informePessoas'));
      setActive('guests');
      return;
    }
    if (limitePessoas != null && guests > limitePessoas) {
      setError(f.capacidadeExcedida(limitePessoas));
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
    window.location.assign(`/reservas/novo?${params.toString()}`);
  }

  return (
    <div ref={containerRef} className="sticky space-y-4" style={{ top: topoSticky }}>
      {/* Favoritar + Compartilhar — no celular ficam sobre a foto da galeria */}
      <div className="hidden lg:block">
        <RoteiroAcoes roteiroId={roteiroId} roteiroNome={roteiroNome} initialFavorito={initialFavorito} />
      </div>

      {/* Price Card */}
      <div ref={cardRef} className="rounded-2xl border border-slate-200 p-6 shadow-sm">
        {/* Abas de modelo de cobrança — só aparecem quando há mais de uma opção */}
        {modalidadesDisponiveis.length > 1 && (
          <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1">
            {modalidadesDisponiveis.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setModalidade(m);
                  setError(null);
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
                  modalidade === m ? 'bg-white text-marinho shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t(`modalidade.${m}`)}
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
                  {t('aPartirDe')}
                </span>
              )}
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-marinho">{f.moeda(precoCabecalho)}</span>
                <span className="text-sm text-slate-500">{f.unidadePreco(modalidade)}</span>
              </div>
              {precoVariaPorData && (
                <p className="mt-1 text-xs text-slate-400">
                  {dateISO ? t('valorDataSelecionada') : t('precoVaria')}
                </p>
              )}
            </>
          ) : (
            <span className="text-lg font-semibold text-slate-500">{tCards('consultePreco')}</span>
          )}
        </div>

        {/* Date field — abre o calendário do roteiro (o mesmo que o gestor configura) */}
        <div ref={campoDataRef} className="mb-3 relative">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            {modalidade === 'diaria' ? t('checkin') : t('data')}
          </p>
          <button type="button" onClick={() => open('date')} aria-expanded={active === 'date'}
            className={`w-full flex items-center gap-2 text-left rounded-xl border px-4 py-3 transition-all ${
              active === 'date' ? 'border-marinho ring-2 ring-marinho bg-white' : 'border-slate-200 hover:bg-slate-50'
            }`}>
            <CalendarDays className="h-4 w-4 text-slate-400 shrink-0" />
            {dateISO ? (
              <span className="text-sm font-medium text-grafite truncate">
                {f.data(dateISO, { weekday: 'short', day: '2-digit', month: 'short' })}
                {flex > 0 && <span className="text-slate-500"> · {tFlex('flex', { count: flex })}</span>}
              </span>
            ) : (
              <span className="text-sm text-slate-400">{t('escolhaData')}</span>
            )}
          </button>
          {active === 'date' && (
            // Celular: centralizado no campo (que ocupa a largura da tela); a partir do sm, alinhado à direita.
            <div className="absolute left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 top-full z-50 mt-2 w-[min(680px,calc(100vw-2rem))] rounded-2xl border border-slate-100 bg-white p-4 shadow-2xl">
              <CalendarioReserva
                calendario={calendario}
                selecionada={dateISO}
                onSelecionar={(iso) => {
                  rastrear('reserva_data_escolhida', { item_id: roteiroId, data: iso, modalidade });
                  setData(iso);
                  setError(null);
                  setActive(null);
                }}
                modalidade={modalidade}
                diarias={diarias}
              />
            </div>
          )}
          {modalidade === 'diaria' && checkout && (
            <p className="mt-1.5 text-xs text-slate-500">
              {t.rich('checkoutEm', {
                data: f.data(checkout, { day: '2-digit', month: 'long', year: 'numeric' }),
                b: (texto) => <span className="font-medium text-slate-700">{texto}</span>,
              })}
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
              unidade="diarias"
              min={Math.max(1, precoDiariaMinimo)}
            />
          </div>
        )}

        {/* Guests field */}
        <div ref={campoPessoasRef} className="mb-4">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            {t('pessoas')}
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
              {t('ajustado', { count: ajustadoPara })}
            </p>
          ) : limitePessoas != null ? (
            <p className="mt-1.5 text-xs text-slate-400">
              {t('limite', { count: limitePessoas })}
            </p>
          ) : null}
        </div>

        {/* Opcionais (produtos/serviços do catálogo) — à vista, com marcação; mesmo carrinho da
            seção "Turbine seu passeio" do conteúdo */}
        <OpcionaisRoteiro roteiroId={roteiroId} variante="card" onFaltaData={pedirDataParaOpcionais} />

        {/* Detalhamento — valores com a taxa embutida (somam o total) */}
        {valores && (
          <div className="space-y-2 py-4 border-t border-slate-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">
                {t(`linha.${modalidade}`)}
                {multiplicador > 1 ? ` × ${multiplicador}` : ''}
              </span>
              <span className="font-medium text-grafite">{f.moeda(valores.passeio)}</span>
            </div>
            {totalAdicionais > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{t('adicionais')}</span>
                <span className="font-medium text-grafite">{f.moeda(valores.adicionais)}</span>
              </div>
            )}
          </div>
        )}

        {valores && (
          <div className="py-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-marinho">{t('total')}</span>
              <span className="text-xl font-bold text-marinho">{f.moeda(valores.total)}</span>
            </div>
            {/* Referência para grupos: o preço é do passeio (barco), dividido aqui só como estimativa. */}
            {guests > 1 && (
              <p className="mt-1 text-right text-xs font-medium text-turquesa-escuro">
                {t('porPessoa', { valor: f.moeda(valores.total / guests), count: guests })}
              </p>
            )}
            <p className="mt-1 text-[11px] text-slate-400">
              {t('cupom')}
            </p>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleReserve}
          className="w-full bg-marinho hover:bg-marinho-escuro text-white font-semibold py-3.5 rounded-xl transition-all hover:shadow-lg hover:shadow-marinho/25 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer mt-4"
        >
          {t('solicitar')}
        </button>

        {error && (
          <p className="mt-2 text-xs font-medium text-red-600 text-center" role="alert">
            {error}
          </p>
        )}

        {/* Solicitar não compromete: o pagamento só vem depois da confirmação do dono */}
        <p className="mt-2.5 text-center text-xs font-medium text-turquesa-escuro">
          {t('semCobranca')}
        </p>

        {/* Trust badges — só o que o produto garante (repasse 48h após o passeio, anúncio aprovado) */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-turquesa shrink-0" />
            <span>{t('pagamentoProtegido')}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <BadgeCheck className="h-3.5 w-3.5 text-turquesa shrink-0" />
            <span>{t('anuncioAprovado')}</span>
          </div>
        </div>
      </div>

      {/* Contato com o dono logo abaixo do "Solicitar Reserva": a dúvida que trava a reserva
          vira conversa em modal, sem sair da página (o texto segue como rascunho) */}
      {!ehDono && (
        <div ref={contatoRef}>
          <ContatoDono roteiroId={roteiroId} roteiroNome={roteiroNome} dataISO={dateISO} pessoas={guests} />
        </div>
      )}

      {/* Celular: preço + atalho para a reserva, fixos no rodapé — sempre o mesmo valor que o
          cliente vai pagar, com os opcionais já incluídos */}
      <BarraReservaMobile
        rotulo={dateISO
          ? f.data(dateISO, { weekday: 'short', day: '2-digit', month: 'short' })
          : mostrarAPartirDe ? t('aPartirDe') : modalidade === 'diaria' ? t('barra.porDiaria') : t('barra.valor')}
        valor={valorBarra != null ? f.moeda(valorBarra) : null}
        unidade={unidadeBarra}
        acao={dateISO ? t('barra.reservar') : t('barra.verDatas')}
        onAcao={abrirReservaPelaBarra}
        card={cardRef}
      />
    </div>
  );
}
