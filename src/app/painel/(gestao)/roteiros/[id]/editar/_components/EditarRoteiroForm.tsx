'use client';

import { useState, useTransition, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Info, MapPin, ImageIcon, Upload, X, Star, DollarSign,
  Loader2, AlertCircle, CheckCircle, ChevronRight, CalendarDays,
  Plus, ChevronDown, ChevronUp, Trash2, HelpCircle, BookOpen,
} from 'lucide-react';
import { MAX_IMAGE_SIZE_BYTES, MAX_IMAGE_SIZE_ERROR } from '@/lib/upload';
import {
  atualizarRoteiro,
  atualizarCatalogoRoteiro,
  excluirImagemRoteiro,
  definirPrincipalRoteiro,
  excluirRegraRoteiro,
  salvarBloqueiosRoteiro,
  type AtualizarRoteiroPayload,
} from '../actions';
import {
  salvarImagemRoteiro,
  getMunicipiosByEstado,
  criarRegraRoteiro,
} from '../../../novo/actions';
import MapaPicker from '../../../../embarcacoes/novo/_components/MapaPicker';
import CatalogoSelector, { type CatalogoItem, type ItemSelecionado } from '../../../_components/CatalogoSelector';
import DisponibilidadePicker from '@/components/painel/DisponibilidadePicker';
import type { PrecoRegraTipo } from '@/types/supabase';

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
  dia_semana:    { label: 'Dias da Semana',  badgeCls: 'bg-blue-50 text-blue-700 border-blue-200',     dot: 'bg-blue-500'   },
  periodo_anual: { label: 'Período Anual',   badgeCls: 'bg-amber-50 text-amber-700 border-amber-200',  dot: 'bg-amber-500'  },
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

// ─── Tipos ────────────────────────────────────────────────────────────────────

type RoteiroPrecoRegra = {
  id: string;
  nome: string;
  valor: number;
  tipo: string;
  prioridade: number;
  ativo: boolean;
  dias_semana: number[] | null;
  periodo_mes_inicio: number | null;
  periodo_dia_inicio: number | null;
  periodo_mes_fim: number | null;
  periodo_dia_fim: number | null;
  data_inicio: string | null;
  data_fim: string | null;
};

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
  preco_base: number | null;
  disponibilidade_dias_semana: number[] | null;
  estado_id: number | null;
  roteiro_imagens: RoteiroImagem[];
  roteiro_preco_regra: RoteiroPrecoRegra[];
};

type Estado     = { id: number; uf: string; nome: string };
type Municipio  = { id: number; nome: string };
type Embarcacao = { id: string; nome: string; capacidade: number | null };

type ExistingImage = RoteiroImagem & { markedForDelete: boolean };

type NewImage = {
  file: File; previewUrl: string; principal: boolean;
  uploading: boolean; uploaded: boolean; error?: string;
};

type RegraExistente = RoteiroPrecoRegra & { markedForDelete: boolean };

type RegraLocal = {
  localId: string;
  tipo: PrecoRegraTipo;
  nome: string;
  valor: string;
  diasSemana: number[];
  periodoMesInicio: number;
  periodoDiaInicio: number;
  periodoMesFim: number;
  periodoDiaFim: number;
  dataInicio: string;
  dataFim: string;
};

