import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft, Receipt, User, Anchor, MapPin, Ship, CalendarDays, Users, CreditCard, QrCode, FlaskConical,
  Wallet, History, Webhook, TicketPercent, ShieldCheck, StickyNote, ExternalLink, ShoppingCart, Percent,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatCurrencyPrecise } from '@/lib/utils';
import { formatarDataHoraBR } from '@/lib/termos/formato';
import { PAGAMENTO_CANCELAVEL } from '@/lib/pagamentos/pedidos';
import { multiplicadorDaReserva } from '@/lib/pagamentos/valores';
import type { PagamentoStatus } from '@/types/supabase';
import { carregarDetalhePedido, type DetalhePedido, type PagamentoDetalhe } from '../_lib/detalhe';
import {
  ACAO_LABEL, ESTORNO_STATUS, EVENTO_STATUS, FORMA_LABEL, MODALIDADE_LABEL, PAGAMENTO_STATUS, PARCELA_STATUS,
  PEDIDO_STATUS, RESERVA_STATUS, TRANSACAO_LABEL, formatarDataCurta, formatarDocumento, formatarTelefone,
} from '../_lib/rotulos';
import PedidoAcoes from './_components/PedidoAcoes';
import CancelarCobrancaButton from './_components/CancelarCobrancaButton';
import CopiarValor from './_components/CopiarValor';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const brl = (v: number | string | null | undefined) => (v == null ? '—' : formatCurrencyPrecise(Number(v)));
const dh = (iso: string | null | undefined) => formatarDataHoraBR(iso, { segundos: true });
const PAGO: PagamentoStatus[] = ['confirmado', 'recebido', 'estornado_parcial', 'em_disputa', 'estornado'];

// ─── Blocos de apresentação ─────────────────────────────────────────────────

function Card({ titulo, icon: Icon, children, extra }: { titulo: string; icon: React.ElementType; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#0B2447]"><Icon className="w-4 h-4" /> {titulo}</h2>
        {extra}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

function Campo({ label, children, mono = false }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">{label}</p>
      <div className={`mt-0.5 text-sm text-slate-700 break-words ${mono ? 'font-mono text-xs' : ''}`}>{children ?? '—'}</div>
    </div>
  );
}

function Badge({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${cls}`}>{children}</span>;
}

function Linha({ label, valor, destaque, cor }: { label: React.ReactNode; valor: string; destaque?: boolean; cor?: string }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-1.5 ${destaque ? 'border-t border-slate-100 mt-1 pt-2.5' : ''}`}>
      <span className={`text-sm ${destaque ? 'font-bold text-[#0B2447]' : 'text-slate-500'}`}>{label}</span>
      <span className={`text-sm whitespace-nowrap ${destaque ? 'font-bold text-[#0B2447]' : cor ?? 'text-slate-700'}`}>{valor}</span>
    </div>
  );
}

function Json({ valor, titulo = 'Ver payload' }: { valor: unknown; titulo?: string }) {
  if (valor == null) return null;
  return (
    <details className="group">
      <summary className="cursor-pointer text-xs font-semibold text-[#0B3D91] hover:underline select-none">{titulo}</summary>
      <pre className="mt-2 text-[11px] leading-relaxed text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-3 overflow-auto max-h-96">
        {JSON.stringify(valor, null, 2)}
      </pre>
    </details>
  );
}

