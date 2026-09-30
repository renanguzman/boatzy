import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, Users, MapPin, Ship, BadgeCheck, TimerOff, Receipt } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatCurrencyPrecise } from '@/lib/utils';
import { isValidCPF } from '@/lib/validators';
import { lerAsaasConfig } from '@/lib/asaas/config';
import { getFormasPagamento } from '@/lib/financeiro/config';
import { expirarPedidosVencidosSemFalhar, PAGAMENTO_PAGO } from '@/lib/pagamentos/pedidos';
import { opcoesParcelas } from '@/lib/pagamentos/valores';
import { retomarPixPendente } from '@/lib/pagamentos/checkout';
import { formatarDataHoraBR } from '@/lib/termos/formato';
import type { FormaPagamentoCodigo, PedidoStatus } from '@/types/supabase';
import CheckoutPagamento, { type FormaCheckout, type Pix } from './_components/CheckoutPagamento';

type PedidoPagar = {
  id: string;
  numero: number;
  status: PedidoStatus;
  expira_em: string | null;
  pago_em: string | null;
  valor_itens: number;
  comissao_percentual: number;
  valor_comissao: number;
  valor_desconto: number;
  valor_total: number;
  pedido_desconto: { cupom_codigo: string | null; valor: number }[];
};

type ReservaPagar = {
  id: string;
  tipo: 'roteiro' | 'embarcacao';
  item_nome: string;
  data_reserva: string;
  data_fim_reserva: string | null;
  quantidade_pessoas: number;
  roteiro: { nome: string; municipios: { nome: string; estados: { uf: string } | null } | null } | null;
  pedido: PedidoPagar | PedidoPagar[] | null;
};

