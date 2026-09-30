'use client';

import { useState } from 'react';
import { PlugZap, Loader2, CircleCheck, TriangleAlert } from 'lucide-react';
import type { AsaasAmbiente } from '@/lib/asaas/config';
import { testarConexaoAsaas } from '../actions';

type Props = {
  configurado: boolean;
  erroConfig: string | null;
  ambiente: AsaasAmbiente | null;
  apiUrl: string | null;
  tokenWebhookConfigurado: boolean;
};

type Resultado =
  | { ok: true; saldo: number; latenciaMs: number }
  | { ok: false; error: string };

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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

export default function ConexaoAsaasCard({ configurado, erroConfig, ambiente, apiUrl, tokenWebhookConfigurado }: Props) {
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function handleTestar() {
    setTestando(true);
    setResultado(null);
    const r = await testarConexaoAsaas();
    setTestando(false);
    setResultado(r.ok ? { ok: true, saldo: r.saldo, latenciaMs: r.latenciaMs } : { ok: false, error: r.error });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Conexão com o Asaas</p>
          <p className="text-sm text-slate-500 mt-1">Credenciais lidas das variáveis de ambiente do servidor.</p>
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
        <Linha label="Chave de API">
          <Status ok={configurado} sim="Configurada" nao="Não configurada" />
        </Linha>
        <Linha label="URL da API">{apiUrl ?? '—'}</Linha>
        <Linha label="Token do webhook">
          <Status ok={tokenWebhookConfigurado} sim="Configurado" nao="Não configurado" />
        </Linha>
      </div>

      {erroConfig && (
        <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">{erroConfig}</p>
      )}

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
          {resultado.ok
            ? `Conectado. Saldo disponível: ${brl(resultado.saldo)} (${resultado.latenciaMs} ms).`
            : resultado.error}
        </p>
      )}
    </div>
  );
}
