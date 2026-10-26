'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarDays, Clock, MapPin, Receipt, Ship, ShieldCheck, Sparkles, Users, Wallet, Waves } from 'lucide-react';
import LocationPicker, { type LocationValue } from '@/components/home/search/LocationPicker';
import DatePicker, { type DateValue } from '@/components/home/search/DatePicker';
import PainelFiltros from '@/components/busca/PainelFiltros';
import { useCatalogo } from '@/i18n/CatalogoProvider';
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
  const { traduzir, ordenar } = useCatalogo();
  const t = useTranslations('Busca');
  const tf = useTranslations('Busca.filtros');
  const tComum = useTranslations('Comum');
  const tPessoas = useTranslations('CamposBusca.quantidade.pessoas');
  const limpar = (onClick: () => void) => ({ label: tComum('limpar'), onClick });
  const limparContagem = (count: number, onClick: () => void) => ({ label: tf('limparContagem', { count }), onClick });

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
      return { type: 'geo', lat: parseFloat(params.lat), lng: parseFloat(params.lng) };
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
        <FiltroSecao titulo={tf('destino')} icone={MapPin}
          acao={localAtual ? limpar(() => mudarLocal(null)) : null}>
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
          <FiltroSecao titulo={tf('data')} icone={CalendarDays}
            acao={dataAtual ? limpar(() => mudarData(null)) : null}>
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

      <FiltroSecao titulo={tf('quantidadePessoas')} icone={Users}>
        <ContadorFiltro
          valor={pessoas}
          onChange={mudarPessoas}
          formatar={(n) => tPessoas('valor', { count: n })}
          rotuloRemover={tPessoas('remover')}
          rotuloAdicionar={tPessoas('adicionar')}
        />
      </FiltroSecao>

      {abaEmbarcacao && tiposEmbarcacao.length > 0 && (
        <FiltroSecao titulo={tf('tipoEmbarcacao')} icone={Ship}>
          <div className="flex flex-wrap gap-1.5">
            <ChipFiltro ativo={!params.tipo_embarcacao}
              onClick={() => aplicar({ tipo: 'embarcacao', tipo_embarcacao: null, tipo_nome: null })}>
              {tf('todos')}
            </ChipFiltro>
            {ordenar(tiposEmbarcacao, 'tipo').map((tipo) => (
              <ChipFiltro key={tipo.id} ativo={params.tipo_embarcacao === tipo.id}
                onClick={() => aplicar(params.tipo_embarcacao === tipo.id
                  ? { tipo: 'embarcacao', tipo_embarcacao: null, tipo_nome: null }
                  : { tipo: 'embarcacao', tipo_embarcacao: tipo.id, tipo_nome: tipo.nome })}>
                {traduzir('tipo', tipo.nome)}
              </ChipFiltro>
            ))}
          </div>
        </FiltroSecao>
      )}

      {!abaEmbarcacao && (
        <FiltroSecao titulo={tf('faixaPreco')} icone={Wallet}
          acao={params.preco_min || params.preco_max ? limpar(() => aplicar({ preco_min: null, preco_max: null })) : null}>
          <FaixaNumerica
            key={`preco-${params.preco_min ?? ''}-${params.preco_max ?? ''}`}
            rotulo={tf('preco')}
            prefixo="R$"
            step={50}
            min={params.preco_min ?? ''}
            max={params.preco_max ?? ''}
            onAplicar={(a, b) => aplicar({ preco_min: a || null, preco_max: b || null })}
          />
        </FiltroSecao>
      )}

      <FiltroSecao titulo={tf('duracaoPasseio')} icone={Clock}
        acao={durMin != null || durMax != null ? limpar(() => aplicar({ duracao_min: null, duracao_max: null })) : null}>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {DURACAO_PRESETS.map((p) => {
            const ativo = durMin === p.min && durMax === p.max;
            return (
              <ChipFiltro key={p.id} ativo={ativo}
                onClick={() => aplicar(ativo
                  ? { duracao_min: null, duracao_max: null }
                  : { duracao_min: p.min == null ? null : String(p.min), duracao_max: p.max == null ? null : String(p.max) })}>
                {t(`duracaoPresets.${p.id}`)}
              </ChipFiltro>
            );
          })}
        </div>
        <FaixaNumerica
          key={`dur-${params.duracao_min ?? ''}-${params.duracao_max ?? ''}`}
          rotulo={tf('duracaoHoras')}
          sufixo="h"
          step={0.5}
          min={params.duracao_min ?? ''}
          max={params.duracao_max ?? ''}
          onAplicar={(a, b) => aplicar({ duracao_min: a || null, duracao_max: b || null })}
        />
        <p className="text-[11px] text-slate-400 mt-2">{tf('ajudaHoras')}</p>
      </FiltroSecao>

      {!abaEmbarcacao && (
        <FiltroSecao titulo={tf('modeloCobranca')} icone={Receipt}>
          <div className="flex flex-wrap gap-1.5">
            {MODELOS_PRECO.map((m) => (
              <ChipFiltro key={m} ativo={modelos.includes(m)} onClick={() => toggleModelo(m)}>
                {t(`modelosPreco.${m}`)}
              </ChipFiltro>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">{tf('ajudaModelos')}</p>
        </FiltroSecao>
      )}

      {comodidades.length > 0 && (
        <FiltroSecao titulo={tf('comodidades')} icone={Sparkles}
          acao={comodidadesSel.length > 0 ? limparContagem(comodidadesSel.length, () => aplicar({ comodidades: null })) : null}>
          <FiltroMultiSelect
            itens={comodidades}
            categoria="comodidade"
            selecionados={comodidadesSel}
            onToggle={(id) => toggleIdSelecionado('comodidades', comodidadesSel, id)}
            placeholder={tf('comodidadesPlaceholder')}
            vazio={tf('comodidadesVazio')}
          />
        </FiltroSecao>
      )}

      {acessorios.length > 0 && (
        <FiltroSecao titulo={tf('acessorios')} icone={Waves}
          acao={acessoriosSel.length > 0 ? limparContagem(acessoriosSel.length, () => aplicar({ acessorios: null })) : null}>
          <FiltroMultiSelect
            itens={acessorios}
            categoria="acessorio"
            selecionados={acessoriosSel}
            onToggle={(id) => toggleIdSelecionado('acessorios', acessoriosSel, id)}
            placeholder={tf('acessoriosPlaceholder')}
            vazio={tf('acessoriosVazio')}
          />
        </FiltroSecao>
      )}

      {equipamentosSeguranca.length > 0 && (
        <FiltroSecao titulo={tf('equipamentos')} icone={ShieldCheck}
          acao={equipamentosSel.length > 0 ? limparContagem(equipamentosSel.length, () => aplicar({ equipamentos_seguranca: null })) : null}>
          <FiltroMultiSelect
            itens={equipamentosSeguranca}
            categoria="equipamento"
            selecionados={equipamentosSel}
            onToggle={(id) => toggleIdSelecionado('equipamentos_seguranca', equipamentosSel, id)}
            placeholder={tf('equipamentosPlaceholder')}
            vazio={tf('equipamentosVazio')}
          />
        </FiltroSecao>
      )}
    </PainelFiltros>
  );
}
