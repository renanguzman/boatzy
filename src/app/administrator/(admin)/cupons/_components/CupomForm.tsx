'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Ticket, Percent, CalendarRange, Handshake, ChevronRight, Loader2,
  AlertCircle, CheckCircle, Plus, X,
} from 'lucide-react';
import { criarCupom, atualizarCupom, criarParceiro, type CupomPayload } from '../actions';
import type { CupomTipoDesconto } from '@/types/supabase';

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

export type ParceiroOption = { id: string; nome: string };

export type CupomInicial = {
  id: string;
  codigo: string;
  descricao: string | null;
  tipoDesconto: CupomTipoDesconto;
  valor: number;
  valorDescontoMaximo: number | null;
  valorMinimoPedido: number | null;
  dataInicio: string | null;
  dataFim: string | null;
  limiteUsoTotal: number | null;
  limiteUsoPorCliente: number | null;
  ativo: boolean;
  parceiroId: string | null;
};

type FormState = {
  codigo: string;
  descricao: string;
  tipoDesconto: CupomTipoDesconto;
  valor: string;
  valorDescontoMaximo: string;
  valorMinimoPedido: string;
  dataInicio: string;
  dataFim: string;
  limiteUsoTotal: string;
  limiteUsoPorCliente: string;
  ativo: boolean;
  parceiroId: string;
};

function estadoInicial(cupom?: CupomInicial): FormState {
  if (!cupom) {
    return {
      codigo: '', descricao: '', tipoDesconto: 'percentual', valor: '',
      valorDescontoMaximo: '', valorMinimoPedido: '', dataInicio: '', dataFim: '',
      limiteUsoTotal: '', limiteUsoPorCliente: '', ativo: true, parceiroId: '',
    };
  }
  return {
    codigo: cupom.codigo,
    descricao: cupom.descricao ?? '',
    tipoDesconto: cupom.tipoDesconto,
    valor: String(cupom.valor),
    valorDescontoMaximo: cupom.valorDescontoMaximo != null ? String(cupom.valorDescontoMaximo) : '',
    valorMinimoPedido: cupom.valorMinimoPedido != null ? String(cupom.valorMinimoPedido) : '',
    dataInicio: cupom.dataInicio ?? '',
    dataFim: cupom.dataFim ?? '',
    limiteUsoTotal: cupom.limiteUsoTotal != null ? String(cupom.limiteUsoTotal) : '',
    limiteUsoPorCliente: cupom.limiteUsoPorCliente != null ? String(cupom.limiteUsoPorCliente) : '',
    ativo: cupom.ativo,
    parceiroId: cupom.parceiroId ?? '',
  };
}

type Props = {
  parceiros: ParceiroOption[];
  cupom?: CupomInicial; // presente = modo edição
};

