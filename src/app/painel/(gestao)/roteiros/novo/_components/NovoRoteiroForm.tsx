'use client';

import { useState, useEffect, useMemo, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Info, ClipboardCheck, MapPin, ImageIcon, DollarSign,
  Loader2, AlertCircle, CheckCircle,
  Plus, ChevronDown, ChevronUp, Trash2, BookOpen,
} from 'lucide-react';
import GaleriaImagensEditor, { type GaleriaItem } from '@/components/painel/GaleriaImagensEditor';
import { enviarFotosNovas, mensagemFalhaEnvio, MENSAGEM_SEM_FOTOS } from '@/lib/galeria-upload';
import {
  criarRoteiro,
  criarRegraRoteiro,
  salvarCatalogoRoteiro,
  salvarParadasRoteiro,
  getMunicipiosByEstado,
  type CriarRoteiroPayload,
  type DadosCopiaRoteiroLocalizacao,
  type DadosCopiaRoteiroPreco,
} from '../actions';
import MapaPicker from '../../../embarcacoes/novo/_components/MapaPicker';
import CatalogoSelector, { type CatalogoItem, type ItemSelecionado } from '../../_components/CatalogoSelector';
import {
  salvarDisponibilidadeRoteiro, salvarFechamentosEmbarcacao, carregarAgendaEmbarcacao,
} from '@/lib/disponibilidade-actions';
import { JANELA_RESERVA_PADRAO, type JanelaReservaMeses, type OcupacaoDia } from '@/lib/disponibilidade';
import EtapaPreco, { type RegraListada } from '../../_components/EtapaPreco';
import {
  regraDeFormulario, compactarAjustes, type RegraFormulario, NOME_DATA_ESPECIFICA, PRIORIDADE_DATA_ESPECIFICA,
} from '@/lib/precos-calendario';
import PreviewPublicacaoModal from '@/components/preview/PreviewPublicacaoModal';
import BotaoPreview from '@/components/preview/BotaoPreview';
import { montarPreviewRoteiro, type AgendaPreview } from '@/components/preview/montar';
import { buscarEmbarcacaoParaPreview } from '@/lib/preview-actions';
import type { RoteiroDetalheDados } from '@/app/roteiros/[id]/_components/RoteiroDetalheView';
import IndicadorEtapas from '@/components/painel/etapas/IndicadorEtapas';
import RodapeEtapas from '@/components/painel/etapas/RodapeEtapas';
import RevisaoChecklist from '@/components/painel/etapas/RevisaoChecklist';
import { useEtapas } from '@/components/painel/etapas/useEtapas';
import RoteiroCard from '@/app/buscar/_components/RoteiroCard';
import { ETAPAS_ROTEIRO, ETAPA_ROT, revisaoRoteiro } from '../../_components/etapasRoteiro';
import CopiarDadosRoteiro, { type RoteiroCopiavel } from '../../_components/CopiarDadosRoteiro';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Estado     = { id: number; uf: string; nome: string };
type Municipio  = { id: number; nome: string };
type Embarcacao = { id: string; nome: string; capacidade: number | null };

type ParadaLocal = { localId: string; nome: string };

type RegraLocal = RegraFormulario & { localId: string };

