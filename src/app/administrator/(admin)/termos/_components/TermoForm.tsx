'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText, ListChecks, PenLine, ChevronRight, Loader2, AlertCircle, CheckCircle, Eye, Info,
} from 'lucide-react';
import TermoMarkdown from '@/components/termos/TermoMarkdown';
import {
  TERMOS_IDENTIFICADORES,
  TERMO_PUBLICO_ALVO_LABEL,
  isTermoIdentificador,
  type TermoIdentificador,
} from '@/lib/termos/identificadores';
import { criarTermo, atualizarTermo, type TermoPayload } from '../actions';

const inputCls = `w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800
  placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20
  focus:border-[#0B2447]/40 transition bg-white disabled:bg-slate-50 disabled:text-slate-500`;

const selectCls = `${inputCls} appearance-none cursor-pointer disabled:cursor-not-allowed`;

function SectionCard({ icon: Icon, title, children, bodyClassName = 'p-6' }: {
  icon: React.ElementType; title: string; children: React.ReactNode; bodyClassName?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <Icon className="w-4 h-4 text-[#0B2447]" />
        <h2 className="text-sm font-bold text-[#0B2447] tracking-wide uppercase">{title}</h2>
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: React.ReactNode; children: React.ReactNode;
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

function Toggle({ checked, onChange, label, hint }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-emerald-500' : 'bg-slate-300'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`} />
      </button>
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-400">{hint}</p>
      </div>
    </div>
  );
}

/** Situação atual de cada identificador — orienta qual versão será criada. */
export type SituacaoIdentificador = { ultimaVersao: number; temRascunho: boolean };

export type TermoInicial = {
  id: string;
  identificador: string;
  versao: number;
  titulo: string;
  conteudo: string;
  descricaoInterna: string | null;
  exigeRolagemCompleta: boolean;
  exigeConfirmacaoDigitada: boolean;
};

type Props = {
  termo?: TermoInicial; // presente = modo edição (sempre um rascunho)
  situacao?: Record<string, SituacaoIdentificador>; // só no modo criação
};

const MARKDOWN_AJUDA = [
  ['## Título da seção', 'seção numerada do termo'],
  ['**texto**', 'negrito'],
  ['- item', 'lista'],
  ['1. item', 'lista numerada'],
  ['> texto', 'cláusula em destaque'],
] as const;

export default function TermoForm({ termo, situacao = {} }: Props) {
  const router = useRouter();
  const editando = !!termo;

  const [form, setForm] = useState<TermoPayload>({
    identificador: termo?.identificador ?? '',
    titulo: termo?.titulo ?? '',
    conteudo: termo?.conteudo ?? '',
    descricaoInterna: termo?.descricaoInterna ?? '',
    exigeRolagemCompleta: termo?.exigeRolagemCompleta ?? true,
    exigeConfirmacaoDigitada: termo?.exigeConfirmacaoDigitada ?? true,
  });
  const [aba, setAba] = useState<'editar' | 'visualizar'>('editar');
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setField<K extends keyof TermoPayload>(k: K, v: TermoPayload[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  const infoIdentificador = isTermoIdentificador(form.identificador)
    ? TERMOS_IDENTIFICADORES[form.identificador]
    : null;
  const proximaVersao = editando
    ? termo!.versao
    : (situacao[form.identificador]?.ultimaVersao ?? 0) + 1;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFeedback(null);
    setSubmitting(true);

    const result = editando
      ? await atualizarTermo(termo!.id, form)
      : await criarTermo(form);

    if (!result.ok) {
      setFeedback({ type: 'error', msg: result.error ?? 'Erro desconhecido.' });
      setSubmitting(false);
      return;
    }

    const termoId = editando ? termo!.id : (result as { termoId: string }).termoId;
    setFeedback({ type: 'success', msg: 'Rascunho salvo! Revise o texto e publique quando estiver pronto.' });
    setSubmitting(false);
    setTimeout(() => router.push(`/administrator/termos/${termoId}`), 1000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-6xl">

      {/* ── Identificação ────────────────────────────────────────────────── */}
      <SectionCard icon={FileText} title="Identificação">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field
            label="Identificador (ponto de uso)"
            required
            hint={editando
              ? 'O identificador não muda entre versões.'
              : 'Onde este termo é exibido e aceito no sistema.'}
          >
            <select
              className={selectCls}
              value={form.identificador}
              onChange={e => setField('identificador', e.target.value)}
              disabled={editando}
              required
            >
              <option value="" disabled>Selecione...</option>
              {(Object.keys(TERMOS_IDENTIFICADORES) as TermoIdentificador[]).map(id => {
                const temRascunho = !editando && situacao[id]?.temRascunho;
                return (
                  <option key={id} value={id} disabled={temRascunho}>
                    {TERMOS_IDENTIFICADORES[id].label}{temRascunho ? ' (rascunho em andamento)' : ''}
                  </option>
                );
              })}
            </select>
          </Field>

          <Field label="Título" required hint="Exibido no topo do termo para o usuário.">
            <input
              className={inputCls}
              placeholder="ex: Termos e Condições da Reserva"
              value={form.titulo}
              onChange={e => setField('titulo', e.target.value)}
              maxLength={200}
              required
            />
          </Field>

          {infoIdentificador && (
            <div className="md:col-span-2 flex items-start gap-2.5 rounded-xl bg-blue-50/60 border border-blue-100 px-4 py-3">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-xs text-blue-900 space-y-0.5">
                <p>
                  <span className="font-mono font-semibold">{form.identificador}</span> · Público:{' '}
                  <strong>{TERMO_PUBLICO_ALVO_LABEL[infoIdentificador.publicoAlvo]}</strong> · {infoIdentificador.descricao}
                </p>
                <p>
                  Este rascunho será a <strong>versão {proximaVersao}</strong>
                  {proximaVersao > 1 ? ' — ao ser publicado, substitui a versão vigente.' : ' (primeira versão deste termo).'}
                </p>
              </div>
            </div>
          )}

          <div className="md:col-span-2">
            <Field label="Descrição interna" hint="Nota para a equipe (ex.: o que mudou nesta versão). Não é exibida ao usuário.">
              <input
                className={inputCls}
                placeholder="ex: Inclusão da cláusula de cancelamento por condições climáticas"
                value={form.descricaoInterna}
                onChange={e => setField('descricaoInterna', e.target.value)}
              />
            </Field>
          </div>
        </div>
      </SectionCard>

      {/* ── Exigências no aceite ─────────────────────────────────────────── */}
      <SectionCard icon={ListChecks} title="Exigências no momento do aceite">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Toggle
            checked={form.exigeRolagemCompleta}
            onChange={v => setField('exigeRolagemCompleta', v)}
            label="Exigir leitura até o fim"
            hint="O botão de aceite só é liberado após o usuário rolar o texto até o final."
          />
          <Toggle
            checked={form.exigeConfirmacaoDigitada}
            onChange={v => setField('exigeConfirmacaoDigitada', v)}
            label="Exigir confirmação digitada"
            hint="O usuário digita o nome completo (ou o CPF, quando cadastrado) para confirmar a identidade."
          />
        </div>
      </SectionCard>

      {/* ── Conteúdo ─────────────────────────────────────────────────────── */}
      <SectionCard icon={PenLine} title="Conteúdo do termo" bodyClassName="p-0">
        {/* Abas só em telas pequenas; no desktop, editor e prévia lado a lado. */}
        <div className="flex lg:hidden border-b border-slate-100">
          {(['editar', 'visualizar'] as const).map(a => (
            <button
              key={a}
              type="button"
              onClick={() => setAba(a)}
              className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wide transition ${
                aba === a ? 'text-[#0B2447] border-b-2 border-[#0B2447]' : 'text-slate-400'
              }`}
            >
              {a === 'editar' ? 'Editar' : 'Pré-visualizar'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className={`${aba === 'editar' ? 'block' : 'hidden'} lg:block p-6 lg:border-r border-slate-100`}>
            <textarea
              className={`${inputCls} font-mono text-[13px] leading-relaxed min-h-[520px] resize-y`}
              placeholder={'## 1. Objeto\n\nEste termo regula...\n\n## 2. Cancelamento\n\n> O cancelamento com menos de 24h...'}
              value={form.conteudo}
              onChange={e => setField('conteudo', e.target.value)}
              required
            />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {MARKDOWN_AJUDA.map(([sintaxe, desc]) => (
                <span key={sintaxe} className="text-[11px] text-slate-400">
                  <code className="font-mono text-slate-600 bg-slate-100 rounded px-1">{sintaxe}</code> {desc}
                </span>
              ))}
            </div>
          </div>

          <div className={`${aba === 'visualizar' ? 'block' : 'hidden'} lg:block p-6 bg-slate-50/40`}>
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4">
              <Eye className="w-3.5 h-3.5" /> Pré-visualização
            </p>
            <div className="bg-white rounded-xl border border-slate-200 p-6 max-h-[560px] overflow-y-auto">
              {form.titulo && (
                <h1 className="text-lg font-bold text-[#0B2447] mb-5 pb-4 border-b-2 border-[#0B2447]">{form.titulo}</h1>
              )}
              {form.conteudo.trim()
                ? <TermoMarkdown conteudo={form.conteudo} />
                : <p className="text-sm text-slate-400 italic">O texto formatado aparecerá aqui.</p>}
            </div>
          </div>
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
      <div className="flex items-center justify-between gap-3 pb-4">
        <p className="text-xs text-slate-400">
          O termo é salvo como <strong>rascunho</strong>. A publicação é feita na tela de visualização.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(editando ? `/administrator/termos/${termo!.id}` : '/administrator/termos')}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || !form.identificador || !form.titulo.trim() || !form.conteudo.trim()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold transition shadow-md shadow-[#0B2447]/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
              : <><ChevronRight className="w-4 h-4" /> Salvar rascunho</>}
          </button>
        </div>
      </div>
    </form>
  );
}
