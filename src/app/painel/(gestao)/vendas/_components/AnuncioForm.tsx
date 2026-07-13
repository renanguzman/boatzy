'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Ship,
  Tag,
  DollarSign,
  History,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowDownRight,
  ArrowUpRight,
  MapPin,
  Users,
} from 'lucide-react';
import { criarAnuncio, atualizarAnuncio } from '../actions';

const inputCls = `w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800
  placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20
  focus:border-[#0B2447]/40 transition bg-white`;

const selectCls = `${inputCls} appearance-none cursor-pointer`;

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export type EmbarcacaoOption = {
  id: string;
  nome: string;
  capacidade: number | null;
  tipo: { id: string; nome: string } | null;
  localidade: string | null;
  imagem: string | null;
};

export type PrecoHistoricoItem = { preco: number; created_at: string };

type Props = {
  modo: 'novo' | 'editar';
  anuncioId?: string;
  /** Novo: embarcações elegíveis (ativas, sem anúncio vigente). Editar: apenas a vinculada. */
  embarcacoes: EmbarcacaoOption[];
  tipos: { id: string; nome: string }[];
  initial?: {
    embarcacaoId: string;
    fabricante: string;
    anoModelo: string;
    anoFabricacao: string;
    preco: string;
    descricaoVenda: string;
  };
  historico?: PrecoHistoricoItem[];
};

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