type Props = {
  estados: Estado[];
  embarcacoes: Embarcacao[];
  catalogo: CatalogoItem[];
  /** Embarcação pré-selecionada (`?embarcacao=` vindo da lista de embarcações); ignorada se não estiver na lista. */
  embarcacaoInicialId?: string;
  /** Comissão do Boatzy (%) do gestor — mostrada no calendário de preços. */
  taxaPercent: number;
  /** Outros roteiros do gestor — origem do "copiar de outro roteiro" nas etapas Localização/Preço. */
  roteirosParaCopiar?: RoteiroCopiavel[];
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
    // overflow-clip (não hidden): recorta os cantos igual, sem virar contêiner de
    // rolagem — senão o `sticky` do calendário de preços e da barra do dia não funciona.
    <div id={id} className="scroll-mt-24 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-clip">
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

export default function NovoRoteiroForm({
  estados, embarcacoes, catalogo: catalogoInicial, embarcacaoInicialId, taxaPercent, roteirosParaCopiar = [],
}: Props) {
  const embarcacaoInicial = embarcacoes.find(e => e.id === embarcacaoInicialId);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const numeroInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Omit<CriarRoteiroPayload, 'municipio_id' | 'disponibilidade_dias_semana' | 'janela_reserva_meses' | 'id' | 'imagens'> & {
    municipio_id: string; estado_id: string;
  }>({
    embarcacao_id: embarcacaoInicial?.id ?? '',
    nome: '', descricao: '',
    duracao_valor: '', duracao_unidade: 'horas',
    // Mesma herança de capacidade de `setEmbarcacao`.
    quantidade_pessoas: embarcacaoInicial?.capacidade != null ? String(embarcacaoInicial.capacidade) : '',
    origem: '', destino: '',
    preco_base: '',
    preco_diaria_ativo: false, preco_diaria_valor: '', preco_diaria_minimo: '1',
    estado_id: '', municipio_id: '',
    latitude: '', longitude: '',
    cep: '', bairro: '', logradouro: '', logradouro_numero: '', complemento: '',
    horario_saida: '',
  });

  const [municipios, setMunicipios]               = useState<Municipio[]>([]);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  const [cepLoading, setCepLoading]               = useState(false);
  const [cepError, setCepError]                   = useState<string | null>(null);

  // Regras de preço
  const [regras, setRegras]             = useState<RegraLocal[]>([]);
  // Preço de um dia específico, definido no calendário de preços ('yyyy-mm-dd' → R$).
  const [ajustes, setAjustes]           = useState<Record<string, number>>({});

  // Disponibilidade: dias da semana de operação (vazio = todos), janela de
  // reservas, dias fechados/abertos do roteiro e dias com o barco fechado.
  const [diasOperacao, setDiasOperacao] = useState<number[]>([]);
  const [janelaMeses, setJanelaMeses]   = useState<JanelaReservaMeses>(JANELA_RESERVA_PADRAO);
  const [diasRoteiro, setDiasRoteiro]   = useState<Record<string, boolean>>({});
  // Incrementado a cada cópia de preço de outro roteiro (chave da EtapaPreco).
  const [copiasPreco, setCopiasPreco]   = useState(0);
  // Agenda do barco escolhido (reservas de outros roteiros e dias fechados):
  // `base` = como está no banco, para gravar só a diferença.
  const [agendaBarco, setAgendaBarco] = useState<{
    embarcacaoId: string; base: string[]; fechamentos: string[]; ocupacao: OcupacaoDia[];
  }>({ embarcacaoId: '', base: [], fechamentos: [], ocupacao: [] });
  useEffect(() => {
    const id = form.embarcacao_id;
    if (id === agendaBarco.embarcacaoId) return;
    let cancelado = false;
    const vazia = { embarcacaoId: id, base: [], fechamentos: [], ocupacao: [] };
    if (!id) { setAgendaBarco(vazia); return; }
    carregarAgendaEmbarcacao(id, null).then(agenda => {
      if (cancelado) return;
      setAgendaBarco(agenda
        ? { embarcacaoId: id, base: agenda.fechamentosBarco, fechamentos: agenda.fechamentosBarco, ocupacao: agenda.ocupacao }
        : vazia);
    });
    return () => { cancelado = true; };
  }, [form.embarcacao_id, agendaBarco.embarcacaoId]);

  // Regras exibidas na etapa Preço (e aplicadas no calendário de preços).
  const regrasListadas = useMemo<RegraListada[]>(
    () => regras.map(r => ({ id: r.localId, regra: regraDeFormulario(r, r.localId), estado: 'nova' as const })),
    [regras],
  );

  // Paradas do itinerário: pontos intermediários entre origem e destino (0, 1 ou vários)
  const [paradas, setParadas]     = useState<ParadaLocal[]>([]);
  const [novaParada, setNovaParada] = useState('');

  const [imagens, setImagens]   = useState<GaleriaItem[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [itensCatalogo, setItensCatalogo] = useState<ItemSelecionado[]>([]);
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>(catalogoInicial);

  // ── Pré-visualização (mesmo layout da página pública) ──────────────────────
  const [previewAberto, setPreviewAberto] = useState(false);

  // ── Etapas (wizard) ─────────────────────────────────────────────────────────
  const etapas = useEtapas(ETAPAS_ROTEIRO.length, { ids: ETAPAS_ROTEIRO.map(e => e.id) });
  // Preço e disponibilidade ainda não salvos — alimentam o card da Revisão e a
  // prévia da página (o mesmo calendário que o cliente verá).
  const agendaPreview: AgendaPreview = {
    diasOperacao, janelaMeses, diasRoteiro,
    fechamentosBarco: form.embarcacao_id ? agendaBarco.fechamentos : null,
    ocupacao: agendaBarco.ocupacao,
    regras: regrasListadas.map(r => r.regra),
    ajustes, taxaPercent,
  };
  const revisao = revisaoRoteiro({
    form, embarcacoes, estados, municipios, paradas, imagens, agenda: agendaPreview,
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
        form, estados, municipios, imagens,
        paradas, itensCatalogo, catalogo,
        agenda: agendaPreview,
        embarcacao: form.embarcacao_id ? previewEmb?.dados ?? null : null,
      })
    : null;

  function setField<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  /** Ao vincular uma embarcação, herda a capacidade dela como capacidade do roteiro. */
  function setEmbarcacao(embarcacaoId: string) {
    const capacidade = embarcacoes.find(e => e.id === embarcacaoId)?.capacidade;
    setForm(f => ({
      ...f,
      embarcacao_id: embarcacaoId,
      quantidade_pessoas: capacidade != null ? String(capacidade) : f.quantidade_pessoas,
    }));
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

  // ─── Copiar de outro roteiro (etapas Localização e Preço) ──────────────────

  async function copiarLocalizacao(d: DadosCopiaRoteiroLocalizacao) {
    setCepError(null);
    setForm(f => ({
      ...f,
      cep: d.cep, estado_id: d.estado_id, municipio_id: '',
      bairro: d.bairro, logradouro: d.logradouro,
      logradouro_numero: d.logradouro_numero, complemento: d.complemento,
      latitude: d.latitude, longitude: d.longitude,
    }));
    setMunicipios([]);
    if (!d.estado_id) return;
    await carregarMunicipios(parseInt(d.estado_id, 10));
    setField('municipio_id', d.municipio_id);
  }

  function copiarPreco(d: DadosCopiaRoteiroPreco) {
    setForm(f => ({
      ...f,
      preco_base: d.preco_base, preco_diaria_ativo: d.preco_diaria_ativo,
      preco_diaria_valor: d.preco_diaria_valor, preco_diaria_minimo: d.preco_diaria_minimo,
    }));
    setRegras(d.regras.map(r => ({ ...r, localId: crypto.randomUUID() })));
    setAjustes(d.ajustes);
    setDiasOperacao(d.disponibilidade_dias_semana);
    setJanelaMeses(d.janela_reserva_meses);
    setDiasRoteiro(d.diasRoteiro);
    // Remonta a EtapaPreco: os passos já preenchidos aparecem como concluídos.
    setCopiasPreco(n => n + 1);
  }

  // ─── Regras ───────────────────────────────────────────────────────────────

  function handleAddRegra(regra: RegraFormulario) {
    setRegras(prev => [...prev, { ...regra, localId: crypto.randomUUID() }]);
  }

  function handleRemoveRegra(localId: string) {
    setRegras(prev => prev.filter(r => r.localId !== localId));
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

  // Id do novo roteiro, gerado no 1º salvar e mantido nas novas tentativas:
  // as fotos sobem para a pasta dele ANTES de o registro existir.
  const novoIdRef = useRef<string | null>(null);

  function atualizarImagem(key: string, patch: Partial<GaleriaItem>) {
    setImagens(prev => prev.map(it => (it.key === key ? { ...it, ...patch } : it)));
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
    if (imagens.length === 0) {
      setFeedback({ type: 'error', msg: MENSAGEM_SEM_FOTOS });
      etapas.ir(ETAPA_ROT.fotos);
      return;
    }
    setSubmitting(true);
    novoIdRef.current ??= crypto.randomUUID();
    const roteiroIdNovo = novoIdRef.current;

    // Envia as fotos primeiro: se alguma falhar, nada é salvo.
    const envio = await enviarFotosNovas({
      itens: imagens, endpoint: '/api/painel/roteiros/upload',
      entidadeId: roteiroIdNovo, atualizar: atualizarImagem,
    });
    if (envio.falhas > 0) {
      setFeedback({ type: 'error', msg: mensagemFalhaEnvio(envio.falhas) });
      etapas.ir(ETAPA_ROT.fotos);
      setSubmitting(false);
      return;
    }

    const result = await criarRoteiro({
      id:                 roteiroIdNovo,
      // A ordem da lista é a da galeria.
      imagens:            imagens.map((it, ordem) => ({ url: envio.urls[it.key], titulo: it.titulo, principal: it.principal, ordem })),
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
      janela_reserva_meses: janelaMeses,
      horario_saida:       form.horario_saida,
    });

    if (!result.ok) {
      setFeedback({ type: 'error', msg: result.error });
      setSubmitting(false);
      return;
    }

    const { roteiroId } = result;

    // Disponibilidade: dias fechados/abertos do roteiro e barco fechado (só a
    // diferença — o barco é compartilhado com outros roteiros).
    if (Object.keys(diasRoteiro).length > 0) {
      await salvarDisponibilidadeRoteiro(roteiroId, diasRoteiro);
    }
    if (form.embarcacao_id && form.embarcacao_id === agendaBarco.embarcacaoId) {
      const adicionar = agendaBarco.fechamentos.filter(d => !agendaBarco.base.includes(d));
      const remover = agendaBarco.base.filter(d => !agendaBarco.fechamentos.includes(d));
      if (adicionar.length > 0 || remover.length > 0) {
        await salvarFechamentosEmbarcacao(form.embarcacao_id, adicionar, remover);
      }
    }

    // Salvar paradas do itinerário
    if (paradas.length > 0) {
      await salvarParadasRoteiro(roteiroId, paradas.map(p => p.nome));
    }

    // Criar regras de preço
    for (const regra of regras) {
      await criarRegraRoteiro({
        roteiroId,
        nome:              regra.nome,
        valor:             parseFloat(regra.valor),
        tipo:              regra.tipo,
        prioridade:        0,
        diasSemana:        regra.tipo === 'dia_semana'    ? regra.diasSemana       : undefined,
        periodoMesInicio:  regra.tipo === 'periodo_anual' ? regra.periodoMesInicio : undefined,
        periodoDiaInicio:  regra.tipo === 'periodo_anual' ? regra.periodoDiaInicio : undefined,
        periodoMesFim:     regra.tipo === 'periodo_anual' ? regra.periodoMesFim    : undefined,
        periodoDiaFim:     regra.tipo === 'periodo_anual' ? regra.periodoDiaFim    : undefined,
      });
    }

    // Datas específicas (preço definido no calendário): dias seguidos de mesmo valor = uma regra
    for (const g of compactarAjustes(ajustes)) {
      await criarRegraRoteiro({
        roteiroId, nome: NOME_DATA_ESPECIFICA, valor: g.valor, tipo: 'data_fixa',
        prioridade: PRIORIDADE_DATA_ESPECIFICA, dataInicio: g.inicio, dataFim: g.fim,
      });
    }

    // Salvar itens do catálogo vinculados
    if (itensCatalogo.length > 0) {
      await salvarCatalogoRoteiro(
        roteiroId,
        itensCatalogo.map(i => ({
          catalogoId: i.catalogoId,
          valorCustomizado: i.valorCustomizado !== '' ? parseFloat(i.valorCustomizado) : null,
        })),
      );
    }

    setFeedback({ type: 'success', msg: 'Roteiro enviado para análise! Ele aparece no site assim que a equipe Boatzy aprovar.' });
    setSubmitting(false);
    setTimeout(() => router.push('/painel/roteiros'), 1200);
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
                <p className="text-[10px] font-bold text-[#0B3D91] uppercase tracking-wider mb-1">Embarque (saída)</p>
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
                <p className="text-[10px] font-bold text-cyan-600 uppercase tracking-wider mb-1">Desembarque (chegada)</p>
                <input className={inputCls} placeholder="ex: Ilha Grande, RJ"
                  value={form.destino} onChange={e => setField('destino', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      </div>

      <div hidden={etapas.atual !== ETAPA_ROT.preco} className="space-y-6">
      <CopiarDadosRoteiro etapa="preco" roteiros={roteirosParaCopiar} onCopiar={copiarPreco} />

      {/* ── 2. Preço ─────────────────────────────────────────────────────── */}
      <SectionCard id="preco" icon={DollarSign} title="Preço">
        <EtapaPreco
          key={copiasPreco}
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
          onRemoverRegra={handleRemoveRegra}
          ajustes={ajustes}
          onAjustesChange={setAjustes}
          diasOperacao={diasOperacao}
          onDiasOperacaoChange={setDiasOperacao}
          janelaMeses={janelaMeses}
          onJanelaMesesChange={setJanelaMeses}
          diasRoteiro={diasRoteiro}
          onDiasRoteiroChange={setDiasRoteiro}
          fechamentosBarco={form.embarcacao_id ? agendaBarco.fechamentos : null}
          onFechamentosBarcoChange={datas => setAgendaBarco(a => ({ ...a, fechamentos: datas }))}
          ocupacao={agendaBarco.ocupacao}
          taxaPercent={taxaPercent}
          ativa={etapas.atual === ETAPA_ROT.preco}
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
      <CopiarDadosRoteiro etapa="localizacao" roteiros={roteirosParaCopiar} onCopiar={copiarLocalizacao} />

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
        modo="novo"
        rotuloSalvar="Enviar para análise"
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
