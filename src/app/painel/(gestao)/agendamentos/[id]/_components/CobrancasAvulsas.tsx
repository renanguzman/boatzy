'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Copy, Eye, HandCoins, Loader2, MessageCircle, Plus, XCircle } from 'lucide-react';
import type { PedidoStatus } from '@/types/supabase';
import type { CobrancaAvulsa } from '@/lib/pagamentos/avulso';
import { formatCurrencyPrecise } from '@/lib/utils';
import { formatarDataHora } from '@/lib/datas';
import { cancelarCobrancaAvulsaGestor, registrarCompartilhamentoCobranca } from '../../cobrancas-actions';
import NovaCobrancaModal, { type ItemCatalogo, type OpcaoForma } from './NovaCobrancaModal';
import { linkWhatsAppCobranca } from './compartilhar';

const STATUS: Record<PedidoStatus, { label: string; badge: string }> = {
  aguardando_pagamento: { label: 'Aguardando pagamento', badge: 'bg-violet-100 text-violet-700' },
  pago: { label: 'Paga', badge: 'bg-emerald-100 text-emerald-700' },
  expirado: { label: 'Expirada', badge: 'bg-slate-100 text-slate-500' },
  cancelado: { label: 'Cancelada', badge: 'bg-slate-100 text-slate-500' },
  reembolsado: { label: 'Reembolsada', badge: 'bg-amber-100 text-amber-700' },
  reembolsado_parcial: { label: 'Reembolsada parcialmente', badge: 'bg-amber-100 text-amber-700' },
  em_disputa: { label: 'Em disputa', badge: 'bg-red-100 text-red-600' },
};

const TIPO_ITEM: Record<string, string> = { produto: 'produto', servico: 'serviço', taxa: 'taxa', outro: 'outro' };

type Props = {
  reservaId: string;
  itemNome: string;
  cobrancas: CobrancaAvulsa[];
  /** null = pode emitir; texto = por que não pode. */
  bloqueio: string | null;
  catalogo: ItemCatalogo[];
  formas: OpcaoForma[];
  taxaPercent: number;
  prazoPadraoHoras: number;
  prazoMaxDias: number;
  baseUrl: string;
  clienteTelefone: string | null;
};

export default function CobrancasAvulsas(props: Props) {
  const [aberto, setAberto] = useState(false);

  // Sem cobranças e sem poder emitir: não ocupa espaço (reserva pendente, recusada…).
  if (!props.cobrancas.length && props.bloqueio) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#0B2447]">
          <HandCoins className="h-4 w-4" /> Cobranças adicionais
        </h2>
        {!props.bloqueio && (
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2447] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0B3D91] transition"
          >
            <Plus className="h-3.5 w-3.5" /> Nova cobrança
          </button>
        )}
      </div>

      {props.cobrancas.length === 0 ? (
        <p className="text-sm text-slate-500">
          Precisa cobrar algo que não estava na reserva — consumo, um serviço extra ou uma taxa? Gere uma cobrança e o
          cliente paga pelo Boatzy, com Pix ou cartão.
        </p>
      ) : (
        <ul className="space-y-3">
          {props.cobrancas.map((c) => <CobrancaItem key={c.id} c={c} {...props} />)}
        </ul>
      )}

      {props.bloqueio && props.cobrancas.length > 0 && (
        <p className="mt-3 text-xs text-slate-400">{props.bloqueio}</p>
      )}

      {aberto && (
        <NovaCobrancaModal
          reservaId={props.reservaId}
          catalogo={props.catalogo}
          formas={props.formas}
          taxaPercent={props.taxaPercent}
          prazoPadraoHoras={props.prazoPadraoHoras}
          prazoMaxDias={props.prazoMaxDias}
          baseUrl={props.baseUrl}
          clienteTelefone={props.clienteTelefone}
          itemNome={props.itemNome}
          onClose={() => setAberto(false)}
        />
      )}
    </section>
  );
}

