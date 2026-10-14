'use client';

import { useState, useEffect, useMemo, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Info, ClipboardCheck, MapPin, ImageIcon, DollarSign,
  Loader2, AlertCircle, CheckCircle, CalendarDays,
  Plus, ChevronDown, ChevronUp, Trash2, BookOpen,
} from 'lucide-react';
import GaleriaImagensEditor, { itensDeImagensSalvas, type GaleriaItem } from '@/components/painel/GaleriaImagensEditor';
import { enviarFotosNovas, mensagemFalhaEnvio, MENSAGEM_SEM_FOTOS } from '@/lib/galeria-upload';
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
import EtapaPreco, { type RegraListada } from '../../../_components/EtapaPreco';
import {
  regraDeBanco, regraDeFormulario, ajustesDeBanco, isManualBanco, compactarAjustes, type RegraFormulario,
  NOME_AJUSTE_MANUAL, PRIORIDADE_AJUSTE_MANUAL,
} from '@/lib/precos-calendario';
import { horasParaPartes } from '@/lib/duracao';
import type { PrecoRegraTipo } from '@/types/supabase';
import ConfirmarNovaAnaliseModal from '@/components/publicacao/ConfirmarNovaAnaliseModal';
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
  disponibilidade_dias_semana: number[] | null;
  horario_saida: string | null;
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
  /**
   * Pipeline de aprovação: true quando quem edita é o gestor e o roteiro
   * está Ativo — mudar campo sensível tira do site até nova aprovação.
   */
  avisarNovaAnalise?: boolean;
  /** Comissão do Boatzy (%) do gestor dono do roteiro — mostrada no calendário de preços. */
  taxaPercent: number;
  /** Datas já seguradas por reservas do roteiro (confirmadas / aguardando pagamento). */
  datasOcupadas: string[];
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
      <div className="flex items-center gap-2.5 px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <Icon className="w-4 h-4 text-[#0B2447]" />
        <h2 className="text-sm font-bold text-[#0B2447] tracking-wide uppercase">{title}</h2>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
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

export default function EditarRoteiroForm({ roteiro, estados, municipiosIniciais, embarcacoes, catalogo: catalogoInicial, catalogoIniciais, bloqueiosIniciais, paradasIniciais, voltarHref = '/painel/roteiros', avisarNovaAnalise = false, taxaPercent, datasOcupadas }: Props) {
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
    estado_id:          roteiro.estado_id != null ? String(roteiro.estado_id) : '',
    municipio_id:       roteiro.municipio_id != null ? String(roteiro.municipio_id) : '',
    latitude:           roteiro.latitude  != null ? String(roteiro.latitude)  : '',
    longitude:          roteiro.longitude != null ? String(roteiro.longitude) : '',
    cep:                fmtCep(roteiro.cep),
    bairro:             roteiro.bairro ?? '',
    logradouro:         roteiro.logradouro ?? '',
    logradouro_numero:  roteiro.logradouro_numero ?? '',
    complemento:        roteiro.complemento ?? '',
    horario_saida:      roteiro.horario_saida ?? '',
  });

  const [municipios, setMunicipios]               = useState<Municipio[]>(municipiosIniciais);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  const [cepLoading, setCepLoading]               = useState(false);
  const [cepError, setCepError]                   = useState<string | null>(null);

  // Regras existentes
  // Os ajustes manuais (preço de um dia, feito no calendário) ficam fora da lista
  // de regras: aparecem como chips no próprio calendário.
  const [regrasExistentes, setRegrasExistentes] = useState<RegraExistente[]>(
    roteiro.roteiro_preco_regra.filter(r => !isManualBanco(r)).map(r => ({ ...r, markedForDelete: false })),
  );
  const [ajustesIniciais] = useState(() => ajustesDeBanco(roteiro.roteiro_preco_regra));
  const [ajustes, setAjustes] = useState<Record<string, number>>(ajustesIniciais);
  // Novas regras (adicionadas localmente)
  const [novasRegras, setNovasRegras]       = useState<RegraLocal[]>([]);

  // Regras exibidas na etapa Preço (e aplicadas no calendário): salvas + novas.
  const regrasListadas = useMemo<RegraListada[]>(() => [
    ...regrasExistentes.map(r => ({
      id: r.id, regra: regraDeBanco(r), estado: r.markedForDelete ? 'excluir' as const : 'salva' as const,
    })),
    ...novasRegras.map(r => ({ id: r.localId, regra: regraDeFormulario(r, r.localId), estado: 'nova' as const })),
  ], [regrasExistentes, novasRegras]);

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
  const [confirmarAnalise, setConfirmarAnalise] = useState<string[] | null>(null);
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

  function handleAddRegra(regra: RegraFormulario) {
    setNovasRegras(prev => [...prev, { ...regra, localId: crypto.randomUUID() }]);
  }

  /** Salva: marca/desmarca a exclusão (efetivada ao salvar). Nova: remove da lista. */
  function handleRemoverRegra(id: string) {
    if (regrasExistentes.some(r => r.id === id)) {
      setRegrasExistentes(prev =>
        prev.map(r => r.id === id ? { ...r, markedForDelete: !r.markedForDelete } : r),
      );
    } else {
      setNovasRegras(prev => prev.filter(r => r.localId !== id));
    }
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

  function atualizarImagem(key: string, patch: Partial<GaleriaItem>) {
    setImagens(prev => prev.map(it => (it.key === key ? { ...it, ...patch } : it)));
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  /** Campos sensíveis alterados (espelha `publicacao_snapshot` — exigem nova aprovação). */
  function camposSensiveisAlterados(): string[] {
    const campos: string[] = [];
    if (form.nome.trim() !== roteiro.nome.trim()) campos.push('nome');
    if (form.descricao.trim() !== roteiro.descricao.trim()) campos.push('descricao');
    if (form.origem.trim() !== (roteiro.origem ?? '').trim()) campos.push('origem');
    if (form.destino.trim() !== (roteiro.destino ?? '').trim()) campos.push('destino');
    if (form.embarcacao_id !== (roteiro.embarcacao_id ?? '')) campos.push('embarcacao_id');
    if (form.duracao_valor !== duracaoInicial.valor || form.duracao_unidade !== duracaoInicial.unidade) campos.push('duracao_horas');
    const nomesParadas = paradas.map(p => p.nome.trim()).filter(Boolean);
    if (nomesParadas.join('\n') !== paradasIniciais.map(p => p.trim()).filter(Boolean).join('\n')) campos.push('paradas');
    const idsMantidos = new Set(imagens.map(i => i.id).filter(Boolean));
    if (imagens.some(i => i.file) || roteiro.roteiro_imagens.some(i => !idsMantidos.has(i.id))) campos.push('fotos');
    return campos;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (avisarNovaAnalise) {
      const campos = camposSensiveisAlterados();
      if (campos.length > 0) { setConfirmarAnalise(campos); return; }
    }
    void salvar();
  }

  async function salvar() {
    const enviandoParaAnalise = !!confirmarAnalise;
    setConfirmarAnalise(null);
    setFeedback(null);
    if (!form.nome.trim() || !form.descricao.trim()) {
      setFeedback({ type: 'error', msg: 'Informe o nome e a descrição do roteiro.' });
      etapas.ir(ETAPA_ROT.informacoes);
      return;
    }
    if (imagens.length === 0) {
      setFeedback({ type: 'error', msg: MENSAGEM_SEM_FOTOS });
      etapas.ir(ETAPA_ROT.fotos);
      return;
    }
    setSubmitting(true);

    // 0. Envia as fotos novas antes de tudo: se alguma falhar, nada é salvo.
    const envio = await enviarFotosNovas({
      itens: imagens, endpoint: '/api/painel/roteiros/upload',
      entidadeId: roteiro.id, atualizar: atualizarImagem,
    });
    if (envio.falhas > 0) {
      setFeedback({ type: 'error', msg: mensagemFalhaEnvio(envio.falhas) });
      etapas.ir(ETAPA_ROT.fotos);
      setSubmitting(false);
      return;
    }

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
      municipio_id:       form.municipio_id,
      latitude:           form.latitude,
      longitude:          form.longitude,
      cep:                form.cep,
      bairro:             form.bairro,
      logradouro:         form.logradouro,
      logradouro_numero:  form.logradouro_numero,
      complemento:        form.complemento,
      disponibilidade_dias_semana: diasOperacao,
      horario_saida:       form.horario_saida,
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

    // 2b. Ajustes de preço por dia (calendário): só mexe se mudaram — apaga os
    // salvos e grava de novo, com dias seguidos de mesmo valor num único intervalo.
    const ajustesFinais = compactarAjustes(ajustes);
    if (JSON.stringify(ajustesFinais) !== JSON.stringify(compactarAjustes(ajustesIniciais))) {
      for (const regra of roteiro.roteiro_preco_regra.filter(isManualBanco)) {
        await excluirRegraRoteiro(roteiro.id, regra.id);
      }
      for (const g of ajustesFinais) {
        await criarRegraRoteiro({
          roteiroId: roteiro.id, nome: NOME_AJUSTE_MANUAL, valor: g.valor, tipo: 'data_fixa',
          prioridade: PRIORIDADE_AJUSTE_MANUAL, dataInicio: g.inicio, dataFim: g.fim,
        });
      }
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

    // 6. Registra as fotos novas (já no storage), cada uma com a sua posição
    const falhasRegistro: string[] = [];
    for (let ordem = 0; ordem < imagens.length; ordem++) {
      const item = imagens[ordem];
      if (!item.file) continue;
      const salvo = await salvarImagemRoteiro({
        roteiroId: roteiro.id, urlImagem: envio.urls[item.key],
        titulo: item.titulo, principal: item.principal, ordem,
      });
      if (!salvo.ok) falhasRegistro.push(salvo.error ?? 'erro desconhecido');
    }

    // 7. Atualizar itens do catálogo vinculados
    await atualizarCatalogoRoteiro(
      roteiro.id,
      itensCatalogo.map(i => ({
        catalogoId: i.catalogoId,
        valorCustomizado: i.valorCustomizado !== '' ? parseFloat(i.valorCustomizado) : null,
      })),
    );

    if (falhasRegistro.length > 0) {
      setFeedback({
        type: 'error',
        msg: `Os dados foram salvos, mas ${falhasRegistro.length === 1 ? '1 foto não pôde ser registrada' : `${falhasRegistro.length} fotos não puderam ser registradas`} (${falhasRegistro[0]}). Recarregue a página para conferir a galeria e envie a foto novamente.`,
      });
      setSubmitting(false);
      return;
    }

    setFeedback({
      type: 'success',
      msg: enviandoParaAnalise
        ? 'Alterações salvas e enviadas para análise. O roteiro volta ao site após a aprovação.'
        : 'Roteiro atualizado com sucesso!',
    });
    setSubmitting(false);
    setTimeout(() => router.push(voltarHref), 1200);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} onKeyDown={bloquearEnter}
      // A etapa Preço abre mais espaço em telas largas: calendário ao lado dos passos.
      className={`space-y-6 max-w-4xl ${etapas.atual === ETAPA_ROT.preco ? 'xl:max-w-6xl' : ''}`}>
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
          <Field label="Horário de Saída" hint="Horário de partida do passeio (opcional).">
            <input className={inputCls} type="time"
              value={form.horario_saida}
              onChange={e => setField('horario_saida', e.target.value)} />
          </Field>

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
                        className="w-9 h-9 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
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
                  <button type="button" onClick={handleAddParada} disabled={!novaParada.trim()} aria-label="Adicionar parada"
                    className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
                    <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Adicionar</span>
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
        <EtapaPreco
          precoBase={form.preco_base}
          onPrecoBaseChange={v => setField('preco_base', v)}
          diariaAtivo={form.preco_diaria_ativo}
          onDiariaAtivoChange={v => setField('preco_diaria_ativo', v)}
          diariaValor={form.preco_diaria_valor}
          onDiariaValorChange={v => setField('preco_diaria_valor', v)}
          diariaMinimo={form.preco_diaria_minimo}
          onDiariaMinimoChange={v => setField('preco_diaria_minimo', v)}
          regras={regrasListadas}
          onAdicionarRegra={handleAddRegra}
          onRemoverRegra={handleRemoverRegra}
          ajustes={ajustes}
          onAjustesChange={setAjustes}
          diasOperacao={diasOperacao}
          bloqueios={bloqueios}
          datasOcupadas={datasOcupadas}
          taxaPercent={taxaPercent}
          ativa={etapas.atual === ETAPA_ROT.preco}
        />
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
          exemploTitulo="Vista do mirante"
        />
      </SectionCard>

      </div>

      {/* ── 7. Revisão ───────────────────────────────────────────────────── */}
      <div hidden={etapas.atual !== ETAPA_ROT.revisao} className="space-y-6">
        <SectionCard icon={ClipboardCheck} title="Revisão">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
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

      {confirmarAnalise && (
        <ConfirmarNovaAnaliseModal
          campos={confirmarAnalise}
          onConfirmar={() => void salvar()}
          onCancelar={() => setConfirmarAnalise(null)}
        />
      )}
    </form>
  );
}
