'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Clock, MapPin, Receipt, Search, Ship, Sparkles, Users, Wallet, X } from 'lucide-react';
import LocationPicker, { type LocationValue } from '@/components/home/search/LocationPicker';
import DatePicker, { type DateValue } from '@/components/home/search/DatePicker';
import PainelFiltros from '@/components/busca/PainelFiltros';
import { useNavegacaoBusca } from '@/components/busca/NavegacaoBusca';
import { CampoFiltro, CheckFiltro, ChipFiltro, ContadorFiltro, FaixaNumerica, FiltroSecao } from '@/components/busca/CamposFiltro';
import { DURACAO_PRESETS } from '@/lib/duracao';
import {
  buildBuscarUrl,
  MODELOS_PRECO,
  parseComodidadeIds,
  parseModelosPreco,
  type BuscaSearchParams,
  type ModeloPreco,
} from '../_lib/filtros';

type Props = {
  /** Params atuais da URL — vêm da página (Server Component). */
  params: BuscaSearchParams;
  /** Aba Embarcações (true) ou Roteiros (false). */
  abaEmbarcacao: boolean;
  tiposEmbarcacao: { id: string; nome: string }[];
  /** Comodidades — só na aba Embarcações. */
  comodidades: { id: string; nome: string }[];
  totalResultados: number;
};

/** Comodidades mostradas antes do "Ver todas". */
const COMODIDADES_VISIVEIS = 8;

function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Painel lateral de /buscar (Roteiros e Embarcações): todos os filtros
 * visíveis de uma vez — destino, data, pessoas, tipo de embarcação, preço,
 * duração, modelo de cobrança e comodidades. Cada alteração vai direto para a
 * URL (a página refaz a busca); faixas numéricas aplicam ao sair do campo.
 */
