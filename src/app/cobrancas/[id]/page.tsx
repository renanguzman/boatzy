import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { after } from 'next/server';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BadgeCheck, CalendarDays, MapPin, MessageSquare, Receipt, Ship, TimerOff } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isValidCPF } from '@/lib/validators';
import { lerAsaasConfig } from '@/lib/asaas/config';
import { getFormasPagamento } from '@/lib/financeiro/config';
import { expirarPedidosVencidosSemFalhar, PAGAMENTO_PAGO } from '@/lib/pagamentos/pedidos';
import { formasPermitidasDoPedido, retomarPixPendente } from '@/lib/pagamentos/checkout';
import { registrarVisualizacao } from '@/lib/pagamentos/avulso';
import { linhasAvulsoParaCliente } from '@/lib/pagamentos/valores';
import type { FormaPagamentoCodigo, PedidoItemTipo, PedidoStatus } from '@/types/supabase';
import CheckoutPagamento, { type FormaCheckout, type Pix } from '@/components/pagamento/CheckoutPagamento';
import { documentoTomador, tomadorParaForm, type TomadorForm, type TomadorRegistro } from '@/lib/pagamentos/tomador';
import { getFormatos } from '@/i18n/formatos-servidor';
import EventoAnalytics from '@/components/analytics/EventoAnalytics';

/**
 * Cobrança avulsa — página do cliente (SPEC §34.16). É o link que o gestor
 * copia/compartilha: só abre para o cliente da reserva, logado (D4). Itens e
 * total já com a taxa de serviço embutida (o site não mostra a taxa à parte).
 */

type ReservaCobranca = {
  id: string;
  tipo: 'roteiro' | 'embarcacao';
  item_nome: string;
  data_reserva: string;
  data_fim_reserva: string | null;
  roteiro: { nome: string; municipios: { nome: string; estados: { uf: string } | null } | null } | null;
};

