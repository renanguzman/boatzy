'use client';

import { useState } from 'react';
import { PlugZap, Loader2, CircleCheck, TriangleAlert, Copy, Check } from 'lucide-react';
import type { PagarmeAmbiente } from '@/lib/pagarme/config';
import { testarConexaoPagarme } from '../actions';

/**
 * Conexão com a Pagar.me (cartão de crédito, SPEC §109): chaves lidas do
 * ambiente, teste real da API e o que cadastrar no dashboard da Pagar.me
 * (webhook com Basic Auth e domínios liberados para a tokenização).
 */

type Props = {
  configurado: boolean;
  erroConfig: string | null;
  ambiente: PagarmeAmbiente | null;
  credenciaisWebhook: boolean;
  urlWebhook: string;
  dominio: string;
  cartaoNaPagarme: boolean;
};

type Resultado = { ok: true; latenciaMs: number } | { ok: false; error: string };

const EVENTOS = [
  'order.paid', 'order.payment_failed', 'order.canceled', 'charge.paid', 'charge.payment_failed',
  'charge.refunded', 'charge.partial_canceled', 'charge.antifraud_approved', 'charge.antifraud_reproved',
  'charge.antifraud_manual', 'charge.antifraud_pending', 'chargeback.received',
];

function Linha({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-slate-700 text-right break-all">{children}</span>
    </div>
  );
}

function Status({ ok, sim, nao }: { ok: boolean; sim: string; nao: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${ok ? 'text-emerald-600' : 'text-amber-600'}`}>
      {ok ? <CircleCheck className="w-4 h-4" /> : <TriangleAlert className="w-4 h-4" />}
      {ok ? sim : nao}
    </span>
  );
}

export default function ConexaoPagarmeCard({
  configurado, erroConfig, ambiente, credenciaisWebhook, urlWebhook, dominio, cartaoNaPagarme,
}: Props) {
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function handleTestar() {
    setTestando(true);
    setResultado(null);
    const r = await testarConexaoPagarme();
    setTestando(false);
    setResultado(r.ok ? { ok: true, latenciaMs: r.latenciaMs } : { ok: false, error: r.error });
  }

  async function copiarUrl() {
    await navigator.clipboard.writeText(urlWebhook);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Conexão com a Stone / Pagar.me</p>
          <p className="text-sm text-slate-500 mt-1">Cartão de crédito. Credenciais lidas das variáveis de ambiente do servidor.</p>
        </div>
        {ambiente && (
          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${
              ambiente === 'sandbox' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {ambiente === 'sandbox' ? 'Sandbox' : 'Produção'}
          </span>
        )}
      </div>

      <div className="mb-5">
        <Linha label="Chaves (sk / pk)">
          <Status ok={configurado} sim="Configuradas" nao="Não configuradas" />
        </Linha>
        <Linha label="Basic Auth do webhook">
          <Status ok={credenciaisWebhook} sim="Configurado" nao="Não configurado" />
        </Linha>
        <Linha label="Cartão no checkout">
          <Status ok={cartaoNaPagarme} sim="Processado pela Pagar.me" nao="Ainda no Asaas (ligue em Configurações)" />
        </Linha>
      </div>

      {erroConfig && (
        <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">{erroConfig}</p>
      )}

      <div className="mb-5 rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-xs text-slate-600 space-y-2">
        <p className="font-semibold text-slate-700">Cadastrar no dashboard da Pagar.me</p>
        <p>
          <span className="font-semibold">1. Webhook</span> — URL abaixo, autenticação <b>Basic</b> com o usuário e a senha de{' '}
          <code>PAGARME_WEBHOOK_USER</code> / <code>PAGARME_WEBHOOK_PASSWORD</code>, eventos:
        </p>
        <div className="flex items-stretch gap-2">
          <input readOnly value={urlWebhook} className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600" />
          <button type="button" onClick={copiarUrl} className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2.5 text-xs font-semibold text-[#0B2447] hover:bg-slate-50">
            {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <p className="font-mono text-[11px] text-slate-500 break-words">{EVENTOS.join(', ')}</p>
        <p>
          <span className="font-semibold">2. Domínios permitidos</span> (tokenização do cartão no navegador): <code>{dominio}</code>
          {ambiente === 'sandbox' && <> e <code>localhost</code></>}.
        </p>
      </div>

      <button
        type="button"
        onClick={handleTestar}
        disabled={!configurado || testando}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B2447] text-white text-sm font-semibold hover:bg-[#0B3D91] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {testando ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
        Testar conexão
      </button>

      {resultado && (
        <p
          className={`mt-4 text-sm rounded-xl px-4 py-3 border ${
            resultado.ok ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-red-700 bg-red-50 border-red-100'
          }`}
        >
          {resultado.ok ? `Conectado (${resultado.latenciaMs} ms).` : resultado.error}
        </p>
      )}
    </div>
  );
}
