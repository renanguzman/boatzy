'use client';

import { ShoppingBag, Wrench, Check } from 'lucide-react';
import type { CatalogoTipo } from '@/types/supabase';

export type CatalogoItem = {
  id: string;
  descricao: string;
  valor: number;
  tipo: CatalogoTipo;
};

export type ItemSelecionado = {
  catalogoId: string;
  valorCustomizado: string; // string para bind no input
};

const TIPO_CONFIG: Record<CatalogoTipo, {
  label: string;
  icon: React.ElementType;
  text: string;
  bg: string;
  border: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
}> = {
  produto: {
    label: 'Produtos',
    icon: ShoppingBag,
    text: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    activeBg: 'bg-blue-50',
    activeBorder: 'border-blue-400',
    activeText: 'text-blue-700',
  },
  servico: {
    label: 'Serviços',
    icon: Wrench,
    text: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-100',
    activeBg: 'bg-violet-50',
    activeBorder: 'border-violet-400',
    activeText: 'text-violet-700',
  },
};

const inputCls = `w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800
  placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20
  focus:border-[#0B2447]/40 transition bg-white`;

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type Props = {
  catalogo: CatalogoItem[];
  selecionados: ItemSelecionado[];
  onChange: (selecionados: ItemSelecionado[]) => void;
};

export default function CatalogoSelector({ catalogo, selecionados, onChange }: Props) {
  const produtos = catalogo.filter(c => c.tipo === 'produto');
  const servicos = catalogo.filter(c => c.tipo === 'servico');

  if (catalogo.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic">
        Nenhum item cadastrado no catálogo. Crie itens em{' '}
        <a href="/painel/catalogo" target="_blank" className="text-[#0B3D91] underline hover:text-[#0B2447]">
          Catálogo
        </a>{' '}
        para vinculá-los aqui.
      </p>
    );
  }

  function isSelected(id: string): boolean {
    return selecionados.some(s => s.catalogoId === id);
  }

  function getValor(id: string): string {
    return selecionados.find(s => s.catalogoId === id)?.valorCustomizado ?? '';
  }

  function toggle(item: CatalogoItem) {
    if (isSelected(item.id)) {
      onChange(selecionados.filter(s => s.catalogoId !== item.id));
    } else {
      onChange([...selecionados, {
        catalogoId: item.id,
        valorCustomizado: String(item.valor),
      }]);
    }
  }

  function setValor(id: string, valor: string) {
    onChange(selecionados.map(s =>
      s.catalogoId === id ? { ...s, valorCustomizado: valor } : s,
    ));
  }

  function renderGroup(itens: CatalogoItem[], tipo: CatalogoTipo) {
    if (itens.length === 0) return null;
    const cfg = TIPO_CONFIG[tipo];
    const Icon = cfg.icon;

    return (
      <div>
        <div className={`flex items-center gap-2 mb-3 px-1`}>
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${cfg.bg}`}>
            <Icon className={`w-3.5 h-3.5 ${cfg.text}`} />
          </div>
          <p className={`text-xs font-bold uppercase tracking-wider ${cfg.text}`}>
            {cfg.label}
          </p>
          <span className="text-xs text-slate-400">({itens.length})</span>
        </div>

        <div className="space-y-2">
          {itens.map(item => {
            const selected = isSelected(item.id);
            return (
              <div
                key={item.id}
                className={`rounded-xl border transition-all ${
                  selected
                    ? `${cfg.activeBg} ${cfg.activeBorder}`
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Linha do item — clicável para selecionar */}
                <button
                  type="button"
                  onClick={() => toggle(item)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  <div className={`w-5 h-5 rounded-md flex-shrink-0 border-2 flex items-center justify-center transition-all ${
                    selected
                      ? `bg-[#0B2447] border-[#0B2447]`
                      : 'bg-white border-slate-300'
                  }`}>
                    {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                  <span className={`flex-1 text-sm font-medium truncate ${selected ? cfg.activeText : 'text-slate-700'}`}>
                    {item.descricao}
                  </span>
                  <span className="text-xs font-semibold text-slate-400 whitespace-nowrap ml-2">
                    padrão: {fmtBRL(item.valor)}
                  </span>
                </button>

                {/* Campo de valor customizado — só aparece quando selecionado */}
                {selected && (
                  <div className="px-4 pb-3 flex items-center gap-3">
                    <div className="w-5 flex-shrink-0" /> {/* alinha com o checkbox */}
                    <div className="flex items-center gap-2 flex-1">
                      <label className="text-xs text-slate-500 whitespace-nowrap">
                        Valor neste roteiro:
                      </label>
                      <div className="relative max-w-[160px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">R$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder={String(item.valor)}
                          value={getValor(item.id)}
                          onChange={e => setValor(item.id, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className={`${inputCls} pl-8 py-1.5 text-xs`}
                        />
                      </div>
                      {getValor(item.id) !== String(item.valor) && getValor(item.id) !== '' && (
                        <button
                          type="button"
                          onClick={() => setValor(item.id, String(item.valor))}
                          className="text-[10px] text-slate-400 hover:text-slate-600 underline whitespace-nowrap transition-colors"
                        >
                          Restaurar padrão
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderGroup(produtos, 'produto')}
      {renderGroup(servicos, 'servico')}

      {selecionados.length > 0 && (
        <p className="text-xs text-slate-400 pt-1">
          {selecionados.length} {selecionados.length === 1 ? 'item selecionado' : 'itens selecionados'}.
          O valor pode ser personalizado por roteiro; deixe igual ao padrão para manter o preço do catálogo.
        </p>
      )}
    </div>
  );
}
