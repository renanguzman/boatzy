'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Webhook, Loader2, Play, Plus, TriangleAlert } from 'lucide-react';
import type { AsaasWebhookConfig } from '@/lib/asaas/tipos';
import { cadastrarWebhookAsaas, reativarWebhookAsaas } from '../actions';

type Props = {
  habilitado: boolean;
  webhooks: AsaasWebhookConfig[];
  erro: string | null;
  urlSugerida: string;
  emailSugerido: string;
  tokenWebhookConfigurado: boolean;
};

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition';

function SituacaoBadge({ w }: { w: AsaasWebhookConfig }) {
  const [cls, label] = !w.enabled
    ? ['bg-slate-100 text-slate-500', 'Desativado']
    : w.interrupted
      ? ['bg-red-50 text-red-700', 'Fila pausada']
      : ['bg-emerald-50 text-emerald-700', 'Ativo'];
  return <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${cls}`}>{label}</span>;
}

export default function WebhooksAsaasCard({
  habilitado, webhooks, erro, urlSugerida, emailSugerido, tokenWebhookConfigurado,
}: Props) {
  const router = useRouter();
  const [formAberto, setFormAberto] = useState(false);
  const [url, setUrl] = useState(urlSugerida);
  const [email, setEmail] = useState(emailSugerido);
  const [salvando, setSalvando] = useState(false);
  const [reativando, setReativando] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);

  async function handleCadastrar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setMensagem(null);
    const r = await cadastrarWebhookAsaas({ url, email });
    setSalvando(false);
    if (r.ok) {
      setFormAberto(false);
      setMensagem({ ok: true, texto: 'Webhook cadastrado no Asaas.' });
      router.refresh();
    } else {
      setMensagem({ ok: false, texto: r.error });
    }
  }

  async function handleReativar(id: string) {
    if (!confirm('Reativar a fila deste webhook? Faça isso só depois de corrigir a causa das falhas — o Asaas reenviará os eventos acumulados.')) return;
    setReativando(id);
    setMensagem(null);
    const r = await reativarWebhookAsaas(id);
    setReativando(null);
    if (r.ok) {
      setMensagem({ ok: true, texto: 'Fila reativada.' });
      router.refresh();
    } else {
      setMensagem({ ok: false, texto: r.error });
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Webhooks na conta Asaas</p>
          <p className="text-sm text-slate-500 mt-1">
            Fila sequencial com o token de <code className="text-xs">ASAAS_WEBHOOK_TOKEN</code>.
          </p>
        </div>
        {habilitado && !formAberto && (
          <button
            type="button"
            onClick={() => setFormAberto(true)}
            disabled={!tokenWebhookConfigurado}
            title={tokenWebhookConfigurado ? undefined : 'Configure ASAAS_WEBHOOK_TOKEN primeiro'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-[#0B2447] bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Cadastrar
          </button>
        )}
      </div>

      {!habilitado ? (
        <p className="text-sm text-slate-400">Configure a chave de API para consultar os webhooks.</p>
      ) : erro ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{erro}</p>
      ) : webhooks.length === 0 ? (
        <div className="flex items-center gap-3 text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-3">
          <Webhook className="w-4 h-4 text-slate-400 flex-shrink-0" />
          Nenhum webhook cadastrado — os eventos do Asaas ainda não chegam ao Boatzy.
        </div>
      ) : (
        <ul className="space-y-3">
          {webhooks.map((w) => (
            <li key={w.id} className="rounded-xl border border-slate-100 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-700 truncate">{w.name}</p>
                <SituacaoBadge w={w} />
              </div>
              <p className="text-xs text-slate-500 break-all mt-1">{w.url}</p>
              <p className="text-[11px] text-slate-400 mt-1">
                {w.events.length} eventos · {w.sendType === 'SEQUENTIALLY' ? 'sequencial' : 'não sequencial'} ·{' '}
                {w.hasAuthToken ? 'com token' : 'sem token'}
                {w.penalizedRequestsCount > 0 && ` · ${w.penalizedRequestsCount} falhas penalizadas`}
              </p>
              {w.url.replace(/\/+$/, '') !== urlSugerida && (
                <p className="text-[11px] text-slate-400 mt-1">URL diferente da deste ambiente ({urlSugerida}).</p>
              )}
              {w.interrupted && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-red-50 px-3 py-2">
                  <span className="flex items-center gap-1.5 text-xs text-red-700">
                    <TriangleAlert className="w-3.5 h-3.5 flex-shrink-0" />
                    Eventos acumulados são descartados após 14 dias.
                  </span>
                  <button
                    type="button"
                    onClick={() => handleReativar(w.id)}
                    disabled={reativando === w.id}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-800 disabled:opacity-50 whitespace-nowrap"
                  >
                    {reativando === w.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Reativar fila
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {formAberto && (
        <form onSubmit={handleCadastrar} className="mt-5 space-y-3 border-t border-slate-100 pt-5">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">URL do endpoint (https, pública)</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} className={`${inputCls} mt-1`} required />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">E-mail para alertas de falha do Asaas</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputCls} mt-1`} required />
          </label>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B2447] text-white text-sm font-semibold hover:bg-[#0B3D91] disabled:opacity-50 transition-colors"
            >
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
              Cadastrar no Asaas
            </button>
            <button
              type="button"
              onClick={() => setFormAberto(false)}
              disabled={salvando}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {mensagem && (
        <p
          className={`mt-4 text-sm rounded-xl px-4 py-3 border ${
            mensagem.ok ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-red-700 bg-red-50 border-red-100'
          }`}
        >
          {mensagem.texto}
        </p>
      )}
    </div>
  );
}
