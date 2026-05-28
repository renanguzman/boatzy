'use client';

import { useState, useTransition, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Info, MapPin, ImageIcon, Upload, X, Star,
  Loader2, AlertCircle, CheckCircle, ChevronRight,
} from 'lucide-react';
import {
  atualizarRoteiro,
  excluirImagemRoteiro,
  definirPrincipalRoteiro,
  type AtualizarRoteiroPayload,
} from '../actions';
import { salvarImagemRoteiro } from '../../../novo/actions';
import { getMunicipiosByEstado } from '../../../novo/actions';
import MapaPicker from '../../../../embarcacoes/novo/_components/MapaPicker';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type RoteiroImagem = {
  id: string;
  url_imagem: string;
  titulo: string | null;
  principal: boolean;
};

type RoteiroData = {
  id: string;
  embarcacao_id: string | null;
  nome: string;
  descricao: string;
  duracao: string | null;
  quantidade_pessoas: number | null;
  origem: string | null;
  destino: string | null;
  municipio_id: number | null;
  cep: string | null;
  bairro: string | null;
  logradouro: string | null;
  logradouro_numero: string | null;
  complemento: string | null;
  latitude: number | null;
  longitude: number | null;
  estado_id: number | null;
  roteiro_imagens: RoteiroImagem[];
};

type Estado     = { id: number; uf: string; nome: string };
type Municipio  = { id: number; nome: string };
type Embarcacao = { id: string; nome: string };

type ExistingImage = RoteiroImagem & { markedForDelete: boolean };

type NewImage = {
  file: File; previewUrl: string; principal: boolean;
  uploading: boolean; uploaded: boolean; error?: string;
};

type Props = {
  roteiro: RoteiroData;
  estados: Estado[];
  municipiosIniciais: Municipio[];
  embarcacoes: Embarcacao[];
};

// ─── Helpers de UI ────────────────────────────────────────────────────────────

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

// ─── Componente principal ─────────────────────────────────────────────────────

