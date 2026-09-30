import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, MapPin, Ship, Users, CalendarDays, ShoppingCart, User, Mail,
  IdCard, Clock, MessageSquare, AlertTriangle, Wallet,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatCurrency, formatCurrencyPrecise } from '@/lib/utils';
import { getFinanceiroConfig } from '@/lib/financeiro/config';
import { expirarPedidosVencidosSemFalhar } from '@/lib/pagamentos/pedidos';
import { multiplicadorDaReserva } from '@/lib/pagamentos/valores';
import { formatarDataHoraBR } from '@/lib/termos/formato';
import type { PedidoStatus, ReservaStatus } from '@/types/supabase';
import { getDatasReservadasEmbarcacao, haConflitoReservaRoteiro } from '@/lib/reservas';
import { getAtendenteOptions, getAtendentesDaReserva, resolveEmbarcacaoIdDaReserva } from '@/lib/equipe';
import ReservaAcoes from './_components/ReservaAcoes';
import AdicionarAoCalendario from './_components/AdicionarAoCalendario';

type ReservaDetalhe = {
  id: string;
  tipo: 'roteiro' | 'embarcacao';
  roteiro_id: string | null;
  embarcacao_id: string | null;
  data_reserva: string;
  data_fim_reserva: string | null;
  modalidade_preco: 'roteiro' | 'diaria' | 'pessoa';
  quantidade_diarias: number | null;
  flexibilidade: number | null;
  quantidade_pessoas: number;
  item_nome: string;
  preco_base: number | null;
  total_adicionais: number;
  taxa_servico: number | null;
  taxa_percent: number | null;
  total_estimado: number | null;
  cupom_codigo: string | null;
  desconto_valor: number;
  status: ReservaStatus;
  observacao_gestor: string | null;
  solicitado_em: string;
  respondido_em: string | null;
  cliente: { name: string; email: string; cpf_cnpj: string | null; avatar_url: string | null } | null;
  roteiro: {
    nome: string;
    embarcacao_id: string | null;
    preco_pessoa_modo_capacidade: 'compartilhado' | 'exclusivo';
    preco_pessoa_capacidade_maxima: number | null;
    municipios: { nome: string; estados: { uf: string } | null } | null;
  } | null;
  embarcacao: { nome: string } | null;
  reserva_adicional: { id: string; descricao: string; valor: number; tipo: string }[];
  pedido: PedidoResumo | PedidoResumo[] | null;
};

type PedidoResumo = {
  numero: number;
  status: PedidoStatus;
  expira_em: string | null;
  pago_em: string | null;
  valor_total: number;
  valor_itens: number;
};

const PEDIDO_STATUS: Record<PedidoStatus, { label: string; badge: string }> = {
  aguardando_pagamento: { label: 'Aguardando pagamento', badge: 'bg-violet-100 text-violet-700' },
  pago: { label: 'Pago', badge: 'bg-emerald-100 text-emerald-700' },
  expirado: { label: 'Expirado', badge: 'bg-slate-100 text-slate-500' },
  cancelado: { label: 'Cancelado', badge: 'bg-slate-100 text-slate-500' },
  reembolsado: { label: 'Reembolsado', badge: 'bg-amber-100 text-amber-700' },
  reembolsado_parcial: { label: 'Reembolsado parcialmente', badge: 'bg-amber-100 text-amber-700' },
  em_disputa: { label: 'Em disputa', badge: 'bg-red-100 text-red-600' },
};

const MODALIDADE = {
  roteiro: { label: 'Roteiro (diária única)', badge: 'bg-slate-100 text-slate-600' },
  diaria:  { label: 'Por Diária',              badge: 'bg-sky-100 text-sky-700' },
  pessoa:  { label: 'Por Pessoa',              badge: 'bg-violet-100 text-violet-700' },
} as const;

const STATUS: Record<ReservaStatus, { label: string; badge: string }> = {
  pendente: { label: 'Pendente', badge: 'bg-amber-100 text-amber-700' },
  aguardando_pagamento: { label: 'Aguardando pagamento', badge: 'bg-violet-100 text-violet-700' },
  expirada: { label: 'Pagamento expirado', badge: 'bg-slate-100 text-slate-500' },
  confirmada: { label: 'Confirmada', badge: 'bg-emerald-100 text-emerald-700' },
  recusada: { label: 'Recusada', badge: 'bg-red-100 text-red-600' },
  cancelada: { label: 'Cancelada pelo cliente', badge: 'bg-slate-200 text-slate-600' },
  concluida: { label: 'Concluída', badge: 'bg-sky-100 text-sky-700' },
};