function Pessoa({ u, papel }: { u: DetalhePedido['cliente']; papel: string }) {
  if (!u) return <p className="text-sm text-slate-400">Usuário não encontrado.</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
          {u.avatar_url ? (
            <Image src={u.avatar_url} alt={u.name} width={40} height={40} className="w-full h-full object-cover" />
          ) : (
            <User className="w-4 h-4 text-slate-300" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-700 truncate">{u.name}</p>
          <p className="text-[11px] text-slate-400">{papel} · desde {formatarDataCurta(u.created_at)}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2.5">
        <Campo label="E-mail">{u.email}</Campo>
        <Campo label="Telefone">{formatarTelefone(u.phone)}</Campo>
        <Campo label="CPF / CNPJ">{formatarDocumento(u.cpf_cnpj)}</Campo>
        <Campo label="ID do usuário"><CopiarValor valor={u.id} curto /></Campo>
      </div>
    </div>
  );
}

// ─── Linha do tempo ─────────────────────────────────────────────────────────

type ItemTempo = { em: string; titulo: string; detalhe?: string; origem: 'cliente' | 'gestor' | 'gateway' | 'sistema' | 'admin' };

const ORIGEM_COR: Record<ItemTempo['origem'], string> = {
  cliente: 'bg-sky-500',
  gestor: 'bg-indigo-500',
  gateway: 'bg-emerald-500',
  sistema: 'bg-slate-400',
  admin: 'bg-amber-500',
};
const ORIGEM_LABEL: Record<ItemTempo['origem'], string> = {
  cliente: 'Cliente', gestor: 'Gestor', gateway: 'Asaas', sistema: 'Sistema', admin: 'Admin',
};

function montarLinhaDoTempo(d: DetalhePedido): ItemTempo[] {
  const itens: ItemTempo[] = [];
  const r = d.reserva;
  const p = d.pedido;
  if (r) {
    itens.push({ em: r.solicitado_em, titulo: 'Reserva solicitada', detalhe: `${r.item_nome} · ${r.quantidade_pessoas} pessoa(s)`, origem: 'cliente' });
    for (const a of d.aceites) {
      itens.push({ em: a.aceito_em, titulo: `Termo da reserva aceito (v${a.termo_versao})`, detalhe: `Protocolo ${a.evidencia_hash.slice(0, 12).toUpperCase()}`, origem: 'cliente' });
    }
  }
  itens.push({
    em: r?.aceita_em ?? p.criado_em,
    titulo: `Gestor aceitou — pedido #${p.numero} gerado`,
    detalhe: `Total ${brl(p.valor_total)} · prazo inicial para pagar calculado a partir do aceite`,
    origem: 'gestor',
  });
  d.pagamentos.forEach((pg, i) => {
    for (const t of pg.pagamento_transacao) {
      itens.push({
        em: t.ocorrido_em,
        titulo: `${TRANSACAO_LABEL[t.tipo] ?? t.tipo} — tentativa ${i + 1} (${FORMA_LABEL[pg.forma_pagamento]}${pg.numero_parcelas > 1 ? ` ${pg.numero_parcelas}x` : ''})`,
        detalhe: [t.valor != null ? brl(t.valor) : null, t.status_asaas, pg.asaas_payment_id].filter(Boolean).join(' · '),
        origem: t.tipo === 'criacao' || t.tipo === 'falha_criacao' ? 'cliente' : 'gateway',
      });
    }
    for (const e of pg.pagamento_estorno) {
      itens.push({ em: e.solicitado_em, titulo: `Estorno ${ESTORNO_STATUS[e.status].label.toLowerCase()}`, detalhe: `${brl(e.valor)} · ${e.motivo}`, origem: e.origem === 'admin' ? 'admin' : 'gateway' });
    }
  });
  if (p.pago_em) itens.push({ em: p.pago_em, titulo: 'Pedido pago — reserva confirmada', detalhe: 'E-mails de confirmação enviados ao cliente e ao gestor', origem: 'sistema' });
  if (p.cancelado_em) {
    itens.push({ em: p.cancelado_em, titulo: p.status === 'expirado' ? 'Pedido expirado — data liberada' : 'Pedido cancelado', detalhe: p.motivo_cancelamento ?? undefined, origem: 'sistema' });
  }
  if (r?.cancelada_em) itens.push({ em: r.cancelada_em, titulo: 'Cliente cancelou a reserva', origem: 'cliente' });
  for (const a of d.auditoria) {
    itens.push({
      em: a.criado_em,
      titulo: `${a.admin?.name ?? 'Admin'}: ${ACAO_LABEL[a.acao] ?? a.acao}`,
      detalhe: a.motivo ?? undefined,
      origem: 'admin',
    });
  }
  return itens.sort((a, b) => a.em.localeCompare(b.em));
}

// ─── Pagamento (tentativa) ──────────────────────────────────────────────────

function PagamentoCard({ pg, indice }: { pg: PagamentoDetalhe; indice: number }) {
  const cartao = Array.isArray(pg.pagamento_cartao) ? pg.pagamento_cartao[0] : pg.pagamento_cartao;
  const FormaIcon = pg.forma_pagamento === 'cartao_credito' ? CreditCard : QrCode;
  const cancelavel = PAGAMENTO_CANCELAVEL.includes(pg.status);

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#0B2447]">
          <FormaIcon className="w-4 h-4" />
          Tentativa {indice} · {FORMA_LABEL[pg.forma_pagamento]}
          {pg.numero_parcelas > 1 && <span className="text-slate-500 font-normal">em {pg.numero_parcelas}x</span>}
          {pg.ambiente === 'sandbox' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              <FlaskConical className="w-3 h-3" /> Sandbox
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge cls={PAGAMENTO_STATUS[pg.status].cls}>{PAGAMENTO_STATUS[pg.status].label}</Badge>
          {pg.status_asaas && <span className="font-mono text-[10px] text-slate-400">{pg.status_asaas}</span>}
        </div>
      </div>

      <div className="p-4 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Campo label="Valor cobrado">{brl(pg.valor)}</Campo>
          <Campo label="Líquido (Asaas)">{brl(pg.valor_liquido)}</Campo>
          <Campo label="Tarifa Asaas">{brl(pg.valor_tarifa)}</Campo>
          <Campo label="Parcelas">{pg.numero_parcelas}x</Campo>
          <Campo label="Criada em">{dh(pg.criado_em)}</Campo>
          <Campo label="Vencimento">{formatarDataCurta(pg.vencimento)}</Campo>
          <Campo label="Confirmado em">{dh(pg.confirmado_em)}</Campo>
          <Campo label="Recebido em">{dh(pg.recebido_em)}</Campo>
          <Campo label="Crédito previsto">{formatarDataCurta(pg.credito_previsto_em)}</Campo>
          <Campo label="Atualizado em">{dh(pg.atualizado_em)}</Campo>
          <Campo label="Nº da fatura">{pg.numero_fatura ?? '—'}</Campo>
          <Campo label="Ambiente">{pg.ambiente === 'sandbox' ? 'Sandbox' : 'Produção'}</Campo>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Campo label="ID do pagamento (Boatzy = externalReference)"><CopiarValor valor={pg.id} /></Campo>
          <Campo label="ID da cobrança (Asaas)">{pg.asaas_payment_id ? <CopiarValor valor={pg.asaas_payment_id} /> : '—'}</Campo>
          <Campo label="ID do parcelamento (Asaas)">{pg.asaas_parcelamento_id ? <CopiarValor valor={pg.asaas_parcelamento_id} /> : '—'}</Campo>
          <Campo label="Cliente no Asaas">{pg.asaas_customer_id ? <CopiarValor valor={pg.asaas_customer_id} /> : '—'}</Campo>
          {pg.forma_pagamento === 'pix' && (
            <>
              <Campo label="Transação Pix (Asaas)">{pg.pix_transacao_id ? <CopiarValor valor={pg.pix_transacao_id} curto /> : '—'}</Campo>
              <Campo label="QR Code válido até">{dh(pg.pix_qrcode_expira_em)}</Campo>
            </>
          )}
        </div>

        {pg.forma_pagamento === 'pix' && pg.pix_qrcode_payload && (
          <Campo label="Pix copia e cola"><CopiarValor valor={pg.pix_qrcode_payload} curto /></Campo>
        )}

        {cartao && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
            <CreditCard className="w-5 h-5 text-[#0B2447]" />
            <div>
              <p className="text-sm font-semibold text-slate-700">{cartao.bandeira} •••• {cartao.ultimos_digitos}</p>
              <p className="text-[11px] text-slate-400">Registrado em {dh(cartao.criado_em)} · o Boatzy guarda só a bandeira e os 4 últimos dígitos</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          {pg.fatura_url && (
            <a href={pg.fatura_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B3D91] hover:underline">
              <ExternalLink className="w-3.5 h-3.5" /> Fatura no Asaas
            </a>
          )}
          {pg.comprovante_url && (
            <a href={pg.comprovante_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B3D91] hover:underline">
              <ExternalLink className="w-3.5 h-3.5" /> Comprovante
            </a>
          )}
          {cancelavel && <CancelarCobrancaButton pagamentoId={pg.id} />}
        </div>

        {pg.pagamento_parcela.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-2">Parcelas</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="py-1.5 pr-3">#</th><th className="py-1.5 pr-3">Cobrança</th><th className="py-1.5 pr-3">Valor</th>
                    <th className="py-1.5 pr-3">Líquido</th><th className="py-1.5 pr-3">Status</th><th className="py-1.5 pr-3">Vencimento</th>
                    <th className="py-1.5 pr-3">Crédito previsto</th><th className="py-1.5">Recebida</th>
                  </tr>
                </thead>
                <tbody>
                  {pg.pagamento_parcela.map((pp) => (
                    <tr key={pp.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-1.5 pr-3">{pp.numero}/{pp.total}</td>
                      <td className="py-1.5 pr-3 font-mono">{pp.asaas_payment_id ?? '—'}</td>
                      <td className="py-1.5 pr-3">{brl(pp.valor)}</td>
                      <td className="py-1.5 pr-3">{brl(pp.valor_liquido)}</td>
                      <td className="py-1.5 pr-3"><Badge cls={PARCELA_STATUS[pp.status].cls}>{PARCELA_STATUS[pp.status].label}</Badge></td>
                      <td className="py-1.5 pr-3">{formatarDataCurta(pp.vencimento)}</td>
                      <td className="py-1.5 pr-3">{formatarDataCurta(pp.credito_previsto_em)}</td>
                      <td className="py-1.5">{dh(pp.recebido_em)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div>
          <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-2">Movimentos da transação</p>
          {pg.pagamento_transacao.length === 0 ? (
            <p className="text-xs text-slate-400">Nenhum movimento registrado.</p>
          ) : (
            <ul className="space-y-2">
              {pg.pagamento_transacao.map((t) => (
                <li key={t.id} className="rounded-lg border border-slate-100 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-700">{TRANSACAO_LABEL[t.tipo] ?? t.tipo}</span>
                    <span className="text-xs text-slate-400">{dh(t.ocorrido_em)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[11px] text-slate-500">
                    {t.valor != null && <span>{brl(t.valor)}</span>}
                    {t.status_asaas && <span className="font-mono">{t.status_asaas}</span>}
                    {t.asaas_evento_id && (
                      <Link href={`/administrator/financeiro/integracao?q=${encodeURIComponent(t.asaas_evento_id)}`} className="font-mono text-[#0B3D91] hover:underline">
                        evento {t.asaas_evento_id.slice(0, 18)}…
                      </Link>
                    )}
                  </div>
                  {t.payload != null && <div className="mt-1.5"><Json valor={t.payload} /></div>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {pg.pagamento_estorno.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-2">Estornos</p>
            <ul className="space-y-2">
              {pg.pagamento_estorno.map((e) => (
                <li key={e.id} className="rounded-lg border border-amber-100 bg-amber-50/40 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-700">{brl(e.valor)} · {e.origem}</span>
                    <Badge cls={ESTORNO_STATUS[e.status].cls}>{ESTORNO_STATUS[e.status].label}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{e.motivo}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Solicitado {dh(e.solicitado_em)}{e.concluido_em ? ` · concluído ${dh(e.concluido_em)}` : ''}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Json valor={pg.ultimo_payload} titulo="Último estado da cobrança recebido do Asaas (JSON)" />
      </div>
    </div>
  );
}

// ─── Página ─────────────────────────────────────────────────────────────────

export default async function AdminPedidoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/administrator/login');

  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const d = await carregarDetalhePedido(id);
  if (!d) notFound();

  const { pedido: p, reserva: r } = d;
  const pagamentoPago = [...d.pagamentos].reverse().find((pg) => PAGO.includes(pg.status)) ?? null;
  const tarifa = pagamentoPago?.valor_tarifa != null ? Number(pagamentoPago.valor_tarifa) : null;
  const receitaBoatzy = Number(p.valor_comissao) - Number(p.valor_desconto);
  const margem = tarifa != null ? receitaBoatzy - tarifa : null;
  const multiplicador = r ? multiplicadorDaReserva(r) : 1;
  const localidade = r?.roteiro?.municipios
    ? `${r.roteiro.municipios.nome}${r.roteiro.municipios.estados ? `, ${r.roteiro.municipios.estados.uf}` : ''}`
    : null;
  const linhaDoTempo = montarLinhaDoTempo(d);
  const anotacoes = d.auditoria.filter((a) => a.acao === 'pedido.anotacao');
  const ambientes = [...new Set(d.pagamentos.map((pg) => pg.ambiente))];

  return (
    <div className="p-8 space-y-6">
      <Link href="/administrator/pedidos" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0B2447]">
        <ArrowLeft className="h-4 w-4" /> Pedidos
      </Link>

      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#0B2447]/5 flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5 text-[#0B2447]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-[#0B2447]">Pedido #{p.numero}</h1>
              <Badge cls={PEDIDO_STATUS[p.status].cls}>{PEDIDO_STATUS[p.status].label}</Badge>
              {r && <Badge cls={RESERVA_STATUS[r.status].cls}>Reserva: {RESERVA_STATUS[r.status].label}</Badge>}
              {ambientes.includes('sandbox') && (
                <Badge cls="bg-amber-50 text-amber-700"><FlaskConical className="w-3 h-3 inline -mt-0.5 mr-1" />Sandbox</Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Criado em {dh(p.criado_em)}</span>
              <span>Atualizado em {dh(p.atualizado_em)}</span>
              <CopiarValor valor={p.id} />
            </p>
          </div>
        </div>
        <PedidoAcoes pedidoId={p.id} status={p.status} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="xl:col-span-2 space-y-6">
          {/* Resumo financeiro */}
          <Card titulo="Resumo financeiro" icon={Wallet}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
              <div>
                <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">O que o cliente paga</p>
                {r && r.preco_base != null && (
                  <Linha
                    label={`${MODALIDADE_LABEL[r.modalidade_preco] ?? 'Preço'}${multiplicador > 1 ? ` (${brl(r.preco_base)} × ${multiplicador})` : ''}`}
                    valor={brl(Number(r.preco_base) * multiplicador)}
                  />
                )}
                {r && Number(r.total_adicionais) > 0 && <Linha label="Adicionais" valor={brl(r.total_adicionais)} />}
                <Linha label="Valor dos itens (do gestor)" valor={brl(p.valor_itens)} />
                <Linha label={`Taxa de serviço (${Number(p.comissao_percentual).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%)`} valor={brl(p.valor_comissao)} />
                {Number(p.valor_desconto) > 0 && <Linha label="Desconto (cupom)" valor={`−${brl(p.valor_desconto)}`} cor="text-emerald-600" />}
                <Linha label="Total do pedido" valor={brl(p.valor_total)} destaque />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Resultado</p>
                <Linha label="Recebido no Asaas (líquido)" valor={brl(pagamentoPago?.valor_liquido)} />
                <Linha label="Tarifa Asaas (absorvida)" valor={tarifa != null ? `−${brl(tarifa)}` : '—'} cor="text-amber-600" />
                <Linha label="A repassar ao gestor" valor={brl(p.valor_itens)} cor="text-sky-700" />
                <Linha label="Receita Boatzy (comissão − desconto)" valor={brl(receitaBoatzy)} />
                <Linha
                  label="Margem Boatzy (− tarifa)"
                  valor={margem != null ? brl(margem) : 'após o pagamento'}
                  destaque
                />
                {margem != null && margem < 0 && <p className="text-xs text-red-600 mt-1">Margem negativa neste pedido.</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-4 border-t border-slate-100">
              <Campo label="Prazo para pagar">{dh(p.expira_em)}</Campo>
              <Campo label="Pago em">{dh(p.pago_em)}</Campo>
              <Campo label="Encerrado em">{dh(p.cancelado_em)}</Campo>
              <Campo label="Crédito previsto">{formatarDataCurta(pagamentoPago?.credito_previsto_em)}</Campo>
              {p.motivo_cancelamento && <div className="col-span-2 md:col-span-4"><Campo label="Motivo do encerramento">{p.motivo_cancelamento}</Campo></div>}
              <div className="col-span-2 md:col-span-4 text-xs text-slate-500">
                Taxa congelada na solicitação: <b>{Number(p.comissao_percentual).toLocaleString('pt-BR')}%</b>
                {d.taxaAtualGestor && (
                  <> · taxa que valeria hoje para este gestor: <b>{d.taxaAtualGestor.percent.toLocaleString('pt-BR')}%</b> ({d.taxaAtualGestor.origem === 'especifica' ? 'específica' : 'geral'})</>
                )}
                {' · '}o repasse ao gestor é feito na Fase 3 (após o passeio e a confirmação de realização).
              </div>
            </div>
          </Card>

          {/* Pagamentos */}
          <Card
            titulo={`Pagamentos e transações (${d.pagamentos.length} tentativa${d.pagamentos.length === 1 ? '' : 's'})`}
            icon={CreditCard}
          >
            {d.pagamentos.length === 0 ? (
              <p className="text-sm text-slate-400">O cliente ainda não iniciou nenhum pagamento.</p>
            ) : (
              <div className="space-y-4">
                {[...d.pagamentos].reverse().map((pg) => (
                  <PagamentoCard key={pg.id} pg={pg} indice={d.pagamentos.indexOf(pg) + 1} />
                ))}
              </div>
            )}
          </Card>

          {/* Linha do tempo */}
          <Card titulo="Linha do tempo" icon={History}>
            <ol className="relative border-l border-slate-200 ml-2 space-y-4">
              {linhaDoTempo.map((it, i) => (
                <li key={i} className="ml-4">
                  <span className={`absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full ${ORIGEM_COR[it.origem]}`} />
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium text-slate-700">{it.titulo}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{ORIGEM_LABEL[it.origem]}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{dh(it.em)}</p>
                  {it.detalhe && <p className="text-xs text-slate-500 mt-0.5 break-words">{it.detalhe}</p>}
                </li>
              ))}
            </ol>
          </Card>

          {/* Eventos do webhook */}
          <Card
            titulo={`Eventos recebidos do Asaas (${d.eventos.length})`}
            icon={Webhook}
            extra={<Link href="/administrator/financeiro/integracao" className="text-xs font-semibold text-[#0B3D91] hover:underline">Fila de eventos</Link>}
          >
            {d.eventos.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum evento de webhook para as cobranças deste pedido.</p>
            ) : (
              <ul className="space-y-2">
                {d.eventos.map((e) => (
                  <li key={e.id} className="rounded-lg border border-slate-100 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-[#0B2447]">{e.evento}</span>
                      <Badge cls={EVENTO_STATUS[e.status].cls}>{EVENTO_STATUS[e.status].label}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[11px] text-slate-500">
                      <span>Criado no Asaas {dh(e.criado_asaas_em)}</span>
                      <span>Recebido {dh(e.recebido_em)}</span>
                      <span>Processado {dh(e.processado_em)}</span>
                      <span>{e.tentativas} tentativa(s)</span>
                      <span className="font-mono">{e.recurso_id}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5 break-all">{e.id}</p>
                    {e.erro && <p className="mt-1 text-xs text-red-600">{e.erro}</p>}
                    <div className="mt-1.5"><Json valor={e.payload} /></div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Coluna lateral */}
        <div className="space-y-6">
          <Card titulo="Cliente" icon={User}>
            <Pessoa u={d.cliente} papel="Cliente" />
            {d.clienteAsaas.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                {d.clienteAsaas.map((c) => (
                  <Campo key={c.ambiente} label={`Cliente no Asaas (${c.ambiente === 'sandbox' ? 'sandbox' : 'produção'})`}>
                    <CopiarValor valor={c.asaas_customer_id} />
                  </Campo>
                ))}
              </div>
            )}
          </Card>

          <Card titulo="Gestor (dono da embarcação)" icon={Anchor}>
            <Pessoa u={d.gestor} papel="Gestor" />
          </Card>

          <Card titulo="Reserva" icon={CalendarDays}>
            {!r ? (
              <p className="text-sm text-slate-400">Reserva não encontrada.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  {r.tipo === 'embarcacao' ? <Ship className="w-4 h-4 text-slate-400 mt-0.5" /> : <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700">{r.roteiro?.nome ?? r.item_nome}</p>
                    <p className="text-[11px] text-slate-400">
                      {r.tipo === 'embarcacao' ? 'Reserva de embarcação' : 'Reserva de roteiro'}{localidade ? ` · ${localidade}` : ''}
                    </p>
                    <div className="flex flex-wrap gap-3 mt-1">
                      {r.roteiro_id && (
                        <Link href={`/administrator/roteiros/${r.roteiro_id}/editar`} className="text-xs font-semibold text-[#0B3D91] hover:underline">Roteiro no admin</Link>
                      )}
                      {r.embarcacao_id && (
                        <Link href={`/administrator/embarcacoes/${r.embarcacao_id}/editar`} className="text-xs font-semibold text-[#0B3D91] hover:underline">Embarcação no admin</Link>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Status"><Badge cls={RESERVA_STATUS[r.status].cls}>{RESERVA_STATUS[r.status].label}</Badge></Campo>
                  <Campo label="Modalidade">{MODALIDADE_LABEL[r.modalidade_preco] ?? r.modalidade_preco}</Campo>
                  <Campo label={r.data_fim_reserva ? 'Período' : 'Data do passeio'}>
                    {formatarDataCurta(r.data_reserva)}{r.data_fim_reserva && r.data_fim_reserva !== r.data_reserva ? ` → ${formatarDataCurta(r.data_fim_reserva)}` : ''}
                  </Campo>
                  <Campo label="Pessoas"><span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5 text-slate-400" />{r.quantidade_pessoas}</span></Campo>
                  {r.quantidade_diarias != null && <Campo label="Diárias">{r.quantidade_diarias}</Campo>}
                  {r.flexibilidade ? <Campo label="Flexibilidade">± {r.flexibilidade} dia(s)</Campo> : null}
                  {r.roteiro?.duracao_horas != null && <Campo label="Duração">{r.roteiro.duracao_horas}h</Campo>}
                  {r.embarcacao && <Campo label="Embarcação">{r.embarcacao.nome}</Campo>}
                  <Campo label="Solicitada em">{dh(r.solicitado_em)}</Campo>
                  <Campo label="Aceita em">{dh(r.aceita_em)}</Campo>
                  {r.cancelada_em && <Campo label="Cancelada em">{dh(r.cancelada_em)}</Campo>}
                  {r.expirada_em && <Campo label="Expirada em">{dh(r.expirada_em)}</Campo>}
                  <Campo label="ID da reserva"><CopiarValor valor={r.id} curto /></Campo>
                </div>
                {r.reserva_adicional.length > 0 && (
                  <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5"><ShoppingCart className="w-3.5 h-3.5" /> Adicionais</p>
                    {r.reserva_adicional.map((a) => (
                      <div key={a.id} className="flex justify-between text-xs text-slate-600">
                        <span>{a.descricao} <span className="text-slate-400 uppercase text-[10px]">{a.tipo}</span></span>
                        <span>{brl(a.valor)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {r.reserva_atendente.length > 0 && (
                  <Campo label="Atendentes">
                    {r.reserva_atendente
                      .map((a) => a.equipe_membro)
                      .filter((m): m is NonNullable<typeof m> => !!m)
                      .map((m) => `${m.is_gestor ? 'Gestor' : m.nome_completo}${m.telefone ? ` (${formatarTelefone(m.telefone)})` : ''}`)
                      .join(', ')}
                  </Campo>
                )}
                {r.observacao_gestor && <Campo label="Observação do gestor ao cliente">{r.observacao_gestor}</Campo>}
                {d.aceites.map((a) => (
                  <Link key={a.id} href={`/administrator/termos/aceites/${a.id}`}
                    className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-xs text-emerald-800 hover:bg-emerald-50">
                    <ShieldCheck className="w-4 h-4" /> Termo da reserva aceito (v{a.termo_versao}) em {dh(a.aceito_em)} · ver evidências
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card titulo="Descontos e cupom" icon={TicketPercent}>
            {d.descontos.length === 0 ? (
              <p className="text-sm text-slate-400">Sem desconto.</p>
            ) : (
              <div className="space-y-3">
                {d.descontos.map((ds) => (
                  <div key={ds.id} className="rounded-lg border border-slate-100 px-3 py-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700">
                        {ds.tipo === 'cupom' ? `Cupom ${ds.cupom_codigo}` : ds.tipo === 'manual' ? 'Desconto manual' : 'Promocional'}
                      </span>
                      <span className="text-emerald-600">−{brl(ds.valor)}</span>
                    </div>
                    {ds.descricao && <p className="text-[11px] text-slate-400 mt-0.5">{ds.descricao}</p>}
                    {ds.percentual != null && <p className="text-[11px] text-slate-400">{Number(ds.percentual)}%</p>}
                  </div>
                ))}
                {d.cupom && (
                  <div className="text-xs text-slate-500 space-y-1">
                    <p className="flex items-center gap-1"><Percent className="w-3 h-3" /> Cupom cadastrado: {d.cupom.tipo_desconto === 'percentual' ? `${d.cupom.valor}%` : brl(d.cupom.valor)} · {d.cupom.ativo ? 'ativo' : 'inativo'}</p>
                    {d.cupomUso && <p>Uso registrado em {dh(d.cupomUso.criado_em)} ({brl(d.cupomUso.valor_desconto)} na solicitação)</p>}
                    <Link href={`/administrator/cupons/${d.cupom.id}/editar`} className="font-semibold text-[#0B3D91] hover:underline">Abrir cupom</Link>
                  </div>
                )}
                <p className="text-[11px] text-slate-400">O desconto sai só da taxa de serviço (limitado a ela).</p>
              </div>
            )}
          </Card>

          <Card titulo={`Anotações internas (${anotacoes.length})`} icon={StickyNote}>
            {anotacoes.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma anotação. Use o botão “Anotação” no topo.</p>
            ) : (
              <ul className="space-y-2">
                {anotacoes.map((a) => (
                  <li key={a.id} className="rounded-lg bg-amber-50/60 border border-amber-100 px-3 py-2">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.motivo}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{a.admin?.name ?? 'Admin'} · {dh(a.criado_em)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card titulo={`Auditoria (${d.auditoria.length})`} icon={ShieldCheck}>
            {d.auditoria.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma ação manual do admin neste pedido.</p>
            ) : (
              <ul className="space-y-2">
                {[...d.auditoria].reverse().map((a) => (
                  <li key={a.id} className="rounded-lg border border-slate-100 px-3 py-2">
                    <p className="text-sm font-medium text-slate-700">{ACAO_LABEL[a.acao] ?? a.acao}</p>
                    <p className="text-[11px] text-slate-400">{a.admin?.name ?? 'Admin'} ({a.admin?.email ?? '—'}) · {dh(a.criado_em)}</p>
                    {a.motivo && a.acao !== 'pedido.anotacao' && <p className="text-xs text-slate-500 mt-1">Motivo: {a.motivo}</p>}
                    {(a.antes != null || a.depois != null) && (
                      <div className="mt-1.5"><Json valor={{ antes: a.antes, depois: a.depois }} titulo="Antes / depois" /></div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
