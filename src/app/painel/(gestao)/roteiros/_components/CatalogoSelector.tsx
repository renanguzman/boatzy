'use client';

import { useState } from 'react';
import { ShoppingBag, Wrench, Check, Plus, X, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { criarCatalogo } from '../../catalogo/novo/actions';
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
  /** Chamado quando um novo item é criado pelo modal, para o form incluí-lo na listagem. */
  onCatalogoCriado: (item: CatalogoItem) => void;
};

/** Modal de cadastro rápido de item de catálogo, sem sair da página do roteiro. */
function NovoItemModal({ onClose, onCriado }: {
  onClose: () => void;
  onCriado: (item: CatalogoItem) => void;
}) {
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [tipo, setTipo] = useState<CatalogoTipo>('produto');
  const [erro, setErro] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setErro(null);
    setSubmitting(true);

    const result = await criarCatalogo({ descricao, valor, tipo });

    if (!result.ok) {
      setErro(result.error);
      setSubmitting(false);
      return;
    }

    onCriado({
      id: result.catalogoId,
      descricao: descricao.trim(),
      valor: parseFloat(valor),
      tipo,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-sm font-bold text-[#0B2447] tracking-wide uppercase">
            Novo item de catálogo
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Não usamos <form> aninhado: este modal é renderizado dentro do form do roteiro. */}
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Descrição<span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              autoFocus
              className={inputCls}
              placeholder="ex: Locação de equipamento de mergulho"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Tipo<span className="text-red-500 ml-0.5">*</span>
              </label>
              <select
                className={`${inputCls} appearance-none cursor-pointer`}
                value={tipo}
                onChange={e => setTipo(e.target.value as CatalogoTipo)}
              >
                <option value="produto">Produto</option>
                <option value="servico">Serviço</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Valor (R$)<span className="text-red-500 ml-0.5">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">R$</span>
                <input
                  className={`${inputCls} pl-10`}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={valor}
                  onChange={e => setValor(e.target.value)}
                />
              </div>
            </div>
          </div>

          {erro && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {erro}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !descricao.trim() || !valor}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold transition shadow-md shadow-[#0B2447]/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                : <><Plus className="w-4 h-4" /> Salvar item</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CatalogoSelector({ catalogo, selecionados, onChange, onCatalogoCriado }: Props) {
  const [modalAberto, setModalAberto] = useState(false);

  const produtos = catalogo.filter(c => c.tipo === 'produto');
  const servicos = catalogo.filter(c => c.tipo === 'servico');

  /** Cria o item e já o deixa marcado no roteiro com o valor padrão. */
  function handleCriado(item: CatalogoItem) {
    onCatalogoCriado(item);
    onChange([...selecionados, { catalogoId: item.id, valorCustomizado: String(item.valor) }]);
  }

  const botaoNovo = (
    <button
      type="button"
      onClick={() => setModalAberto(true)}
      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-slate-300 text-sm font-semibold text-slate-600 hover:border-[#0B2447] hover:text-[#0B2447] transition"
    >
      <Plus className="w-4 h-4" /> Cadastrar novo item
    </button>
  );

  const modal = modalAberto && (
    <NovoItemModal onClose={() => setModalAberto(false)} onCriado={handleCriado} />
  );

  if (catalogo.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-400 italic">
          Nenhum item cadastrado no catálogo. Cadastre um item abaixo para vinculá-lo a este roteiro.
        </p>
        {botaoNovo}
        {modal}
      </div>
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
        <div className="flex items-center gap-2 mb-2 px-0.5">
          <div className={`w-5 h-5 rounded-md flex items-center justify-center ${cfg.bg}`}>
            <Icon className={`w-3 h-3 ${cfg.text}`} />
          </div>
          <p className={`text-xs font-bold uppercase tracking-wider ${cfg.text}`}>
            {cfg.label}
          </p>
          <span className={`text-[10px] font-bold px-1.5 py-px rounded-full ${cfg.bg} ${cfg.text}`}>
            {itens.length}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {itens.map(item => {
            const selected = isSelected(item.id);
            const valorAtual = getValor(item.id);
            const isCustom = selected && valorAtual !== '' && valorAtual !== String(item.valor);

            return (
              <div
                key={item.id}
                title={item.descricao}
                className={`flex items-center gap-2 rounded-xl border pl-2.5 pr-2 py-2 transition-colors ${
                  selected
                    ? `${cfg.activeBg} ${cfg.activeBorder}`
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Checkbox + nome — clicável para selecionar */}
                <button
                  type="button"
                  onClick={() => toggle(item)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  <span className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                    selected ? 'bg-[#0B2447] border-[#0B2447]' : 'bg-white border-slate-300'
                  }`}>
                    {selected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                  </span>
                  <span className={`flex-1 min-w-0 truncate text-[13px] font-medium ${selected ? cfg.activeText : 'text-slate-700'}`}>
                    {item.descricao}
                  </span>
                </button>

                {/* Preço — padrão (texto) quando não selecionado, editável quando selecionado */}
                {selected ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium pointer-events-none">
                        R$
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={String(item.valor)}
                        value={valorAtual}
                        onChange={e => setValor(item.id, e.target.value)}
                        className="w-[84px] rounded-lg border border-slate-200 bg-white pl-6 pr-1.5 py-1 text-xs font-semibold text-slate-800
                          focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition"
                      />
                    </div>
                    {isCustom && (
                      <button
                        type="button"
                        onClick={() => setValor(item.id, String(item.valor))}
                        title="Restaurar valor padrão"
                        className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-[#0B2447] hover:bg-white transition-colors shrink-0"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap shrink-0">
                    {fmtBRL(item.valor)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {renderGroup(produtos, 'produto')}
      {renderGroup(servicos, 'servico')}

      {botaoNovo}
      {modal}

      {selecionados.length > 0 && (
        <p className="text-xs text-slate-400 pt-1">
          {selecionados.length} {selecionados.length === 1 ? 'item selecionado' : 'itens selecionados'}.
          O valor pode ser personalizado por roteiro; deixe igual ao padrão para manter o preço do catálogo.
        </p>
      )}
    </div>
  );
}
