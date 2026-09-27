'use client';

import { useMemo } from 'react';
import { CalendarRange, ChevronDown, MapPin, Ship, Wallet } from 'lucide-react';
import PainelFiltros from '@/components/busca/PainelFiltros';
import { useNavegacaoBusca } from '@/components/busca/NavegacaoBusca';
import { ChipFiltro, FaixaNumerica, FiltroSecao } from '@/components/busca/CamposFiltro';
import type { TipoVendaOption } from '@/components/home/search/venda/TipoVendaPicker';
import type { LocalVendaOption } from '@/components/home/search/venda/LocalidadeVendaPicker';
import { buildVendasUrl, type VendasSearchParams } from '../_lib/filtros';

type Props = {
  params: VendasSearchParams;
  /** Tipos com anúncio ativo. */
  tipos: TipoVendaOption[];
  /** Municípios (com estado) que têm anúncio ativo. */
  locais: LocalVendaOption[];
  totalResultados: number;
};

const selectCls = `w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-9 py-2.5 text-sm text-slate-800
  focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition disabled:bg-slate-50 disabled:text-slate-400`;

/**
 * Painel lateral de /vendas: tipo, localização (estado → cidade), ano do
 * modelo e valor, todos visíveis. Estado e cidade só oferecem locais com
 * anúncio ativo (mesma fonte do seletor da home).
 */
export default function FiltrosVendaLaterais({ params, tipos, locais, totalResultados }: Props) {
  const { ir } = useNavegacaoBusca();
  const anoAtual = new Date().getFullYear();

  function aplicar(alteracoes: Partial<Record<keyof VendasSearchParams, string | null>>) {
    ir(buildVendasUrl(params, { ...alteracoes, pagina: null }));
  }

  const estados = useMemo(() => {
    const map = new Map<number, { id: number; nome: string; uf: string; total: number }>();
    for (const l of locais) {
      const e = map.get(l.estadoId) ?? { id: l.estadoId, nome: l.estadoNome, uf: l.uf, total: 0 };
      e.total += l.total;
      map.set(l.estadoId, e);
    }
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [locais]);

  const cidades = useMemo(
    () => locais
      .filter((l) => String(l.estadoId) === params.estado)
      .sort((a, b) => a.municipioNome.localeCompare(b.municipioNome, 'pt-BR')),
    [locais, params.estado],
  );

  const ativos = [
    !!params.tipo,
    !!params.estado,
    !!(params.ano_min || params.ano_max),
    !!(params.preco_min || params.preco_max),
  ].filter(Boolean).length;

  return (
    <PainelFiltros ativos={ativos} limparHref="/vendas" totalResultados={totalResultados}>
      <FiltroSecao titulo="Tipo de embarcação" icone={Ship}>
        <div className="flex flex-wrap gap-1.5">
          <ChipFiltro ativo={!params.tipo} onClick={() => aplicar({ tipo: null })}>Todos</ChipFiltro>
          {tipos.map((t) => (
            <ChipFiltro key={t.id} ativo={params.tipo === t.id}
              onClick={() => aplicar({ tipo: params.tipo === t.id ? null : t.id })}>
              {t.nome}
            </ChipFiltro>
          ))}
        </div>
      </FiltroSecao>

      <FiltroSecao titulo="Localização" icone={MapPin}
        acao={params.estado ? { label: 'Limpar', onClick: () => aplicar({ estado: null, cidade: null }) } : null}>
        <div className="space-y-2">
          <label className="relative block">
            <span className="sr-only">Estado</span>
            <select
              className={selectCls}
              value={params.estado ?? ''}
              onChange={(e) => aplicar({ estado: e.target.value || null, cidade: null })}
            >
              <option value="">Todos os estados</option>
              {estados.map((e) => (
                <option key={e.id} value={e.id}>{e.nome} ({e.total})</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </label>
          <label className="relative block">
            <span className="sr-only">Cidade</span>
            <select
              className={selectCls}
              value={params.cidade ?? ''}
              disabled={!params.estado}
              onChange={(e) => aplicar({ cidade: e.target.value || null })}
            >
              <option value="">{params.estado ? 'Todo o estado' : 'Escolha um estado primeiro'}</option>
              {cidades.map((c) => (
                <option key={c.municipioId} value={c.municipioId}>{c.municipioNome} ({c.total})</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </label>
        </div>
      </FiltroSecao>

      <FiltroSecao titulo="Ano do modelo" icone={CalendarRange}
        acao={params.ano_min || params.ano_max ? { label: 'Limpar', onClick: () => aplicar({ ano_min: null, ano_max: null }) } : null}>
        <FaixaNumerica
          key={`ano-${params.ano_min ?? ''}-${params.ano_max ?? ''}`}
          rotulo="Ano do modelo"
          min={params.ano_min ?? ''}
          max={params.ano_max ?? ''}
          placeholderMin="De"
          placeholderMax={`Até ${anoAtual + 1}`}
          onAplicar={(a, b) => aplicar({ ano_min: a || null, ano_max: b || null })}
        />
      </FiltroSecao>

      <FiltroSecao titulo="Valor" icone={Wallet}
        acao={params.preco_min || params.preco_max ? { label: 'Limpar', onClick: () => aplicar({ preco_min: null, preco_max: null }) } : null}>
        <FaixaNumerica
          key={`valor-${params.preco_min ?? ''}-${params.preco_max ?? ''}`}
          rotulo="Valor"
          prefixo="R$"
          step={10000}
          min={params.preco_min ?? ''}
          max={params.preco_max ?? ''}
          onAplicar={(a, b) => aplicar({ preco_min: a || null, preco_max: b || null })}
        />
      </FiltroSecao>
    </PainelFiltros>
  );
}