function CobrancaItem({ c, reservaId, baseUrl, clienteTelefone, itemNome }: Props & { c: CobrancaAvulsa }) {
  const router = useRouter();
  const [detalhes, setDetalhes] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const s = STATUS[c.status];
  const link = `${baseUrl}/cobrancas/${c.id}`;
  const aberta = c.status === 'aguardando_pagamento' && (!c.expira_em || new Date(c.expira_em) > new Date());

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt('Copie o link da cobrança:', link);
    }
    void registrarCompartilhamentoCobranca(c.id, 'copiar');
  }

  function cancelar() {
    setErro(null);
    startTransition(async () => {
      const r = await cancelarCobrancaAvulsaGestor({ reservaId, pedidoId: c.id, motivo: motivo.trim() });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setCancelando(false);
      router.refresh();
    });
  }

  return (
    <li className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-700 break-words">{c.titulo}</p>
          <p className="text-[11px] text-slate-400">Cobrança #{c.numero} · {formatarDataHora(c.criado_em)}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.badge}`}>
          {aberta || c.status !== 'aguardando_pagamento' ? s.label : 'Prazo vencido'}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <span className="text-slate-500">Cliente paga</span>
        <span className="text-right font-medium text-slate-700">{formatCurrencyPrecise(Number(c.valor_total))}</span>
        <span className="text-slate-500">Você recebe</span>
        <span className="text-right font-bold text-emerald-700">{formatCurrencyPrecise(Number(c.valor_itens))}</span>
        <span className="text-slate-500">Pagamento</span>
        <span className="text-right text-slate-600">
          {c.formas_permitidas.map((f) => (f === 'pix' ? 'Pix' : `Cartão${c.parcelas_max > 1 ? ` até ${c.parcelas_max}x` : ''}`)).join(' · ')}
        </span>
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        {c.status === 'pago' && c.pago_em && <>Paga em {formatarDataHora(c.pago_em)}.</>}
        {c.status === 'aguardando_pagamento' && c.expira_em && <>Prazo: {formatarDataHora(c.expira_em)}.</>}
        {(c.status === 'cancelado' || c.status === 'expirado') && c.motivo_cancelamento && <>{c.motivo_cancelamento}.</>}
        {c.visualizado_em && c.status === 'aguardando_pagamento' && (
          <span className="ml-1 inline-flex items-center gap-1 text-slate-400"><Eye className="h-3 w-3" /> visualizada pelo cliente</span>
        )}
      </p>

      <button type="button" onClick={() => setDetalhes((d) => !d)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700">
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${detalhes ? 'rotate-180' : ''}`} />
        {detalhes ? 'Ocultar itens' : `Ver itens (${c.itens.length})`}
      </button>
      {detalhes && (
        <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-2.5 space-y-1 text-xs">
          {c.itens.map((i) => (
            <div key={i.id} className="flex justify-between gap-2">
              <span className="text-slate-600 min-w-0">
                {Number(i.quantidade) !== 1 && `${Number(i.quantidade).toLocaleString('pt-BR')} × `}{i.descricao}
                <span className="ml-1.5 text-[9px] uppercase tracking-wider text-slate-400">{TIPO_ITEM[i.tipo] ?? i.tipo}</span>
              </span>
              <span className="shrink-0 font-medium text-slate-700">{formatCurrencyPrecise(Number(i.valor_total))}</span>
            </div>
          ))}
          {c.valor_ajuste !== 0 && (
            <div className="flex justify-between gap-2 border-t border-slate-200 pt-1">
              <span className="text-slate-500">Ajuste{c.motivo_ajuste ? ` — ${c.motivo_ajuste}` : ''}</span>
              <span className="shrink-0 text-slate-700">{c.valor_ajuste > 0 ? '+' : ''}{formatCurrencyPrecise(c.valor_ajuste)}</span>
            </div>
          )}
          {c.mensagem_cliente && <p className="border-t border-slate-200 pt-1 text-slate-500">Recado: “{c.mensagem_cliente}”</p>}
        </div>
      )}

      {aberta && !cancelando && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button type="button" onClick={copiar} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">
            {copiado ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copiado ? 'Copiado' : 'Copiar link'}
          </button>
          <a
            href={linkWhatsAppCobranca({ telefone: clienteTelefone, link, titulo: c.titulo, itemNome })}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void registrarCompartilhamentoCobranca(c.id, 'whatsapp')}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition"
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
          <button type="button" onClick={() => setCancelando(true)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition">
            <XCircle className="h-3.5 w-3.5" /> Cancelar
          </button>
        </div>
      )}

      {cancelando && (
        <div className="mt-3 rounded-lg border border-red-100 bg-red-50/60 p-2.5 space-y-2">
          <p className="text-xs text-red-800">Cancelar esta cobrança? O cliente é avisado e o link deixa de funcionar.</p>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={300}
            placeholder="Motivo (opcional)"
            className="w-full rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none"
          />
          {erro && <p className="text-xs text-red-700" role="alert">{erro}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setCancelando(false)} disabled={pendente} className="px-2.5 py-1.5 text-xs text-slate-500">Voltar</button>
            <button type="button" onClick={cancelar} disabled={pendente} className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60">
              {pendente && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Cancelar cobrança
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
