'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Info, ClipboardCheck, Ruler, MapPin, ImageIcon, Sparkles,
  Loader2, AlertCircle, CheckCircle, ShieldCheck, Waves,
} from 'lucide-react';
import GaleriaImagensEditor, { itensDeImagensSalvas, type GaleriaItem } from '@/components/painel/GaleriaImagensEditor';
import {
  atualizarEmbarcacao,
  atualizarComodidades,
  atualizarEquipamentosSeguranca,
  atualizarAcessorios,
  excluirImagem,
  atualizarImagens,
  type AtualizarEmbarcacaoPayload,
} from '../actions';
import {
  salvarImagem,
  getMunicipiosByEstado,
} from '../../../novo/actions';
import MapaPicker from '../../../novo/_components/MapaPicker';
import type { EmbarcacaoStatus, ModalidadeCapitao } from '@/types/supabase';
import { COMPRIMENTO_UNIDADES, type ComprimentoUnidade } from '@/lib/comprimento';
import PreviewPublicacaoModal from '@/components/preview/PreviewPublicacaoModal';
import BotaoPreview from '@/components/preview/BotaoPreview';
import { montarPreviewEmbarcacao } from '@/components/preview/montar';
import IndicadorEtapas from '@/components/painel/etapas/IndicadorEtapas';
import RodapeEtapas from '@/components/painel/etapas/RodapeEtapas';
import RevisaoChecklist from '@/components/painel/etapas/RevisaoChecklist';
import { useEtapas } from '@/components/painel/etapas/useEtapas';
import EmbarcacaoCard from '@/components/ui/EmbarcacaoCard';
import { ETAPAS_EMBARCACAO, ETAPA_EMB, revisaoEmbarcacao } from '../../../_components/etapasEmbarcacao';

// ─── Tipos locais ─────────────────────────────────────────────────────────────

type Tipo      = { id: string; nome: string };
type Estado    = { id: number; uf: string; nome: string };
type Municipio = { id: number; nome: string };
type Comodidade = { id: string; nome: string };
type EquipamentoSeguranca = { id: string; nome: string };
type Acessorio = { id: string; nome: string };

type EmbarcacaoData = {
  id: string;
  nome: string; descricao: string | null;
  embarcacao_tipo_id: string | null;
  status: EmbarcacaoStatus;
  modalidade_capitao: ModalidadeCapitao | null;
  capacidade: number | null; comprimento: number | null;
  comprimento_unidade: ComprimentoUnidade | null;
  quartos: number | null;
  banheiros: number | null; tripulacao: number | null;
  municipio_id: number | null; estado_id: number | null;
  latitude: number | null; longitude: number | null;
  cep: string | null; bairro: string | null; logradouro: string | null;
  logradouro_numero: string | null; complemento: string | null;
  embarcacao_imagens: { id: string; url_imagem: string; titulo: string | null; principal: boolean; ordem: number }[];
};

type Props = {
  embarcacao: EmbarcacaoData;
  tipos: Tipo[]; estados: Estado[];
  municipiosIniciais: Municipio[];
  comodidades: Comodidade[];
  comodidadesIniciais: string[];
  equipamentosSeguranca: EquipamentoSeguranca[];
  equipamentosSegurancaIniciais: string[];
  acessorios: Acessorio[];
  acessoriosIniciais: string[];
  /** Rota de retorno após salvar/cancelar (o admin reutiliza o form com outra rota). */
  voltarHref?: string;
};

// ─── Helpers de UI ────────────────────────────────────────────────────────────

const inputCls = `w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800
  placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20
  focus:border-[#0B2447]/40 transition bg-white`;
const selectCls = `${inputCls} appearance-none cursor-pointer`;

