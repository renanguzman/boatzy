import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CalendarDays, Users, MapPin, Ship, BadgeCheck, TimerOff, Receipt } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isValidCPF } from '@/lib/validators';
import { lerAsaasConfig } from '@/lib/asaas/config';
import { getFormasPagamento } from '@/lib/financeiro/config';
import { expirarPedidosVencidosSemFalhar, PAGAMENTO_PAGO } from '@/lib/pagamentos/pedidos';
import { formasPermitidasDoPedido, retomarPixPendente } from '@/lib/pagamentos/checkout';
import type { FormaPagamentoCodigo, PedidoStatus } from '@/types/supabase';
import CheckoutPagamento, { type FormaCheckout, type Pix } from '@/components/pagamento/CheckoutPagamento';
import { getFormatos } from '@/i18n/formatos-servidor';
import EventoAnalytics from '@/components/analytics/EventoAnalytics';

type PedidoPagar = {
  id: string;
  numero: number;
  status: PedidoStatus;
  expira_em: string | null;
  pago_em: string | null;
  valor_itens: number;
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

export default async function PagarReservaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ retorno?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [t, tNav, tPessoas, f] = await Promise.all([
    getTranslations('Pagamento'),
    getTranslations('Navegacao'),
    getTranslations('CamposBusca.quantidade.pessoas'),
    getFormatos(),
  ]);
  const dataLonga = (iso: string) => f.data(iso, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?redirect_to=/reservas/${id}/pagar`);

  await expirarPedidosVencidosSemFalhar();

  const { data } = await supabaseAdmin
    .from('reserva')
    .select(
      `id, tipo, item_nome, data_reserva, data_fim_reserva, quantidade_pessoas,
       roteiro ( nome, municipios ( nome, estados ( uf ) ) ),
       pedido ( id, numero, status, expira_em, pago_em, valor_itens, valor_comissao,
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
        cartao: c ? t('cartaoFinal', { bandeira: c.bandeira, digitos: c.ultimos_digitos }) : null,
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
    formas = formasPermitidasDoPedido(todas, { valor_total: Number(pedido.valor_total) })
      .map((forma) => ({ ...forma, nome: t(`formas.${forma.codigo}`) }));
    precisaCpf = !(usuario?.cpf_cnpj && isValidCPF(usuario.cpf_cnpj));
    formaInicial = pendente && formas.some((forma) => forma.codigo === pendente.forma_pagamento) ? pendente.forma_pagamento : null;
    if (formaInicial === 'pix' && sp.retorno !== '1') pixInicial = await retomarPixPendente(pedido.id);
  }

  const cfg = lerAsaasConfig();
  const sandbox = cfg.ok && cfg.config.ambiente === 'sandbox';

  return (
    <div className="min-h-screen flex flex-col bg-areia">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10">
        <Link href="/minhas-reservas" className="text-sm text-slate-500 hover:text-slate-700">
          {t('voltar')}
        </Link>

        <h1 className="mt-3 text-2xl font-bold text-marinho">{t('titulo')}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('subtitulo')}
        </p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-5">
          {/* Resumo */}
          <section className="md:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm p-5 h-fit">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <TipoIcon className="h-3 w-3" /> {t(`tipo.${reserva.tipo}`)}
            </div>
            <h2 className="mt-0.5 text-base font-bold text-marinho">{reserva.roteiro?.nome ?? reserva.item_nome}</h2>
            {localidade && <p className="text-xs text-slate-500 mt-0.5">{localidade}</p>}

            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p className="flex items-center gap-2 capitalize">
                <CalendarDays className="h-4 w-4 text-slate-400 shrink-0" />
                {dataLonga(reserva.data_reserva)}
                {reserva.data_fim_reserva && reserva.data_fim_reserva !== reserva.data_reserva && ` → ${dataLonga(reserva.data_fim_reserva)}`}
              </p>
              <p className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-400 shrink-0" />
                {tPessoas('valor', { count: reserva.quantidade_pessoas })}
              </p>
            </div>

            {pedido && (
              <div className="mt-5 pt-4 border-t border-slate-100 space-y-2 text-sm">
                {/* Taxa de serviço embutida: o cliente não a vê separada. */}
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('passeioEAdicionais')}</span>
                  <span className="text-slate-700">{f.moedaCentavos(Number(pedido.valor_itens) + Number(pedido.valor_comissao))}</span>
                </div>
                {Number(pedido.valor_desconto) > 0 && (
                  <div className="flex justify-between text-turquesa-escuro">
                    <span>{cupom ? t('descontoCupom', { cupom }) : t('desconto')}</span>
                    <span>-{f.moedaCentavos(Number(pedido.valor_desconto))}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-marinho">
                  <span>{t('total')}</span><span>{f.moedaCentavos(Number(pedido.valor_total))}</span>
                </div>
                <p className="text-[11px] text-slate-400">{t('pedido', { numero: pedido.numero })}</p>
              </div>
            )}
          </section>

          {/* Ação */}
          <div className="md:col-span-3">
            {!pedido ? (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 text-sm text-slate-600">
                {t.rich('semPendente', {
                  link: (texto) => <Link href="/minhas-reservas" className="font-medium text-marinho hover:underline">{texto}</Link>,
                })}
              </div>
            ) : pedido.status === 'aguardando_pagamento' && pedido.expira_em ? (
              formas.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 text-sm text-slate-600">
                  {t('semFormas')}
                </div>
              ) : (
                <CheckoutPagamento
                  pedidoId={pedido.id}
                  caminho={`/reservas/${reserva.id}/pagar`}
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
              <div className="rounded-2xl border border-turquesa/40 bg-white shadow-sm p-6">
                {/* GA4: compra concluída — 1x por navegador; transaction_id deduplica no GA (SPEC §65) */}
                {pedido.status === 'pago' && (
                  <EventoAnalytics
                    evento="purchase"
                    chave={String(pedido.numero)}
                    umaVez
                    params={{
                      transaction_id: String(pedido.numero),
                      currency: 'BRL',
                      value: Number(pedido.valor_total),
                      payment_type: pago?.forma,
                      coupon: cupom ?? undefined,
                      items: [{
                        item_id: reserva.id,
                        item_name: reserva.roteiro?.nome ?? reserva.item_nome,
                        item_category: reserva.tipo,
                        price: Number(pedido.valor_total),
                        quantity: 1,
                      }],
                    }}
                  />
                )}
                <BadgeCheck className="h-9 w-9 text-turquesa-escuro" />
                <h2 className="mt-3 text-lg font-bold text-marinho">
                  {pedido.status === 'pago' ? t('confirmado') : t('recebido')}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {pedido.status === 'pago' ? t('confirmadoTexto') : t('alteradoTexto')}
                </p>
                <div className="mt-4 space-y-1 text-sm text-slate-600">
                  {pedido.pago_em && <p>{t('pagoEm', { data: f.dataHora(pedido.pago_em) })}</p>}
                  {pago && <p>{pago.forma === 'pix' ? t('formas.pix') : `${t('formas.cartao_credito')}${pago.cartao ? ` · ${pago.cartao}` : ''}`}</p>}
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  {pago?.comprovante && (
                    <a href={pago.comprovante} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-marinho hover:bg-slate-50">
                      <Receipt className="h-4 w-4" /> {t('verComprovante')}
                    </a>
                  )}
                  <Link href="/minhas-reservas" className="inline-flex items-center rounded-xl bg-marinho hover:bg-marinho-escuro px-4 py-2.5 text-sm font-semibold text-white">
                    {tNav('minhasReservas')}
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
                <TimerOff className="h-9 w-9 text-slate-400" />
                <h2 className="mt-3 text-lg font-bold text-marinho">
                  {pedido.status === 'expirado' ? t('prazoTerminou') : t('cancelado')}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {t('nenhumValor')}
                </p>
                <Link href="/buscar" className="mt-5 inline-flex items-center rounded-xl bg-marinho hover:bg-marinho-escuro px-4 py-2.5 text-sm font-semibold text-white">
                  {t('buscarPasseios')}
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