export default function FiltrosLaterais({ params, abaEmbarcacao, tiposEmbarcacao, comodidades, totalResultados }: Props) {
  const { ir } = useNavegacaoBusca();

  function aplicar(alteracoes: Partial<Record<keyof BuscaSearchParams, string | null>>) {
    ir(buildBuscarUrl(params, { ...alteracoes, pagina: null }));
  }

  // ── Destino / data (dropdowns) ─────────────────────────────────────────────
  const [painel, setPainel] = useState<'location' | 'date' | null>(null);
  const camposRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (camposRef.current && !camposRef.current.contains(e.target as Node)) setPainel(null);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const localAtual: LocationValue | null = useMemo(() => {
    if (params.municipio && params.local) {
      const [nome, uf] = params.local.split(', ');
      return { type: 'place', id: parseInt(params.municipio), nome, uf: uf ?? '' };
    }
    if (params.lat && params.lng) {
      return { type: 'geo', lat: parseFloat(params.lat), lng: parseFloat(params.lng), label: 'Minha localização' };
    }
    return null;
  }, [params.municipio, params.local, params.lat, params.lng]);

  function mudarLocal(v: LocationValue | null) {
    if (!v) aplicar({ municipio: null, local: null, lat: null, lng: null });
    else if (v.type === 'place') aplicar({ municipio: String(v.id), local: `${v.nome}, ${v.uf}`, lat: null, lng: null });
    else aplicar({ lat: String(v.lat), lng: String(v.lng), municipio: null, local: null });
  }

  const dataAtual: DateValue | null = params.data
    ? { date: new Date(params.data + 'T12:00:00'), flexibility: (parseInt(params.flex ?? '0') || 0) as DateValue['flexibility'] }
    : null;

  function mudarData(v: DateValue | null) {
    if (!v) aplicar({ data: null, flex: null });
    else aplicar({ data: isoLocal(v.date), flex: v.flexibility > 0 ? String(v.flexibility) : null });
  }

  // ── Pessoas (stepper; aplica após uma pausa curta) ─────────────────────────
  const pessoasUrl = parseInt(params.pessoas ?? '0') || 0;
  const [pessoas, setPessoas] = useState(pessoasUrl);
  const [pessoasSync, setPessoasSync] = useState(pessoasUrl);
  if (pessoasSync !== pessoasUrl) { setPessoasSync(pessoasUrl); setPessoas(pessoasUrl); }
  const timerPessoas = useRef<ReturnType<typeof setTimeout> | null>(null);
  function mudarPessoas(n: number) {
    setPessoas(n);
    if (timerPessoas.current) clearTimeout(timerPessoas.current);
    timerPessoas.current = setTimeout(() => aplicar({ pessoas: n > 0 ? String(n) : null }), 500);
  }

  // ── Duração / modelo de cobrança / comodidades ─────────────────────────────
  const durMin = params.duracao_min ? parseFloat(params.duracao_min) : null;
  const durMax = params.duracao_max ? parseFloat(params.duracao_max) : null;
  const modelos = parseModelosPreco(params.modelo_preco);
  const comodidadesSel = parseComodidadeIds(params.comodidades);

  function toggleModelo(m: ModeloPreco) {
    const prox = modelos.includes(m) ? modelos.filter((x) => x !== m) : [...modelos, m];
    aplicar({ modelo_preco: prox.length > 0 ? prox.join(',') : null });
  }

  function toggleComodidade(id: string) {
    const prox = comodidadesSel.includes(id) ? comodidadesSel.filter((x) => x !== id) : [...comodidadesSel, id];
    aplicar({ comodidades: prox.length > 0 ? prox.join(',') : null });
  }

  const [buscaComodidade, setBuscaComodidade] = useState('');
  const [todasComodidades, setTodasComodidades] = useState(false);
  const comodidadesFiltradas = buscaComodidade.trim()
    ? comodidades.filter((c) => normalizar(c.nome).includes(normalizar(buscaComodidade)))
    : comodidades;
  // Selecionadas primeiro, para ficarem visíveis mesmo com a lista recolhida.
  const comodidadesOrdenadas = [...comodidadesFiltradas].sort(
    (a, b) => Number(comodidadesSel.includes(b.id)) - Number(comodidadesSel.includes(a.id)),
  );
  const comodidadesExibidas = todasComodidades || buscaComodidade.trim()
    ? comodidadesOrdenadas
    : comodidadesOrdenadas.slice(0, COMODIDADES_VISIVEIS);

  // ── Contagem + limpar tudo (mantém aba e ordenação) ────────────────────────
  const grupos = [
    !!(params.municipio || params.lat),
    !!params.data,
    pessoasUrl > 0,
    !!params.tipo_embarcacao,
    !!(params.preco_min || params.preco_max),
    !!(params.duracao_min || params.duracao_max),
    modelos.length > 0,
    comodidadesSel.length > 0,
  ];
  const ativos = grupos.filter(Boolean).length;
  const limparHref = buildBuscarUrl(
    { ...(abaEmbarcacao ? { tipo: 'embarcacao' } : {}), ...(params.ordenar ? { ordenar: params.ordenar } : {}) },
    {},
  );

  return (
    <PainelFiltros ativos={ativos} limparHref={limparHref} totalResultados={totalResultados}>
      <div ref={camposRef}>
        <FiltroSecao titulo="Destino" icone={MapPin}
          acao={localAtual ? { label: 'Limpar', onClick: () => mudarLocal(null) } : null}>
          <CampoFiltro>
            <LocationPicker
              value={localAtual}
              onChange={mudarLocal}
              isOpen={painel === 'location'}
              onOpen={() => setPainel((p) => (p === 'location' ? null : 'location'))}
              onClose={() => setPainel(null)}
              semRotulo
            />
          </CampoFiltro>
        </FiltroSecao>

        <FiltroSecao titulo="Data" icone={CalendarDays}
          acao={dataAtual ? { label: 'Limpar', onClick: () => mudarData(null) } : null}>
          <CampoFiltro>
            <DatePicker
              value={dataAtual}
              onChange={mudarData}
              isOpen={painel === 'date'}
              onOpen={() => setPainel((p) => (p === 'date' ? null : 'date'))}
              onClose={() => setPainel(null)}
              alinhamentoPainel="esquerda"
              semRotulo
            />
          </CampoFiltro>
        </FiltroSecao>
      </div>

      <FiltroSecao titulo="Quantidade de pessoas" icone={Users}>
        <ContadorFiltro valor={pessoas} onChange={mudarPessoas} singular="pessoa" plural="pessoas" />
      </FiltroSecao>

      {abaEmbarcacao && tiposEmbarcacao.length > 0 && (
        <FiltroSecao titulo="Tipo de embarcação" icone={Ship}>
          <div className="flex flex-wrap gap-1.5">
            <ChipFiltro ativo={!params.tipo_embarcacao}
              onClick={() => aplicar({ tipo: 'embarcacao', tipo_embarcacao: null, tipo_nome: null })}>
              Todos
            </ChipFiltro>
            {tiposEmbarcacao.map((t) => (
              <ChipFiltro key={t.id} ativo={params.tipo_embarcacao === t.id}
                onClick={() => aplicar(params.tipo_embarcacao === t.id
                  ? { tipo: 'embarcacao', tipo_embarcacao: null, tipo_nome: null }
                  : { tipo: 'embarcacao', tipo_embarcacao: t.id, tipo_nome: t.nome })}>
                {t.nome}
              </ChipFiltro>
            ))}
          </div>
        </FiltroSecao>
      )}

      <FiltroSecao titulo="Faixa de preço" icone={Wallet}
        acao={params.preco_min || params.preco_max ? { label: 'Limpar', onClick: () => aplicar({ preco_min: null, preco_max: null }) } : null}>
        <FaixaNumerica
          key={`preco-${params.preco_min ?? ''}-${params.preco_max ?? ''}`}
          rotulo="Preço"
          prefixo="R$"
          step={50}
          min={params.preco_min ?? ''}
          max={params.preco_max ?? ''}
          onAplicar={(a, b) => aplicar({ preco_min: a || null, preco_max: b || null })}
        />
      </FiltroSecao>

      <FiltroSecao titulo="Duração do passeio" icone={Clock}
        acao={durMin != null || durMax != null ? { label: 'Limpar', onClick: () => aplicar({ duracao_min: null, duracao_max: null }) } : null}>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {DURACAO_PRESETS.map((p) => {
            const ativo = durMin === p.min && durMax === p.max;
            return (
              <ChipFiltro key={p.label} ativo={ativo}
                onClick={() => aplicar(ativo
                  ? { duracao_min: null, duracao_max: null }
                  : { duracao_min: p.min == null ? null : String(p.min), duracao_max: p.max == null ? null : String(p.max) })}>
                {p.label}
              </ChipFiltro>
            );
          })}
        </div>
        <FaixaNumerica
          key={`dur-${params.duracao_min ?? ''}-${params.duracao_max ?? ''}`}
          rotulo="Duração em horas"
          sufixo="h"
          step={0.5}
          min={params.duracao_min ?? ''}
          max={params.duracao_max ?? ''}
          onAplicar={(a, b) => aplicar({ duracao_min: a || null, duracao_max: b || null })}
        />
        <p className="text-[11px] text-slate-400 mt-2">Em horas — 1 dia equivale a 24 h.</p>
      </FiltroSecao>

      {!abaEmbarcacao && (
        <FiltroSecao titulo="Modelo de cobrança" icone={Receipt}>
          <div className="flex flex-wrap gap-1.5">
            {MODELOS_PRECO.map((m) => (
              <ChipFiltro key={m.value} ativo={modelos.includes(m.value)} onClick={() => toggleModelo(m.value)}>
                {m.label}
              </ChipFiltro>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Nenhum selecionado mostra todos os modelos.</p>
        </FiltroSecao>
      )}

      {abaEmbarcacao && comodidades.length > 0 && (
        <FiltroSecao titulo="Comodidades" icone={Sparkles}
          acao={comodidadesSel.length > 0 ? { label: `Limpar (${comodidadesSel.length})`, onClick: () => aplicar({ comodidades: null }) } : null}>
          {comodidades.length > COMODIDADES_VISIVEIS && (
            <label className="relative block mb-2">
              <span className="sr-only">Buscar comodidade</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="search"
                value={buscaComodidade}
                onChange={(e) => setBuscaComodidade(e.target.value)}
                placeholder="Ex.: churrasqueira, som…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-8 py-2 text-sm text-slate-800
                  placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:bg-white"
              />
              {buscaComodidade && (
                <button type="button" onClick={() => setBuscaComodidade('')} aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full hover:bg-slate-200 flex items-center justify-center">
                  <X className="h-3 w-3 text-slate-500" />
                </button>
              )}
            </label>
          )}
          <div className="space-y-0.5">
            {comodidadesExibidas.map((c) => (
              <CheckFiltro key={c.id} marcado={comodidadesSel.includes(c.id)} onClick={() => toggleComodidade(c.id)}>
                {c.nome}
              </CheckFiltro>
            ))}
            {comodidadesExibidas.length === 0 && (
              <p className="text-xs text-slate-400 py-1">Nenhuma comodidade encontrada.</p>
            )}
          </div>
          {!buscaComodidade.trim() && comodidades.length > COMODIDADES_VISIVEIS && (
            <button type="button" onClick={() => setTodasComodidades((v) => !v)}
              className="mt-2 text-xs font-semibold text-[#0B3D91] hover:text-[#0B2447]">
              {todasComodidades ? 'Ver menos' : `Ver todas (${comodidades.length})`}
            </button>
          )}
        </FiltroSecao>
      )}
    </PainelFiltros>
  );
}
