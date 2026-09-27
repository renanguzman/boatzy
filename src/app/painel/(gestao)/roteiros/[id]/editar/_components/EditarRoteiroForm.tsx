'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Info, ClipboardCheck, MapPin, ImageIcon, DollarSign,
  Loader2, AlertCircle, CheckCircle, CalendarDays,
  Plus, ChevronDown, ChevronUp, Trash2, HelpCircle, BookOpen, Check,
} from 'lucide-react';
import GaleriaImagensEditor, { itensDeImagensSalvas, type GaleriaItem } from '@/components/painel/GaleriaImagensEditor';
import {
  atualizarRoteiro,
  atualizarCatalogoRoteiro,
  excluirImagemRoteiro,
  atualizarImagensRoteiro,
  excluirRegraRoteiro,
  salvarBloqueiosRoteiro,
  salvarParadasRoteiro,
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
import { horasParaPartes } from '@/lib/duracao';
import type { PrecoRegraTipo, PrecoPessoaModoCapacidade } from '@/types/supabase';
import PreviewPublicacaoModal from '@/components/preview/PreviewPublicacaoModal';
import BotaoPreview from '@/components/preview/BotaoPreview';
import { montarPreviewRoteiro } from '@/components/preview/montar';
import { buscarEmbarcacaoParaPreview } from '@/lib/preview-actions';
import type { RoteiroDetalheDados } from '@/app/roteiros/[id]/_components/RoteiroDetalheView';
import IndicadorEtapas from '@/components/painel/etapas/IndicadorEtapas';
import RodapeEtapas from '@/components/painel/etapas/RodapeEtapas';
import RevisaoChecklist from '@/components/painel/etapas/RevisaoChecklist';
import { useEtapas } from '@/components/painel/etapas/useEtapas';
import RoteiroCard from '@/app/buscar/_components/RoteiroCard';
import { ETAPAS_ROTEIRO, ETAPA_ROT, revisaoRoteiro } from '../../../_components/etapasRoteiro';

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
  ordem: number;
};

type RoteiroData = {
  id: string;
  embarcacao_id: string | null;
  nome: string;
  descricao: string;
  duracao_horas: number | null;
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
  preco_diaria_ativo: boolean;
  preco_diaria_valor: number | null;
  preco_diaria_minimo: number;
  preco_pessoa_ativo: boolean;
  preco_pessoa_valor: number | null;
  preco_pessoa_capacidade_minima: number | null;
  preco_pessoa_capacidade_maxima: number | null;
  preco_pessoa_modo_capacidade: PrecoPessoaModoCapacidade;
  disponibilidade_dias_semana: number[] | null;
  estado_id: number | null;
  roteiro_imagens: RoteiroImagem[];
  roteiro_preco_regra: RoteiroPrecoRegra[];
};

type Estado     = { id: number; uf: string; nome: string };
type Municipio  = { id: number; nome: string };
type Embarcacao = { id: string; nome: string; capacidade: number | null };

type ParadaLocal = { localId: string; nome: string };

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
  paradasIniciais: string[];
  /** Rota de retorno após salvar/cancelar (o admin reutiliza o form com outra rota). */
  voltarHref?: string;
};

// ─── Helpers de UI ────────────────────────────────────────────────────────────

const inputCls = `w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800
  placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20
  focus:border-[#0B2447]/40 transition bg-white`;
const selectCls = `${inputCls} appearance-none cursor-pointer`;