function SectionCard({ icon: Icon, title, subtitle, children }: {
  icon: React.ElementType; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-start gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <Icon className="w-4 h-4 mt-0.5 shrink-0 text-[#0B2447]" />
        <h2 className="text-sm leading-5">
          <span className="font-bold text-[#0B2447] tracking-wide uppercase">{title}</span>
          {subtitle && <span className="ml-1.5 font-normal text-slate-500">({subtitle})</span>}
        </h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Field({ label, required, hint, className, children }: {
  label: string; required?: boolean; hint?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function EditarEmbarcacaoForm({
  embarcacao, tipos, estados, municipiosIniciais,
  comodidades, comodidadesIniciais,
  equipamentosSeguranca, equipamentosSegurancaIniciais,
  acessorios, acessoriosIniciais,
  voltarHref = '/painel/embarcacoes',
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const numeroInputRef = useRef<HTMLInputElement>(null);

  // ── Form base ──────────────────────────────────────────────────────────────
  const [form, setForm] = useState<Omit<AtualizarEmbarcacaoPayload, 'municipio_id'> & {
    municipio_id: string; estado_id: string;
  }>({
    nome:        embarcacao.nome,
    descricao:   embarcacao.descricao   ?? '',
    embarcacao_tipo_id:      embarcacao.embarcacao_tipo_id      ?? '',
    status:      embarcacao.status,
    modalidade_capitao: embarcacao.modalidade_capitao ?? 'sem_capitao',
    capacidade:  embarcacao.capacidade  != null ? String(embarcacao.capacidade)  : '',
    comprimento: embarcacao.comprimento != null ? String(embarcacao.comprimento) : '',
    comprimento_unidade: embarcacao.comprimento_unidade ?? 'm',
    quartos:     embarcacao.quartos     != null ? String(embarcacao.quartos)     : '',
    banheiros:   embarcacao.banheiros   != null ? String(embarcacao.banheiros)   : '',
    tripulacao:  embarcacao.tripulacao  != null ? String(embarcacao.tripulacao)  : '',
    estado_id:   embarcacao.estado_id   != null ? String(embarcacao.estado_id)   : '',
    municipio_id: embarcacao.municipio_id != null ? String(embarcacao.municipio_id) : '',
    latitude:    embarcacao.latitude    != null ? String(embarcacao.latitude)    : '',
    longitude:   embarcacao.longitude   != null ? String(embarcacao.longitude)   : '',
    cep:               embarcacao.cep               ?? '',
    bairro:            embarcacao.bairro            ?? '',
    logradouro:        embarcacao.logradouro         ?? '',
    logradouro_numero: embarcacao.logradouro_numero  ?? '',
    complemento:       embarcacao.complemento        ?? '',
  });

  // ── Municipios ─────────────────────────────────────────────────────────────
  const [municipios, setMunicipios]               = useState<Municipio[]>(municipiosIniciais);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  const [cepLoading, setCepLoading]               = useState(false);
  const [cepError,   setCepError]                 = useState<string | null>(null);

  // ── Equipamentos de segurança ──────────────────────────────────────────────
  const [equipamentosSelecionados, setEquipamentosSelecionados] = useState<string[]>(equipamentosSegurancaIniciais);

  function toggleEquipamento(id: string) {
    setEquipamentosSelecionados(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id],
    );
  }

  // ── Acessórios ─────────────────────────────────────────────────────────────
  const [acessoriosSelecionados, setAcessoriosSelecionados] = useState<string[]>(acessoriosIniciais);

  function toggleAcessorio(id: string) {
    setAcessoriosSelecionados(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id],
    );
  }

  // ── Comodidades ────────────────────────────────────────────────────────────
  const [comodidadesSelecionadas, setComodidadesSelecionadas] = useState<string[]>(comodidadesIniciais);

  function toggleComodidade(id: string) {
    setComodidadesSelecionadas(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id],
    );
  }

  // ── Imagens (salvas + novas, na ordem da galeria) ──────────────────────────
  const [imagens, setImagens] = useState<GaleriaItem[]>(
    () => itensDeImagensSalvas(embarcacao.embarcacao_imagens),
  );

  // ── Feedback ───────────────────────────────────────────────────────────────
  const [feedback,   setFeedback]   = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Pré-visualização (mesmo layout da página pública) ──────────────────────
  const [previewAberto, setPreviewAberto] = useState(false);

  // ── Etapas (wizard) ─────────────────────────────────────────────────────────
  const etapas = useEtapas(ETAPAS_EMBARCACAO.length, { todasVisitadas: true, ids: ETAPAS_EMBARCACAO.map(e => e.id) });
  const revisao = revisaoEmbarcacao({
    form, tipos, estados, municipios, comodidadesSelecionadas, imagens,
    ir: etapas.ir,
  });

  // Enter num campo não envia o cadastro no meio das etapas.
  function bloquearEnter(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
  }
  const previewDados = previewAberto
    ? montarPreviewEmbarcacao({
        form, tipos, estados, municipios, comodidades, comodidadesSelecionadas,
        equipamentosSeguranca, equipamentosSegurancaSelecionados: equipamentosSelecionados,
        acessorios, acessoriosSelecionados,
        imagens,
      })
    : null;

  // ─── Helpers de form ───────────────────────────────────────────────────────

  function setField<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function carregarMunicipios(estadoId: number): Promise<Municipio[]> {
    setLoadingMunicipios(true);
    const data = await getMunicipiosByEstado(estadoId);
    setMunicipios(data);
    setLoadingMunicipios(false);
    return data;
  }

  function handleEstadoChange(estadoId: string) {
    setField('estado_id', estadoId);
    setField('municipio_id', '');
    setMunicipios([]);
    if (!estadoId) return;
    startTransition(() => { carregarMunicipios(parseInt(estadoId, 10)); });
  }

  async function handleCepChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    const masked = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    setField('cep', masked);
    setCepError(null);
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!res.ok) throw new Error();
      const data = await res.json() as Record<string, string>;
      if (data.erro) {
        setCepError('CEP não encontrado. Verifique o número digitado ou preencha o endereço manualmente.');
        return;
      }
      if (data.logradouro) setField('logradouro', data.logradouro);
      if (data.bairro)     setField('bairro',     data.bairro);
      const estado = estados.find(e => e.uf === data.uf);
      if (!estado) return;
      setField('estado_id',   String(estado.id));
      setField('municipio_id', '');
      setMunicipios([]);
      const muns = await carregarMunicipios(estado.id);
      const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const mun = muns.find(m => norm(m.nome) === norm(data.localidade ?? ''));
      if (mun) setField('municipio_id', String(mun.id));

      if (data.logradouro && data.bairro) {
        setTimeout(() => numeroInputRef.current?.focus(), 50);
      }
    } catch {
      setCepError('Erro ao consultar o CEP. Preencha manualmente.');
    } finally {
      setCepLoading(false);
    }
  }

  function geocodificarEndereco() {
    if (!form.logradouro || !form.logradouro_numero) return;
    if (typeof window === 'undefined' || !window.google?.maps?.Geocoder) return;

    const partes = [
      form.logradouro,
      form.logradouro_numero,
      form.bairro,
      form.cep.replace(/\D/g, ''),
      'Brasil',
    ].filter(Boolean).join(', ');

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: partes }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const loc = results[0].geometry.location;
        setField('latitude',  loc.lat().toFixed(7));
        setField('longitude', loc.lng().toFixed(7));
      }
    });
  }

  // ─── Imagens ───────────────────────────────────────────────────────────────

  async function uploadImagem(item: GaleriaItem, embarcacaoId: string, ordem: number) {
    if (!item.file) return null;
    const body = new FormData();
    body.append('file', item.file);
    body.append('embarcacaoId', embarcacaoId);
    const res = await fetch('/api/painel/embarcacoes/upload', { method: 'POST', body });
    if (!res.ok) return null;
    const { publicUrl } = await res.json();
    const saved = await salvarImagem({
      embarcacaoId, urlImagem: publicUrl, titulo: item.titulo, principal: item.principal, ordem,
    });
    return saved.ok ? (publicUrl as string) : null;
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFeedback(null);
    if (!form.nome.trim()) {
      setFeedback({ type: 'error', msg: 'Informe o nome da embarcação.' });
      etapas.ir(ETAPA_EMB.informacoes);
      return;
    }
    setSubmitting(true);

    // 1. Atualizar campos base
    const result = await atualizarEmbarcacao(embarcacao.id, {
      nome: form.nome, descricao: form.descricao,
      embarcacao_tipo_id: form.embarcacao_tipo_id,
      status: form.status as EmbarcacaoStatus,
      modalidade_capitao: form.modalidade_capitao as ModalidadeCapitao,
      capacidade: form.capacidade, comprimento: form.comprimento,
      comprimento_unidade: form.comprimento_unidade,
      quartos: form.quartos,
      banheiros: form.banheiros, tripulacao: form.tripulacao,
      municipio_id: form.municipio_id,
      latitude: form.latitude, longitude: form.longitude,
      cep: form.cep, bairro: form.bairro, logradouro: form.logradouro,
      logradouro_numero: form.logradouro_numero, complemento: form.complemento,
    });

    if (!result.ok) {
      setFeedback({ type: 'error', msg: result.error ?? 'Erro ao atualizar.' });
      setSubmitting(false);
      return;
    }

    // 2. Atualizar equipamentos de segurança
    await atualizarEquipamentosSeguranca(embarcacao.id, equipamentosSelecionados);

    // 3. Atualizar acessórios
    await atualizarAcessorios(embarcacao.id, acessoriosSelecionados);

    // 4. Atualizar comodidades
    await atualizarComodidades(embarcacao.id, comodidadesSelecionadas);

    // 3. Excluir as imagens salvas que saíram da galeria
    const idsMantidos = new Set(imagens.map(i => i.id).filter(Boolean));
    for (const img of embarcacao.embarcacao_imagens.filter(i => !idsMantidos.has(i.id))) {
      await excluirImagem(embarcacao.id, img.id);
    }

    // 4. Título, ordem e principal das imagens salvas (a posição na lista é a ordem)
    await atualizarImagens(
      embarcacao.id,
      imagens.flatMap((it, ordem) =>
        it.id ? [{ id: it.id, titulo: it.titulo, ordem, principal: it.principal }] : []),
    );

    // 5. Upload das novas, cada uma já com a sua posição
    for (let ordem = 0; ordem < imagens.length; ordem++) {
      const item = imagens[ordem];
      if (!item.file) continue;
      setImagens(prev => prev.map(it => it.key === item.key ? { ...it, status: 'uploading' } : it));
      const url = await uploadImagem(item, embarcacao.id, ordem);
      setImagens(prev => prev.map(it => it.key === item.key ? { ...it, status: url ? 'done' : 'error' } : it));
    }

    setFeedback({ type: 'success', msg: 'Embarcação atualizada com sucesso!' });
    setSubmitting(false);
    setTimeout(() => router.push(voltarHref), 1200);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} onKeyDown={bloquearEnter} className="space-y-6 max-w-4xl">
      <div ref={etapas.topoRef} className="scroll-mt-6">
        <IndicadorEtapas etapas={ETAPAS_EMBARCACAO} atual={etapas.atual} visitadas={etapas.visitadas} onIr={etapas.ir} />
      </div>


      <div hidden={etapas.atual !== ETAPA_EMB.informacoes} className="space-y-6">
      {/* ── 1. Informações gerais ──────────────────────────────────────────── */}
      <SectionCard icon={Info} title="Informações gerais">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <Field label="Nome da embarcação" required>
              <input className={inputCls} placeholder="ex: Lancha Azul Horizon"
                value={form.nome} onChange={e => setField('nome', e.target.value)} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Descrição">
              <textarea className={`${inputCls} resize-none`} rows={3}
                placeholder="Descreva sua embarcação, diferenciais, comodidades..."
                value={form.descricao} onChange={e => setField('descricao', e.target.value)} />
            </Field>
          </div>
          <Field label="Tipo">
            <select className={selectCls} value={form.embarcacao_tipo_id}
              onChange={e => setField('embarcacao_tipo_id', e.target.value)}>
              <option value="">Selecione o tipo</option>
              {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </Field>
          <Field label="Capitão">
            <select className={selectCls} value={form.modalidade_capitao}
              onChange={e => setField('modalidade_capitao', e.target.value as ModalidadeCapitao)}>
              <option value="com_capitao">Com capitão obrigatório</option>
            </select>
          </Field>
          <Field label="Status">
            <select className={selectCls} value={form.status}
              onChange={e => setField('status', e.target.value as EmbarcacaoStatus)}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              <option value="em_manutencao">Em Manutenção</option>
            </select>
          </Field>
        </div>
      </SectionCard>

      </div>

      <div hidden={etapas.atual !== ETAPA_EMB.detalhes} className="space-y-6">
      {/* ── 2. Especificações técnicas ─────────────────────────────────────── */}
      <SectionCard icon={Ruler} title="Especificações técnicas">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          <Field label="Capacidade (pessoas)">
            <input className={inputCls} type="number" min="1" placeholder="ex: 12"
              value={form.capacidade} onChange={e => setField('capacidade', e.target.value)} />
          </Field>
          <Field label="Tripulação">
            <input className={inputCls} type="number" min="0" placeholder="ex: 3"
              value={form.tripulacao} onChange={e => setField('tripulacao', e.target.value)} />
          </Field>
          <Field label="Comprimento" className="col-span-2 md:col-span-1">
            <div className="flex rounded-xl border border-slate-200 bg-white overflow-hidden transition
              focus-within:ring-2 focus-within:ring-[#0B2447]/20 focus-within:border-[#0B2447]/40">
              <input className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-sm text-slate-800
                placeholder:text-slate-400 focus:outline-none"
                type="number" min="0" step="0.01"
                placeholder={form.comprimento_unidade === 'pes' ? 'ex: 28' : 'ex: 8.50'}
                value={form.comprimento} onChange={e => setField('comprimento', e.target.value)} />
              <select aria-label="Unidade do comprimento"
                className="shrink-0 border-l border-slate-200 bg-slate-50 pl-3 pr-2 text-sm font-medium
                  text-slate-700 cursor-pointer focus:outline-none"
                value={form.comprimento_unidade}
                onChange={e => setField('comprimento_unidade', e.target.value as ComprimentoUnidade)}>
                {COMPRIMENTO_UNIDADES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          </Field>
          <Field label="Quartos">
            <input className={inputCls} type="number" min="0" placeholder="ex: 3"
              value={form.quartos} onChange={e => setField('quartos', e.target.value)} />
          </Field>
          <Field label="Banheiros">
            <input className={inputCls} type="number" min="0" placeholder="ex: 1"
              value={form.banheiros} onChange={e => setField('banheiros', e.target.value)} />
          </Field>
        </div>
      </SectionCard>

      {/* ── 3. Equipamentos de segurança ──────────────────────────────────── */}
      {equipamentosSeguranca.length > 0 && (
        <SectionCard icon={ShieldCheck} title="Equipamentos de Segurança">
          <p className="text-xs text-slate-400 mb-4">
            Selecione os equipamentos de segurança disponíveis a bordo desta embarcação.
          </p>
          <div className="flex flex-wrap gap-2">
            {equipamentosSeguranca.map(e => {
              const ativo = equipamentosSelecionados.includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => toggleEquipamento(e.id)}
                  className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    ativo
                      ? 'bg-[#0B2447] text-white border-[#0B2447] shadow-sm shadow-[#0B2447]/20'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-[#0B2447]/40 hover:text-[#0B2447]'
                  }`}
                >
                  {e.nome}
                </button>
              );
            })}
          </div>
          {equipamentosSelecionados.length > 0 && (
            <p className="mt-3 text-xs text-slate-400">
              {equipamentosSelecionados.length} equipamento{equipamentosSelecionados.length > 1 ? 's' : ''} selecionado{equipamentosSelecionados.length > 1 ? 's' : ''}.
            </p>
          )}
        </SectionCard>
      )}

      {/* ── 4. Acessórios ─────────────────────────────────────────────────── */}
      {acessorios.length > 0 && (
        <SectionCard icon={Waves} title="Acessórios da Embarcação">
          <p className="text-xs text-slate-400 mb-4">
            Selecione os acessórios disponíveis a bordo desta embarcação.
          </p>
          <div className="flex flex-wrap gap-2">
            {acessorios.map(a => {
              const ativo = acessoriosSelecionados.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAcessorio(a.id)}
                  className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    ativo
                      ? 'bg-[#0B2447] text-white border-[#0B2447] shadow-sm shadow-[#0B2447]/20'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-[#0B2447]/40 hover:text-[#0B2447]'
                  }`}
                >
                  {a.nome}
                </button>
              );
            })}
          </div>
          {acessoriosSelecionados.length > 0 && (
            <p className="mt-3 text-xs text-slate-400">
              {acessoriosSelecionados.length} acessório{acessoriosSelecionados.length > 1 ? 's' : ''} selecionado{acessoriosSelecionados.length > 1 ? 's' : ''}.
            </p>
          )}
        </SectionCard>
      )}

      {/* ── 5. Comodidades ────────────────────────────────────────────────── */}
      {comodidades.length > 0 && (
        <SectionCard icon={Sparkles} title="Comodidades">
          <p className="text-xs text-slate-400 mb-4">
            Selecione as comodidades disponíveis a bordo desta embarcação.
          </p>
          <div className="flex flex-wrap gap-2">
            {comodidades.map(c => {
              const ativo = comodidadesSelecionadas.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleComodidade(c.id)}
                  className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    ativo
                      ? 'bg-[#0B2447] text-white border-[#0B2447] shadow-sm shadow-[#0B2447]/20'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-[#0B2447]/40 hover:text-[#0B2447]'
                  }`}
                >
                  {c.nome}
                </button>
              );
            })}
          </div>
          {comodidadesSelecionadas.length > 0 && (
            <p className="mt-3 text-xs text-slate-400">
              {comodidadesSelecionadas.length} comodidade{comodidadesSelecionadas.length > 1 ? 's' : ''} selecionada{comodidadesSelecionadas.length > 1 ? 's' : ''}.
            </p>
          )}
        </SectionCard>
      )}

      </div>

      <div hidden={etapas.atual !== ETAPA_EMB.localizacao} className="space-y-6">
      {/* ── 6. Localização ────────────────────────────────────────────────── */}
      <SectionCard icon={MapPin} title="Localização" subtitle="Onde sua embarcação fica a maior parte do tempo">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">CEP</label>
            <div className="relative max-w-xs">
              <input
                className={`${inputCls} ${cepError ? 'border-red-300 focus:ring-red-200 focus:border-red-400' : ''}`}
                placeholder="00000-000" maxLength={9}
                value={form.cep} onChange={e => handleCepChange(e.target.value)} />
              {cepLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#0B2447]" />}
            </div>
            {cepError
              ? <p className="mt-1 text-xs text-red-500">{cepError}</p>
              : <p className="mt-1 text-xs text-slate-400">Preencha o CEP para completar o endereço automaticamente.</p>
            }
          </div>
          <Field label="Estado">
            <select className={selectCls} value={form.estado_id} onChange={e => handleEstadoChange(e.target.value)}>
              <option value="">Selecione o estado</option>
              {estados.map(e => <option key={e.id} value={e.id}>{e.nome} ({e.uf})</option>)}
            </select>
          </Field>
          <Field label="Município">
            <div className="relative">
              <select
                className={`${selectCls} ${!form.estado_id ? 'opacity-50 cursor-not-allowed' : ''}`}
                value={form.municipio_id}
                onChange={e => setField('municipio_id', e.target.value)}
                disabled={!form.estado_id || loadingMunicipios}>
                <option value="">
                  {loadingMunicipios ? 'Carregando...' : !form.estado_id ? 'Selecione o estado primeiro' : 'Selecione o município'}
                </option>
                {municipios.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
              {loadingMunicipios && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
            </div>
          </Field>
          <Field label="Bairro">
            <input className={inputCls} placeholder="ex: Beira Mar"
              value={form.bairro} onChange={e => setField('bairro', e.target.value)} />
          </Field>
          <Field label="Logradouro">
            <input className={inputCls} placeholder="ex: Av. Atlântica"
              value={form.logradouro} onChange={e => setField('logradouro', e.target.value)} />
          </Field>
          <Field label="Número">
            <input ref={numeroInputRef} className={inputCls} placeholder="ex: 1500"
              value={form.logradouro_numero}
              onChange={e => setField('logradouro_numero', e.target.value)}
              onBlur={geocodificarEndereco} />
          </Field>
          <Field label="Complemento">
            <input className={inputCls} placeholder="ex: Marina Sul, Vaga 42"
              value={form.complemento} onChange={e => setField('complemento', e.target.value)} />
          </Field>

          {/* Mapa — ponto exato de atracação */}
          <div className="md:col-span-2 mt-1">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Localização no mapa
            </label>
            <MapaPicker
              lat={form.latitude}
              lng={form.longitude}
              onChange={(lat, lng) => {
                setField('latitude', lat);
                setField('longitude', lng);
              }}
            />
          </div>
        </div>
      </SectionCard>

      </div>

      <div hidden={etapas.atual !== ETAPA_EMB.fotos} className="space-y-6">
      {/* ── 6. Imagens ────────────────────────────────────────────────────── */}
      <SectionCard icon={ImageIcon} title="Imagens">
        <GaleriaImagensEditor
          items={imagens}
          onChange={setImagens}
          disabled={submitting}
          onError={msg => setFeedback({ type: 'error', msg })}
          exemploTitulo="Proa do iate"
        />
      </SectionCard>

      </div>

      {/* ── 7. Revisão ───────────────────────────────────────────────────── */}
      <div hidden={etapas.atual !== ETAPA_EMB.revisao} className="space-y-6">
        <SectionCard icon={ClipboardCheck} title="Revisão">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <RevisaoChecklist itens={revisao.itens} />
            </div>
            <div className="lg:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Como aparece na busca</p>
              <div inert className="select-none">
                <EmbarcacaoCard embarcacao={revisao.card} />
              </div>
              <BotaoPreview onClick={() => setPreviewAberto(true)} className="w-full mt-3" />
            </div>
          </div>
        </SectionCard>
      </div>

      {/* ── Feedback ──────────────────────────────────────────────────────── */}
      {feedback && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
          feedback.type === 'error'
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
        }`}>
          {feedback.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
          {feedback.msg}
        </div>
      )}

      {/* ── Rodapé fixo ─────────────────────────────────────────────────── */}
      <RodapeEtapas
        atual={etapas.atual}
        total={ETAPAS_EMBARCACAO.length}
        labelAtual={ETAPAS_EMBARCACAO[etapas.atual].label}
        proximoLabel={etapas.ehUltima ? null : ETAPAS_EMBARCACAO[etapas.atual + 1].label}
        modo="editar"
        rotuloSalvar="Salvar alterações"
        onVoltar={etapas.anterior}
        onProximo={etapas.proxima}
        onPreview={() => setPreviewAberto(true)}
        submitting={submitting}
        podeSalvar
      />

      <PreviewPublicacaoModal
        aberto={previewAberto}
        onFechar={() => setPreviewAberto(false)}
        tipo="embarcacao"
        dados={previewDados}
      />
    </form>
  );
}
