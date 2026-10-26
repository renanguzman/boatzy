import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import {
  ArrowLeft, BadgeCheck, CalendarDays, Check, Clock, CreditCard, Crown, ExternalLink, FileText,
  Hourglass, MapPin, MessageSquare, Navigation, Phone, QrCode, Receipt, RotateCcw,
  ShieldCheck, Ship, ShoppingCart, Sunrise, Sunset, TimerOff, User, Users, X,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { supabaseAdmin } from '@/lib/supabase';
import { concluirReservasVencidas } from '@/lib/reservas';
import { expirarPedidosVencidosSemFalhar, PAGAMENTO_PAGO } from '@/lib/pagamentos/pedidos';
import { multiplicadorDaReserva, valoresParaCliente } from '@/lib/pagamentos/valores';
import { protocoloAceite } from '@/lib/termos/formato';
import { horarioRetorno } from '@/lib/duracao';
import { ordenarImagens } from '@/lib/galeria';
import { applyPhoneMask, onlyDigits } from '@/lib/validators';
import { useFormatos, type Formatos } from '@/i18n/formatos';
import { getFormatos } from '@/i18n/formatos-servidor';
import type {
  AvaliacaoStatus, FormaPagamentoCodigo, PagamentoEstornoStatus, PagamentoStatus, PedidoStatus,
  ReservaModalidadePreco, ReservaStatus,
} from '@/types/supabase';
import CancelarReservaButton from '../../_components/CancelarReservaButton';
import AvaliacaoReserva from '../../_components/AvaliacaoReserva';
import { STATUS } from '../../_lib/status';
import BotaoImprimir from './BotaoImprimir';
import ConversarDonoReserva from '../../_components/ConversarDonoReserva';

/* ── Tipos do select ─────────────────────────────────────────────────────── */

type AvaliacaoResumo = { nota: number; comentario: string | null; created_at: string; status: AvaliacaoStatus };

type PedidoDetalhe = {
  id: string;
  numero: number;
  status: PedidoStatus;
  expira_em: string | null;
  pago_em: string | null;
  cancelado_em: string | null;
  valor_itens: number;
  valor_comissao: number;
  valor_desconto: number;
  valor_total: number;
  pedido_desconto: { cupom_codigo: string | null; valor: number }[];
};

type ReservaDetalhe = {
  id: string;
  owner_id: string;
  tipo: 'roteiro' | 'embarcacao';
  data_reserva: string;
  data_fim_reserva: string | null;
  flexibilidade: number | null;
  quantidade_pessoas: number;
  quantidade_diarias: number | null;
  modalidade_preco: ReservaModalidadePreco;
  roteiro_id: string | null;
  item_nome: string;
  preco_base: number | null;
  total_adicionais: number;
  taxa_percent: number | null;
  total_estimado: number | null;
  cupom_codigo: string | null;
  desconto_valor: number;
  status: ReservaStatus;
  observacao_gestor: string | null;
  solicitado_em: string;
  respondido_em: string | null;
  aceita_em: string | null;
  cancelada_em: string | null;
  expirada_em: string | null;
  pagamento_exigido: boolean;
  roteiro: {
    nome: string;
    origem: string | null;
    destino: string | null;
    horario_saida: string | null;
    duracao_horas: number | null;
    logradouro: string | null;
    logradouro_numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cep: string | null;
    latitude: number | null;
    longitude: number | null;
    municipios: { nome: string; estados: { uf: string } | null } | null;
    roteiro_imagens: { url_imagem: string; principal: boolean; ordem: number | null }[];
  } | null;
  embarcacao: { nome: string } | null;
  reserva_adicional: { id: string; descricao: string; valor: number; tipo: string }[];
  reserva_atendente: {
    equipe_membro: { nome_completo: string; foto_url: string | null; telefone: string | null; is_gestor: boolean } | null;
  }[];
  avaliacao: AvaliacaoResumo | AvaliacaoResumo[] | null;
  pedido: PedidoDetalhe | PedidoDetalhe[] | null;
};

type PagamentoDetalhe = {
  id: string;
  forma_pagamento: FormaPagamentoCodigo;
  numero_parcelas: number;
  valor: number;
  status: PagamentoStatus;
  confirmado_em: string | null;
  recebido_em: string | null;
  numero_fatura: string | null;
  comprovante_url: string | null;
  fatura_url: string | null;
  asaas_payment_id: string | null;
  pix_transacao_id: string | null;
  criado_em: string;
  pagamento_cartao: { bandeira: string; ultimos_digitos: string } | { bandeira: string; ultimos_digitos: string }[] | null;
  pagamento_estorno: { valor: number; status: PagamentoEstornoStatus; solicitado_em: string; concluido_em: string | null }[];
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** "Sábado, 24 de outubro de 2026" — só a primeira letra maiúscula (`capitalize` faria "De Outubro De"). */
function dataLonga(iso: string, f: Formatos): string {
  const texto = f.data(iso, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

type TradutorDetalhe = Awaited<ReturnType<typeof getTranslations<'DetalheReserva'>>>;

/** Código curto da reserva, para citar no chat/suporte. */
const codigoReserva = (id: string) => id.slice(0, 8).toUpperCase();

/** CPF/CNPJ do pagador só com o miolo visível (***.456.789-** / **.345.678/****-**). */
function documentoMascarado(doc: string | null): string | null {
  const d = onlyDigits(doc ?? '');
  if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  if (d.length === 14) return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/****-**`;
  return null;
}

function formatTelefone(digits: string | null): string | null {
  if (!digits) return null;
  const d = onlyDigits(digits);
  if (d.length < 10) return null;
  return applyPhoneMask(d, d.length > 10 ? '(##) #####-####' : '(##) ####-####');
}

const BANDEIRA: Record<string, string> = {
  VISA: 'Visa', MASTERCARD: 'Mastercard', ELO: 'Elo', AMEX: 'American Express', HIPERCARD: 'Hipercard',
  DINERS: 'Diners', DISCOVER: 'Discover', JCB: 'JCB',
};

/** Pagamentos que representam dinheiro recebido (inclusive depois estornado/contestado). */
const PAGAMENTO_COM_COMPROVANTE: PagamentoStatus[] = [...PAGAMENTO_PAGO, 'estornado', 'estornado_parcial', 'em_disputa', 'estorno_em_andamento'];

type EtapaEstado = 'feito' | 'atual' | 'falhou' | 'futuro';
type Etapa = { titulo: string; detalhe: string | null; estado: EtapaEstado };

/** Linha do tempo da reserva, do ponto de vista do cliente. */
function montarEtapas(r: ReservaDetalhe, pedido: PedidoDetalhe | null, t: TradutorDetalhe, f: Formatos): Etapa[] {
  const quando = (iso: string | null) => (iso ? f.dataHora(iso) : null);
  const etapas: Etapa[] = [
    { titulo: t('etapas.solicitacaoEnviada'), detalhe: f.dataHora(r.solicitado_em), estado: 'feito' },
  ];

  // Resposta do dono.
  if (r.status === 'pendente') {
    etapas.push({ titulo: t('etapas.respostaDono'), detalhe: t('etapas.aguardandoAnalise'), estado: 'atual' });
  } else if (r.status === 'recusada') {
    etapas.push({ titulo: t('etapas.naoAceita'), detalhe: quando(r.respondido_em), estado: 'falhou' });
    return etapas;
  } else if (r.status === 'cancelada' && !r.respondido_em) {
    etapas.push({ titulo: t('etapas.canceladaPorVoce'), detalhe: quando(r.cancelada_em), estado: 'falhou' });
    return etapas;
  } else {
    etapas.push({
      titulo: r.pagamento_exigido ? t('etapas.aceitaPeloDono') : t('etapas.confirmadaPeloDono'),
      detalhe: quando(r.aceita_em ?? r.respondido_em),
      estado: 'feito',
    });
  }

  // Pagamento pelo Boatzy (só quando a reserva exige).
  if (r.pagamento_exigido || pedido) {
    if (!pedido || r.status === 'pendente') {
      etapas.push({ titulo: t('etapas.pagamento'), detalhe: t('etapas.depoisAceite'), estado: 'futuro' });
    } else if (pedido.status === 'aguardando_pagamento') {
      etapas.push({
        titulo: t('etapas.pagamento'),
        detalhe: pedido.expira_em ? t('etapas.pagueAte', { data: f.dataHora(pedido.expira_em) }) : t('etapas.aguardando'),
        estado: 'atual',
      });
    } else if (pedido.status === 'expirado') {
      etapas.push({ titulo: t('etapas.prazoExpirou'), detalhe: quando(r.expirada_em), estado: 'falhou' });
      return etapas;
    } else if (pedido.status === 'cancelado') {
      etapas.push({ titulo: t('etapas.canceladaPorVoce'), detalhe: quando(r.cancelada_em), estado: 'falhou' });
      return etapas;
    } else {
      etapas.push({ titulo: t('etapas.pagamentoAprovado'), detalhe: quando(pedido.pago_em), estado: 'feito' });
      if (pedido.status === 'reembolsado' || pedido.status === 'reembolsado_parcial') {
        etapas.push({ titulo: pedido.status === 'reembolsado' ? t('etapas.reembolsado') : t('etapas.reembolsoParcial'), detalhe: null, estado: 'falhou' });
        return etapas;
      }
    }
  }

  if (r.status === 'cancelada') {
    etapas.push({ titulo: t('etapas.canceladaPorVoce'), detalhe: quando(r.cancelada_em), estado: 'falhou' });
    return etapas;
  }

  // Passeio.
  etapas.push({
    titulo: r.status === 'concluida' ? t('etapas.passeioRealizado') : t('etapas.diaPasseio'),
    detalhe: f.data(r.data_reserva),
    estado: r.status === 'concluida' ? 'feito' : r.status === 'confirmada' ? 'atual' : 'futuro',
  });
  return etapas;
}

const ESTILO_ETAPA: Record<EtapaEstado, { bolinha: string; titulo: string; Icone: React.ElementType | null }> = {
  feito: { bolinha: 'bg-turquesa text-white', titulo: 'text-marinho', Icone: Check },
  atual: { bolinha: 'bg-destaque text-marinho ring-4 ring-destaque/25', titulo: 'text-marinho', Icone: Hourglass },
  falhou: { bolinha: 'bg-slate-300 text-white', titulo: 'text-slate-500', Icone: X },
  futuro: { bolinha: 'bg-slate-100 text-slate-300 border border-slate-200', titulo: 'text-slate-400', Icone: null },
};

/* ── Detalhe ─────────────────────────────────────────────────────────────── */

/**
 * Detalhe de uma reserva na visão do cliente (SPEC §90). Só renderiza reservas de `clienteId`
 * (outra pessoa → 404). A página faz a checagem de sessão.
 */
export default async function DetalheReserva({ reservaId: id, clienteId }: { reservaId: string; clienteId: string }) {
  const [t, tStatus, tTipo, tPessoas, tPag, tMR, tOpc, tLocal, f] = await Promise.all([
    getTranslations('DetalheReserva'),
    getTranslations('StatusReserva'),
    getTranslations('Pagamento.tipo'),
    getTranslations('CamposBusca.quantidade.pessoas'),
    getTranslations('Pagamento'),
    getTranslations('MinhasReservas'),
    getTranslations('Opcionais'),
    getTranslations('Roteiro.localizacao'),
    getFormatos(),
  ]);

  // Transições lazy antes de exibir: pagamento vencido → expirada; confirmada com data passada → concluída.
  await expirarPedidosVencidosSemFalhar();
  await concluirReservasVencidas();

  const { data } = await supabaseAdmin
    .from('reserva')
    .select(
      `id, owner_id, tipo, data_reserva, data_fim_reserva, flexibilidade, quantidade_pessoas, quantidade_diarias,
       modalidade_preco, roteiro_id, item_nome, preco_base, total_adicionais, taxa_percent, total_estimado,
       cupom_codigo, desconto_valor, status, observacao_gestor, solicitado_em, respondido_em, aceita_em,
       cancelada_em, expirada_em, pagamento_exigido,
       roteiro ( nome, origem, destino, horario_saida, duracao_horas, logradouro, logradouro_numero, complemento,
                 bairro, cep, latitude, longitude, municipios ( nome, estados ( uf ) ),
                 roteiro_imagens ( url_imagem, principal, ordem ) ),
       embarcacao ( nome ),
       reserva_adicional ( id, descricao, valor, tipo ),
       reserva_atendente ( equipe_membro ( nome_completo, foto_url, telefone, is_gestor ) ),
       avaliacao ( nota, comentario, created_at, status ),
       pedido ( id, numero, status, expira_em, pago_em, cancelado_em, valor_itens, valor_comissao, valor_desconto,
                valor_total, pedido_desconto ( cupom_codigo, valor ) )`,
    )
    .eq('id', id)
    .eq('cliente_id', clienteId)
    .maybeSingle();
  // Só o próprio cliente vê a reserva (id de outra pessoa → 404, sem revelar que existe).
  if (!data) notFound();

  const r = data as unknown as ReservaDetalhe;
  const pedido = um(r.pedido);
  const avaliacao = um(r.avaliacao);

  const [{ data: pagamentosData }, { data: cliente }, { data: dono }, { data: aceite }, { data: naoLidasRows }] = await Promise.all([
    pedido
      ? supabaseAdmin
          .from('pagamento')
          .select(
            `id, forma_pagamento, numero_parcelas, valor, status, confirmado_em, recebido_em, numero_fatura,
             comprovante_url, fatura_url, asaas_payment_id, pix_transacao_id, criado_em,
             pagamento_cartao ( bandeira, ultimos_digitos ),
             pagamento_estorno ( valor, status, solicitado_em, concluido_em )`,
          )
          .eq('pedido_id', pedido.id)
          .order('criado_em', { ascending: false })
      : Promise.resolve({ data: [] }),
    supabaseAdmin.from('users').select('name, cpf_cnpj').eq('id', clienteId).maybeSingle(),
    supabaseAdmin.from('users').select('name').eq('id', r.owner_id).maybeSingle(),
    supabaseAdmin
      .from('termos_uso_aceite')
      .select('termo_versao, aceito_em, evidencia_hash')
      .eq('user_id', clienteId)
      .eq('contexto_tipo', 'reserva')
      .eq('contexto_id', r.id)
      .order('aceito_em', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin.rpc('chat_nao_lidas_por_gestor', { p_cliente: clienteId }),
  ]);

  const pagamentos = (pagamentosData ?? []) as unknown as PagamentoDetalhe[];
  const pagamento = pagamentos.find((p) => PAGAMENTO_COM_COMPROVANTE.includes(p.status)) ?? null;
  const cartao = pagamento ? um(pagamento.pagamento_cartao) : null;
  const estornos = (pagamento?.pagamento_estorno ?? []).filter((e) => e.status !== 'cancelado');
  // Recibo da transação no Asaas (ou a fatura, se o recibo ainda não veio pelo webhook).
  const urlOperadora = pagamento?.comprovante_url ?? pagamento?.fatura_url ?? null;
  const mostrarComprovante = !!pedido && !!pagamento
    && ['pago', 'reembolsado', 'reembolsado_parcial', 'em_disputa'].includes(pedido.status);

  const s = STATUS[r.status];
  const nome = r.roteiro?.nome ?? r.item_nome;
  const TipoIcon = r.tipo === 'embarcacao' ? Ship : MapPin;
  const localidade = r.roteiro?.municipios
    ? `${r.roteiro.municipios.nome}${r.roteiro.municipios.estados ? `, ${r.roteiro.municipios.estados.uf}` : ''}`
    : null;
  const capa = ordenarImagens(r.roteiro?.roteiro_imagens ?? []).sort((a, b) => Number(b.principal) - Number(a.principal))[0]?.url_imagem ?? null;
  const periodoVariasDatas = r.data_fim_reserva && r.data_fim_reserva !== r.data_reserva;
  const retorno = horarioRetorno(r.roteiro?.horario_saida, r.roteiro?.duracao_horas);
  const endereco = r.roteiro?.logradouro
    ? [
        `${r.roteiro.logradouro}${r.roteiro.logradouro_numero ? `, ${r.roteiro.logradouro_numero}` : ''}${r.roteiro.complemento ? ` — ${r.roteiro.complemento}` : ''}`,
        r.roteiro.bairro,
        localidade,
        r.roteiro.cep ? tLocal('cep', { cep: r.roteiro.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2') }) : null,
      ].filter(Boolean).join(' · ')
    : null;
  const mapaUrl = r.roteiro?.latitude != null && r.roteiro?.longitude != null
    ? `https://www.google.com/maps/search/?api=1&query=${r.roteiro.latitude},${r.roteiro.longitude}`
    : null;

  const atendentes = (r.reserva_atendente ?? [])
    .map((a) => a.equipe_membro)
    .filter((m): m is NonNullable<typeof m> => m != null)
    .sort((a, b) => Number(b.is_gestor) - Number(a.is_gestor));
  const mostrarAtendentes = (r.status === 'confirmada' || r.status === 'concluida') && atendentes.length > 0;

  const podeCancelar =
    r.status === 'pendente' || r.status === 'aguardando_pagamento' || (r.status === 'confirmada' && !r.pagamento_exigido);
  const chatIndisponivel = r.owner_id === clienteId;
  const naoLidas = Number((naoLidasRows ?? []).find((n) => n.gestor_id === r.owner_id)?.total ?? 0);

  // Valores com a taxa embutida (o cliente nunca vê a taxa separada) — mesma conta do checkout.
  const taxa = Number(r.taxa_percent ?? 0);
  const valores = r.preco_base != null
    ? valoresParaCliente({
        precoUnitario: Number(r.preco_base),
        multiplicador: multiplicadorDaReserva(r),
        totalAdicionais: Number(r.total_adicionais),
        taxaPercent: taxa,
        descontoCupom: Number(r.desconto_valor),
      })
    : null;
  const total = pedido ? Number(pedido.valor_total) : valores?.total ?? (r.total_estimado != null ? Number(r.total_estimado) : null);
  const desconto = pedido ? Number(pedido.valor_desconto) : Number(r.desconto_valor);
  const cupom = pedido?.pedido_desconto.find((d) => d.cupom_codigo)?.cupom_codigo ?? r.cupom_codigo;
  const rotuloPasseio = r.modalidade_preco === 'diaria'
    ? t('linhaPasseioDiarias', { count: r.quantidade_diarias ?? 1 })
    : r.modalidade_preco === 'pessoa'
      ? t('linhaPasseioPessoas', { count: r.quantidade_pessoas })
      : t('linhaPasseio');
  const duracao = f.duracao(r.roteiro?.duracao_horas);

  const etapas = montarEtapas(r, pedido, t, f);

  return (
    <div className="min-h-screen flex flex-col bg-areia print:bg-white">
      <div className="print:hidden"><Header /></div>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 sm:py-10 print:p-0">
        <Link href="/minhas-reservas" className="print:hidden inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-marinho transition-colors">
          <ArrowLeft className="h-4 w-4" /> {tMR('titulo')}
        </Link>

        {/* ── Cabeçalho ── */}
        <section className="print:hidden mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row">
            <div className="relative h-40 sm:h-auto sm:w-56 shrink-0 bg-slate-100">
              {capa ? (
                <Image src={capa} alt={nome} fill className="object-cover" sizes="(min-width: 640px) 224px, 100vw" priority />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <TipoIcon className="h-8 w-8 text-slate-300" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <TipoIcon className="h-3 w-3" />
                    {tTipo(r.tipo)}
                    <span className="text-slate-300">·</span>
                    <span className="font-mono normal-case tracking-normal">{t('reservaCodigo', { codigo: codigoReserva(r.id) })}</span>
                  </p>
                  <h1 className="mt-1 text-xl sm:text-2xl font-bold text-marinho leading-tight">{nome}</h1>
                  {localidade && (
                    <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                      <MapPin className="h-3.5 w-3.5 shrink-0" /> {localidade}
                    </p>
                  )}
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${s.badge}`}>
                  <s.Icon className="h-3.5 w-3.5" /> {tStatus(`${r.status}.label`)}
                </span>
              </div>

              {/* Linha do tempo */}
              <ol className="mt-5 grid gap-3 sm:gap-0 sm:grid-flow-col sm:auto-cols-fr">
                {etapas.map((e, i) => {
                  const est = ESTILO_ETAPA[e.estado];
                  const ultima = i === etapas.length - 1;
                  return (
                    <li key={i} className="relative flex sm:flex-col items-start gap-3 sm:gap-2 sm:pr-3">
                      {!ultima && (
                        <span aria-hidden className="absolute left-[13px] top-7 bottom-[-12px] w-px bg-slate-200 sm:left-7 sm:right-0 sm:top-[13px] sm:bottom-auto sm:h-px sm:w-auto" />
                      )}
                      <span className={`relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${est.bolinha}`}>
                        {est.Icone && <est.Icone className="h-3.5 w-3.5" strokeWidth={2.5} />}
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-xs font-semibold leading-snug ${est.titulo}`}>{e.titulo}</span>
                        {e.detalhe && <span className="block text-[11px] text-slate-400 leading-snug">{e.detalhe}</span>}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </section>

        <div className="print:hidden mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ── Coluna principal ── */}
          <div className="lg:col-span-2 space-y-5">
            {/* Seu passeio */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
              <h2 className="text-base font-bold text-marinho">{t('seuPasseio')}</h2>
              <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <Info icone={CalendarDays} rotulo={periodoVariasDatas ? t('periodo') : t('data')}>
                  <span>{dataLonga(r.data_reserva, f)}</span>
                  {periodoVariasDatas && <> {t('ate')} <span>{dataLonga(r.data_fim_reserva!, f)}</span></>}
                  {r.flexibilidade ? <span className="block text-xs text-slate-400">{t('flexivel', { count: r.flexibilidade })}</span> : null}
                </Info>
                <Info icone={Users} rotulo={t('pessoas')}>
                  {tPessoas('valor', { count: r.quantidade_pessoas })}
                </Info>
                {r.roteiro?.horario_saida && (
                  <Info icone={Sunrise} rotulo={t('saida')}>{f.horario(r.roteiro.horario_saida)}</Info>
                )}
                {(retorno || r.roteiro?.duracao_horas) && (
                  <Info icone={Sunset} rotulo={retorno ? t('retornoAproximado') : t('duracao')}>
                    {retorno ? f.retorno(retorno) : duracao}
                    {retorno && duracao && (
                      <span className="block text-xs text-slate-400">{t('duracaoDe', { duracao })}</span>
                    )}
                  </Info>
                )}
                {r.embarcacao?.nome && <Info icone={Ship} rotulo={t('embarcacao')}>{r.embarcacao.nome}</Info>}
                {dono?.name && <Info icone={Crown} rotulo={t('donoEmbarcacao')}>{dono.name}</Info>}
                {(r.roteiro?.origem || r.roteiro?.destino) && (
                  <Info icone={Navigation} rotulo={t('embarqueDesembarque')}>
                    {r.roteiro?.origem ?? '—'}
                    {r.roteiro?.destino && r.roteiro.destino !== r.roteiro.origem && <> → {r.roteiro.destino}</>}
                  </Info>
                )}
                <Info icone={Clock} rotulo={t('solicitadaEm')}>{f.dataHora(r.solicitado_em)}</Info>
              </dl>

              {endereco && (
                <div className="mt-5 flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-marinho" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('pontoEncontro')}</p>
                      <p className="mt-0.5 text-sm text-slate-700">{endereco}</p>
                    </div>
                  </div>
                  {mapaUrl && (
                    <a href={mapaUrl} target="_blank" rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-marinho hover:text-turquesa-escuro">
                      {t('abrirMapa')} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}

              {r.reserva_adicional.length > 0 && (
                <div className="mt-5">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-marinho">
                    <ShoppingCart className="h-4 w-4" /> {t('opcionaisIncluidos')}
                  </p>
                  <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100">
                    {r.reserva_adicional.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                        <span className="text-slate-700">
                          {a.descricao}
                          <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            {a.tipo === 'servico' ? tOpc('servico') : tOpc('produto')}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Resposta do dono */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
              <h2 className="text-base font-bold text-marinho">{r.observacao_gestor ? t('respostaDono') : t('situacao')}</h2>
              {r.observacao_gestor ? (
                <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-indigo-700">
                    <MessageSquare className="h-4 w-4 text-indigo-500" /> {t('recado')}
                  </p>
                  <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">{r.observacao_gestor}</p>
                  {r.respondido_em && <p className="mt-2 text-xs text-slate-400">{tMR('respondidaEm', { data: f.dataHora(r.respondido_em) })}</p>}
                </div>
              ) : (
                <div className={`mt-3 rounded-xl border p-3 text-sm font-medium ${s.noteClass}`}>{tStatus(`${r.status}.note`)}</div>
              )}

              {mostrarAtendentes && (
                <div className="mt-4">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-marinho">
                    <Users className="h-4 w-4" /> {tMR('quemAtende')}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-4">
                    {atendentes.map((m, i) => {
                      const tel = formatTelefone(m.telefone);
                      return (
                        <div key={i} className="flex items-center gap-2.5">
                          <span className="w-10 h-10 rounded-full overflow-hidden bg-slate-50 border border-slate-200 shrink-0 flex items-center justify-center">
                            {m.foto_url ? (
                              <Image src={m.foto_url} alt={m.nome_completo} width={40} height={40} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-4 h-4 text-slate-300" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm text-slate-700 flex items-center gap-1">
                              {m.is_gestor && <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                              {m.is_gestor ? tMR('gestorEmbarcacao') : m.nome_completo}
                            </p>
                            {tel && <p className="text-xs text-slate-400 flex items-center gap-1"><Phone className="h-3 w-3" /> {tel}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* Avaliação (o componente já tem título e moldura) */}
            {r.status === 'concluida' && <AvaliacaoReserva reservaId={r.id} avaliacao={avaliacao} />}
          </div>

          {/* ── Coluna lateral (no celular vem primeiro: valores, pagamento e ações) ── */}
          <aside className="order-first lg:order-none space-y-5">
            {/* Valores */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
              <h2 className="text-base font-bold text-marinho">{t('valores')}</h2>
              {total == null ? (
                <p className="mt-3 text-sm text-slate-500">{t('precoACombinar')}</p>
              ) : (
                <div className="mt-3 space-y-2 text-sm">
                  {valores && (
                    <>
                      <Linha rotulo={rotuloPasseio} valor={valores.passeio} />
                      {valores.adicionais > 0 && <Linha rotulo={t('opcionais')} valor={valores.adicionais} />}
                    </>
                  )}
                  {desconto > 0 && (
                    <div className="flex justify-between text-turquesa-escuro">
                      <span>{cupom ? tPag('descontoCupom', { cupom }) : tPag('desconto')}</span>
                      <span>-{f.moedaCentavos(desconto)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold text-marinho">
                    <span>{pedido ? t('total') : t('totalEstimado')}</span>
                    <span>{f.moedaCentavos(total)}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{pedido ? t('taxasIncluidasPedido', { numero: pedido.numero }) : t('taxasIncluidas')}</p>
                </div>
              )}
            </section>

            {/* Pagamento */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
              <h2 className="text-base font-bold text-marinho">{t('pagamento')}</h2>
              <StatusPagamento r={r} pedido={pedido} pagamento={pagamento} />
            </section>

            {/* Ações */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
              {chatIndisponivel ? (
                <p className="text-sm text-slate-400">{t('itemSeu')}</p>
              ) : (
                <ConversarDonoReserva
                  reservaId={r.id}
                  itemNome={nome}
                  dataLabel={f.data(r.data_reserva)}
                  naoLidas={naoLidas}
                  variante="botao"
                />
              )}
              {r.roteiro_id && (
                <Link
                  href={`/roteiros/${r.roteiro_id}`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-marinho hover:bg-slate-50 transition-colors"
                >
                  {t('verRoteiro')}
                </Link>
              )}
              {podeCancelar && (
                <div className="flex justify-center pt-1">
                  <CancelarReservaButton reservaId={r.id} />
                </div>
              )}
            </section>

            {/* Aceite dos termos */}
            {aceite && (
              <p className="flex items-start gap-1.5 px-1 text-[11px] leading-relaxed text-slate-400">
                <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" />
                <span>
                  {t.rich('termosAceitos', {
                    versao: aceite.termo_versao,
                    data: f.dataHora(aceite.aceito_em),
                    protocolo: protocoloAceite(aceite.evidencia_hash),
                    mono: (texto) => <span className="font-mono">{texto}</span>,
                  })}
                </span>
              </p>
            )}
          </aside>
        </div>

        {/* ── Comprovante de pagamento (único bloco impresso) ── */}
        {mostrarComprovante && pedido && pagamento && (
          <section id="comprovante" className="scroll-mt-24 mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm print:mt-0 print:border-0 print:shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-slate-200 p-5 sm:px-7">
              <div className="flex items-center gap-3">
                <Image src="/images/logo.png" alt="Boatzy" width={120} height={36} className="h-9 w-auto" />
                <div>
                  <h2 className="flex items-center gap-1.5 text-base font-bold text-marinho">
                    <Receipt className="h-4 w-4" /> {t('comprovante.titulo')}
                  </h2>
                  <p className="text-xs text-slate-400">{t('comprovante.pedidoReserva', { numero: pedido.numero, codigo: codigoReserva(r.id) })}</p>
                </div>
              </div>
              <BotaoImprimir />
            </div>

            <div className="p-5 sm:px-7">
              {/* Valor + situação */}
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('comprovante.valorPago')}</p>
                  <p className="text-3xl font-bold text-marinho tabular-nums">{f.moedaCentavos(Number(pagamento.valor))}</p>
                </div>
                <SeloPedido status={pedido.status} />
              </div>

              <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                {/* `pago_em` tem a hora exata; o `confirmado_em` da operadora pode vir só com a data. */}
                <LinhaRecibo rotulo={t('comprovante.dataPagamento')} valor={(() => {
                  const quando = pedido.pago_em ?? pagamento.confirmado_em ?? pagamento.recebido_em;
                  return quando ? f.dataHora(quando) : '—';
                })()} />
                <LinhaRecibo
                  rotulo={t('comprovante.forma')}
                  valor={
                    pagamento.forma_pagamento === 'pix'
                      ? tPag('formas.pix')
                      : `${tPag('formas.cartao_credito')}${cartao ? ` ${tPag('cartaoFinal', { bandeira: BANDEIRA[cartao.bandeira] ?? cartao.bandeira, digitos: cartao.ultimos_digitos })}` : ''}`
                      + (pagamento.numero_parcelas > 1
                        ? ` · ${tPag('parcelas', { n: pagamento.numero_parcelas, valor: f.moedaCentavos(Number(pagamento.valor) / pagamento.numero_parcelas) })}`
                        : ` · ${t('comprovante.aVista')}`)
                  }
                  icone={pagamento.forma_pagamento === 'pix' ? QrCode : CreditCard}
                />
                <LinhaRecibo rotulo={t('comprovante.pagador')} valor={[cliente?.name, documentoMascarado(cliente?.cpf_cnpj ?? null)].filter(Boolean).join(' · ') || '—'} />
                <LinhaRecibo rotulo={t('comprovante.recebedor')} valor={t('comprovante.recebedorValor')} />
                {pagamento.asaas_payment_id && <LinhaRecibo rotulo={t('comprovante.idTransacao')} valor={pagamento.asaas_payment_id} mono />}
                {pagamento.pix_transacao_id && <LinhaRecibo rotulo={t('comprovante.idPix')} valor={pagamento.pix_transacao_id} mono />}
                {pagamento.numero_fatura && <LinhaRecibo rotulo={t('comprovante.numeroFatura')} valor={pagamento.numero_fatura} mono />}
              </dl>

              {/* Itens */}
              <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('comprovante.referenteA')}</p>
                <p className="mt-1 font-semibold text-marinho">{nome}</p>
                <p className="text-slate-600">
                  <span>{dataLonga(r.data_reserva, f)}</span>
                  {periodoVariasDatas && <> {t('ate')} <span>{dataLonga(r.data_fim_reserva!, f)}</span></>}
                  {' · '}{tPessoas('valor', { count: r.quantidade_pessoas })}
                </p>
                {r.reserva_adicional.length > 0 && (
                  <p className="mt-1 text-slate-500">{t('comprovante.opcionaisLista', { lista: r.reserva_adicional.map((a) => a.descricao).join(', ') })}</p>
                )}
                <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-3">
                  <Linha rotulo={t('comprovante.passeioOpcionais')} valor={Number(pedido.valor_itens) + Number(pedido.valor_comissao)} />
                  {Number(pedido.valor_desconto) > 0 && (
                    <div className="flex justify-between text-turquesa-escuro">
                      <span>{cupom ? tPag('descontoCupom', { cupom }) : tPag('desconto')}</span>
                      <span>-{f.moedaCentavos(Number(pedido.valor_desconto))}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-marinho">
                    <span>{t('comprovante.totalPago')}</span><span>{f.moedaCentavos(Number(pagamento.valor))}</span>
                  </div>
                </div>
              </div>

              {/* Reembolsos */}
              {estornos.length > 0 && (
                <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/60 p-4 text-sm">
                  <p className="flex items-center gap-1.5 font-semibold text-sky-800">
                    <RotateCcw className="h-4 w-4" /> {t('comprovante.reembolsos')}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {estornos.map((e, i) => (
                      <li key={i} className="flex justify-between gap-3 text-sky-900">
                        <span>
                          {e.status === 'concluido'
                            ? t('comprovante.estornadoEm', { data: f.dataHora(e.concluido_em ?? e.solicitado_em) })
                            : t('comprovante.emAndamento', { data: f.dataHora(e.solicitado_em) })}
                        </span>
                        <span className="font-semibold">-{f.moedaCentavos(Number(e.valor))}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-sky-700">{t('comprovante.prazoExtrato')}</p>
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-slate-200 pt-4">
                <p className="text-[11px] leading-relaxed text-slate-400">
                  {t('comprovante.processado', { data: f.dataHora(new Date()) })}
                </p>
                {urlOperadora && (
                  <a
                    href={urlOperadora}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="print:hidden inline-flex items-center gap-1.5 text-sm font-semibold text-marinho hover:text-turquesa-escuro"
                  >
                    <FileText className="h-4 w-4" /> {t('comprovante.operadora')} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      <div className="print:hidden"><Footer /></div>
    </div>
  );
}

/* ── Peças ───────────────────────────────────────────────────────────────── */

function Info({ icone: Icone, rotulo, children }: { icone: React.ElementType; rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{rotulo}</dt>
        <dd className="text-slate-700">{children}</dd>
      </div>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  const f = useFormatos();
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{rotulo}</span>
      <span className="text-slate-700 tabular-nums">{f.moedaCentavos(valor)}</span>
    </div>
  );
}

function LinhaRecibo({ rotulo, valor, mono = false, icone: Icone }: { rotulo: string; valor: string; mono?: boolean; icone?: React.ElementType }) {
  return (
    <div className="flex flex-col border-b border-slate-100 pb-2.5">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{rotulo}</dt>
      <dd className={`mt-0.5 flex items-center gap-1.5 text-slate-700 break-all ${mono ? 'font-mono text-xs' : ''}`}>
        {Icone && <Icone className="h-4 w-4 shrink-0 text-slate-400" />}
        {valor}
      </dd>
    </div>
  );
}

function SeloPedido({ status }: { status: PedidoStatus }) {
  const t = useTranslations('DetalheReserva.selo');
  const selo: Partial<Record<PedidoStatus, { texto: string; classe: string; Icone: React.ElementType }>> = {
    pago: { texto: t('pago'), classe: 'bg-emerald-100 text-emerald-700', Icone: BadgeCheck },
    reembolsado: { texto: t('reembolsado'), classe: 'bg-sky-100 text-sky-700', Icone: RotateCcw },
    reembolsado_parcial: { texto: t('reembolsado_parcial'), classe: 'bg-sky-100 text-sky-700', Icone: RotateCcw },
    em_disputa: { texto: t('em_disputa'), classe: 'bg-amber-100 text-amber-700', Icone: Hourglass },
  };
  const s = selo[status];
  if (!s) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${s.classe}`}>
      <s.Icone className="h-3.5 w-3.5" /> {s.texto}
    </span>
  );
}

/** Situação do pagamento com a próxima ação para o cliente. */
function StatusPagamento({
  r, pedido, pagamento,
}: {
  r: ReservaDetalhe;
  pedido: PedidoDetalhe | null;
  pagamento: PagamentoDetalhe | null;
}) {
  const caixa = 'mt-3 rounded-xl border p-3.5 text-sm';
  const t = useTranslations('DetalheReserva.statusPagamento');
  const tMR = useTranslations('MinhasReservas');
  const tPag = useTranslations('Pagamento');
  const f = useFormatos();

  if (!pedido) {
    if (r.status === 'pendente') {
      return (
        <div className={`${caixa} border-slate-200 bg-slate-50 text-slate-600`}>
          {t('pendente')}
        </div>
      );
    }
    if (r.status === 'confirmada' || r.status === 'concluida') {
      return (
        <div className={`${caixa} border-slate-200 bg-slate-50 text-slate-600`}>
          {t('semOnline')}
        </div>
      );
    }
    return <div className={`${caixa} border-slate-200 bg-slate-50 text-slate-500`}>{t('nenhum')}</div>;
  }

  switch (pedido.status) {
    case 'aguardando_pagamento':
      return (
        <div className={`${caixa} border-violet-200 bg-violet-50 text-violet-800`}>
          <p className="font-semibold flex items-center gap-1.5"><CreditCard className="h-4 w-4" /> {t('aguardando')}</p>
          {pedido.expira_em && <p className="mt-0.5 text-xs text-violet-700">{tMR('pagueAte', { data: f.dataHora(pedido.expira_em) })}</p>}
          <Link
            href={`/reservas/${r.id}/pagar`}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-marinho hover:bg-marinho-escuro px-4 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            {tMR('pagar', { valor: f.moedaCentavos(Number(pedido.valor_total)) })}
          </Link>
        </div>
      );
    case 'pago':
    case 'reembolsado':
    case 'reembolsado_parcial':
    case 'em_disputa': {
      const reembolso = pedido.status === 'reembolsado' || pedido.status === 'reembolsado_parcial';
      return (
        <div className={`${caixa} ${reembolso ? 'border-sky-100 bg-sky-50 text-sky-800' : 'border-emerald-100 bg-emerald-50 text-emerald-800'}`}>
          <p className="font-semibold flex items-center gap-1.5">
            {reembolso ? <RotateCcw className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />}
            {pedido.status === 'reembolsado' ? t('reembolsado')
              : pedido.status === 'reembolsado_parcial' ? t('reembolsoParcial')
              : pedido.status === 'em_disputa' ? t('emContestacao')
              : t('aprovado')}
          </p>
          {pedido.pago_em && <p className="mt-0.5 text-xs opacity-80">{tPag('pagoEm', { data: f.dataHora(pedido.pago_em) })}</p>}
          {pagamento && (
            <a href="#comprovante" className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-current/20 bg-white px-4 py-2.5 text-sm font-semibold text-marinho hover:bg-slate-50 transition-colors">
              <Receipt className="h-4 w-4" /> {tPag('verComprovante')}
            </a>
          )}
          {!reembolso && pedido.status === 'pago' && (
            <p className="mt-2 text-[11px] text-emerald-700">{t('protegido')}</p>
          )}
        </div>
      );
    }
    case 'expirado':
      return (
        <div className={`${caixa} border-slate-200 bg-slate-50 text-slate-600`}>
          <p className="font-semibold flex items-center gap-1.5"><TimerOff className="h-4 w-4" /> {t('expirado')}</p>
          <p className="mt-0.5 text-xs">{t('expiradoTexto')}</p>
        </div>
      );
    case 'cancelado':
      return (
        <div className={`${caixa} border-slate-200 bg-slate-50 text-slate-600`}>
          <p className="font-semibold flex items-center gap-1.5"><X className="h-4 w-4" /> {t('cancelado')}</p>
          <p className="mt-0.5 text-xs">{t('nenhumCobrado')}</p>
        </div>
      );
    default:
      return null;
  }
}