function SectionCard({ id, icon: Icon, title, children }: {
  id?: string; icon: React.ElementType; title: string; children: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-24 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
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

export default function EditarRoteiroForm({ roteiro, estados, municipiosIniciais, embarcacoes, catalogo: catalogoInicial, catalogoIniciais, bloqueiosIniciais, paradasIniciais, voltarHref = '/painel/roteiros' }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const numeroInputRef = useRef<HTMLInputElement>(null);

  const fmtCep = (v: string | null) => {
    if (!v) return '';
    const d = v.replace(/\D/g, '');
    return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };

  // duracao_horas → (número, unidade) para os dois campos do formulário.
  const duracaoInicial = horasParaPartes(roteiro.duracao_horas);

  const [form, setForm] = useState<Omit<AtualizarRoteiroPayload, 'municipio_id' | 'disponibilidade_dias_semana'> & {
    municipio_id: string; estado_id: string;
  }>({
    embarcacao_id:      roteiro.embarcacao_id ?? '',
    nome:               roteiro.nome,
    descricao:          roteiro.descricao,
    duracao_valor:      duracaoInicial.valor,
    duracao_unidade:    duracaoInicial.unidade,
    quantidade_pessoas: roteiro.quantidade_pessoas != null ? String(roteiro.quantidade_pessoas) : '',
    origem:             roteiro.origem ?? '',
    destino:            roteiro.destino ?? '',
    preco_base:         roteiro.preco_base != null ? String(roteiro.preco_base) : '',
    preco_diaria_ativo: roteiro.preco_diaria_ativo,
    preco_diaria_valor: roteiro.preco_diaria_valor != null ? String(roteiro.preco_diaria_valor) : '',
    preco_diaria_minimo: String(roteiro.preco_diaria_minimo || 1),
    preco_pessoa_ativo: roteiro.preco_pessoa_ativo,
    preco_pessoa_valor: roteiro.preco_pessoa_valor != null ? String(roteiro.preco_pessoa_valor) : '',
    preco_pessoa_capacidade_minima:
      roteiro.preco_pessoa_capacidade_minima != null ? String(roteiro.preco_pessoa_capacidade_minima) : '',
    preco_pessoa_capacidade_maxima:
      roteiro.preco_pessoa_capacidade_maxima != null ? String(roteiro.preco_pessoa_capacidade_maxima) : '',
    preco_pessoa_modo_capacidade: roteiro.preco_pessoa_modo_capacidade,
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

  // Paradas do itinerário: pontos intermediários entre origem e destino (0, 1 ou vários)
  const [paradas, setParadas] = useState<ParadaLocal[]>(
    paradasIniciais.map(nome => ({ localId: crypto.randomUUID(), nome })),
  );
  const [novaParada, setNovaParada] = useState('');

  // Imagens (salvas + novas, na ordem da galeria)
  const [imagens, setImagens] = useState<GaleriaItem[]>(
    () => itensDeImagensSalvas(roteiro.roteiro_imagens),
  );
  const [feedback, setFeedback]     = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [itensCatalogo, setItensCatalogo] = useState<ItemSelecionado[]>(catalogoIniciais);
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>(catalogoInicial);

  // ── Pré-visualização (mesmo layout da página pública) ──────────────────────
  const [previewAberto, setPreviewAberto] = useState(false);

  // ── Etapas (wizard) ─────────────────────────────────────────────────────────
  const etapas = useEtapas(ETAPAS_ROTEIRO.length, { todasVisitadas: true, ids: ETAPAS_ROTEIRO.map(e => e.id) });
  const revisao = revisaoRoteiro({
    form, embarcacoes, estados, municipios, paradas, imagens, diasOperacao, bloqueios,
    totalAdicionais: itensCatalogo.length,
    ir: etapas.ir,
  });

  // Enter num campo não envia o cadastro no meio das etapas.
  function bloquearEnter(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
  }
  // Embarcação vinculada no formato da página pública (buscada ao abrir a prévia).
  const [previewEmb, setPreviewEmb] = useState<{ id: string; dados: RoteiroDetalheDados['embarcacao'] } | null>(null);
  useEffect(() => {
    const id = form.embarcacao_id;
    if (!previewAberto || !id || previewEmb?.id === id) return;
    let cancelado = false;
    buscarEmbarcacaoParaPreview(id).then(dados => {
      if (!cancelado) setPreviewEmb({ id, dados });
    });
    return () => { cancelado = true; };
  }, [previewAberto, form.embarcacao_id, previewEmb?.id]);
  const embarcacaoPronta = !form.embarcacao_id || previewEmb?.id === form.embarcacao_id;
  const previewDados = previewAberto && embarcacaoPronta
    ? montarPreviewRoteiro({
        form, estados, municipios, imagens, diasOperacao, bloqueios,
        paradas, itensCatalogo, catalogo,
        embarcacao: form.embarcacao_id ? previewEmb?.dados ?? null : null,
      })
    : null;

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

  // ─── Paradas do itinerário ──────────────────────────────────────────────────

  function handleAddParada() {
    const nome = novaParada.trim();
    if (!nome) return;
    setParadas(prev => [...prev, { localId: crypto.randomUUID(), nome }]);
    setNovaParada('');
  }

  function handleRemoveParada(localId: string) {
    setParadas(prev => prev.filter(p => p.localId !== localId));
  }

  function handleMoveParada(localId: string, dir: -1 | 1) {
    setParadas(prev => {
      const idx = prev.findIndex(p => p.localId === localId);
      const alvo = idx + dir;
      if (idx < 0 || alvo < 0 || alvo >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[alvo]] = [next[alvo], next[idx]];
      return next;
    });
  }

  // ─── Imagens ──────────────────────────────────────────────────────────────

  async function uploadImagem(item: GaleriaItem, ordem: number) {
    if (!item.file) return null;
    const body = new FormData();
    body.append('file', item.file);
    body.append('roteiroId', roteiro.id);
    const res = await fetch('/api/painel/roteiros/upload', { method: 'POST', body });
    if (!res.ok) return null;
    const { publicUrl } = await res.json();
    const saved = await salvarImagemRoteiro({
      roteiroId: roteiro.id, urlImagem: publicUrl, titulo: item.titulo, principal: item.principal, ordem,
    });
    return saved.ok ? (publicUrl as string) : null;
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFeedback(null);
    if (!form.nome.trim() || !form.descricao.trim()) {
      setFeedback({ type: 'error', msg: 'Informe o nome e a descrição do roteiro.' });
      etapas.ir(ETAPA_ROT.informacoes);
      return;
    }
    setSubmitting(true);

    // 1. Atualizar dados
    const result = await atualizarRoteiro(roteiro.id, {
      embarcacao_id:      form.embarcacao_id,
      nome:               form.nome,
      descricao:          form.descricao,
      duracao_valor:      form.duracao_valor,
      duracao_unidade:    form.duracao_unidade,
      quantidade_pessoas: form.quantidade_pessoas,
      origem:             form.origem,
      destino:            form.destino,
      preco_base:         form.preco_base,
      preco_diaria_ativo: form.preco_diaria_ativo,
      preco_diaria_valor: form.preco_diaria_valor,
      preco_diaria_minimo: form.preco_diaria_minimo,
      preco_pessoa_ativo: form.preco_pessoa_ativo,
      preco_pessoa_valor: form.preco_pessoa_valor,
      preco_pessoa_capacidade_minima: form.preco_pessoa_capacidade_minima,
      preco_pessoa_capacidade_maxima: form.preco_pessoa_capacidade_maxima,
      preco_pessoa_modo_capacidade: form.preco_pessoa_modo_capacidade,
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

    // Substituir o conjunto de paradas do itinerário
    await salvarParadasRoteiro(roteiro.id, paradas.map(p => p.nome));

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

    // 4. Excluir as imagens salvas que saíram da galeria
    const idsMantidos = new Set(imagens.map(i => i.id).filter(Boolean));
    for (const img of roteiro.roteiro_imagens.filter(i => !idsMantidos.has(i.id))) {
      await excluirImagemRoteiro(roteiro.id, img.id);
    }

    // 5. Título, ordem e principal das imagens salvas (a posição na lista é a ordem)
    await atualizarImagensRoteiro(
      roteiro.id,
      imagens.flatMap((it, ordem) =>
        it.id ? [{ id: it.id, titulo: it.titulo, ordem, principal: it.principal }] : []),
    );

    // 6. Upload das novas, cada uma já com a sua posição
    for (let ordem = 0; ordem < imagens.length; ordem++) {
      const item = imagens[ordem];
      if (!item.file) continue;
      setImagens(prev => prev.map(it => it.key === item.key ? { ...it, status: 'uploading' } : it));
      const url = await uploadImagem(item, ordem);
      setImagens(prev => prev.map(it => it.key === item.key ? { ...it, status: url ? 'done' : 'error' } : it));
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
    <form onSubmit={handleSubmit} onKeyDown={bloquearEnter} className="space-y-6 max-w-4xl">
      <div ref={etapas.topoRef} className="scroll-mt-6">
        <IndicadorEtapas etapas={ETAPAS_ROTEIRO} atual={etapas.atual} visitadas={etapas.visitadas} onIr={etapas.ir} />
      </div>



      <div hidden={etapas.atual !== ETAPA_ROT.informacoes} className="space-y-6">
      {/* ── 1. Informações gerais ────────────────────────────────────────── */}
      <SectionCard id="informacoes-gerais" icon={Info} title="Informações gerais">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <Field label="Nome do roteiro" required>
              <input className={inputCls} placeholder="ex: Passeio à Ilha Grande"
                value={form.nome} onChange={e => setField('nome', e.target.value)} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Descrição" required>
              <textarea className={`${inputCls} resize-none`} rows={3}
                placeholder="Descreva o roteiro, pontos turísticos, atrações e destaques..."
                value={form.descricao} onChange={e => setField('descricao', e.target.value)} />
            </Field>
          </div>
          <Field label="Embarcação vinculada" hint="Opcional — associe este roteiro a uma de suas embarcações.">
            <select className={selectCls} value={form.embarcacao_id}
              onChange={e => setEmbarcacao(e.target.value)}>
              <option value="">Sem vínculo</option>
              {embarcacoes.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </Field>
          <Field label="Duração" hint="Usada nos filtros e na ordenação da busca do site.">
            <div className="flex items-center gap-2 flex-wrap">
              <input
                className="w-24 shrink-0 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800
                  placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20
                  focus:border-[#0B2447]/40 transition bg-white"
                type="number" min="0" step="0.5" placeholder="ex: 4"
                value={form.duracao_valor} onChange={e => setField('duracao_valor', e.target.value)} />
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1 shrink-0">
                {(['horas', 'dias'] as const).map(u => (
                  <button key={u} type="button" onClick={() => setField('duracao_unidade', u)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                      form.duracao_unidade === u ? 'bg-white text-[#0B2447] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    {u === 'horas' ? 'Horas' : 'Dias'}
                  </button>
                ))}
              </div>
            </div>
          </Field>
          <Field label="Capacidade máxima" hint="Número de pessoas — preenchida com a capacidade da embarcação vinculada.">
            <input className={inputCls} type="number" min="1" placeholder="ex: 12"
              value={form.quantidade_pessoas}
              onChange={e => setField('quantidade_pessoas', e.target.value)} />
          </Field>
          <div />

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Itinerário</label>
            <p className="text-xs text-slate-400 mb-4">
              Partida, paradas — adicione quantas precisar, ou nenhuma — e chegada, nessa ordem. É como o cliente vai ver no roteiro.
            </p>

            <div className="relative pl-6">
              {/* Linha do tempo conectando todos os pontos */}
              <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gradient-to-b from-[#0B3D91] via-sky-300 to-cyan-400 rounded-full" />

              {/* Partida */}
              <div className="relative mb-4">
                <div className="absolute -left-6 top-1.5 h-3 w-3 rounded-full bg-[#0B3D91] ring-2 ring-white" />
                <p className="text-[10px] font-bold text-[#0B3D91] uppercase tracking-wider mb-1">Partida (saída)</p>
                <input className={inputCls} placeholder="ex: Marina da Glória, RJ"
                  value={form.origem} onChange={e => setField('origem', e.target.value)} />
              </div>

              {/* Paradas */}
              {paradas.map((p, i) => (
                <div key={p.localId} className="relative mb-4">
                  <div className="absolute -left-6 top-1.5 h-3 w-3 rounded-full bg-sky-400 ring-2 ring-white" />
                  <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-1">Parada {i + 1}</p>
                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl pl-3.5 pr-1.5 py-1.5 shadow-sm">
                    <span className="flex-1 text-sm text-slate-700 truncate">{p.nome}</span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button type="button" onClick={() => handleMoveParada(p.localId, -1)} disabled={i === 0}
                        title="Mover para cima"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#0B2447] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => handleMoveParada(p.localId, 1)} disabled={i === paradas.length - 1}
                        title="Mover para baixo"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#0B2447] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => handleRemoveParada(p.localId)} title="Remover"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Adicionar parada */}
              <div className="relative mb-4">
                <div className="absolute -left-6 top-1.5 h-3 w-3 rounded-full border-2 border-dashed border-slate-300 bg-white" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Adicionar parada</p>
                <div className="flex gap-2">
                  <input className={inputCls} placeholder="ex: Praia do Pontal (parada para banho)"
                    value={novaParada} onChange={e => setNovaParada(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddParada(); } }} />
                  <button type="button" onClick={handleAddParada} disabled={!novaParada.trim()}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </button>
                </div>
              </div>

              {/* Chegada */}
              <div className="relative">
                <div className="absolute -left-6 top-1.5 h-3 w-3 rounded-full bg-cyan-400 ring-2 ring-white" />
                <p className="text-[10px] font-bold text-cyan-600 uppercase tracking-wider mb-1">Chegada (destino)</p>
                <input className={inputCls} placeholder="ex: Ilha Grande, RJ"
                  value={form.destino} onChange={e => setField('destino', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      </div>

      <div hidden={etapas.atual !== ETAPA_ROT.preco} className="space-y-6">
      {/* ── 2. Preço ─────────────────────────────────────────────────────── */}
      <SectionCard id="preco" icon={DollarSign} title="Preço">
        {/* Modelo de cobrança */}
        <div className="mb-6">
          <p className="text-sm font-bold text-[#0B2447] mb-1">Modelo de cobrança</p>
          <p className="text-xs text-slate-400 mb-4">
            Ative quantos modelos quiser — o cliente vê e escolhe entre os que estiverem disponíveis ao reservar.
          </p>

          <div className="space-y-3">
            {/* Roteiro — sempre disponível, configurado logo abaixo */}
            <div className="flex items-start gap-3 rounded-xl border border-[#0B2447]/20 bg-[#0B2447]/[0.03] p-4">
              <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-md bg-[#0B2447] text-white shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0B2447]">Roteiro (diária única)</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  O cliente reserva o roteiro inteiro por um dia. Preço base e regras configurados logo abaixo.
                </p>
              </div>
            </div>

            {/* Por Diária */}
            <button type="button" onClick={() => setField('preco_diaria_ativo', !form.preco_diaria_ativo)}
              className={`w-full flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                form.preco_diaria_ativo ? 'border-[#0B2447]/20 bg-[#0B2447]/[0.03]' : 'border-slate-200 hover:border-slate-300'
              }`}>
              <div className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border-2 shrink-0 ${
                form.preco_diaria_ativo ? 'bg-[#0B2447] border-[#0B2447] text-white' : 'border-slate-300'
              }`}>
                {form.preco_diaria_ativo && <Check className="w-3.5 h-3.5" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0B2447]">Por Diária</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Passeio de vários dias — o cliente escolhe a data de saída e quantas diárias quer.
                </p>
              </div>
            </button>

            {form.preco_diaria_ativo && (
              <div className="ml-8 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <Field label="Valor da diária (R$)" required>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">R$</span>
                    <input className={`${inputCls} pl-10`} type="number" min="0" step="0.01" placeholder="0,00"
                      value={form.preco_diaria_valor} onChange={e => setField('preco_diaria_valor', e.target.value)} />
                  </div>
                </Field>
                <Field label="Diárias mínimas" hint="Menor quantidade de diárias que o cliente pode reservar.">
                  <input className={inputCls} type="number" min="1" step="1" placeholder="1"
                    value={form.preco_diaria_minimo} onChange={e => setField('preco_diaria_minimo', e.target.value)} />
                </Field>
              </div>
            )}

            {/* Por Pessoa */}
            <button type="button" onClick={() => setField('preco_pessoa_ativo', !form.preco_pessoa_ativo)}
              className={`w-full flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                form.preco_pessoa_ativo ? 'border-[#0B2447]/20 bg-[#0B2447]/[0.03]' : 'border-slate-200 hover:border-slate-300'
              }`}>
              <div className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border-2 shrink-0 ${
                form.preco_pessoa_ativo ? 'bg-[#0B2447] border-[#0B2447] text-white' : 'border-slate-300'
              }`}>
                {form.preco_pessoa_ativo && <Check className="w-3.5 h-3.5" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0B2447]">Por Pessoa</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bilheteria — valor fixo por pessoa, ideal para eventos e passeios públicos com vagas.
                </p>
              </div>
            </button>

            {form.preco_pessoa_ativo && (
              <div className="ml-8 space-y-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Valor por pessoa (R$)" required>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">R$</span>
                      <input className={`${inputCls} pl-10`} type="number" min="0" step="0.01" placeholder="0,00"
                        value={form.preco_pessoa_valor} onChange={e => setField('preco_pessoa_valor', e.target.value)} />
                    </div>
                  </Field>
                  <Field label="Capacidade mínima" hint="Grupo mínimo por reserva (opcional).">
                    <input className={inputCls} type="number" min="1" step="1" placeholder="ex: 2"
                      value={form.preco_pessoa_capacidade_minima}
                      onChange={e => setField('preco_pessoa_capacidade_minima', e.target.value)} />
                  </Field>
                  <Field label="Capacidade máxima" required hint="Total de vagas disponíveis na data.">
                    <input className={inputCls} type="number" min="1" step="1" placeholder="ex: 20"
                      value={form.preco_pessoa_capacidade_maxima}
                      onChange={e => setField('preco_pessoa_capacidade_maxima', e.target.value)} />
                  </Field>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Como a capacidade é controlada</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(['exclusivo', 'compartilhado'] as const).map(modo => (
                      <button key={modo} type="button" onClick={() => setField('preco_pessoa_modo_capacidade', modo)}
                        className={`text-left rounded-xl border p-3 transition-colors ${
                          form.preco_pessoa_modo_capacidade === modo
                            ? 'border-[#0B2447] bg-white shadow-sm'
                            : 'border-slate-200 bg-white/60 hover:border-slate-300'
                        }`}>
                        <p className="text-xs font-bold text-[#0B2447]">
                          {modo === 'exclusivo' ? 'Exclusivo' : 'Compartilhado'}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          {modo === 'exclusivo'
                            ? 'Uma reserva usa o roteiro inteiro na data — só muda a forma de cobrar, por pessoa.'
                            : 'Vários clientes reservam a mesma data até atingir a capacidade máxima.'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 mb-6" />

        {/* Preço base (modelo Roteiro) */}
        <div className="max-w-xs mb-6">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Roteiro (diária única)</p>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Início <span className="text-red-500">*</span></p>
                  {/* Grid (não flex) para o mês nunca disputar largura com o dia — ver nota em selectCls. */}
                  <div className="grid grid-cols-[1fr_5.5rem] gap-2">
                    <select className={selectCls} value={rf.periodoMesInicio} onChange={e => setRfField('periodoMesInicio', parseInt(e.target.value))}>
                      {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                    </select>
                    <select className={selectCls} value={rf.periodoDiaInicio} onChange={e => setRfField('periodoDiaInicio', parseInt(e.target.value))}>
                      {Array.from({ length: DIAS_MES[rf.periodoMesInicio] }, (_, i) => i+1).map(d => (
                        <option key={d} value={d}>{String(d).padStart(2,'0')}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Fim <span className="text-red-500">*</span></p>
                  <div className="grid grid-cols-[1fr_5.5rem] gap-2">
                    <select className={selectCls} value={rf.periodoMesFim} onChange={e => setRfField('periodoMesFim', parseInt(e.target.value))}>
                      {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                    </select>
                    <select className={selectCls} value={rf.periodoDiaFim} onChange={e => setRfField('periodoDiaFim', parseInt(e.target.value))}>
                      {Array.from({ length: DIAS_MES[rf.periodoMesFim] }, (_, i) => i+1).map(d => (
                        <option key={d} value={d}>{String(d).padStart(2,'0')}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="sm:col-span-2 text-xs text-slate-400">
                  💡 Para períodos que cruzam o ano (ex: Dez → Mar), o sistema identifica automaticamente.
                </p>
              </div>
            )}

            {rf.tipo === 'data_fixa' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      </div>

      <div hidden={etapas.atual !== ETAPA_ROT.disponibilidade} className="space-y-6">
      {/* ── 3. Disponibilidade ───────────────────────────────────────────── */}
      <SectionCard id="disponibilidade" icon={CalendarDays} title="Disponibilidade">
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

      </div>

      <div hidden={etapas.atual !== ETAPA_ROT.adicionais} className="space-y-6">
      {/* ── 4. Catálogo ──────────────────────────────────────────────────── */}
      <SectionCard id="catalogo" icon={BookOpen} title="Catálogo — Produtos e Serviços">
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

      </div>

      <div hidden={etapas.atual !== ETAPA_ROT.localizacao} className="space-y-6">
      {/* ── 4. Localização de partida ────────────────────────────────────── */}
      <SectionCard id="localizacao" icon={MapPin} title="Localização de partida">
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

      </div>

      <div hidden={etapas.atual !== ETAPA_ROT.fotos} className="space-y-6">
      {/* ── 4. Imagens ──────────────────────────────────────────────────── */}
      <SectionCard id="imagens" icon={ImageIcon} title="Imagens">
        <GaleriaImagensEditor
          items={imagens}
          onChange={setImagens}
          disabled={submitting}
          onError={msg => setFeedback({ type: 'error', msg })}
          exemploTitulo="Vista do mirante"
        />
      </SectionCard>

      </div>

      {/* ── 7. Revisão ───────────────────────────────────────────────────── */}
      <div hidden={etapas.atual !== ETAPA_ROT.revisao} className="space-y-6">
        <SectionCard icon={ClipboardCheck} title="Revisão">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <RevisaoChecklist itens={revisao.itens} />
            </div>
            <div className="lg:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Como aparece na busca</p>
              <div inert className="select-none">
                <RoteiroCard roteiro={revisao.card} />
              </div>
              <BotaoPreview onClick={() => setPreviewAberto(true)} className="w-full mt-3" />
            </div>
          </div>
        </SectionCard>
      </div>

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

      {/* ── Rodapé fixo ─────────────────────────────────────────────────── */}
      <RodapeEtapas
        atual={etapas.atual}
        total={ETAPAS_ROTEIRO.length}
        labelAtual={ETAPAS_ROTEIRO[etapas.atual].label}
        proximoLabel={etapas.ehUltima ? null : ETAPAS_ROTEIRO[etapas.atual + 1].label}
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
        tipo="roteiro"
        dados={previewDados}
      />
    </form>
  );
}