function formatData(iso: string, flex: number | null): string {
  const label = new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  return flex && flex > 0 ? `${label} (± ${flex} dia${flex > 1 ? 's' : ''})` : label;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default async function ReservaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  // Transição lazy: pedidos com prazo de pagamento vencido expiram e liberam a data.
  await expirarPedidosVencidosSemFalhar();

  const { data } = await supabaseAdmin
    .from('reserva')
    .select(
      `id, tipo, roteiro_id, embarcacao_id, data_reserva, data_fim_reserva, modalidade_preco,
       quantidade_diarias, flexibilidade, quantidade_pessoas, item_nome,
       preco_base, total_adicionais, taxa_servico, taxa_percent, total_estimado, cupom_codigo, desconto_valor,
       status, observacao_gestor, solicitado_em, respondido_em,
       cliente:users!reserva_cliente_id_fkey ( name, email, cpf_cnpj, avatar_url ),
       roteiro ( nome, embarcacao_id, preco_pessoa_modo_capacidade, preco_pessoa_capacidade_maxima, municipios ( nome, estados ( uf ) ) ),
       embarcacao ( nome ),
       reserva_adicional ( id, descricao, valor, tipo ),
       pedido ( numero, status, expira_em, pago_em, valor_total, valor_itens )`,
    )
    .eq('id', id)
    .eq('owner_id', user.id)
    .single();

  if (!data) notFound();

  const r = data as unknown as ReservaDetalhe;
  const s = STATUS[r.status];
  const pedido = Array.isArray(r.pedido) ? (r.pedido[0] ?? null) : r.pedido;

  let exigirPagamento = false;
  let horasPrazoPagamento = 24;
  try {
    const cfg = await getFinanceiroConfig();
    exigirPagamento = cfg.exigir_pagamento;
    horasPrazoPagamento = cfg.horas_prazo_pagamento;
  } catch {
    // migration financeira ainda não aplicada → fluxo sem cobrança
  }

  // Pendente cuja data já foi tomada por outra reserva confirmada (mesma
  // embarcação ou mesmo roteiro) — aviso visual; a ação de recusar continua
  // manual, o gestor decide.
  let temConflito = false;
  if (r.status === 'pendente') {
    temConflito =
      r.tipo === 'embarcacao'
        ? (await getDatasReservadasEmbarcacao(r.embarcacao_id!)).includes(r.data_reserva)
        : await haConflitoReservaRoteiro({
            roteiroId: r.roteiro_id!,
            embarcacaoId: r.roteiro?.embarcacao_id ?? null,
            pessoaModoCapacidade: r.roteiro?.preco_pessoa_modo_capacidade ?? 'exclusivo',
            pessoaCapacidadeMaxima: r.roteiro?.preco_pessoa_capacidade_maxima ?? null,
            modalidadePreco: r.modalidade_preco,
            dataReserva: r.data_reserva,
            dataFimReserva: r.data_fim_reserva,
            quantidadePessoas: r.quantidade_pessoas,
          });
  }
  // Equipe: opções de atendente (gestor + membros vinculados à embarcação) e
  // quem já está indicado nesta reserva.
  const embarcacaoIdReserva = resolveEmbarcacaoIdDaReserva({
    tipo: r.tipo,
    embarcacao_id: r.embarcacao_id,
    roteiro: r.roteiro ? { embarcacao_id: r.roteiro.embarcacao_id } : null,
  });
  const [atendenteOptions, atendentesAtuais] = await Promise.all([
    getAtendenteOptions(user.id, embarcacaoIdReserva),
    getAtendentesDaReserva(id),
  ]);
  const atendentesAtuaisIds = atendentesAtuais.map((a) => a.id);

  const TipoIcon = r.tipo === 'embarcacao' ? Ship : MapPin;
  const localidade = r.roteiro?.municipios
    ? r.roteiro.municipios.estados
      ? `${r.roteiro.municipios.nome}, ${r.roteiro.municipios.estados.uf}`
      : r.roteiro.municipios.nome
    : null;

  // Dados para o lembrete no Google Calendar (evento de dia inteiro).
  const itemNome = r.roteiro?.nome ?? r.item_nome;
  const clienteNome = r.cliente?.name ?? 'Cliente';
  const tituloEvento = `${itemNome} — ${clienteNome}`;
  const detalhesEvento = [
    r.tipo === 'embarcacao' ? 'Reserva de embarcação · Boatzy' : 'Reserva de roteiro · Boatzy',
    '',
    `Cliente: ${clienteNome}${r.cliente?.email ? ` (${r.cliente.email})` : ''}`,
    `Pessoas: ${r.quantidade_pessoas}`,
    r.embarcacao ? `Embarcação: ${r.embarcacao.nome}` : null,
    r.reserva_adicional.length > 0
      ? `Adicionais: ${r.reserva_adicional.map((a) => a.descricao).join(', ')}`
      : null,
    atendentesAtuais.length > 0
      ? `Atende: ${atendentesAtuais.map((a) => (a.is_gestor ? 'Você (gestor)' : a.nome_completo)).join(', ')}`
      : null,
    r.total_estimado != null ? `Total estimado: ${formatCurrency(r.total_estimado)}` : null,
  ]
    .filter((l) => l !== null)
    .join('\n');

  return (
    <div className="p-8 max-w-4xl">
      <Link
        href="/painel/agendamentos"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0B2447] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao calendário
      </Link>

      {/* Header */}
      <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <TipoIcon className="h-3.5 w-3.5" />
            {r.tipo === 'embarcacao' ? 'Reserva de embarcação' : 'Reserva de roteiro'}
            {r.tipo === 'roteiro' && (
              <span className={`normal-case rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-normal ${MODALIDADE[r.modalidade_preco].badge}`}>
                {MODALIDADE[r.modalidade_preco].label}
              </span>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#0B2447]">{r.roteiro?.nome ?? r.item_nome}</h1>
          {localidade && (
            <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <MapPin className="h-4 w-4" /> {localidade}
            </div>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${s.badge}`}>{s.label}</span>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-5">
          {/* Cliente */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="text-sm font-bold text-[#0B2447] mb-4">Cliente</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2.5 text-slate-700">
                <User className="h-4 w-4 text-slate-400 shrink-0" />
                {r.cliente?.name ?? '—'}
              </div>
              <div className="flex items-center gap-2.5 text-slate-700">
                <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                {r.cliente?.email ?? '—'}
              </div>
              {r.cliente?.cpf_cnpj && (
                <div className="flex items-center gap-2.5 text-slate-700">
                  <IdCard className="h-4 w-4 text-slate-400 shrink-0" />
                  {r.cliente.cpf_cnpj}
                </div>
              )}
            </div>
          </section>

          {/* Pedido */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="text-sm font-bold text-[#0B2447] mb-4">Detalhes do pedido</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-2.5">
                <CalendarDays className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                    {r.modalidade_preco === 'diaria' ? 'Período' : 'Data'}
                  </p>
                  {r.modalidade_preco === 'diaria' && r.data_fim_reserva ? (
                    <p className="text-slate-700 capitalize">
                      {formatData(r.data_reserva, null)} → {formatData(r.data_fim_reserva, null)}
                      {r.quantidade_diarias && (
                        <span className="text-slate-400"> · {r.quantidade_diarias} diária{r.quantidade_diarias > 1 ? 's' : ''}</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-slate-700 capitalize">{formatData(r.data_reserva, r.flexibilidade)}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Users className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Pessoas</p>
                  <p className="text-slate-700">{r.quantidade_pessoas}</p>
                </div>
              </div>
              {r.embarcacao && (
                <div className="flex items-start gap-2.5">
                  <Ship className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Embarcação</p>
                    <p className="text-slate-700">{r.embarcacao.nome}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2.5">
                <Clock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Solicitada em</p>
                  <p className="text-slate-700">{formatDateTime(r.solicitado_em)}</p>
                </div>
              </div>
            </div>

            {/* Adicionais */}
            {r.reserva_adicional.length > 0 && (
              <div className="mt-5 rounded-xl bg-slate-50 border border-slate-100 p-3.5">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <ShoppingCart className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-600">Adicionais</span>
                </div>
                <div className="space-y-1.5">
                  {r.reserva_adicional.map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">
                        {a.descricao}
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-slate-400">{a.tipo}</span>
                      </span>
                      <span className="font-medium text-slate-700">{formatCurrency(a.valor)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Observação já registrada */}
          {r.observacao_gestor && (
            <section className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
              <div className="flex items-center gap-1.5 mb-2">
                <MessageSquare className="h-4 w-4 text-indigo-500" />
                <span className="text-sm font-semibold text-indigo-700">Observação enviada ao cliente</span>
              </div>
              <p className="text-sm text-slate-600">{r.observacao_gestor}</p>
              {r.respondido_em && (
                <p className="mt-2 text-xs text-slate-400">Respondida em {formatDateTime(r.respondido_em)}</p>
              )}
            </section>
          )}
        </div>

        {/* Sidebar: valores + ações */}
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="text-sm font-bold text-[#0B2447] mb-4">Valores</h2>
            {r.preco_base != null ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">
                    {r.modalidade_preco === 'diaria' && r.quantidade_diarias
                      ? `Diária (${formatCurrency(r.preco_base)} × ${r.quantidade_diarias})`
                      : r.modalidade_preco === 'pessoa'
                        ? `Pessoa (${formatCurrency(r.preco_base)} × ${r.quantidade_pessoas})`
                        : 'Diária'}
                  </span>
                  <span className="font-medium text-slate-700">
                    {formatCurrency(
                      r.preco_base *
                        (r.modalidade_preco === 'diaria' ? r.quantidade_diarias ?? 1
                          : r.modalidade_preco === 'pessoa' ? r.quantidade_pessoas
                          : 1),
                    )}
                  </span>
                </div>
                {r.total_adicionais > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Adicionais</span>
                    <span className="font-medium text-slate-700">{formatCurrency(r.total_adicionais)}</span>
                  </div>
                )}
                {r.taxa_servico != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">
                      Taxa de serviço
                      {r.taxa_percent != null &&
                        ` (${r.taxa_percent.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%)`}
                    </span>
                    <span className="font-medium text-slate-700">{formatCurrency(r.taxa_servico)}</span>
                  </div>
                )}
                {r.desconto_valor > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-600">
                      Desconto{r.cupom_codigo ? ` (${r.cupom_codigo})` : ''}
                    </span>
                    <span className="font-medium text-emerald-600">-{formatCurrency(r.desconto_valor)}</span>
                  </div>
                )}
                {r.total_estimado != null && (
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-1">
                    <span className="font-bold text-[#0B2447]">Total estimado</span>
                    <span className="text-lg font-bold text-[#0B2447]">{formatCurrency(r.total_estimado)}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Preço a combinar.</p>
            )}
          </section>

          {temConflito && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Esta data já tem outra reserva confirmada (ou aguardando pagamento) para
                {r.tipo === 'embarcacao' ? ' esta embarcação' : ' este roteiro (ou a embarcação vinculada a ele)'}.
                Confirmar esta solicitação vai falhar — considere recusá-la.
              </p>
            </div>
          )}

          {pedido && (
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#0B2447]">
                  <Wallet className="h-4 w-4" /> Pagamento
                </h2>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${PEDIDO_STATUS[pedido.status].badge}`}>
                  {PEDIDO_STATUS[pedido.status].label}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Pedido</span>
                  <span className="font-medium text-slate-700">#{pedido.numero}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Cliente paga</span>
                  <span className="font-medium text-slate-700">{formatCurrencyPrecise(Number(pedido.valor_total))}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Você recebe</span>
                  <span className="font-bold text-emerald-700">{formatCurrencyPrecise(Number(pedido.valor_itens))}</span>
                </div>
                {pedido.status === 'aguardando_pagamento' && pedido.expira_em && (
                  <p className="pt-2 text-xs text-slate-500">
                    O cliente tem até <strong>{formatarDataHoraBR(pedido.expira_em)}</strong> para pagar. A data fica reservada até lá.
                  </p>
                )}
                {pedido.pago_em && (
                  <p className="pt-2 text-xs text-slate-500">Pago em {formatarDataHoraBR(pedido.pago_em)}.</p>
                )}
                {pedido.status === 'pago' && (
                  <p className="text-xs text-slate-400">
                    O repasse do seu valor é feito após o passeio, depois que você confirmar que ele foi realizado.
                  </p>
                )}
              </div>
            </section>
          )}

          <ReservaAcoes
            reservaId={r.id}
            status={r.status}
            atendenteOptions={atendenteOptions}
            atendentesAtuais={atendentesAtuaisIds}
            aceite={{
              exigirPagamento,
              horasPrazoPagamento,
              precoBase: r.preco_base != null ? Number(r.preco_base) : null,
              modalidade: r.modalidade_preco,
              multiplicador: multiplicadorDaReserva(r),
              totalAdicionais: Number(r.total_adicionais),
              taxaPercent: r.taxa_percent != null ? Number(r.taxa_percent) : null,
              descontoValor: Number(r.desconto_valor),
            }}
          />

          <AdicionarAoCalendario
            titulo={tituloEvento}
            dataReserva={r.data_reserva}
            detalhes={detalhesEvento}
            local={localidade}
          />
        </div>
      </div>
    </div>
  );
}
