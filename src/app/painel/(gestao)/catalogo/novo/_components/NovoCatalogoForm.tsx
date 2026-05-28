'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info, DollarSign, ChevronRight, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { criarCatalogo } from '../actions';
import type { CatalogoTipo } from '@/types/supabase';

const inputCls = `w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800
  placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20
  focus:border-[#0B2447]/40 transition bg-white`;

const selectCls = `${inputCls} appearance-none cursor-pointer`;

function SectionCard({ icon: Icon, title, children }: {
  icon: React.ElementType; title: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <Icon className="w-4 h-4 text-[#0B2447]" />
        <h2 className="text-sm font-bold text-[#0B2447] tracking-wide uppercase">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default function NovoCatalogoForm() {
  const router = useRouter();

  const [form, setForm] = useState<{ descricao: string; valor: string; tipo: CatalogoTipo }>({
    descricao: '',
    valor: '',
    tipo: 'produto',
  });

  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setField<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFeedback(null);
    setSubmitting(true);

    const result = await criarCatalogo({
      descricao: form.descricao,
      valor: form.valor,
      tipo: form.tipo,
    });

    if (!result.ok) {
      setFeedback({ type: 'error', msg: result.error });
      setSubmitting(false);
      return;
    }

    setFeedback({ type: 'success', msg: 'Item cadastrado com sucesso!' });
    setSubmitting(false);
    setTimeout(() => router.push('/painel/catalogo'), 1200);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">

      {/* ── Informações ──────────────────────────────────────────────────── */}
      <SectionCard icon={Info} title="Informações do item">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <Field label="Descrição" required>
              <input
                className={inputCls}
                placeholder="ex: Locação de equipamento de mergulho"
                value={form.descricao}
                onChange={e => setField('descricao', e.target.value)}
                required
              />
            </Field>
          </div>

          <Field label="Tipo" required>
            <select
              className={selectCls}
              value={form.tipo}
              onChange={e => setField('tipo', e.target.value as CatalogoTipo)}
            >
              <option value="produto">Produto</option>
              <option value="servico">Serviço</option>
            </select>
          </Field>
        </div>
      </SectionCard>

      {/* ── Precificação ──────────────────────────────────────────────────── */}
      <SectionCard icon={DollarSign} title="Precificação">
        <div className="max-w-xs">
          <Field label="Valor (R$)" required hint="Valor unitário do produto ou serviço.">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">R$</span>
              <input
                className={`${inputCls} pl-10`}
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={form.valor}
                onChange={e => setField('valor', e.target.value)}
                required
              />
            </div>
          </Field>
        </div>
      </SectionCard>

      {/* ── Feedback ─────────────────────────────────────────────────────── */}
      {feedback && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
          feedback.type === 'error'
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
        }`}>
          {feedback.type === 'error'
            ? <AlertCircle className="w-4 h-4 shrink-0" />
            : <CheckCircle className="w-4 h-4 shrink-0" />}
          {feedback.msg}
        </div>
      )}

      {/* ── Ações ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pb-4">
        <button
          type="button"
          onClick={() => router.push('/painel/catalogo')}
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting || !form.descricao.trim() || !form.valor}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold transition shadow-md shadow-[#0B2447]/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
            : <><ChevronRight className="w-4 h-4" /> Salvar item</>}
        </button>
      </div>
    </form>
  );
}
