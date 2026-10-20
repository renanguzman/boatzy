'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Clock, MapPin, Receipt, Ship, ShieldCheck, Sparkles, Users, Wallet, Waves } from 'lucide-react';
import LocationPicker, { ROTULO_PROXIMO_DE_MIM, type LocationValue } from '@/components/home/search/LocationPicker';
import DatePicker, { type DateValue } from '@/components/home/search/DatePicker';
import PainelFiltros from '@/components/busca/PainelFiltros';
import { useNavegacaoBusca } from '@/components/busca/NavegacaoBusca';
import { CampoFiltro, ChipFiltro, ContadorFiltro, FaixaNumerica, FiltroMultiSelect, FiltroSecao } from '@/components/busca/CamposFiltro';
import { DURACAO_PRESETS } from '@/lib/duracao';
import {
  buildBuscarUrl,
  MODELOS_PRECO,
  parseIdsCsv,
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
  /** Catálogos auxiliares da embarcação — filtram as duas abas (na de Roteiros, via a embarcação vinculada). */
  comodidades: { id: string; nome: string }[];
  acessorios: { id: string; nome: string }[];
  equipamentosSeguranca: { id: string; nome: string }[];
  totalResultados: number;
};

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Painel lateral de /buscar (Roteiros e Embarcações): todos os filtros
 * visíveis de uma vez — destino, data, pessoas, tipo de embarcação, preço,
 * duração, modelo de cobrança e comodidades. Cada alteração vai direto para a
 * URL (a página refaz a busca); faixas numéricas aplicam ao sair do campo.
 */
export default function FiltrosLaterais({
  params, abaEmbarcacao, tiposEmbarcacao, comodidades, acessorios, equipamentosSeguranca, totalResultados,
}: Props) {
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
      return { type: 'geo', lat: parseFloat(params.lat), lng: parseFloat(params.lng), label: ROTULO_PROXIMO_DE_MIM };
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

  // ── Duração / modelo de cobrança / catálogos auxiliares ────────────────────
  const durMin = params.duracao_min ? parseFloat(params.duracao_min) : null;
  const durMax = params.duracao_max ? parseFloat(params.duracao_max) : null;
  const modelos = parseModelosPreco(params.modelo_preco);
  const comodidadesSel = parseIdsCsv(params.comodidades);
  const acessoriosSel = parseIdsCsv(params.acessorios);
  const equipamentosSel = parseIdsCsv(params.equipamentos_seguranca);

  function toggleModelo(m: ModeloPreco) {
    const prox = modelos.includes(m) ? modelos.filter((x) => x !== m) : [...modelos, m];
    aplicar({ modelo_preco: prox.length > 0 ? prox.join(',') : null });
  }

  function toggleIdSelecionado(
    campo: 'comodidades' | 'acessorios' | 'equipamentos_seguranca',
    selecionados: string[],
    id: string,
  ) {
    const prox = selecionados.includes(id) ? selecionados.filter((x) => x !== id) : [...selecionados, id];
    aplicar({ [campo]: prox.length > 0 ? prox.join(',') : null });
  }

  // ── Contagem + limpar tudo (mantém aba e ordenação) ────────────────────────
  const grupos = [
    !!(params.municipio || params.lat),
    !abaEmbarcacao && !!params.data,
    pessoasUrl > 0,
    !!params.tipo_embarcacao,
    !abaEmbarcacao && !!(params.preco_min || params.preco_max),
    !!(params.duracao_min || params.duracao_max),
    modelos.length > 0,
    comodidadesSel.length > 0,
    acessoriosSel.length > 0,
    equipamentosSel.length > 0,
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

        {!abaEmbarcacao && (
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
        )}
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

      {!abaEmbarcacao && (
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
      )}

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

      {comodidades.length > 0 && (
        <FiltroSecao titulo="Comodidades" icone={Sparkles}
          acao={comodidadesSel.length > 0 ? { label: `Limpar (${comodidadesSel.length})`, onClick: () => aplicar({ comodidades: null }) } : null}>
          <FiltroMultiSelect
            itens={comodidades}
            selecionados={comodidadesSel}
            onToggle={(id) => toggleIdSelecionado('comodidades', comodidadesSel, id)}
            placeholder="Ex.: churrasqueira, som…"
            vazio="Nenhuma comodidade encontrada."
          />
        </FiltroSecao>
      )}

      {acessorios.length > 0 && (
        <FiltroSecao titulo="Acessórios" icone={Waves}
          acao={acessoriosSel.length > 0 ? { label: `Limpar (${acessoriosSel.length})`, onClick: () => aplicar({ acessorios: null }) } : null}>
          <FiltroMultiSelect
            itens={acessorios}
            selecionados={acessoriosSel}
            onToggle={(id) => toggleIdSelecionado('acessorios', acessoriosSel, id)}
            placeholder="Ex.: caiaque, churrasqueira…"
            vazio="Nenhum acessório encontrado."
          />
        </FiltroSecao>
      )}

      {equipamentosSeguranca.length > 0 && (
        <FiltroSecao titulo="Equipamentos de Segurança" icone={ShieldCheck}
          acao={equipamentosSel.length > 0 ? { label: `Limpar (${equipamentosSel.length})`, onClick: () => aplicar({ equipamentos_seguranca: null }) } : null}>
          <FiltroMultiSelect
            itens={equipamentosSeguranca}
            selecionados={equipamentosSel}
            onToggle={(id) => toggleIdSelecionado('equipamentos_seguranca', equipamentosSel, id)}
            placeholder="Ex.: colete, extintor…"
            vazio="Nenhum equipamento encontrado."
          />
        </FiltroSecao>
      )}
    </PainelFiltros>
  );
}