export default function EditarRoteiroForm({ roteiro, estados, municipiosIniciais, embarcacoes }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const numeroInputRef = useRef<HTMLInputElement>(null);

  const fmtCep = (v: string | null) => {
    if (!v) return '';
    const d = v.replace(/\D/g, '');
    return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };

  const [form, setForm] = useState<Omit<AtualizarRoteiroPayload, 'municipio_id'> & {
    municipio_id: string; estado_id: string;
  }>({
    embarcacao_id:      roteiro.embarcacao_id ?? '',
    nome:               roteiro.nome,
    descricao:          roteiro.descricao,
    duracao:            roteiro.duracao ?? '',
    quantidade_pessoas: roteiro.quantidade_pessoas != null ? String(roteiro.quantidade_pessoas) : '',
    origem:             roteiro.origem ?? '',
    destino:            roteiro.destino ?? '',
    estado_id:          roteiro.estado_id != null ? String(roteiro.estado_id) : '',
    municipio_id:       roteiro.municipio_id != null ? String(roteiro.municipio_id) : '',
    latitude:           roteiro.latitude  != null ? String(roteiro.latitude)  : '',
    longitude:          roteiro.longitude != null ? String(roteiro.longitude) : '',
    cep:                fmtCep(roteiro.cep),
    bairro:             roteiro.bairro ?? '',
    logradouro:         roteiro.logradouro ?? '',
    logradouro_numero:  roteiro.logradouro_numero ?? '',
    complemento:        roteiro.complemento ?? '',
  });

  const [municipios, setMunicipios]               = useState<Municipio[]>(municipiosIniciais);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  const [cepLoading, setCepLoading]               = useState(false);
  const [cepError, setCepError]                   = useState<string | null>(null);

  const [existingImages, setExistingImages] = useState<ExistingImage[]>(
    roteiro.roteiro_imagens.map(img => ({ ...img, markedForDelete: false })),
  );
  const [newImages, setNewImages]   = useState<NewImage[]>([]);
  const [dragging, setDragging]     = useState(false);
  const [feedback, setFeedback]     = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

      setField('estado_id',    String(estado.id));
      setField('municipio_id', '');
      setMunicipios([]);

      const muns = await carregarMunicipios(estado.id);

      const norm = (s: string) =>
        s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const localidade = norm(data.localidade ?? '');
      const mun = muns.find(m => norm(m.nome) === localidade);
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

  // ─── Imagens existentes ───────────────────────────────────────────────────

  function toggleDeleteExisting(id: string) {
    setExistingImages(prev =>
      prev.map(img => img.id === id ? { ...img, markedForDelete: !img.markedForDelete } : img),
    );
  }

  function setPrincipalExisting(id: string) {
    setExistingImages(prev =>
      prev.map(img => ({ ...img, principal: img.id === id })),
    );
  }

  // ─── Novas imagens ────────────────────────────────────────────────────────

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    const hasAnyPrincipal =
      existingImages.some(img => img.principal && !img.markedForDelete) ||
      newImages.some(img => img.principal);
    setNewImages(prev => [
      ...prev,
      ...arr.map((file, i) => ({
        file, previewUrl: URL.createObjectURL(file),
        principal: !hasAnyPrincipal && prev.length === 0 && i === 0,
        uploading: false, uploaded: false,
      })),
    ]);
  }

  function removeNewImage(idx: number) {
    setNewImages(prev => {
      const next = prev.filter((_, i) => i !== idx);
      if (prev[idx].principal && next.length > 0) next[0].principal = true;
      return next;
    });
  }

  function setPrincipalNew(idx: number) {
    setExistingImages(prev => prev.map(img => ({ ...img, principal: false })));
    setNewImages(prev => prev.map((img, i) => ({ ...img, principal: i === idx })));
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function uploadNewImage(img: NewImage, isPrincipal: boolean) {
    const body = new FormData();
    body.append('file', img.file);
    body.append('roteiroId', roteiro.id);

    const res = await fetch('/api/painel/roteiros/upload', { method: 'POST', body });
    if (!res.ok) return null;

    const { publicUrl } = await res.json();
    await salvarImagemRoteiro({
      roteiroId:  roteiro.id,
      urlImagem:  publicUrl,
      titulo:     img.file.name,
      principal:  isPrincipal,
    });
    return publicUrl as string;
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFeedback(null);
    setSubmitting(true);

    // 1. Atualizar dados do roteiro
    const result = await atualizarRoteiro(roteiro.id, {
      embarcacao_id:      form.embarcacao_id,
      nome:               form.nome,
      descricao:          form.descricao,
      duracao:            form.duracao,
      quantidade_pessoas: form.quantidade_pessoas,
      origem:             form.origem,
      destino:            form.destino,
      municipio_id:       form.municipio_id,
      latitude:           form.latitude,
      longitude:          form.longitude,
      cep:                form.cep,
      bairro:             form.bairro,
      logradouro:         form.logradouro,
      logradouro_numero:  form.logradouro_numero,
      complemento:        form.complemento,
    });

    if (!result.ok) {
      setFeedback({ type: 'error', msg: result.error ?? 'Erro ao atualizar.' });
      setSubmitting(false);
      return;
    }

    // 2. Excluir imagens marcadas
    for (const img of existingImages.filter(i => i.markedForDelete)) {
      await excluirImagemRoteiro(roteiro.id, img.id);
    }

    // 3. Definir nova principal em imagens existentes (se houver)
    const principalExisting = existingImages.find(i => i.principal && !i.markedForDelete);
    const principalNew      = newImages.find(i => i.principal);
    if (principalExisting && !principalNew) {
      await definirPrincipalRoteiro(roteiro.id, principalExisting.id);
    }

    // 4. Upload de novas imagens
    for (let i = 0; i < newImages.length; i++) {
      setNewImages(prev => prev.map((img, idx) => idx === i ? { ...img, uploading: true } : img));
      const url = await uploadNewImage(newImages[i], newImages[i].principal);
      setNewImages(prev => prev.map((img, idx) =>
        idx === i ? { ...img, uploading: false, uploaded: !!url, error: url ? undefined : 'Falha no upload' } : img,
      ));
    }

    setFeedback({ type: 'success', msg: 'Roteiro atualizado com sucesso!' });
    setSubmitting(false);
    setTimeout(() => router.push('/painel/roteiros'), 1200);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">

      {/* ── 1. Informações gerais ────────────────────────────────────────── */}
      <SectionCard icon={Info} title="Informações gerais">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <Field label="Nome do roteiro" required>
              <input className={inputCls} placeholder="ex: Passeio à Ilha Grande"
                value={form.nome} onChange={e => setField('nome', e.target.value)} required />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Descrição" required>
              <textarea className={`${inputCls} resize-none`} rows={3}
                placeholder="Descreva o roteiro, pontos turísticos, atrações e destaques..."
                value={form.descricao} onChange={e => setField('descricao', e.target.value)} required />
            </Field>
          </div>
          <Field label="Embarcação vinculada" hint="Opcional — associe este roteiro a uma de suas embarcações.">
            <select className={selectCls} value={form.embarcacao_id}
              onChange={e => setField('embarcacao_id', e.target.value)}>
              <option value="">Sem vínculo</option>
              {embarcacoes.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </Field>
          <Field label="Duração" hint='ex: "4 horas", "1 dia", "3 dias / 2 noites"'>
            <input className={inputCls} placeholder="ex: 4 horas"
              value={form.duracao} onChange={e => setField('duracao', e.target.value)} />
          </Field>
          <Field label="Capacidade máxima" hint="Número de pessoas">
            <input className={inputCls} type="number" min="1" placeholder="ex: 12"
              value={form.quantidade_pessoas}
              onChange={e => setField('quantidade_pessoas', e.target.value)} />
          </Field>
          <div />
          <Field label="Local de partida (origem)">
            <input className={inputCls} placeholder="ex: Marina da Glória, RJ"
              value={form.origem} onChange={e => setField('origem', e.target.value)} />
          </Field>
          <Field label="Local de chegada (destino)">
            <input className={inputCls} placeholder="ex: Ilha Grande, RJ"
              value={form.destino} onChange={e => setField('destino', e.target.value)} />
          </Field>
        </div>
      </SectionCard>

      {/* ── 2. Localização de partida ────────────────────────────────────── */}
      <SectionCard icon={MapPin} title="Localização de partida">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">CEP</label>
            <div className="relative max-w-xs">
              <input
                className={`${inputCls} ${cepError ? 'border-red-300 focus:ring-red-200 focus:border-red-400' : ''}`}
                placeholder="00000-000" maxLength={9}
                value={form.cep} onChange={e => handleCepChange(e.target.value)} />
              {cepLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#0B2447]" />
              )}
            </div>
            {cepError
              ? <p className="mt-1 text-xs text-red-500">{cepError}</p>
              : <p className="mt-1 text-xs text-slate-400">Preencha o CEP para completar o endereço automaticamente.</p>
            }
          </div>

          <Field label="Estado">
            <select className={selectCls} value={form.estado_id}
              onChange={e => handleEstadoChange(e.target.value)}>
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
              {loadingMunicipios && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
              )}
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
            <input className={inputCls} placeholder="ex: Marina Sul, Píer 3"
              value={form.complemento} onChange={e => setField('complemento', e.target.value)} />
          </Field>

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

      {/* ── 3. Imagens ──────────────────────────────────────────────────── */}
      <SectionCard icon={ImageIcon} title="Imagens">

        {/* Imagens existentes */}
        {existingImages.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Imagens salvas
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {existingImages.map((img) => (
                <div key={img.id}
                  className={`relative group rounded-xl overflow-hidden border-2 transition-all ${
                    img.markedForDelete ? 'opacity-40 border-red-300' : img.principal ? 'border-[#0B2447]' : 'border-transparent'
                  }`}>
                  <div className="aspect-square bg-slate-100 relative">
                    <Image src={img.url_imagem} alt={img.titulo ?? ''} fill className="object-cover" />
                  </div>
                  {img.principal && !img.markedForDelete && (
                    <div className="absolute bottom-0 left-0 right-0 bg-[#0B2447]/80 py-1 text-center">
                      <span className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center justify-center gap-1">
                        <Star className="w-2.5 h-2.5" /> Principal
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-start justify-between p-1.5 opacity-0 group-hover:opacity-100">
                    {!img.principal && !img.markedForDelete && (
                      <button type="button" onClick={() => setPrincipalExisting(img.id)} title="Definir como principal"
                        className="w-7 h-7 rounded-lg bg-white/90 flex items-center justify-center hover:bg-white transition">
                        <Star className="w-3.5 h-3.5 text-[#0B2447]" />
                      </button>
                    )}
                    <button type="button" onClick={() => toggleDeleteExisting(img.id)}
                      title={img.markedForDelete ? 'Cancelar exclusão' : 'Remover'}
                      className={`w-7 h-7 rounded-lg bg-white/90 flex items-center justify-center transition ml-auto ${
                        img.markedForDelete ? 'text-slate-500 hover:bg-slate-100' : 'hover:bg-red-50 hover:text-red-600'
                      }`}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Drop zone para novas imagens */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
            dragging ? 'border-[#0B2447] bg-[#0B2447]/5' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
          }`}>
          <Upload className="w-8 h-8 text-slate-300" />
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600">
              Adicionar novas imagens — <span className="text-[#0B3D91] underline">clique ou arraste</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">JPG, PNG ou WEBP • Máximo 10 MB por arquivo</p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
            multiple className="hidden"
            onChange={e => e.target.files && addFiles(e.target.files)} />
        </div>

        {newImages.length > 0 && (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {newImages.map((img, i) => (
              <div key={i}
                className={`relative group rounded-xl overflow-hidden border-2 transition-all ${
                  img.principal ? 'border-[#0B2447]' : 'border-transparent'
                }`}>
                <div className="aspect-square bg-slate-100 relative">
                  <Image src={img.previewUrl} alt={img.file.name} fill className="object-cover" unoptimized />
                </div>
                {img.uploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
                {img.uploaded && (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <CheckCircle className="w-3 h-3 text-white" />
                  </div>
                )}
                {img.error && (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                    <AlertCircle className="w-3 h-3 text-white" />
                  </div>
                )}
                {img.principal && (
                  <div className="absolute bottom-0 left-0 right-0 bg-[#0B2447]/80 py-1 text-center">
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center justify-center gap-1">
                      <Star className="w-2.5 h-2.5" /> Principal
                    </span>
                  </div>
                )}
                {!img.uploading && !img.uploaded && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-start justify-between p-1.5 opacity-0 group-hover:opacity-100">
                    {!img.principal && (
                      <button type="button" onClick={() => setPrincipalNew(i)} title="Definir como principal"
                        className="w-7 h-7 rounded-lg bg-white/90 flex items-center justify-center hover:bg-white transition">
                        <Star className="w-3.5 h-3.5 text-[#0B2447]" />
                      </button>
                    )}
                    <button type="button" onClick={() => removeNewImage(i)} title="Remover"
                      className="w-7 h-7 rounded-lg bg-white/90 flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition ml-auto">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {(existingImages.length > 0 || newImages.length > 0) && (
          <p className="mt-3 text-xs text-slate-400">
            Passe o mouse sobre a imagem para defini-la como principal ou removê-la.
          </p>
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
        <button type="button" onClick={() => router.push('/painel/roteiros')}
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
          Cancelar
        </button>
        <button type="submit" disabled={submitting || !form.nome.trim() || !form.descricao.trim()}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold transition shadow-md shadow-[#0B2447]/10 disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
            : <><ChevronRight className="w-4 h-4" /> Salvar alterações</>}
        </button>
      </div>
    </form>
  );
}