type CobrancaCliente = {
  id: string;
  numero: number;
  tipo: string;
  status: PedidoStatus;
  expira_em: string | null;
  pago_em: string | null;
  valor_itens: number;
  valor_total: number;
  gestor: { name: string | null } | null;
  pedido_avulso: {
    titulo: string;
    mensagem_cliente: string | null;
    formas_permitidas: FormaPagamentoCodigo[];
    parcelas_max: number;
    valor_ajuste: number;
    reserva: ReservaCobranca | null;
  } | null;
  pedido_item: { id: string; ordem: number; tipo: PedidoItemTipo; descricao: string; quantidade: number; valor_total: number }[];
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { data } = await supabaseAdmin.from('pedido').select('numero').eq('id', id).eq('tipo', 'avulso').maybeSingle();
  const t = await getTranslations('Cobranca');
  return { title: t('metaTitulo', { numero: String(data?.numero ?? '') }), robots: { index: false, follow: false } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CobrancaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ retorno?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?redirect_to=/cobrancas/${id}`);

  const [t, tPag, f] = await Promise.all([getTranslations('Cobranca'), getTranslations('Pagamento'), getFormatos()]);

  await expirarPedidosVencidosSemFalhar();

  const { data } = await supabaseAdmin
    .from('pedido')
    .select(
      `id, numero, tipo, status, expira_em, pago_em, valor_itens, valor_total,
       gestor:users!pedido_gestor_id_fkey ( name ),
       pedido_avulso ( titulo, mensagem_cliente, formas_permitidas, parcelas_max, valor_ajuste,
         reserva:reserva_id ( id, tipo, item_nome, data_reserva, data_fim_reserva,
                              roteiro ( nome, municipios ( nome, estados ( uf ) ) ) ) ),
       pedido_item ( id, ordem, tipo, descricao, quantidade, valor_total )`,
    )
    .eq('id', id)
    .eq('tipo', 'avulso')
    .eq('cliente_id', user.id)
    .maybeSingle();
  // Pedido de outra pessoa (ou inexistente): 404, sem revelar que existe.
  const c = data as unknown as CobrancaCliente | null;
  const avulso = c ? (Array.isArray(c.pedido_avulso) ? c.pedido_avulso[0] : c.pedido_avulso) : null;
  const reserva = avulso?.reserva ?? null;
  if (!c || !avulso || !reserva) notFound();

  if (c.status === 'aguardando_pagamento') after(() => registrarVisualizacao(c.id, user.id));

  const itens = [...c.pedido_item].sort((a, b) => a.ordem - b.ordem);
  const linhas = linhasAvulsoParaCliente({
    itens: itens.map((i) => Number(i.valor_total)),
    valorAjuste: Number(avulso.valor_ajuste),
    valorItens: Number(c.valor_itens),
    valorTotal: Number(c.valor_total),
  });
  const nomePasseio = reserva.roteiro?.nome ?? reserva.item_nome;
  const localidade = reserva.roteiro?.municipios
    ? `${reserva.roteiro.municipios.nome}${reserva.roteiro.municipios.estados ? `, ${reserva.roteiro.municipios.estados.uf}` : ''}`
    : null;
  const TipoIcon = reserva.tipo === 'embarcacao' ? Ship : MapPin;
  const proprietario = c.gestor?.name?.trim() || t('proprietario');

  // Pagamento concluído (comprovante + cartão mascarado).
  let pago: { comprovante: string | null; forma: FormaPagamentoCodigo; cartao: string | null; emNomeDe: string | null } | null = null;
  if (c.status !== 'aguardando_pagamento') {
    const { data: pg } = await supabaseAdmin
      .from('pagamento')
      .select('forma_pagamento, comprovante_url, fatura_url, pagamento_cartao ( bandeira, ultimos_digitos ), pagamento_tomador ( tipo, nome, documento )')
      .eq('pedido_id', c.id)
      .in('status', [...PAGAMENTO_PAGO, 'estornado', 'estornado_parcial', 'em_disputa'])
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pg) {
      const cartao = Array.isArray(pg.pagamento_cartao) ? pg.pagamento_cartao[0] : pg.pagamento_cartao;
      // Em nome de quem saiu (SPEC §97); sem linha = pagamento anterior, no nome do próprio cliente.
      const tom = Array.isArray(pg.pagamento_tomador) ? pg.pagamento_tomador[0] : pg.pagamento_tomador;
      pago = {
        comprovante: pg.comprovante_url ?? pg.fatura_url,
        forma: pg.forma_pagamento,
        cartao: cartao ? tPag('cartaoFinal', { bandeira: cartao.bandeira, digitos: cartao.ultimos_digitos }) : null,
        emNomeDe: tom && tom.tipo !== 'proprio' ? `${tom.nome} · ${documentoTomador(tom.documento)}` : null,
      };
    }
  }

  // Checkout: formas liberadas pelo gestor ∩ formas ativas, CPF e Pix pendente para retomar.
  let formas: FormaCheckout[] = [];
  let precisaCpf = false;
  let titular: { nome: string; documento: string | null } = { nome: '', documento: null };
  let tomadorInicial: TomadorForm | null = null;
  let formaInicial: FormaPagamentoCodigo | null = null;
  let pixInicial: Pix | null = null;
  if (c.status === 'aguardando_pagamento') {
    const [todas, { data: usuario }, { data: pendente }] = await Promise.all([
      getFormasPagamento(),
      supabaseAdmin.from('users').select('name, cpf_cnpj').eq('id', user.id).single(),
      supabaseAdmin
        .from('pagamento')
        .select('forma_pagamento, pagamento_tomador ( * )')
        .eq('pedido_id', c.id)
        .eq('status', 'pendente')
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    formas = formasPermitidasDoPedido(todas, { valor_total: Number(c.valor_total), avulso })
      .map((forma) => ({ ...forma, nome: tPag(`formas.${forma.codigo}`) }));
    precisaCpf = !(usuario?.cpf_cnpj && isValidCPF(usuario.cpf_cnpj));
    titular = { nome: usuario?.name ?? '', documento: usuario?.cpf_cnpj ?? null };
    const tomadorPendente = pendente
      ? ((Array.isArray(pendente.pagamento_tomador) ? pendente.pagamento_tomador[0] : pendente.pagamento_tomador) ?? null) as TomadorRegistro | null
      : null;
    tomadorInicial = tomadorParaForm(tomadorPendente);
    formaInicial = pendente && formas.some((forma) => forma.codigo === pendente.forma_pagamento) ? pendente.forma_pagamento : null;
    if (formaInicial === 'pix' && sp.retorno !== '1') pixInicial = await retomarPixPendente(c.id);
  }

  const cfg = lerAsaasConfig();
  const sandbox = cfg.ok && cfg.config.ambiente === 'sandbox';
  const encerrada = c.status === 'expirado' || c.status === 'cancelado';
  const paga = c.status === 'pago' || c.status === 'reembolsado' || c.status === 'reembolsado_parcial' || c.status === 'em_disputa';

  return (
    <div className="min-h-screen flex flex-col bg-areia">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10">
        <Link href={`/minhas-reservas/${reserva.id}`} className="text-sm text-slate-500 hover:text-slate-700">
          {t('voltar')}
        </Link>

        <h1 className="mt-3 text-2xl font-bold text-marinho">{t('titulo')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('subtitulo', { proprietario })}</p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-5">
          {/* Resumo */}
          <section className="md:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm p-5 h-fit">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('numero', { numero: c.numero })}</p>
            <h2 className="mt-0.5 text-base font-bold text-marinho break-words">{avulso.titulo}</h2>

            <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-600 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t('referente')}</p>
              <p className="flex items-center gap-1.5 font-medium text-slate-700"><TipoIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" /> {nomePasseio}</p>
              {localidade && <p className="pl-5 text-slate-500">{localidade}</p>}
              <p className="flex items-center gap-1.5 capitalize">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                {f.data(reserva.data_reserva, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>

            <div className="mt-4 space-y-1.5 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('itens')}</p>
              {itens.map((i, idx) => (
                <div key={i.id} className="flex justify-between gap-3">
                  <span className="text-slate-600 min-w-0 break-words">
                    {Number(i.quantidade) !== 1 && `${f.numero(Number(i.quantidade))} × `}{i.descricao}
                  </span>
                  <span className="shrink-0 text-slate-700">{f.moedaCentavos(linhas.itens[idx])}</span>
                </div>
              ))}
              {linhas.ajuste !== 0 && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">{t('ajuste')}</span>
                  <span className="shrink-0 text-slate-700">{linhas.ajuste < 0 ? '-' : ''}{f.moedaCentavos(Math.abs(linhas.ajuste))}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-marinho">
                <span>{t('total')}</span><span>{f.moedaCentavos(Number(c.valor_total))}</span>
              </div>
            </div>

            {avulso.mensagem_cliente && (
              <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700"><MessageSquare className="h-3.5 w-3.5" /> {t('recado')}</p>
                <p className="mt-1 text-sm text-slate-600 break-words">{avulso.mensagem_cliente}</p>
              </div>
            )}
          </section>

          {/* Ação */}
          <div className="md:col-span-3">
            {c.status === 'aguardando_pagamento' && c.expira_em ? (
              formas.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 text-sm text-slate-600">
                  {tPag('semFormas')}
                </div>
              ) : (
                <CheckoutPagamento
                  pedidoId={c.id}
                  caminho={`/cobrancas/${c.id}`}
                  valorTotal={Number(c.valor_total)}
                  expiraEm={c.expira_em}
                  formas={formas}
                  precisaCpf={precisaCpf}
                  titular={titular}
                  tomadorInicial={tomadorInicial}
                  formaInicial={formaInicial}
                  pixInicial={pixInicial}
                  retornoCartao={sp.retorno === '1'}
                  sandbox={sandbox}
                />
              )
            ) : paga ? (
              <div className="rounded-2xl border border-turquesa/40 bg-white shadow-sm p-6">
                {/* GA4: compra concluída — 1x por navegador; transaction_id deduplica no GA (SPEC §65) */}
                {c.status === 'pago' && (
                  <EventoAnalytics
                    evento="purchase"
                    chave={String(c.numero)}
                    umaVez
                    params={{
                      transaction_id: String(c.numero),
                      currency: 'BRL',
                      value: Number(c.valor_total),
                      payment_type: pago?.forma,
                      items: [{
                        item_id: c.id,
                        item_name: avulso.titulo,
                        item_category: 'cobranca_avulsa',
                        price: Number(c.valor_total),
                        quantity: 1,
                      }],
                    }}
                  />
                )}
                <BadgeCheck className="h-9 w-9 text-turquesa-escuro" />
                <h2 className="mt-3 text-lg font-bold text-marinho">
                  {c.status === 'pago' ? t('pagaTitulo') : tPag('recebido')}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {c.status === 'pago' ? t('pagaTexto') : tPag('alteradoTexto')}
                </p>
                <div className="mt-4 space-y-1 text-sm text-slate-600">
                  {c.pago_em && <p>{tPag('pagoEm', { data: f.dataHora(c.pago_em) })}</p>}
                  {pago && <p>{pago.forma === 'pix' ? tPag('formas.pix') : `${tPag('formas.cartao_credito')}${pago.cartao ? ` · ${pago.cartao}` : ''}`}</p>}
                  {pago?.emNomeDe && <p>{tPag('emNomeDe', { titular: pago.emNomeDe })}</p>}
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  {pago?.comprovante && (
                    <a href={pago.comprovante} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-marinho hover:bg-slate-50">
                      <Receipt className="h-4 w-4" /> {tPag('verComprovante')}
                    </a>
                  )}
                  <Link href={`/minhas-reservas/${reserva.id}`} className="inline-flex items-center rounded-xl bg-marinho hover:bg-marinho-escuro px-4 py-2.5 text-sm font-semibold text-white">
                    {t('verReserva')}
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
                <TimerOff className="h-9 w-9 text-slate-400" />
                <h2 className="mt-3 text-lg font-bold text-marinho">
                  {encerrada && c.status === 'cancelado' ? t('canceladaTitulo') : t('expiradaTitulo')}
                </h2>
                <p className="mt-1 text-sm text-slate-600">{t('nenhumValor')}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href={`/minhas-reservas/${reserva.id}/chat`} className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-marinho hover:bg-slate-50">
                    {t('conversar')}
                  </Link>
                  <Link href={`/minhas-reservas/${reserva.id}`} className="inline-flex items-center rounded-xl bg-marinho hover:bg-marinho-escuro px-4 py-2.5 text-sm font-semibold text-white">
                    {t('verReserva')}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
