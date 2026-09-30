import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  MapPin, Ship, Users, CalendarDays, ShoppingCart, Clock, MessageSquare,
  MessageCircle, Hourglass, CheckCircle2, XCircle, Compass, Ban, Flag,
  User, Crown, Phone, CreditCard, TimerOff, BadgeCheck,
} from 'lucide-react';
import { applyPhoneMask, onlyDigits } from '@/lib/validators';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { concluirReservasVencidas } from '@/lib/reservas';
import { expirarPedidosVencidosSemFalhar } from '@/lib/pagamentos/pedidos';
import { formatarDataHoraBR } from '@/lib/termos/formato';
import { formatCurrency } from '@/lib/utils';
import type { ReservaStatus, AvaliacaoStatus, PedidoStatus } from '@/types/supabase';
import CancelarReservaButton from './_components/CancelarReservaButton';
import AvaliacaoReserva from './_components/AvaliacaoReserva';
import { FUSO_HORARIO } from '@/lib/datas';

type AvaliacaoResumo = { nota: number; comentario: string | null; created_at: string; status: AvaliacaoStatus };

type ReservaCliente = {
  id: string;
  owner_id: string;
  tipo: 'roteiro' | 'embarcacao';
  data_reserva: string;
  flexibilidade: number | null;
  quantidade_pessoas: number;
  roteiro_id: string | null;
  item_nome: string;
  preco_base: number | null;
  total_adicionais: number;
  taxa_servico: number | null;
  total_estimado: number | null;
  cupom_codigo: string | null;
  desconto_valor: number;
  status: ReservaStatus;
  observacao_gestor: string | null;
  solicitado_em: string;
  respondido_em: string | null;
  cancelada_em: string | null;
  roteiro: {
    nome: string;
    municipios: { nome: string; estados: { uf: string } | null } | null;
    roteiro_imagens: { url_imagem: string; principal: boolean }[];
  } | null;
  embarcacao: { nome: string } | null;
  reserva_adicional: { id: string; descricao: string; valor: number; tipo: string }[];
  reserva_atendente: {
    equipe_membro: {
      nome_completo: string;
      foto_url: string | null;
      telefone: string | null;
      is_gestor: boolean;
    } | null;
  }[];
  avaliacao: AvaliacaoResumo | AvaliacaoResumo[] | null;
  pagamento_exigido: boolean;
  pedido: PedidoCliente | PedidoCliente[] | null;
};

type PedidoCliente = { numero: number; status: PedidoStatus; expira_em: string | null; pago_em: string | null; valor_total: number };

const STATUS: Record<
  ReservaStatus,
  { label: string; badge: string; Icon: React.ElementType; note: string; noteClass: string }
> = {
  pendente: {
    label: 'Aguardando confirmação',
    badge: 'bg-amber-100 text-amber-700',
    Icon: Hourglass,
    note: 'Sua solicitação foi enviada. O gestor irá analisar e responder em breve.',
    noteClass: 'bg-amber-50 border-amber-100 text-amber-700',
  },
  aguardando_pagamento: {
    label: 'Aguardando pagamento',
    badge: 'bg-violet-100 text-violet-700',
    Icon: CreditCard,
    note: 'O gestor aceitou sua solicitação. Conclua o pagamento para garantir a data.',
    noteClass: 'bg-violet-50 border-violet-100 text-violet-700',
  },
  expirada: {
    label: 'Pagamento expirado',
    badge: 'bg-slate-200 text-slate-600',
    Icon: TimerOff,
    note: 'O prazo para pagamento terminou e a solicitação expirou. Nenhum valor foi cobrado.',
    noteClass: 'bg-slate-50 border-slate-200 text-slate-500',
  },
  confirmada: {
    label: 'Confirmada',
    badge: 'bg-emerald-100 text-emerald-700',
    Icon: CheckCircle2,
    note: 'Reserva confirmada pelo gestor.',
    noteClass: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  },
  recusada: {
    label: 'Recusada',
    badge: 'bg-red-100 text-red-600',
    Icon: XCircle,
    note: 'Esta solicitação foi recusada pelo gestor.',
    noteClass: 'bg-red-50 border-red-100 text-red-600',
  },
  cancelada: {
    label: 'Cancelada',
    badge: 'bg-slate-200 text-slate-600',
    Icon: Ban,
    note: 'Você cancelou esta reserva.',
    noteClass: 'bg-slate-50 border-slate-200 text-slate-500',
  },
  concluida: {
    label: 'Concluída',
    badge: 'bg-sky-100 text-sky-700',
    Icon: Flag,
    note: 'Experiência realizada. Conte como foi — sua avaliação ajuda outros clientes!',
    noteClass: 'bg-sky-50 border-sky-100 text-sky-700',
  },
};

