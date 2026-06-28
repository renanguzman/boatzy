'use client';

import { useState, useTransition, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Info, Ruler, DollarSign, MapPin, ImageIcon, Sparkles, CalendarDays,
  Upload, X, Star, Loader2, AlertCircle, CheckCircle,
  ChevronRight, Plus, ChevronDown, ChevronUp, Trash2, HelpCircle,
} from 'lucide-react';
import { MAX_IMAGE_SIZE_BYTES, MAX_IMAGE_SIZE_ERROR } from '@/lib/upload';
import {
  atualizarEmbarcacao,
  atualizarComodidades,
  excluirImagem,
  excluirRegra,
  definirPrincipal,
  salvarBloqueiosEmbarcacao,
  type AtualizarEmbarcacaoPayload,
} from '../actions';
import {
  criarRegra,
  salvarImagem,
  getMunicipiosByEstado,
} from '../../../novo/actions';
import MapaPicker from '../../../novo/_components/MapaPicker';
import DisponibilidadePicker from '@/components/painel/DisponibilidadePicker';
import type { EmbarcacaoStatus, ModalidadeCapitao, PrecoRegraTipo } from '@/types/supabase';

// ─── Constantes ───────────────────────────────────────────────────────────────

const DIAS_SEMANA = [
  { value: 0, label: 'Dom' }, { value: 1, label: 'Seg' }, { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' }, { value: 4, label: 'Qui' }, { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DIAS_MES: Record<number, number> = {
  1:31, 2:29, 3:31, 4:30, 5:31, 6:30, 7:31, 8:31, 9:30, 10:31, 11:30, 12:31,
};

const TIPO_CONFIG: Record<PrecoRegraTipo, { label: string; badgeCls: string; dot: string }> = {
  dia_semana:    { label: 'Dias da Semana',  badgeCls: 'bg-blue-50 text-blue-700 border-blue-200',      dot: 'bg-blue-500'   },
  periodo_anual: { label: 'Período Anual',   badgeCls: 'bg-amber-50 text-amber-700 border-amber-200',   dot: 'bg-amber-500'  },
  data_fixa:     { label: 'Data Específica', badgeCls: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
};

// Níveis de precificação em ORDEM DE PRIORIDADE (maior → menor). Esta é a única
// fonte de verdade da ordem exibida nas instruções — evita inversões visuais.
const PRECO_NIVEIS = [
  { nivel: 1, emoji: '📌', titulo: 'Data Específica',  desc: 'Intervalo único, sem repetição. Ex: Réveillon 29/12 → 02/01 = ', exemplo: 'R$ 3.000',
    cardCls: 'border-violet-200 bg-violet-50/70', tituloCls: 'text-violet-700', descCls: 'text-violet-600', numCls: 'bg-violet-600' },
  { nivel: 2, emoji: '☀️', titulo: 'Período Anual',   desc: 'Intervalo que repete todo ano. Ex: Verão 01/Dez → 28/Fev = ',    exemplo: 'R$ 2.000',
    cardCls: 'border-amber-200 bg-amber-50/70',  tituloCls: 'text-amber-700',  descCls: 'text-amber-600',  numCls: 'bg-amber-500' },
  { nivel: 3, emoji: '🗓', titulo: 'Dias da Semana',   desc: 'Recorrente toda semana. Ex: todo Sábado e Domingo = ',           exemplo: 'R$ 1.500',
    cardCls: 'border-blue-200 bg-blue-50/70',    tituloCls: 'text-blue-700',   descCls: 'text-blue-600',   numCls: 'bg-blue-500' },
  { nivel: 4, emoji: '🏷️', titulo: 'Preço Base',       desc: 'Padrão aplicado quando nenhuma regra acima vale para a data.',   exemplo: '',
    cardCls: 'border-slate-200 bg-white',        tituloCls: 'text-slate-600',  descCls: 'text-slate-400',  numCls: 'bg-slate-400' },
] as const;

// ─── Tipos locais ─────────────────────────────────────────────────────────────

type Tipo      = { id: string; nome: string };
type Estado    = { id: number; uf: string; nome: string };
type Municipio = { id: number; nome: string };
type Comodidade = { id: string; nome: string };

type ExistingImage = {
  id: string; url: string; titulo: string | null; principal: boolean;
  markedForDelete: boolean;
};

type ExistingRegra = {
  id: string; tipo: PrecoRegraTipo; nome: string; valor: number; resumo: string;
  markedForDelete: boolean;
};

type NewImage = {
  file: File; previewUrl: string; principal: boolean;
  uploading: boolean; uploaded: boolean; error?: string;
};

type NewRegra = {
  localId: string; tipo: PrecoRegraTipo; nome: string; valor: string;
  diasSemana: number[];
  periodoMesInicio: number; periodoDiaInicio: number;
  periodoMesFim: number;   periodoDiaFim: number;
  dataInicio: string; dataFim: string;
};

type EmbarcacaoData = {
  id: string;
  nome: string; descricao: string | null;
  embarcacao_tipo_id: string | null; embarcacao_categoria_id: string | null;
  status: EmbarcacaoStatus;
  modalidade_capitao: ModalidadeCapitao | null;
  capacidade: number | null; comprimento: number | null;
  cabines: number | null; quartos: number | null; suites: number | null;
  banheiros: number | null; tripulacao: number | null;
  preco_base: number | null;
  disponibilidade_dias_semana: number[] | null;
  municipio_id: number | null; estado_id: number | null;
  latitude: number | null; longitude: number | null;
  cep: string | null; bairro: string | null; logradouro: string | null;
  logradouro_numero: string | null; complemento: string | null;
  embarcacao_imagens: { id: string; url_imagem: string; titulo: string | null; principal: boolean }[];
  embarcacao_preco_regra: {
    id: string; nome: string; valor: number; tipo: string; prioridade: number; ativo: boolean;
    dias_semana: number[] | null;
    periodo_mes_inicio: number | null; periodo_dia_inicio: number | null;
    periodo_mes_fim: number | null;   periodo_dia_fim: number | null;
    data_inicio: string | null;       data_fim: string | null;
  }[];
};

type Props = {
  embarcacao: EmbarcacaoData;
  tipos: Tipo[]; categorias: Tipo[]; estados: Estado[];
  municipiosIniciais: Municipio[];
  comodidades: Comodidade[];
  comodidadesIniciais: string[];
  bloqueiosIniciais: string[];
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

function fmtBRL(v: string | number): string {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (!v || isNaN(n)) return '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatRegraResumoFromDb(r: EmbarcacaoData['embarcacao_preco_regra'][0]): string {
  if (r.tipo === 'dia_semana' && r.dias_semana?.length)
    return r.dias_semana.map(d => DIAS_SEMANA[d]?.label ?? d).join(', ');
  if (r.tipo === 'periodo_anual' && r.periodo_mes_inicio != null)
    return `${String(r.periodo_dia_inicio).padStart(2,'0')}/${MESES[r.periodo_mes_inicio-1]} → ${String(r.periodo_dia_fim).padStart(2,'0')}/${MESES[(r.periodo_mes_fim??1)-1]}`;
  if (r.tipo === 'data_fixa' && r.data_inicio && r.data_fim) {
    const fmt = (d: string) => d.split('-').reverse().join('/');
    return `${fmt(r.data_inicio)} → ${fmt(r.data_fim)}`;
  }
  return '';
}

function formatNewRegraResumo(r: NewRegra): string {
  if (r.tipo === 'dia_semana')
    return r.diasSemana.map(d => DIAS_SEMANA[d].label).join(', ');
  if (r.tipo === 'periodo_anual')
    return `${String(r.periodoDiaInicio).padStart(2,'0')}/${MESES[r.periodoMesInicio-1]} → ${String(r.periodoDiaFim).padStart(2,'0')}/${MESES[r.periodoMesFim-1]}`;
  if (r.tipo === 'data_fixa' && r.dataInicio && r.dataFim) {
    const fmt = (d: string) => d.split('-').reverse().join('/');
    return `${fmt(r.dataInicio)} → ${fmt(r.dataFim)}`;
  }
  return '';
}

const emptyNewRegra = (): Omit<NewRegra, 'localId'> => ({
  tipo: 'dia_semana', nome: '', valor: '',
  diasSemana: [],
  periodoMesInicio: 12, periodoDiaInicio: 1,
  periodoMesFim: 2,    periodoDiaFim: 28,
  dataInicio: '', dataFim: '',
});

// ─── Componente principal ─────────────────────────────────────────────────────

export default function EditarEmbarcacaoForm({
  embarcacao, tipos, categorias, estados, municipiosIniciais,
  comodidades, comodidadesIniciais, bloqueiosIniciais,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const numeroInputRef = useRef<HTMLInputElement>(null);

  // ── Form base ──────────────────────────────────────────────────────────────
  const [form, setForm] = useState<Omit<AtualizarEmbarcacaoPayload, 'municipio_id' | 'disponibilidade_dias_semana'> & {
    municipio_id: string; estado_id: string;
  }>({
    nome:        embarcacao.nome,
    descricao:   embarcacao.descricao   ?? '',
    embarcacao_tipo_id:      embarcacao.embarcacao_tipo_id      ?? '',
    embarcacao_categoria_id: embarcacao.embarcacao_categoria_id ?? '',
    status:      embarcacao.status,
    modalidade_capitao: embarcacao.modalidade_capitao ?? 'sem_capitao',
    capacidade:  embarcacao.capacidade  != null ? String(embarcacao.capacidade)  : '',
    comprimento: embarcacao.comprimento != null ? String(embarcacao.comprimento) : '',
    cabines:     embarcacao.cabines     != null ? String(embarcacao.cabines)     : '',
    quartos:     embarcacao.quartos     != null ? String(embarcacao.quartos)     : '',
    suites:      embarcacao.suites      != null ? String(embarcacao.suites)      : '',
    banheiros:   embarcacao.banheiros   != null ? String(embarcacao.banheiros)   : '',
    tripulacao:  embarcacao.tripulacao  != null ? String(embarcacao.tripulacao)  : '',
    preco_base:  embarcacao.preco_base  != null ? String(embarcacao.preco_base)  : '',
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

  // ── Comodidades ────────────────────────────────────────────────────────────
  const [comodidadesSelecionadas, setComodidadesSelecionadas] = useState<string[]>(comodidadesIniciais);

  function toggleComodidade(id: string) {
    setComodidadesSelecionadas(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id],
    );
  }

  // ── Imagens existentes ─────────────────────────────────────────────────────
  const [existingImages, setExistingImages] = useState<ExistingImage[]>(
    embarcacao.embarcacao_imagens.map(img => ({
      id: img.id, url: img.url_imagem, titulo: img.titulo,
      principal: img.principal, markedForDelete: false,
    })),
  );

  // ── Novas imagens ──────────────────────────────────────────────────────────
  const [newImages, setNewImages]   = useState<NewImage[]>([]);
  const [dragging, setDragging]     = useState(false);

  // ── Regras existentes ──────────────────────────────────────────────────────
  const [existingRegras, setExistingRegras] = useState<ExistingRegra[]>(
    embarcacao.embarcacao_preco_regra.map(r => ({
      id: r.id,
      tipo: r.tipo as PrecoRegraTipo,
      nome: r.nome,
      valor: r.valor,
      resumo: formatRegraResumoFromDb(r),
      markedForDelete: false,
    })),
  );

  // ── Novas regras ───────────────────────────────────────────────────────────
  const [newRegras, setNewRegras]             = useState<NewRegra[]>([]);
  const [showRegraForm, setShowRegraForm]     = useState(false);
  const [showInstrucoes, setShowInstrucoes]   = useState(false);
  const [rf, setRf]                           = useState(emptyNewRegra());

  // ── Disponibilidade ─────────────────────────────────────────────────────────
  const [diasOperacao, setDiasOperacao] = useState<number[]>(embarcacao.disponibilidade_dias_semana ?? []);
  const [bloqueios, setBloqueios]       = useState<string[]>(bloqueiosIniciais);

  // ── Feedback ───────────────────────────────────────────────────────────────
  const [feedback,   setFeedback]   = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  // ─── Imagens existentes ────────────────────────────────────────────────────

  function toggleDeleteExisting(id: string) {
    setExistingImages(prev => prev.map(img =>
      img.id === id ? { ...img, markedForDelete: !img.markedForDelete } : img,
    ));
  }

  function setPrincipalExisting(id: string) {
    setExistingImages(prev => prev.map(img => ({ ...img, principal: img.id === id })));
  }

  // ─── Novas imagens ─────────────────────────────────────────────────────────

  function addFiles(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    const arr = imageFiles.filter(f => f.size <= MAX_IMAGE_SIZE_BYTES);
    if (arr.length < imageFiles.length) {
      setFeedback({ type: 'error', msg: MAX_IMAGE_SIZE_ERROR });
    }
    if (arr.length === 0) return;
    const hasExistingPrincipal = existingImages.some(i => i.principal && !i.markedForDelete);
    setNewImages(prev => [
      ...prev,
      ...arr.map((file, i) => ({
        file, previewUrl: URL.createObjectURL(file),
        principal: !hasExistingPrincipal && prev.length === 0 && i === 0,
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

  async function uploadNewImage(img: NewImage, embarcacaoId: string, isPrincipal: boolean) {
    const body = new FormData();
    body.append('file', img.file);
    body.append('embarcacaoId', embarcacaoId);
    const res = await fetch('/api/painel/embarcacoes/upload', { method: 'POST', body });
    if (!res.ok) return null;
    const { publicUrl } = await res.json();
    await salvarImagem({ embarcacaoId, urlImagem: publicUrl, titulo: img.file.name, principal: isPrincipal });
    return publicUrl as string;
  }

  // ─── Regras novas ──────────────────────────────────────────────────────────

  function setRfField<K extends keyof typeof rf>(k: K, v: typeof rf[K]) {
    setRf(r => ({ ...r, [k]: v }));
  }

  function toggleDia(day: number) {
    setRf(r => ({
      ...r,
      diasSemana: r.diasSemana.includes(day)
        ? r.diasSemana.filter(d => d !== day)
        : [...r.diasSemana, day].sort(),
    }));
  }

  function podeAdicionar(): boolean {
    if (!rf.nome.trim() || !rf.valor || parseFloat(rf.valor) <= 0) return false;
    if (rf.tipo === 'dia_semana' && rf.diasSemana.length === 0)        return false;
    if (rf.tipo === 'data_fixa' && (!rf.dataInicio || !rf.dataFim))    return false;
    if (rf.tipo === 'data_fixa' && rf.dataInicio > rf.dataFim)         return false;
    return true;
  }

  function handleAddRegra() {
    if (!podeAdicionar()) return;
    setNewRegras(prev => [...prev, { ...rf, localId: crypto.randomUUID() }]);
    setRf(emptyNewRegra());
    setShowRegraForm(false);
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFeedback(null);
    setSubmitting(true);

    // 1. Atualizar campos base
    const result = await atualizarEmbarcacao(embarcacao.id, {
      nome: form.nome, descricao: form.descricao,
      embarcacao_tipo_id: form.embarcacao_tipo_id,
      embarcacao_categoria_id: form.embarcacao_categoria_id,
      status: form.status as EmbarcacaoStatus,
      modalidade_capitao: form.modalidade_capitao as ModalidadeCapitao,
      capacidade: form.capacidade, comprimento: form.comprimento,
      cabines: form.cabines, quartos: form.quartos, suites: form.suites,
      banheiros: form.banheiros, tripulacao: form.tripulacao,
      preco_base: form.preco_base, municipio_id: form.municipio_id,
      latitude: form.latitude, longitude: form.longitude,
      cep: form.cep, bairro: form.bairro, logradouro: form.logradouro,
      logradouro_numero: form.logradouro_numero, complemento: form.complemento,
      disponibilidade_dias_semana: diasOperacao,
    });

    if (!result.ok) {
      setFeedback({ type: 'error', msg: result.error ?? 'Erro ao atualizar.' });
      setSubmitting(false);
      return;
    }

    // 2. Atualizar comodidades
    await atualizarComodidades(embarcacao.id, comodidadesSelecionadas);

    // Substituir o conjunto de datas bloqueadas
    await salvarBloqueiosEmbarcacao(embarcacao.id, bloqueios);

    // 3. Excluir imagens marcadas
    for (const img of existingImages.filter(i => i.markedForDelete)) {
      await excluirImagem(embarcacao.id, img.id);
    }

    // 4. Atualizar principal de imagens existentes (não deletadas)
    const principalExisting = existingImages.find(i => i.principal && !i.markedForDelete);
    if (principalExisting) {
      await definirPrincipal(embarcacao.id, principalExisting.id);
    }

    // 5. Upload de novas imagens
    const hasPrincipal = !!principalExisting;
    for (let i = 0; i < newImages.length; i++) {
      setNewImages(prev => prev.map((img, idx) => idx === i ? { ...img, uploading: true } : img));
      const isPrincipal = newImages[i].principal || (!hasPrincipal && i === 0);
      const url = await uploadNewImage(newImages[i], embarcacao.id, isPrincipal);
      setNewImages(prev => prev.map((img, idx) =>
        idx === i ? { ...img, uploading: false, uploaded: !!url, error: url ? undefined : 'Falha no upload' } : img,
      ));
    }

    // 6. Excluir regras marcadas
    for (const regra of existingRegras.filter(r => r.markedForDelete)) {
      await excluirRegra(embarcacao.id, regra.id);
    }

    // 7. Criar novas regras
    for (const regra of newRegras) {
      await criarRegra({
        embarcacaoId: embarcacao.id,
        nome: regra.nome,
        valor: parseFloat(regra.valor),
        tipo: regra.tipo,
        prioridade: 0,
        diasSemana:       regra.tipo === 'dia_semana'    ? regra.diasSemana       : undefined,
        periodoMesInicio: regra.tipo === 'periodo_anual' ? regra.periodoMesInicio : undefined,
        periodoDiaInicio: regra.tipo === 'periodo_anual' ? regra.periodoDiaInicio : undefined,
        periodoMesFim:    regra.tipo === 'periodo_anual' ? regra.periodoMesFim    : undefined,
        periodoDiaFim:    regra.tipo === 'periodo_anual' ? regra.periodoDiaFim    : undefined,
        dataInicio:       regra.tipo === 'data_fixa'     ? regra.dataInicio       : undefined,
        dataFim:          regra.tipo === 'data_fixa'     ? regra.dataFim          : undefined,
      });
    }

    setFeedback({ type: 'success', msg: 'Embarcação atualizada com sucesso!' });
    setSubmitting(false);
    setTimeout(() => router.push('/painel/embarcacoes'), 1200);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">

      {/* ── 1. Informações gerais ──────────────────────────────────────────── */}
      <SectionCard icon={Info} title="Informações gerais">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <Field label="Nome da embarcação" required>
              <input className={inputCls} placeholder="ex: Lancha Azul Horizon"
                value={form.nome} onChange={e => setField('nome', e.target.value)} required />
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
          <Field label="Categoria">
            <select className={selectCls} value={form.embarcacao_categoria_id}
              onChange={e => setField('embarcacao_categoria_id', e.target.value)}>
              <option value="">Selecione a categoria</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Field>
          <Field label="Capitão">
            <select className={selectCls} value={form.modalidade_capitao}
              onChange={e => setField('modalidade_capitao', e.target.value as ModalidadeCapitao)}>
              <option value="sem_capitao">Sem capitão (locatário pilota)</option>
              <option value="com_capitao">Com capitão obrigatório</option>
              <option value="opcional">Capitão opcional</option>
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

      {/* ── 2. Especificações técnicas ─────────────────────────────────────── */}
      <SectionCard icon={Ruler} title="Especificações técnicas">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <Field label="Capacidade" hint="Pessoas">
            <input className={inputCls} type="number" min="1" placeholder="ex: 12"
              value={form.capacidade} onChange={e => setField('capacidade', e.target.value)} />
          </Field>
          <Field label="Comprimento" hint="Metros">
            <input className={inputCls} type="number" min="0" step="0.01" placeholder="ex: 8.50"
              value={form.comprimento} onChange={e => setField('comprimento', e.target.value)} />
          </Field>
          <Field label="Cabines">
            <input className={inputCls} type="number" min="0" placeholder="ex: 2"
              value={form.cabines} onChange={e => setField('cabines', e.target.value)} />
          </Field>
          <Field label="Tripulação">
            <input className={inputCls} type="number" min="0" placeholder="ex: 3"
              value={form.tripulacao} onChange={e => setField('tripulacao', e.target.value)} />
          </Field>
          <Field label="Quartos">
            <input className={inputCls} type="number" min="0" placeholder="ex: 3"
              value={form.quartos} onChange={e => setField('quartos', e.target.value)} />
          </Field>
          <Field label="Suítes">
            <input className={inputCls} type="number" min="0" placeholder="ex: 1"
              value={form.suites} onChange={e => setField('suites', e.target.value)} />
          </Field>
          <Field label="Banheiros">
            <input className={inputCls} type="number" min="0" placeholder="ex: 1"
              value={form.banheiros} onChange={e => setField('banheiros', e.target.value)} />
          </Field>
        </div>
      </SectionCard>

      {/* ── 3. Comodidades ────────────────────────────────────────────────── */}
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

      {/* ── 4. Preço ──────────────────────────────────────────────────────── */}
      <SectionCard icon={DollarSign} title="Preço">
        <div className="max-w-xs mb-6">
          <Field label="Preço base (R$ / dia)"
            hint="Aplicado quando nenhuma regra específica estiver vigente.">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">R$</span>
              <input className={`${inputCls} pl-10`} type="number" min="0" step="0.01"
                placeholder="0,00" value={form.preco_base}
                onChange={e => setField('preco_base', e.target.value)} />
            </div>
          </Field>
        </div>

        <div className="border-t border-slate-100 mb-5" />

        <button type="button" onClick={() => setShowInstrucoes(v => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-[#0B2447] mb-4 hover:text-[#0B3D91] transition-colors">
          <HelpCircle className="w-4 h-4" />
          Como funciona a precificação dinâmica?
          {showInstrucoes ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
        </button>

        {showInstrucoes && (
          <div className="mb-6 rounded-xl border border-slate-100 bg-slate-50/60 p-5">
            <p className="text-sm text-slate-600 leading-relaxed">
              Para cada data, o sistema aplica <strong>a primeira regra que se encaixa</strong>, seguindo esta ordem — do mais específico (nº&nbsp;1) ao mais geral (nº&nbsp;4):
            </p>
            <ol className="mt-4 space-y-2">
              {PRECO_NIVEIS.map(n => (
                <li key={n.nivel} className={`flex items-start gap-3 rounded-xl border p-3 ${n.cardCls}`}>
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${n.numCls}`}>
                    {n.nivel}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold ${n.tituloCls}`}>{n.emoji} {n.titulo}</p>
                    <p className={`text-xs leading-relaxed ${n.descCls}`}>
                      {n.desc}{n.exemplo && <strong>{n.exemplo}</strong>}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-slate-500 leading-relaxed bg-slate-100/70 rounded-lg p-3">
              💡 Quando mais de uma regra cai na mesma data, vence a de <strong>menor número</strong>. Ex: 31/12 é domingo, está no verão <em>e</em> é Réveillon — o sistema cobra os <strong>R$ 3.000</strong> da Data Específica (nº&nbsp;1).
            </p>
          </div>
        )}

        {/* Regras existentes */}
        {existingRegras.length > 0 && (
          <div className="space-y-2 mb-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Regras salvas ({existingRegras.filter(r => !r.markedForDelete).length})
            </p>
            {existingRegras.map(regra => {
              const cfg = TIPO_CONFIG[regra.tipo];
              return (
                <div key={regra.id}
                  className={`flex items-center gap-3 border rounded-xl px-4 py-3 transition-all ${
                    regra.markedForDelete
                      ? 'bg-red-50 border-red-200 opacity-60'
                      : 'bg-white border-slate-100 shadow-sm'
                  }`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.badgeCls}`}>
                        {cfg.label}
                      </span>
                      <span className={`text-sm font-semibold truncate ${regra.markedForDelete ? 'line-through text-slate-400' : 'text-[#0B2447]'}`}>
                        {regra.nome}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{regra.resumo}</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-700 whitespace-nowrap">{fmtBRL(regra.valor)}</span>
                  <button type="button" onClick={() => setExistingRegras(prev =>
                    prev.map(r => r.id === regra.id ? { ...r, markedForDelete: !r.markedForDelete } : r)
                  )}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors flex-shrink-0 ${
                      regra.markedForDelete
                        ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                        : 'text-slate-300 hover:text-red-500 hover:bg-red-50'
                    }`}
                    title={regra.markedForDelete ? 'Cancelar exclusão' : 'Remover regra'}>
                    {regra.markedForDelete ? <CheckCircle className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Novas regras */}
        {newRegras.length > 0 && (
          <div className="space-y-2 mb-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Novas regras ({newRegras.length})
            </p>
            {newRegras.map(regra => {
              const cfg = TIPO_CONFIG[regra.tipo];
              return (
                <div key={regra.localId}
                  className="flex items-center gap-3 bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.badgeCls}`}>
                        {cfg.label}
                      </span>
                      <span className="text-sm font-semibold text-[#0B2447] truncate">{regra.nome}</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded">NOVA</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{formatNewRegraResumo(regra)}</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-700 whitespace-nowrap">{fmtBRL(regra.valor)}</span>
                  <button type="button" onClick={() => setNewRegras(prev => prev.filter(r => r.localId !== regra.localId))}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Formulário inline para nova regra */}
        {!showRegraForm ? (
          <button type="button" onClick={() => setShowRegraForm(true)}
            className="flex items-center gap-2 text-sm font-semibold text-[#0B3D91] hover:text-[#0B2447]
              border border-dashed border-[#0B3D91]/30 hover:border-[#0B2447]/40 rounded-xl px-4 py-3
              w-full justify-center transition-colors hover:bg-slate-50/50">
            <Plus className="w-4 h-4" />
            Adicionar regra de preço
          </button>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-5 space-y-4">
            <p className="text-sm font-bold text-[#0B2447]">Nova regra</p>
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {(['data_fixa','periodo_anual','dia_semana'] as PrecoRegraTipo[]).map(t => (
                <button key={t} type="button" onClick={() => setRfField('tipo', t)}
                  className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${
                    rf.tipo === t ? 'bg-white text-[#0B2447] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {TIPO_CONFIG[t].label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nome da regra" required>
                <input className={inputCls}
                  placeholder={rf.tipo === 'dia_semana' ? 'ex: Fim de Semana' : rf.tipo === 'periodo_anual' ? 'ex: Alta Temporada' : 'ex: Réveillon 2025'}
                  value={rf.nome} onChange={e => setRfField('nome', e.target.value)} />
              </Field>
              <Field label="Preço (R$ / dia)" required>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">R$</span>
                  <input className={`${inputCls} pl-10`} type="number" min="0" step="0.01"
                    placeholder="0,00" value={rf.valor} onChange={e => setRfField('valor', e.target.value)} />
                </div>
              </Field>
            </div>

            {rf.tipo === 'dia_semana' && (
              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">Dias da semana <span className="text-red-500">*</span></p>
                <div className="flex gap-2 flex-wrap">
                  {DIAS_SEMANA.map(d => {
                    const active = rf.diasSemana.includes(d.value);
                    return (
                      <button key={d.value} type="button" onClick={() => toggleDia(d.value)}
                        className={`w-12 h-10 rounded-xl text-xs font-bold transition-all ${active ? 'bg-[#0B2447] text-white shadow-md shadow-[#0B2447]/20' : 'bg-white border border-slate-200 text-slate-500 hover:border-[#0B2447]/30'}`}>
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {rf.tipo === 'periodo_anual' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Início <span className="text-red-500">*</span></p>
                  <div className="flex gap-2">
                    <select className={`${selectCls} flex-1`} value={rf.periodoMesInicio} onChange={e => setRfField('periodoMesInicio', parseInt(e.target.value))}>
                      {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                    </select>
                    <select className={`${selectCls} w-20`} value={rf.periodoDiaInicio} onChange={e => setRfField('periodoDiaInicio', parseInt(e.target.value))}>
                      {Array.from({ length: DIAS_MES[rf.periodoMesInicio] }, (_, i) => i+1).map(d => (
                        <option key={d} value={d}>{String(d).padStart(2,'0')}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Fim <span className="text-red-500">*</span></p>
                  <div className="flex gap-2">
                    <select className={`${selectCls} flex-1`} value={rf.periodoMesFim} onChange={e => setRfField('periodoMesFim', parseInt(e.target.value))}>
                      {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                    </select>
                    <select className={`${selectCls} w-20`} value={rf.periodoDiaFim} onChange={e => setRfField('periodoDiaFim', parseInt(e.target.value))}>
                      {Array.from({ length: DIAS_MES[rf.periodoMesFim] }, (_, i) => i+1).map(d => (
                        <option key={d} value={d}>{String(d).padStart(2,'0')}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {rf.tipo === 'data_fixa' && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Data inicial" required>
                  <input className={inputCls} type="date" value={rf.dataInicio} onChange={e => setRfField('dataInicio', e.target.value)} />
                </Field>
                <Field label="Data final" required>
                  <input className={inputCls} type="date" min={rf.dataInicio} value={rf.dataFim} onChange={e => setRfField('dataFim', e.target.value)} />
                </Field>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={() => { setShowRegraForm(false); setRf(emptyNewRegra()); }}
                className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors">
                Cancelar
              </button>
              <button type="button" onClick={handleAddRegra} disabled={!podeAdicionar()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <Plus className="w-3.5 h-3.5" />
                Adicionar regra
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── 5. Disponibilidade ────────────────────────────────────────────── */}
      <SectionCard icon={CalendarDays} title="Disponibilidade">
        <p className="text-xs text-slate-400 mb-5">
          Defina os dias da semana em que a embarcação opera e bloqueie datas específicas em que ela não estará disponível para reserva.
        </p>
        <DisponibilidadePicker
          diasSemana={diasOperacao}
          onDiasSemanaChange={setDiasOperacao}
          bloqueios={bloqueios}
          onBloqueiosChange={setBloqueios}
        />
      </SectionCard>

      {/* ── 6. Localização ────────────────────────────────────────────────── */}
      <SectionCard icon={MapPin} title="Localização">
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

      {/* ── 6. Imagens ────────────────────────────────────────────────────── */}
      <SectionCard icon={ImageIcon} title="Imagens">

        {/* Imagens existentes */}
        {existingImages.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Fotos salvas ({existingImages.filter(i => !i.markedForDelete).length} de {existingImages.length})
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {existingImages.map(img => (
                <div key={img.id}
                  className={`relative group rounded-xl overflow-hidden border-2 transition-all ${
                    img.markedForDelete ? 'opacity-40 border-red-200' :
                    img.principal ? 'border-[#0B2447]' : 'border-transparent'
                  }`}>
                  <div className="aspect-square bg-slate-100 relative">
                    <Image src={img.url} alt={img.titulo ?? 'foto'} fill className="object-cover" unoptimized />
                    {img.markedForDelete && (
                      <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                        <X className="w-8 h-8 text-red-600" />
                      </div>
                    )}
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
                      title={img.markedForDelete ? 'Cancelar remoção' : 'Remover foto'}
                      className={`w-7 h-7 rounded-lg bg-white/90 flex items-center justify-center transition ml-auto ${
                        img.markedForDelete ? 'hover:bg-emerald-50 hover:text-emerald-600' : 'hover:bg-red-50 hover:text-red-600'
                      }`}>
                      {img.markedForDelete ? <CheckCircle className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">Passe o mouse para remover ou definir a principal.</p>
          </div>
        )}

        {/* Upload de novas fotos */}
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
              Adicionar mais fotos —{' '}
              <span className="text-[#0B3D91] underline">clique ou arraste</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">JPG, PNG ou WEBP • Máximo 20 MB por arquivo</p>
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
                <div className="absolute top-1 left-1 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">NOVA</div>
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
      </SectionCard>

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

      {/* ── Ações ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pb-4">
        <button type="button" onClick={() => router.push('/painel/embarcacoes')}
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
          Cancelar
        </button>
        <button type="submit" disabled={submitting || !form.nome.trim()}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold transition shadow-md shadow-[#0B2447]/10 disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
            : <><ChevronRight className="w-4 h-4" /> Salvar alterações</>}
        </button>
      </div>
    </form>
  );
}