export default function CupomForm({ parceiros: parceirosIniciais, cupom }: Props) {
  const router = useRouter();
  const editando = !!cupom;

  const [form, setForm] = useState<FormState>(estadoInicial(cupom));
  const [parceiros, setParceiros] = useState(parceirosIniciais);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Cadastro rápido de parceiro (sem tela própria ainda).
  const [modalParceiroAberto, setModalParceiroAberto] = useState(false);
  const [nomeNovoParceiro, setNomeNovoParceiro] = useState('');
  const [salvandoParceiro, setSalvandoParceiro] = useState(false);
  const [erroParceiro, setErroParceiro] = useState<string | null>(null);

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFeedback(null);
    setSubmitting(true);

    const payload: CupomPayload = {
      codigo: form.codigo,
      descricao: form.descricao,
      tipoDesconto: form.tipoDesconto,
      valor: form.valor,
      valorDescontoMaximo: form.tipoDesconto === 'percentual' ? form.valorDescontoMaximo : '',
      valorMinimoPedido: form.valorMinimoPedido,
      dataInicio: form.dataInicio,
      dataFim: form.dataFim,
      limiteUsoTotal: form.limiteUsoTotal,
      limiteUsoPorCliente: form.limiteUsoPorCliente,
      ativo: form.ativo,
      parceiroId: form.parceiroId || null,
    };

    const result = editando
      ? await atualizarCupom(cupom!.id, payload)
      : await criarCupom(payload);

    if (!result.ok) {
      setFeedback({ type: 'error', msg: result.error ?? 'Erro desconhecido.' });
      setSubmitting(false);
      return;
    }

    setFeedback({ type: 'success', msg: editando ? 'Cupom atualizado com sucesso!' : 'Cupom cadastrado com sucesso!' });
    setSubmitting(false);
    setTimeout(() => router.push('/administrator/cupons'), 1200);
  }

  async function handleSalvarParceiro() {
    if (salvandoParceiro) return;
    setErroParceiro(null);
    setSalvandoParceiro(true);
    const result = await criarParceiro(nomeNovoParceiro);
    if (!result.ok) {
      setErroParceiro(result.error);
      setSalvandoParceiro(false);
      return;
    }
    setParceiros(p => [...p, { id: result.parceiroId, nome: result.nome }]);
    setField('parceiroId', result.parceiroId);
    setSalvandoParceiro(false);
    setModalParceiroAberto(false);
    setNomeNovoParceiro('');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">

      {/* ── Identificação ────────────────────────────────────────────────── */}
      <SectionCard icon={Ticket} title="Identificação">
        <div className="grid grid-cols-1 gap-5">
          <Field label="Código do cupom" required hint="Só letras, números, &quot;_&quot; e &quot;-&quot; — sem espaços. Ex: VERAO2026">
            <input
              className={`${inputCls} font-mono uppercase tracking-wide`}
              placeholder="ex: VERAO2026"
              value={form.codigo}
              onChange={e => setField('codigo', e.target.value.toUpperCase().replace(/\s+/g, ''))}
              required
            />
          </Field>

          <Field label="Descrição" hint="Nota interna — não é exibida ao cliente.">
            <input
              className={inputCls}
              placeholder="ex: Campanha de verão 2026 com a Marina X"
              value={form.descricao}
              onChange={e => setField('descricao', e.target.value)}
            />
          </Field>

          <label className="flex items-center gap-3 cursor-pointer w-fit">
            <button
              type="button"
              role="switch"
              aria-checked={form.ativo}
              onClick={() => setField('ativo', !form.ativo)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
                form.ativo ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                form.ativo ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </button>
            <span className="text-sm font-medium text-slate-700">
              {form.ativo ? 'Ativo' : 'Pausado'}
            </span>
          </label>
        </div>
      </SectionCard>

      {/* ── Desconto ─────────────────────────────────────────────────────── */}
      <SectionCard icon={Percent} title="Desconto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Tipo de desconto" required>
            <select
              className={selectCls}
              value={form.tipoDesconto}
              onChange={e => setField('tipoDesconto', e.target.value as CupomTipoDesconto)}
            >
              <option value="percentual">Percentual (%)</option>
              <option value="valor_fixo">Valor fixo (R$)</option>
            </select>
          </Field>

          <Field label={form.tipoDesconto === 'percentual' ? 'Valor do desconto (%)' : 'Valor do desconto (R$)'} required>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">
                {form.tipoDesconto === 'percentual' ? '%' : 'R$'}
              </span>
              <input
                className={`${inputCls} pl-10`}
                type="number"
                min="0"
                max={form.tipoDesconto === 'percentual' ? 100 : undefined}
                step="0.01"
                placeholder="0,00"
                value={form.valor}
                onChange={e => setField('valor', e.target.value)}
                required
              />
            </div>
          </Field>

          <Field
            label="Teto de desconto (R$)"
            hint={form.tipoDesconto === 'percentual'
              ? 'Opcional. Limita o desconto em reais mesmo sendo percentual.'
              : 'Só se aplica a cupons percentuais.'}
          >
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">R$</span>
              <input
                className={`${inputCls} pl-10 disabled:bg-slate-50 disabled:text-slate-300`}
                type="number"
                min="0"
                step="0.01"
                placeholder="sem teto"
                disabled={form.tipoDesconto !== 'percentual'}
                value={form.tipoDesconto === 'percentual' ? form.valorDescontoMaximo : ''}
                onChange={e => setField('valorDescontoMaximo', e.target.value)}
              />
            </div>
          </Field>

          <Field label="Valor mínimo do pedido (R$)" hint="Opcional. Total mínimo do roteiro para o cupom valer.">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">R$</span>
              <input
                className={`${inputCls} pl-10`}
                type="number"
                min="0"
                step="0.01"
                placeholder="sem mínimo"
                value={form.valorMinimoPedido}
                onChange={e => setField('valorMinimoPedido', e.target.value)}
              />
            </div>
          </Field>
        </div>
      </SectionCard>

      {/* ── Vigência e limites ───────────────────────────────────────────── */}
      <SectionCard icon={CalendarRange} title="Vigência e limites de uso">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Data de início" hint="Em branco = vale desde já.">
            <input
              className={inputCls}
              type="date"
              value={form.dataInicio}
              onChange={e => setField('dataInicio', e.target.value)}
            />
          </Field>

          <Field label="Data de término" hint="Em branco = validade indeterminada.">
            <input
              className={inputCls}
              type="date"
              value={form.dataFim}
              onChange={e => setField('dataFim', e.target.value)}
            />
          </Field>

          <Field label="Limite de uso total" hint="Em branco = ilimitado.">
            <input
              className={inputCls}
              type="number"
              min="1"
              step="1"
              placeholder="ilimitado"
              value={form.limiteUsoTotal}
              onChange={e => setField('limiteUsoTotal', e.target.value)}
            />
          </Field>

          <Field label="Limite de uso por cliente" hint="Em branco = ilimitado por cliente.">
            <input
              className={inputCls}
              type="number"
              min="1"
              step="1"
              placeholder="ilimitado"
              value={form.limiteUsoPorCliente}
              onChange={e => setField('limiteUsoPorCliente', e.target.value)}
            />
          </Field>
        </div>
      </SectionCard>

      {/* ── Parceiro ─────────────────────────────────────────────────────── */}
      <SectionCard icon={Handshake} title="Parceiro (opcional)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-end">
          <Field label="Parceiro vinculado" hint="Usado para rastrear o repasse do desconto.">
            <select
              className={selectCls}
              value={form.parceiroId}
              onChange={e => setField('parceiroId', e.target.value)}
            >
              <option value="">Nenhum</option>
              {parceiros.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </Field>

          <button
            type="button"
            onClick={() => setModalParceiroAberto(true)}
            className="flex items-center gap-1.5 text-sm font-semibold text-[#0B3D91] hover:text-[#0B2447] transition w-fit mb-2.5"
          >
            <Plus className="w-4 h-4" />
            Novo parceiro
          </button>
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
          onClick={() => router.push('/administrator/cupons')}
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting || !form.codigo.trim() || !form.valor}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold transition shadow-md shadow-[#0B2447]/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
            : <><ChevronRight className="w-4 h-4" /> {editando ? 'Salvar alterações' : 'Cadastrar cupom'}</>}
        </button>
      </div>

      {/* ── Modal: novo parceiro ─────────────────────────────────────────── */}
      {modalParceiroAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#0B2447] tracking-wide uppercase">Novo parceiro</h3>
              <button
                type="button"
                onClick={() => { setModalParceiroAberto(false); setErroParceiro(null); setNomeNovoParceiro(''); }}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <Field label="Nome do parceiro" required>
              <input
                className={inputCls}
                placeholder="ex: Marina X"
                value={nomeNovoParceiro}
                onChange={e => setNomeNovoParceiro(e.target.value)}
                autoFocus
              />
            </Field>

            {erroParceiro && (
              <p className="mt-2 text-xs text-red-600 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {erroParceiro}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={() => { setModalParceiroAberto(false); setErroParceiro(null); setNomeNovoParceiro(''); }}
                disabled={salvandoParceiro}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarParceiro}
                disabled={salvandoParceiro || !nomeNovoParceiro.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {salvandoParceiro ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