export default function AnuncioForm({ modo, anuncioId, embarcacoes, tipos, initial, historico }: Props) {
  const router = useRouter();

  const [form, setForm] = useState({
    embarcacaoId: initial?.embarcacaoId ?? '',
    fabricante: initial?.fabricante ?? '',
    anoModelo: initial?.anoModelo ?? '',
    anoFabricacao: initial?.anoFabricacao ?? '',
    preco: initial?.preco ?? '',
    descricaoVenda: initial?.descricaoVenda ?? '',
    tipoId: '',
  });

  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selecionada = useMemo(
    () => embarcacoes.find((e) => e.id === form.embarcacaoId) ?? null,
    [embarcacoes, form.embarcacaoId],
  );
  const precisaTipo = !!selecionada && !selecionada.tipo;

  function setField<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFeedback(null);
    setSubmitting(true);

    const payload = {
      fabricante: form.fabricante,
      anoModelo: form.anoModelo,
      anoFabricacao: form.anoFabricacao,
      preco: form.preco,
      descricaoVenda: form.descricaoVenda,
      tipoId: precisaTipo ? form.tipoId : undefined,
    };

    const result = modo === 'novo'
      ? await criarAnuncio({ ...payload, embarcacaoId: form.embarcacaoId })
      : await atualizarAnuncio(anuncioId!, payload);

    if (!result.ok) {
      setFeedback({ type: 'error', msg: result.error ?? 'Erro ao salvar o anúncio.' });
      setSubmitting(false);
      return;
    }

    setFeedback({
      type: 'success',
      msg: modo === 'novo' ? 'Anúncio publicado com sucesso!' : 'Anúncio atualizado com sucesso!',
    });
    setSubmitting(false);
    setTimeout(() => router.push('/painel/vendas'), 1200);
  }

  const podeSalvar =
    !!form.embarcacaoId &&
    !!form.fabricante.trim() &&
    !!form.anoModelo &&
    !!form.anoFabricacao &&
    !!form.preco &&
    (!precisaTipo || !!form.tipoId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">

      {/* ── Embarcação ───────────────────────────────────────────────────── */}
      <SectionCard icon={Ship} title="Embarcação anunciada">
        {modo === 'novo' ? (
          <Field
            label="Embarcação"
            required
            hint="Fotos, ficha técnica, tipo e localização do anúncio vêm do cadastro da embarcação."
          >
            <select
              className={selectCls}
              value={form.embarcacaoId}
              onChange={(e) => setField('embarcacaoId', e.target.value)}
              required
            >
              <option value="" disabled>Selecione a embarcação...</option>
              {embarcacoes.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          </Field>
        ) : null}

        {selecionada && (
          <div className={`flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4 ${modo === 'novo' ? 'mt-4' : ''}`}>
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100">
              {selecionada.imagem ? (
                <Image
                  src={selecionada.imagem}
                  alt={selecionada.nome}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Ship className="w-6 h-6 text-slate-300" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#0B2447] truncate">{selecionada.nome}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                {selecionada.tipo && (
                  <span className="inline-flex items-center gap-1">
                    <Ship className="w-3 h-3 text-slate-400" />
                    {selecionada.tipo.nome}
                  </span>
                )}
                {selecionada.localidade && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {selecionada.localidade}
                  </span>
                )}
                {selecionada.capacidade != null && (
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3 h-3 text-slate-400" />
                    {selecionada.capacidade} pax
                  </span>
                )}
              </div>
              <a
                href={`/painel/embarcacoes/${selecionada.id}/editar`}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-1.5 text-xs font-semibold text-[#0B3D91] hover:text-[#0B2447] transition-colors"
              >
                Editar dados da embarcação →
              </a>
            </div>
          </div>
        )}

        {precisaTipo && (
          <div className="mt-4">
            <Field
              label="Tipo da embarcação"
              required
              hint="Esta embarcação ainda não tem tipo — ele é obrigatório para o anúncio aparecer na busca de Vendas (fica salvo na embarcação)."
            >
              <select
                className={selectCls}
                value={form.tipoId}
                onChange={(e) => setField('tipoId', e.target.value)}
                required
              >
                <option value="" disabled>Selecione o tipo...</option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </SectionCard>

      {/* ── Dados da venda ───────────────────────────────────────────────── */}
      <SectionCard icon={Tag} title="Dados da venda">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <Field label="Fabricante" required>
              <input
                className={inputCls}
                placeholder="ex: Focker, Schaefer, Azimut..."
                value={form.fabricante}
                onChange={(e) => setField('fabricante', e.target.value)}
                required
              />
            </Field>
          </div>

          <Field label="Ano do modelo" required>
            <input
              className={inputCls}
              type="number"
              min={1900}
              max={new Date().getFullYear() + 1}
              placeholder="ex: 2024"
              value={form.anoModelo}
              onChange={(e) => setField('anoModelo', e.target.value)}
              required
            />
          </Field>

          <Field label="Ano de fabricação" required>
            <input
              className={inputCls}
              type="number"
              min={1900}
              max={new Date().getFullYear() + 1}
              placeholder="ex: 2023"
              value={form.anoFabricacao}
              onChange={(e) => setField('anoFabricacao', e.target.value)}
              required
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="Detalhes da venda" hint="Informações específicas do anúncio (estado de conservação, motorização, upgrades, motivo da venda...).">
              <textarea
                className={`${inputCls} min-h-[100px] resize-y`}
                placeholder="Descreva os detalhes relevantes para o comprador..."
                value={form.descricaoVenda}
                onChange={(e) => setField('descricaoVenda', e.target.value)}
              />
            </Field>
          </div>
        </div>
      </SectionCard>

      {/* ── Valor ────────────────────────────────────────────────────────── */}
      <SectionCard icon={DollarSign} title="Valor do anúncio">
        <div className="max-w-xs">
          <Field
            label="Valor (R$)"
            required
            hint={modo === 'editar'
              ? 'Reduções de preço ganham o selo "Preço reduzido" no site; aumentos não são exibidos ao comprador.'
              : 'Você pode ajustar o valor depois — reduções ganham destaque no site.'}
          >
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">R$</span>
              <input
                className={`${inputCls} pl-10`}
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={form.preco}
                onChange={(e) => setField('preco', e.target.value)}
                required
              />
            </div>
          </Field>
        </div>

        {/* Histórico de preço (só edição; visível só para o gestor) */}
        {modo === 'editar' && historico && historico.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-bold text-slate-500 tracking-wide uppercase">Histórico de preço</h3>
            </div>
            <ul className="space-y-1.5">
              {historico.map((h, i) => {
                const anterior = historico[i + 1];
                const variacao = anterior ? Number(h.preco) - Number(anterior.preco) : 0;
                return (
                  <li
                    key={`${h.created_at}-${i}`}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3.5 py-2 text-sm"
                  >
                    <span className="text-slate-500">{dataBr.format(new Date(h.created_at))}</span>
                    <span className="flex items-center gap-2 font-medium text-slate-700">
                      {brl.format(Number(h.preco))}
                      {anterior && variacao !== 0 && (
                        <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                          variacao < 0 ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                          {variacao < 0
                            ? <ArrowDownRight className="w-3.5 h-3.5" />
                            : <ArrowUpRight className="w-3.5 h-3.5" />}
                          {Math.abs((variacao / Number(anterior.preco)) * 100).toFixed(1)}%
                        </span>
                      )}
                      {i === 0 && (
                        <span className="text-[10px] font-bold text-[#0B3D91] uppercase tracking-wide">vigente</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
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
          onClick={() => router.push('/painel/vendas')}
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting || !podeSalvar}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold transition shadow-md shadow-[#0B2447]/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
            : <><ChevronRight className="w-4 h-4" /> {modo === 'novo' ? 'Publicar anúncio' : 'Salvar alterações'}</>}
        </button>
      </div>
    </form>
  );
}