function dataLonga(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

export default async function PagarReservaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ retorno?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?redirect_to=/reservas/${id}/pagar`);

  await expirarPedidosVencidosSemFalhar();

  const { data } = await supabaseAdmin
    .from('reserva')
    .select(
      `id, tipo, item_nome, data_reserva, data_fim_reserva, quantidade_pessoas,
       roteiro ( nome, municipios ( nome, estados ( uf ) ) ),
       pedido ( id, numero, status, expira_em, pago_em, valor_itens, comissao_percentual, valor_comissao,
                valor_desconto, valor_total, pedido_desconto ( cupom_codigo, valor ) )`,
    )
    .eq('id', id)
    .eq('cliente_id', user.id)
    .maybeSingle();
  if (!data) notFound();

  const reserva = data as unknown as ReservaPagar;
  const pedido = Array.isArray(reserva.pedido) ? (reserva.pedido[0] ?? null) : reserva.pedido;
  const TipoIcon = reserva.tipo === 'embarcacao' ? Ship : MapPin;
  const localidade = reserva.roteiro?.municipios
    ? `${reserva.roteiro.municipios.nome}${reserva.roteiro.municipios.estados ? `, ${reserva.roteiro.municipios.estados.uf}` : ''}`
    : null;
  const cupom = pedido?.pedido_desconto.find((d) => d.cupom_codigo)?.cupom_codigo ?? null;

  // Pagamento concluído (comprovante + cartão mascarado).
  let pago: { comprovante: string | null; forma: FormaPagamentoCodigo; cartao: string | null } | null = null;
  if (pedido && pedido.status !== 'aguardando_pagamento') {
    const { data: pg } = await supabaseAdmin
      .from('pagamento')
      .select('forma_pagamento, comprovante_url, fatura_url, pagamento_cartao ( bandeira, ultimos_digitos )')
      .eq('pedido_id', pedido.id)
      .in('status', [...PAGAMENTO_PAGO, 'estornado', 'estornado_parcial', 'em_disputa'])
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pg) {
      const c = Array.isArray(pg.pagamento_cartao) ? pg.pagamento_cartao[0] : pg.pagamento_cartao;
      pago = {
        comprovante: pg.comprovante_url ?? pg.fatura_url,
        forma: pg.forma_pagamento,
        cartao: c ? `${c.bandeira} final ${c.ultimos_digitos}` : null,
      };
    }
  }

  // Checkout: formas ativas, parcelas permitidas, CPF e pagamento pendente para retomar.
  let formas: FormaCheckout[] = [];
  let precisaCpf = false;
  let formaInicial: FormaPagamentoCodigo | null = null;
  let pixInicial: Pix | null = null;
  if (pedido?.status === 'aguardando_pagamento') {
    const [todas, { data: usuario }, { data: pendente }] = await Promise.all([
      getFormasPagamento(),
      supabaseAdmin.from('users').select('cpf_cnpj').eq('id', user.id).single(),
      supabaseAdmin
        .from('pagamento')
        .select('forma_pagamento')
        .eq('pedido_id', pedido.id)
        .eq('status', 'pendente')
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    formas = todas
      .filter((f) => f.ativo)
      .map((f) => ({
        codigo: f.codigo,
        nome: f.nome,
        opcoesParcelas:
          f.codigo === 'cartao_credito'
            ? opcoesParcelas(Number(pedido.valor_total), f.parcelas_max, f.valor_minimo_parcela != null ? Number(f.valor_minimo_parcela) : null)
            : [1],
      }));
    precisaCpf = !(usuario?.cpf_cnpj && isValidCPF(usuario.cpf_cnpj));
    formaInicial = pendente && formas.some((f) => f.codigo === pendente.forma_pagamento) ? pendente.forma_pagamento : null;
    if (formaInicial === 'pix' && sp.retorno !== '1') pixInicial = await retomarPixPendente(pedido.id);
  }

  const cfg = lerAsaasConfig();
  const sandbox = cfg.ok && cfg.config.ambiente === 'sandbox';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10">
        <Link href="/minhas-reservas" className="text-sm text-slate-500 hover:text-slate-700">
          ← Minhas reservas
        </Link>

        <h1 className="mt-3 text-2xl font-bold text-[#0B2447]">Pagamento da reserva</h1>
        <p className="text-sm text-slate-500 mt-1">
          O pagamento é feito pelo Boatzy e garante a sua data. O gestor recebe depois do passeio.
        </p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-5">
          {/* Resumo */}
          <section className="md:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm p-5 h-fit">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <TipoIcon className="h-3 w-3" /> {reserva.tipo === 'embarcacao' ? 'Embarcação' : 'Roteiro'}
            </div>
            <h2 className="mt-0.5 text-base font-bold text-[#0B2447]">{reserva.roteiro?.nome ?? reserva.item_nome}</h2>
            {localidade && <p className="text-xs text-slate-500 mt-0.5">{localidade}</p>}

            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p className="flex items-center gap-2 capitalize">
                <CalendarDays className="h-4 w-4 text-slate-400 shrink-0" />
                {dataLonga(reserva.data_reserva)}
                {reserva.data_fim_reserva && reserva.data_fim_reserva !== reserva.data_reserva && ` → ${dataLonga(reserva.data_fim_reserva)}`}
              </p>
              <p className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-400 shrink-0" />
                {reserva.quantidade_pessoas} {reserva.quantidade_pessoas === 1 ? 'pessoa' : 'pessoas'}
              </p>
            </div>

            {pedido && (
              <div className="mt-5 pt-4 border-t border-slate-100 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Passeio e adicionais</span><span className="text-slate-700">{formatCurrencyPrecise(Number(pedido.valor_itens))}</span></div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Taxa de serviço ({Number(pedido.comissao_percentual).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%)</span>
                  <span className="text-slate-700">{formatCurrencyPrecise(Number(pedido.valor_comissao))}</span>
                </div>
                {Number(pedido.valor_desconto) > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Desconto{cupom ? ` (${cupom})` : ''}</span>
                    <span>-{formatCurrencyPrecise(Number(pedido.valor_desconto))}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-[#0B2447]">
                  <span>Total</span><span>{formatCurrencyPrecise(Number(pedido.valor_total))}</span>
                </div>
                <p className="text-[11px] text-slate-400">Pedido #{pedido.numero}</p>
              </div>
            )}
          </section>

          {/* Ação */}
          <div className="md:col-span-3">
            {!pedido ? (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 text-sm text-slate-600">
                Esta reserva não tem pagamento pendente. Acompanhe o status em{' '}
                <Link href="/minhas-reservas" className="font-medium text-[#0B3D91] hover:underline">Minhas reservas</Link>.
              </div>
            ) : pedido.status === 'aguardando_pagamento' && pedido.expira_em ? (
              formas.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 text-sm text-slate-600">
                  Nenhuma forma de pagamento está disponível no momento. Tente novamente mais tarde.
                </div>
              ) : (
                <CheckoutPagamento
                  reservaId={reserva.id}
                  valorTotal={Number(pedido.valor_total)}
                  expiraEm={pedido.expira_em}
                  formas={formas}
                  precisaCpf={precisaCpf}
                  formaInicial={formaInicial}
                  pixInicial={pixInicial}
                  retornoCartao={sp.retorno === '1'}
                  sandbox={sandbox}
                />
              )
            ) : pedido.status === 'pago' || pedido.status === 'reembolsado_parcial' || pedido.status === 'em_disputa' || pedido.status === 'reembolsado' ? (
              <div className="rounded-2xl border border-emerald-200 bg-white shadow-sm p-6">
                <BadgeCheck className="h-9 w-9 text-emerald-600" />
                <h2 className="mt-3 text-lg font-bold text-[#0B2447]">
                  {pedido.status === 'pago' ? 'Pagamento confirmado!' : 'Pagamento recebido'}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {pedido.status === 'pago'
                    ? 'Sua reserva está confirmada. Enviamos os detalhes para o seu e-mail.'
                    : 'Este pedido teve alteração após o pagamento (reembolso ou contestação). Fale com o suporte em caso de dúvida.'}
                </p>
                <div className="mt-4 space-y-1 text-sm text-slate-600">
                  {pedido.pago_em && <p>Pago em {formatarDataHoraBR(pedido.pago_em)}</p>}
                  {pago && <p>{pago.forma === 'pix' ? 'Pix' : `Cartão de crédito${pago.cartao ? ` · ${pago.cartao}` : ''}`}</p>}
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  {pago?.comprovante && (
                    <a href={pago.comprovante} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-[#0B2447] hover:bg-slate-50">
                      <Receipt className="h-4 w-4" /> Ver comprovante
                    </a>
                  )}
                  <Link href="/minhas-reservas" className="inline-flex items-center rounded-xl bg-[#0B3D91] hover:bg-[#0B2447] px-4 py-2.5 text-sm font-semibold text-white">
                    Minhas reservas
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
                <TimerOff className="h-9 w-9 text-slate-400" />
                <h2 className="mt-3 text-lg font-bold text-[#0B2447]">
                  {pedido.status === 'expirado' ? 'O prazo de pagamento terminou' : 'Pagamento cancelado'}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Nenhum valor foi cobrado. Se ainda quiser o passeio, faça uma nova solicitação — a data pode continuar disponível.
                </p>
                <Link href="/buscar" className="mt-5 inline-flex items-center rounded-xl bg-[#0B3D91] hover:bg-[#0B2447] px-4 py-2.5 text-sm font-semibold text-white">
                  Buscar passeios
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
