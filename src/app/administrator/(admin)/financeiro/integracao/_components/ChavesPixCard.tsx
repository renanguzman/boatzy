'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode, Plus, Loader2, TriangleAlert, CircleCheck } from 'lucide-react';
import type { AsaasChavePix } from '@/lib/asaas/tipos';
import { criarChavePixAsaas } from '../actions';

const STATUS_CHAVE: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Ativa', cls: 'bg-emerald-50 text-emerald-700' },
  AWAITING_ACTIVATION: { label: 'Aguardando ativação', cls: 'bg-amber-50 text-amber-700' },
  AWAITING_DELETION: { label: 'Aguardando exclusão', cls: 'bg-slate-100 text-slate-500' },
  AWAITING_ACCOUNT_DELETION: { label: 'Aguardando exclusão', cls: 'bg-slate-100 text-slate-500' },
  DELETED: { label: 'Excluída', cls: 'bg-slate-100 text-slate-500' },
  ERROR: { label: 'Erro', cls: 'bg-red-50 text-red-700' },
};

type Props = { habilitado: boolean; chaves: AsaasChavePix[]; erro: string | null };

/** Chaves Pix da conta Asaas. Sem chave ativa, o Asaas recusa cobranças Pix. */
export default function ChavesPixCard({ habilitado, chaves, erro }: Props) {
  const router = useRouter();
  const [criando, setCriando] = useState(false);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);
  const temAtiva = chaves.some((k) => k.status === 'ACTIVE');
  const temPendente = chaves.some((k) => k.status === 'AWAITING_ACTIVATION');

  async function handleCriar() {
    if (!confirm('Criar uma chave Pix aleatória nesta conta Asaas?')) return;
    setCriando(true);
    setMensagem(null);
    const r = await criarChavePixAsaas();
    setCriando(false);
    setMensagem(r.ok ? { ok: true, texto: 'Chave Pix criada.' } : { ok: false, texto: r.error });
    if (r.ok) router.refresh();
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Chaves Pix da conta</p>
          <p className="text-sm text-slate-500 mt-1">Sem uma chave ativa, as cobranças Pix são recusadas pelo Asaas.</p>
        </div>
        {habilitado && !temAtiva && !temPendente && !erro && (
          <button type="button" onClick={handleCriar} disabled={criando}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-[#0B2447] bg-slate-100 hover:bg-slate-200 disabled:opacity-40 whitespace-nowrap">
            {criando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Criar chave aleatória
          </button>
        )}
      </div>

      {!habilitado ? (
        <p className="text-sm text-slate-400">Configure a chave de API para consultar.</p>
      ) : erro ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{erro}</p>
      ) : (
        <>
          <p className={`flex items-center gap-2 text-sm mb-3 ${temAtiva ? 'text-emerald-700' : 'text-amber-700'}`}>
            {temAtiva ? <CircleCheck className="w-4 h-4" /> : <TriangleAlert className="w-4 h-4" />}
            {temAtiva ? 'Pix pronto para receber.' : temPendente ? 'Chave aguardando ativação — Pix ainda indisponível.' : 'Nenhuma chave Pix — pagamentos por Pix vão falhar.'}
          </p>
          {chaves.length > 0 && (
            <ul className="space-y-2">
              {chaves.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-2.5">
                  <span className="flex items-center gap-2 min-w-0">
                    <QrCode className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-mono text-xs text-slate-600 truncate">{k.key}</span>
                    <span className="text-[10px] text-slate-400">{k.type}</span>
                  </span>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${(STATUS_CHAVE[k.status] ?? STATUS_CHAVE.ERROR).cls}`}>
                    {(STATUS_CHAVE[k.status] ?? { label: k.status }).label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {mensagem && (
        <p className={`mt-4 text-sm rounded-xl px-4 py-3 border ${mensagem.ok ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-red-700 bg-red-50 border-red-100'}`}>
          {mensagem.texto}
        </p>
      )}
    </div>
  );
}