function formatData(iso: string, flex: number | null): string {
  const label = new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { timeZone: FUSO_HORARIO, 
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  return flex && flex > 0 ? `${label} (± ${flex} dia${flex > 1 ? 's' : ''})` : label;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: FUSO_HORARIO, 
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatTelefone(digits: string | null): string | null {
  if (!digits) return null;
  const d = onlyDigits(digits);
  if (d.length < 10) return null;
  return applyPhoneMask(d, d.length > 10 ? '(##) #####-####' : '(##) ####-####');
}

function thumb(r: ReservaCliente): string | null {
  const imgs = r.roteiro?.roteiro_imagens ?? [];
  return (imgs.find((i) => i.principal) ?? imgs[0])?.url_imagem ?? null;
}

export default async function MinhasReservasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/entrar?redirect_to=/minhas-reservas');

  // Transições lazy antes de listar: pagamento vencido → expirada; confirmada com data passada → concluída.
  await expirarPedidosVencidosSemFalhar();
  await concluirReservasVencidas();

  const { data } = await supabaseAdmin
    .from('reserva')
    .select(
      `id, owner_id, tipo, data_reserva, flexibilidade, quantidade_pessoas, roteiro_id, item_nome,
       preco_base, total_adicionais, taxa_servico, total_estimado, cupom_codigo, desconto_valor,
       status, observacao_gestor, solicitado_em, respondido_em, cancelada_em, pagamento_exigido,
       pedido ( numero, status, expira_em, pago_em, valor_total ),
       roteiro ( nome, municipios ( nome, estados ( uf ) ), roteiro_imagens ( url_imagem, principal ) ),
       embarcacao ( nome ),
       reserva_adicional ( id, descricao, valor, tipo ),
       reserva_atendente ( equipe_membro ( nome_completo, foto_url, telefone, is_gestor ) ),
       avaliacao ( nota, comentario, created_at, status )`,
    )
    .eq('cliente_id', user.id)
    .order('solicitado_em', { ascending: false });

  const reservas = (data ?? []) as unknown as ReservaCliente[];

  // Mensagens de chat não lidas por gestor (enviadas pelo gestor ao cliente).
  const { data: naoLidasRows } = await supabaseAdmin.rpc('chat_nao_lidas_por_gestor', {
    p_cliente: user.id,
  });
  const naoLidasPorGestor = new Map<string, number>(
    (naoLidasRows ?? []).map((r) => [r.gestor_id, Number(r.total)]),
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-[#0B2447]">Minhas reservas</h1>
        <p className="text-sm text-slate-500 mt-1">
          Acompanhe o status das suas solicitações e a resposta do gestor.
        </p>

        {reservas.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white p-12 flex flex-col items-center text-center">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Compass className="h-7 w-7 text-slate-300" />
            </div>
            <h2 className="text-lg font-semibold text-slate-700">Você ainda não tem reservas</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-sm">
              Explore os roteiros disponíveis e faça sua primeira solicitação.
            </p>
            <Link
              href="/buscar"
              className="mt-6 px-5 py-2.5 bg-[#0B3D91] hover:bg-[#0B2447] text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Explorar roteiros
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {reservas.map((r) => {
              const s = STATUS[r.status];
              const TipoIcon = r.tipo === 'embarcacao' ? Ship : MapPin;
              const localidade = r.roteiro?.municipios
                ? r.roteiro.municipios.estados
                  ? `${r.roteiro.municipios.nome}, ${r.roteiro.municipios.estados.uf}`
                  : r.roteiro.municipios.nome
                : null;
              const img = thumb(r);
              const naoLidas = naoLidasPorGestor.get(r.owner_id) ?? 0;
              // Conta que acumula as roles cliente+gestor não conversa consigo
              // mesma (o chat recusa gestor_id = cliente_id → 404).
              const chatIndisponivel = r.owner_id === user.id;
              // Embed 1:1 pode vir como objeto ou array conforme a detecção do PostgREST.
              const avaliacao = Array.isArray(r.avaliacao) ? (r.avaliacao[0] ?? null) : r.avaliacao;
              const pedido = Array.isArray(r.pedido) ? (r.pedido[0] ?? null) : r.pedido;
              const podeCancelar =
                r.status === 'pendente' ||
                r.status === 'aguardando_pagamento' ||
                (r.status === 'confirmada' && !r.pagamento_exigido);
              const atendentes = (r.reserva_atendente ?? [])
                .map((a) => a.equipe_membro)
                .filter((m): m is NonNullable<typeof m> => m != null)
                .sort((a, b) => Number(b.is_gestor) - Number(a.is_gestor));
              const mostrarAtendentes =
                (r.status === 'confirmada' || r.status === 'concluida') && atendentes.length > 0;

              return (
                <article key={r.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  {/* Topo: imagem + título + status */}
                  <div className="flex items-stretch gap-4 p-4 border-b border-slate-100">
                    <div className="relative h-20 w-28 shrink-0 rounded-xl overflow-hidden bg-slate-100 hidden sm:block">
                      {img ? (
                        <Image src={img} alt={r.item_nome} fill className="object-cover" sizes="112px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <TipoIcon className="h-6 w-6 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            <TipoIcon className="h-3 w-3" />
                            {r.tipo === 'embarcacao' ? 'Embarcação' : 'Roteiro'}
                          </div>
                          <h2 className="mt-0.5 text-base font-bold text-[#0B2447] truncate">
                            {r.roteiro?.nome ?? r.item_nome}
                          </h2>
                          {localidade && (
                            <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                              <MapPin className="h-3 w-3 shrink-0" /> {localidade}
                            </div>
                          )}
                        </div>
                        <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${s.badge}`}>
                          <s.Icon className="h-3.5 w-3.5" />
                          {s.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Corpo: dados do pedido */}
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <CalendarDays className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="capitalize">{formatData(r.data_reserva, r.flexibilidade)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Users className="h-4 w-4 text-slate-400 shrink-0" />
                      {r.quantidade_pessoas} {r.quantidade_pessoas === 1 ? 'pessoa' : 'pessoas'}
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <Clock className="h-4 w-4 shrink-0" />
                      <span className="text-xs">Solicitada em {formatDateTime(r.solicitado_em)}</span>
                    </div>
                  </div>

                  {/* Adicionais */}
                  {r.reserva_adicional.length > 0 && (
                    <div className="px-4 pb-4">
                      <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                        <div className="flex items-center gap-1.5 mb-2">
                          <ShoppingCart className="h-3.5 w-3.5 text-slate-500" />
                          <span className="text-xs font-semibold text-slate-600">Adicionais</span>
                        </div>
                        <div className="space-y-1">
                          {r.reserva_adicional.map((a) => (
                            <div key={a.id} className="flex items-center justify-between text-xs text-slate-600">
                              <span>{a.descricao}</span>
                              <span className="font-medium">{formatCurrency(a.valor)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Desconto (cupom) */}
                  {r.desconto_valor > 0 && (
                    <div className="px-4 pb-2 flex items-center justify-between">
                      <span className="text-sm text-emerald-600">
                        Desconto{r.cupom_codigo ? ` (${r.cupom_codigo})` : ''}
                      </span>
                      <span className="text-sm font-medium text-emerald-600">-{formatCurrency(r.desconto_valor)}</span>
                    </div>
                  )}

                  {/* Total */}
                  {r.total_estimado != null && (
                    <div className="px-4 pb-4 flex items-center justify-between">
                      <span className="text-sm text-slate-500">Total estimado</span>
                      <span className="text-base font-bold text-[#0B2447]">{formatCurrency(r.total_estimado)}</span>
                    </div>
                  )}

                  {/* Pagamento pelo Boatzy */}
                  {r.status === 'aguardando_pagamento' && pedido?.status === 'aguardando_pagamento' && (
                    <div className="px-4 pb-4">
                      <div className="rounded-xl border border-violet-200 bg-violet-50 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-sm text-violet-800">
                          <p className="font-semibold">Pagamento pendente · Pedido #{pedido.numero}</p>
                          {pedido.expira_em && (
                            <p className="text-xs text-violet-700 mt-0.5">
                              Pague até {formatarDataHoraBR(pedido.expira_em)} para garantir a data.
                            </p>
                          )}
                        </div>
                        <Link
                          href={`/reservas/${r.id}/pagar`}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0B3D91] hover:bg-[#0B2447] px-4 py-2.5 text-sm font-semibold text-white transition-colors whitespace-nowrap"
                        >
                          <CreditCard className="h-4 w-4" />
                          Pagar {formatCurrency(Number(pedido.valor_total))}
                        </Link>
                      </div>
                    </div>
                  )}
                  {pedido?.status === 'pago' && (
                    <div className="px-4 pb-4">
                      <div className="flex items-center gap-2 text-xs text-emerald-700">
                        <BadgeCheck className="h-4 w-4" />
                        Pagamento confirmado · Pedido #{pedido.numero}
                        {pedido.pago_em && ` · ${formatarDataHoraBR(pedido.pago_em)}`}
                      </div>
                    </div>
                  )}

                  {/* Resposta do gestor */}
                  <div className="px-4 pb-4">
                    {r.observacao_gestor ? (
                      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <MessageSquare className="h-4 w-4 text-indigo-500" />
                          <span className="text-sm font-semibold text-indigo-700">Resposta do gestor</span>
                        </div>
                        <p className="text-sm text-slate-600">{r.observacao_gestor}</p>
                        {r.respondido_em && (
                          <p className="mt-2 text-xs text-slate-400">Respondida em {formatDateTime(r.respondido_em)}</p>
                        )}
                      </div>
                    ) : (
                      <div className={`rounded-xl border p-3 text-xs font-medium ${s.noteClass}`}>{s.note}</div>
                    )}
                  </div>

                  {/* Quem vai te atender */}
                  {mostrarAtendentes && (
                    <div className="px-4 pb-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <Users className="h-4 w-4 text-[#0B3D91]" />
                          <span className="text-sm font-semibold text-[#0B2447]">Quem vai te atender</span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {atendentes.map((m, i) => {
                            const tel = formatTelefone(m.telefone);
                            return (
                              <div key={i} className="flex items-center gap-2.5">
                                <span className="w-9 h-9 rounded-full overflow-hidden bg-white border border-slate-200 shrink-0 flex items-center justify-center">
                                  {m.foto_url ? (
                                    <Image
                                      src={m.foto_url}
                                      alt={m.nome_completo}
                                      width={36}
                                      height={36}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <User className="w-4 h-4 text-slate-300" />
                                  )}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm text-slate-700 flex items-center gap-1">
                                    {m.is_gestor && <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                                    {m.is_gestor ? 'Gestor da embarcação' : m.nome_completo}
                                  </p>
                                  {tel && (
                                    <p className="text-xs text-slate-400 flex items-center gap-1">
                                      <Phone className="h-3 w-3" /> {tel}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Avaliação (reserva concluída) */}
                  {r.status === 'concluida' && (
                    <div className="px-4 pb-4">
                      <AvaliacaoReserva reservaId={r.id} avaliacao={avaliacao} />
                    </div>
                  )}

                  {/* Ações: conversar com o gestor + cancelar + ver roteiro */}
                  <div className="border-t border-slate-100 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                    {chatIndisponivel ? (
                      <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-300">
                        <MessageCircle className="h-4 w-4" />
                        Conversar com o gestor
                      </span>
                    ) : (
                      <Link
                        href={`/minhas-reservas/${r.id}/chat`}
                        className="inline-flex items-center gap-2 text-sm font-medium text-[#0B3D91] hover:text-[#0B2447] transition-colors"
                      >
                        <span className="relative inline-flex">
                          <MessageCircle className="h-4 w-4" />
                          {naoLidas > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
                              {naoLidas > 99 ? '99+' : naoLidas}
                            </span>
                          )}
                        </span>
                        Conversar com o gestor
                      </Link>
                    )}
                    <div className="flex items-center gap-4">
                      {podeCancelar && <CancelarReservaButton reservaId={r.id} />}
                      {r.roteiro_id && (
                        <Link
                          href={`/roteiros/${r.roteiro_id}`}
                          className="text-sm font-medium text-[#0B3D91] hover:text-[#0B2447] transition-colors"
                        >
                          Ver roteiro →
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