type Props = {
  roteiro: RoteiroData;
  estados: Estado[];
  municipiosIniciais: Municipio[];
  embarcacoes: Embarcacao[];
  catalogo: CatalogoItem[];
  catalogoIniciais: ItemSelecionado[];
  bloqueiosIniciais: string[];
  /** Rota de retorno após salvar/cancelar (o admin reutiliza o form com outra rota). */
  voltarHref?: string;
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

function formatRegraResumo(r: RegraLocal | RegraExistente): string {
  const tipo = r.tipo as PrecoRegraTipo;
  if (tipo === 'dia_semana') {
    const dias = 'diasSemana' in r ? r.diasSemana : (r.dias_semana ?? []);
    return dias.map((d: number) => DIAS_SEMANA[d].label).join(', ');
  }
  if (tipo === 'periodo_anual') {
    const mesI = 'periodoMesInicio' in r ? r.periodoMesInicio : (r.periodo_mes_inicio ?? 1);
    const diaI = 'periodoDiaInicio' in r ? r.periodoDiaInicio : (r.periodo_dia_inicio ?? 1);
    const mesF = 'periodoMesFim'    in r ? r.periodoMesFim    : (r.periodo_mes_fim    ?? 1);
    const diaF = 'periodoDiaFim'    in r ? r.periodoDiaFim    : (r.periodo_dia_fim    ?? 1);
    return `${String(diaI).padStart(2,'0')}/${MESES[mesI-1]} → ${String(diaF).padStart(2,'0')}/${MESES[mesF-1]}`;
  }
  if (tipo === 'data_fixa') {
    const ini = 'dataInicio' in r ? r.dataInicio : r.data_inicio;
    const fim = 'dataFim'    in r ? r.dataFim    : r.data_fim;
    if (ini && fim) {
      const fmt = (d: string) => d.split('-').reverse().join('/');
      return `${fmt(ini)} → ${fmt(fim)}`;
    }
  }
  return '';
}

const emptyRegra = (): Omit<RegraLocal, 'localId'> => ({
  tipo: 'dia_semana',
  nome: '', valor: '',
  diasSemana: [],
  periodoMesInicio: 12, periodoDiaInicio: 1,
  periodoMesFim: 2,    periodoDiaFim: 28,
  dataInicio: '', dataFim: '',
});

// ─── Componente principal ─────────────────────────────────────────────────────

export default function EditarRoteiroForm({ roteiro, estados, municipiosIniciais, embarcacoes, catalogo: catalogoInicial, catalogoIniciais, bloqueiosIniciais, voltarHref = '/painel/roteiros' }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const numeroInputRef = useRef<HTMLInputElement>(null);

  const fmtCep = (v: string | null) => {
    if (!v) return '';
    const d = v.replace(/\D/g, '');
    return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };

  const [form, setForm] = useState<Omit<AtualizarRoteiroPayload, 'municipio_id' | 'disponibilidade_dias_semana'> & {
    municipio_id: string; estado_id: string;
  }>({
    embarcacao_id:      roteiro.embarcacao_id ?? '',
    nome:               roteiro.nome,
    descricao:          roteiro.descricao,
    duracao:            roteiro.duracao ?? '',
    quantidade_pessoas: roteiro.quantidade_pessoas != null ? String(roteiro.quantidade_pessoas) : '',
    origem:             roteiro.origem ?? '',
    destino:            roteiro.destino ?? '',
    preco_base:         roteiro.preco_base != null ? String(roteiro.preco_base) : '',
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

  // Regras existentes
  const [regrasExistentes, setRegrasExistentes] = useState<RegraExistente[]>(
    roteiro.roteiro_preco_regra.map(r => ({ ...r, markedForDelete: false })),
  );
  // Novas regras (adicionadas localmente)
  const [novasRegras, setNovasRegras]       = useState<RegraLocal[]>([]);
  const [showRegraForm, setShowRegraForm]   = useState(false);
  const [showInstrucoes, setShowInstrucoes] = useState(false);
  const [rf, setRf]                         = useState(emptyRegra());

  // Disponibilidade: dias da semana de operação (vazio = todos) + datas bloqueadas (ISO)
  const [diasOperacao, setDiasOperacao] = useState<number[]>(roteiro.disponibilidade_dias_semana ?? []);
  const [bloqueios, setBloqueios]       = useState<string[]>(bloqueiosIniciais);

  // Imagens
  const [existingImages, setExistingImages] = useState<ExistingImage[]>(
    roteiro.roteiro_imagens.map(img => ({ ...img, markedForDelete: false })),
  );
  const [newImages, setNewImages]   = useState<NewImage[]>([]);
  const [dragging, setDragging]     = useState(false);
  const [feedback, setFeedback]     = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [itensCatalogo, setItensCatalogo] = useState<ItemSelecionado[]>(catalogoIniciais);
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>(catalogoInicial);

  /** Ao vincular uma embarcação, herda a capacidade dela como capacidade do roteiro. */
  function setEmbarcacao(embarcacaoId: string) {
    const capacidade = embarcacoes.find(e => e.id === embarcacaoId)?.capacidade;
    setForm(f => ({
      ...f,
      embarcacao_id: embarcacaoId,
      quantidade_pessoas: capacidade != null ? String(capacidade) : f.quantidade_pessoas,
    }));
  }

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
      setField('estado_id', String(estado.id));
      setField('municipio_id', '');
      setMunicipios([]);
      const muns = await carregarMunicipios(estado.id);
      const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const mun = muns.find(m => norm(m.nome) === norm(data.localidade ?? ''));
      if (mun) setField('municipio_id', String(mun.id));
      if (data.logradouro && data.bairro) setTimeout(() => numeroInputRef.current?.focus(), 50);
    } catch {
      setCepError('Erro ao consultar o CEP. Preencha manualmente.');
    } finally {
      setCepLoading(false);
    }
  }

  function geocodificarEndereco() {
    if (!form.logradouro || !form.logradouro_numero) return;
    if (typeof window === 'undefined' || !window.google?.maps?.Geocoder) return;
    const partes = [form.logradouro, form.logradouro_numero, form.bairro, form.cep.replace(/\D/g, ''), 'Brasil'].filter(Boolean).join(', ');
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: partes }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const loc = results[0].geometry.location;
        setField('latitude',  loc.lat().toFixed(7));
        setField('longitude', loc.lng().toFixed(7));
      }
    });
  }

  // ─── Regras ───────────────────────────────────────────────────────────────

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

  function podeAdicionarRegra(): boolean {
    if (!rf.nome.trim() || !rf.valor || parseFloat(rf.valor) <= 0) return false;
    if (rf.tipo === 'dia_semana'    && rf.diasSemana.length === 0)            return false;
    if (rf.tipo === 'data_fixa'     && (!rf.dataInicio || !rf.dataFim))       return false;
    if (rf.tipo === 'data_fixa'     && rf.dataInicio > rf.dataFim)            return false;
    return true;
  }

  function handleAddRegra() {
    if (!podeAdicionarRegra()) return;
    setNovasRegras(prev => [...prev, { ...rf, localId: crypto.randomUUID() }]);
    setRf(emptyRegra());
    setShowRegraForm(false);
  }

  function toggleDeleteRegra(id: string) {
    setRegrasExistentes(prev =>
      prev.map(r => r.id === id ? { ...r, markedForDelete: !r.markedForDelete } : r),
    );
  }

  function removeNovaRegra(localId: string) {
    setNovasRegras(prev => prev.filter(r => r.localId !== localId));
  }

  // ─── Imagens existentes ───────────────────────────────────────────────────

  function toggleDeleteExisting(id: string) {
    setExistingImages(prev =>
      prev.map(img => img.id === id ? { ...img, markedForDelete: !img.markedForDelete } : img),
    );
  }

  function setPrincipalExisting(id: string) {
    setExistingImages(prev => prev.map(img => ({ ...img, principal: img.id === id })));
  }

  // ─── Novas imagens ────────────────────────────────────────────────────────

  function addFiles(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    const arr = imageFiles.filter(f => f.size <= MAX_IMAGE_SIZE_BYTES);
    if (arr.length < imageFiles.length) {
      setFeedback({ type: 'error', msg: MAX_IMAGE_SIZE_ERROR });
    }
    if (arr.length === 0) return;
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
    await salvarImagemRoteiro({ roteiroId: roteiro.id, urlImagem: publicUrl, titulo: img.file.name, principal: isPrincipal });
    return publicUrl as string;
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFeedback(null);
    setSubmitting(true);

    // 1. Atualizar dados
    const result = await atualizarRoteiro(roteiro.id, {
      embarcacao_id:      form.embarcacao_id,
      nome:               form.nome,
      descricao:          form.descricao,
      duracao:            form.duracao,
      quantidade_pessoas: form.quantidade_pessoas,
      origem:             form.origem,
      destino:            form.destino,
      preco_base:         form.preco_base,
      municipio_id:       form.municipio_id,
      latitude:           form.latitude,
      longitude:          form.longitude,
      cep:                form.cep,
      bairro:             form.bairro,
      logradouro:         form.logradouro,
      logradouro_numero:  form.logradouro_numero,
      complemento:        form.complemento,
      disponibilidade_dias_semana: diasOperacao,
    });

    if (!result.ok) {
      setFeedback({ type: 'error', msg: result.error ?? 'Erro ao atualizar.' });
      setSubmitting(false);
      return;
    }

    // Substituir o conjunto de datas bloqueadas
    await salvarBloqueiosRoteiro(roteiro.id, bloqueios);

    // 2. Excluir regras marcadas
    for (const regra of regrasExistentes.filter(r => r.markedForDelete)) {
      await excluirRegraRoteiro(roteiro.id, regra.id);
    }

    // 3. Criar novas regras
    for (const regra of novasRegras) {
      await criarRegraRoteiro({
        roteiroId:         roteiro.id,
        nome:              regra.nome,
        valor:             parseFloat(regra.valor),
        tipo:              regra.tipo,
        prioridade:        0,
        diasSemana:        regra.tipo === 'dia_semana'    ? regra.diasSemana       : undefined,
        periodoMesInicio:  regra.tipo === 'periodo_anual' ? regra.periodoMesInicio : undefined,
        periodoDiaInicio:  regra.tipo === 'periodo_anual' ? regra.periodoDiaInicio : undefined,
        periodoMesFim:     regra.tipo === 'periodo_anual' ? regra.periodoMesFim    : undefined,
        periodoDiaFim:     regra.tipo === 'periodo_anual' ? regra.periodoDiaFim    : undefined,
        dataInicio:        regra.tipo === 'data_fixa'     ? regra.dataInicio       : undefined,
        dataFim:           regra.tipo === 'data_fixa'     ? regra.dataFim          : undefined,
      });
    }

    // 4. Excluir imagens marcadas
    for (const img of existingImages.filter(i => i.markedForDelete)) {
      await excluirImagemRoteiro(roteiro.id, img.id);
    }

    // 5. Definir principal em imagens existentes
    const principalExisting = existingImages.find(i => i.principal && !i.markedForDelete);
    const principalNew      = newImages.find(i => i.principal);
    if (principalExisting && !principalNew) {
      await definirPrincipalRoteiro(roteiro.id, principalExisting.id);
    }

    // 6. Upload de novas imagens
    for (let i = 0; i < newImages.length; i++) {
      setNewImages(prev => prev.map((img, idx) => idx === i ? { ...img, uploading: true } : img));
      const url = await uploadNewImage(newImages[i], newImages[i].principal);
      setNewImages(prev => prev.map((img, idx) =>
        idx === i ? { ...img, uploading: false, uploaded: !!url, error: url ? undefined : 'Falha no upload' } : img,
      ));
    }

    // 7. Atualizar itens do catálogo vinculados
    await atualizarCatalogoRoteiro(
      roteiro.id,
      itensCatalogo.map(i => ({
        catalogoId: i.catalogoId,
        valorCustomizado: i.valorCustomizado !== '' ? parseFloat(i.valorCustomizado) : null,
      })),
    );

    setFeedback({ type: 'success', msg: 'Roteiro atualizado com sucesso!' });
    setSubmitting(false);
    setTimeout(() => router.push(voltarHref), 1200);
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
              onChange={e => setEmbarcacao(e.target.value)}>
              <option value="">Sem vínculo</option>
              {embarcacoes.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </Field>
          <Field label="Duração" hint='ex: "4 horas", "1 dia", "3 dias / 2 noites"'>
            <input className={inputCls} placeholder="ex: 4 horas"
              value={form.duracao} onChange={e => setField('duracao', e.target.value)} />
          </Field>
          <Field label="Capacidade máxima" hint="Número de pessoas — preenchida com a capacidade da embarcação vinculada.">
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

      {/* ── 2. Preço ─────────────────────────────────────────────────────── */}
      <SectionCard icon={DollarSign} title="Preço">
        <div className="max-w-xs mb-6">
          <Field label="Preço base (R$ / dia)"
            hint="Aplicado quando nenhuma regra específica estiver vigente na data da reserva.">
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
        {regrasExistentes.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Regras salvas ({regrasExistentes.filter(r => !r.markedForDelete).length})
            </p>
            {regrasExistentes.map(regra => {
              const cfg = TIPO_CONFIG[regra.tipo as PrecoRegraTipo];
              return (
                <div key={regra.id}
                  className={`flex items-center gap-3 bg-white border rounded-xl px-4 py-3 shadow-sm transition-opacity ${
                    regra.markedForDelete ? 'opacity-40 border-red-200' : 'border-slate-100'
                  }`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.badgeCls}`}>{cfg.label}</span>
                      <span className="text-sm font-semibold text-[#0B2447] truncate">{regra.nome}</span>
                      {regra.markedForDelete && <span className="text-[10px] text-red-500 font-semibold">— será excluída</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{formatRegraResumo(regra)}</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-700 whitespace-nowrap">{fmtBRL(regra.valor)}</span>
                  <button type="button" onClick={() => toggleDeleteRegra(regra.id)}
                    title={regra.markedForDelete ? 'Desfazer exclusão' : 'Excluir regra'}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors flex-shrink-0 ${
                      regra.markedForDelete
                        ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                        : 'text-slate-300 hover:text-red-500 hover:bg-red-50'
                    }`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Novas regras adicionadas na sessão */}
        {novasRegras.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Novas regras ({novasRegras.length})
            </p>
            {novasRegras.map(regra => {
              const cfg = TIPO_CONFIG[regra.tipo];
              return (
                <div key={regra.localId}
                  className="flex items-center gap-3 bg-white border border-slate-100 rounded-xl px-4 py-3 shadow-sm">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.badgeCls}`}>{cfg.label}</span>
                      <span className="text-sm font-semibold text-[#0B2447] truncate">{regra.nome}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{formatRegraResumo(regra)}</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-700 whitespace-nowrap">{fmtBRL(regra.valor)}</span>
                  <button type="button" onClick={() => removeNovaRegra(regra.localId)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Formulário inline de nova regra */}
        {!showRegraForm ? (
          <button type="button" onClick={() => setShowRegraForm(true)}
            className="flex items-center gap-2 text-sm font-semibold text-[#0B3D91] hover:text-[#0B2447] border border-dashed border-[#0B3D91]/30 hover:border-[#0B2447]/40 rounded-xl px-4 py-3 w-full justify-center transition-colors hover:bg-slate-50/50">
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
                        className={`w-12 h-10 rounded-xl text-xs font-bold transition-all ${
                          active ? 'bg-[#0B2447] text-white shadow-md shadow-[#0B2447]/20' : 'bg-white border border-slate-200 text-slate-500 hover:border-[#0B2447]/30'
                        }`}>
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
                <p className="col-span-2 text-xs text-slate-400">
                  💡 Para períodos que cruzam o ano (ex: Dez → Mar), o sistema identifica automaticamente.
                </p>
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
              <button type="button" onClick={() => { setShowRegraForm(false); setRf(emptyRegra()); }}
                className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors">
                Cancelar
              </button>
              <button type="button" onClick={handleAddRegra} disabled={!podeAdicionarRegra()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <Plus className="w-3.5 h-3.5" />
                Adicionar regra
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── 3. Disponibilidade ───────────────────────────────────────────── */}
      <SectionCard icon={CalendarDays} title="Disponibilidade">
        <p className="text-xs text-slate-400 mb-5">
          Defina os dias da semana em que o roteiro opera e bloqueie datas específicas em que ele não estará disponível para reserva.
        </p>
        <DisponibilidadePicker
          diasSemana={diasOperacao}
          onDiasSemanaChange={setDiasOperacao}
          bloqueios={bloqueios}
          onBloqueiosChange={setBloqueios}
        />
      </SectionCard>

      {/* ── 4. Catálogo ──────────────────────────────────────────────────── */}
      <SectionCard icon={BookOpen} title="Catálogo — Produtos e Serviços">
        <p className="text-xs text-slate-400 mb-5">
          Selecione os produtos e serviços disponíveis neste roteiro. Você pode ajustar o valor de cada item especificamente para este roteiro.
        </p>
        <CatalogoSelector
          catalogo={catalogo}
          selecionados={itensCatalogo}
          onChange={setItensCatalogo}
          onCatalogoCriado={item => setCatalogo(c => [...c, item])}
        />
      </SectionCard>

      {/* ── 4. Localização de partida ────────────────────────────────────── */}
      <SectionCard icon={MapPin} title="Localização de partida">
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
            <input className={inputCls} placeholder="ex: Marina Sul, Píer 3"
              value={form.complemento} onChange={e => setField('complemento', e.target.value)} />
          </Field>

          <div className="md:col-span-2 mt-1">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Localização no mapa</label>
            <MapaPicker
              lat={form.latitude}
              lng={form.longitude}
              onChange={(lat: string, lng: string) => {
                setField('latitude', lat);
                setField('longitude', lng);
              }}
            />
          </div>
        </div>
      </SectionCard>

      {/* ── 4. Imagens ──────────────────────────────────────────────────── */}
      <SectionCard icon={ImageIcon} title="Imagens">
        {existingImages.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Imagens salvas</p>
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
          <p className="mt-3 text-xs text-slate-400">Passe o mouse sobre a imagem para defini-la como principal ou removê-la.</p>
        )}
      </SectionCard>

      {/* ── Feedback ─────────────────────────────────────────────────────── */}
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

      {/* ── Ações ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pb-4">
        <button type="button" onClick={() => router.push(voltarHref)}
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
