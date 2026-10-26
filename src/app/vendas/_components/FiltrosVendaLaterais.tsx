'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LOCALE_INTL } from '@/i18n/config';
import { CalendarRange, ChevronDown, MapPin, Ship, Wallet } from 'lucide-react';
import PainelFiltros from '@/components/busca/PainelFiltros';
import { useCatalogo } from '@/i18n/CatalogoProvider';
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

const selectCls = `w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-9 py-2.5 text-sm text-grafite
  focus:outline-none focus:ring-2 focus:ring-marinho/20 focus:border-marinho/40 transition disabled:bg-slate-50 disabled:text-slate-400`;

/**
 * Painel lateral de /vendas: tipo, localização (estado → cidade), ano do
 * modelo e valor, todos visíveis. Estado e cidade só oferecem locais com
 * anúncio ativo (mesma fonte do seletor da home).
 */
export default function FiltrosVendaLaterais({ params, tipos, locais, totalResultados }: Props) {
  const { ir } = useNavegacaoBusca();
  const { traduzir, ordenar } = useCatalogo();
  const t = useTranslations('Vendas.filtros');
  const tCampos = useTranslations('CamposVenda');
  const tBusca = useTranslations('Busca.filtros');
  const tComum = useTranslations('Comum');
  const local = LOCALE_INTL[useLocale()];
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
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, local));
  }, [locais, local]);

  const cidades = useMemo(
    () => locais
      .filter((l) => String(l.estadoId) === params.estado)
      .sort((a, b) => a.municipioNome.localeCompare(b.municipioNome, local)),
    [locais, params.estado, local],
  );

  const ativos = [
    !!params.tipo,
    !!params.estado,
    !!(params.ano_min || params.ano_max),
    !!(params.preco_min || params.preco_max),
  ].filter(Boolean).length;

  return (
    <PainelFiltros ativos={ativos} limparHref="/vendas" totalResultados={totalResultados}>
      <FiltroSecao titulo={tBusca('tipoEmbarcacao')} icone={Ship}>
        <div className="flex flex-wrap gap-1.5">
          <ChipFiltro ativo={!params.tipo} onClick={() => aplicar({ tipo: null })}>{tBusca('todos')}</ChipFiltro>
          {ordenar(tipos, 'tipo').map((t) => (
            <ChipFiltro key={t.id} ativo={params.tipo === t.id}
              onClick={() => aplicar({ tipo: params.tipo === t.id ? null : t.id })}>
              {traduzir('tipo', t.nome)}
            </ChipFiltro>
          ))}
        </div>
      </FiltroSecao>

      <FiltroSecao titulo={t('localizacao')} icone={MapPin}
        acao={params.estado ? { label: tComum('limpar'), onClick: () => aplicar({ estado: null, cidade: null }) } : null}>
        <div className="space-y-2">
          <label className="relative block">
            <span className="sr-only">{tCampos('local.estado')}</span>
            <select
              className={selectCls}
              value={params.estado ?? ''}
              onChange={(e) => aplicar({ estado: e.target.value || null, cidade: null })}
            >
              <option value="">{t('todosEstados')}</option>
              {estados.map((e) => (
                <option key={e.id} value={e.id}>{e.nome} ({e.total})</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </label>
          <label className="relative block">
            <span className="sr-only">{t('cidade')}</span>
            <select
              className={selectCls}
              value={params.cidade ?? ''}
              disabled={!params.estado}
              onChange={(e) => aplicar({ cidade: e.target.value || null })}
            >
              <option value="">{params.estado ? tCampos('local.todoEstado') : t('escolhaEstado')}</option>
              {cidades.map((c) => (
                <option key={c.municipioId} value={c.municipioId}>{c.municipioNome} ({c.total})</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </label>
        </div>
      </FiltroSecao>

      <FiltroSecao titulo={tCampos('ano.titulo')} icone={CalendarRange}
        acao={params.ano_min || params.ano_max ? { label: tComum('limpar'), onClick: () => aplicar({ ano_min: null, ano_max: null }) } : null}>
        <FaixaNumerica
          key={`ano-${params.ano_min ?? ''}-${params.ano_max ?? ''}`}
          rotulo={tCampos('ano.titulo')}
          min={params.ano_min ?? ''}
          max={params.ano_max ?? ''}
          placeholderMin={tCampos('ano.de')}
          placeholderMax={tCampos('ano.ateAnoPlaceholder', { ano: anoAtual + 1 })}
          onAplicar={(a, b) => aplicar({ ano_min: a || null, ano_max: b || null })}
        />
      </FiltroSecao>

      <FiltroSecao titulo={tCampos('valor.rotulo')} icone={Wallet}
        acao={params.preco_min || params.preco_max ? { label: tComum('limpar'), onClick: () => aplicar({ preco_min: null, preco_max: null }) } : null}>
        <FaixaNumerica
          key={`valor-${params.preco_min ?? ''}-${params.preco_max ?? ''}`}
          rotulo={tCampos('valor.rotulo')}
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
