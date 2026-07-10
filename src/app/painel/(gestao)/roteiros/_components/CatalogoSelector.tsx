'use client';

import { useState } from 'react';
import { ShoppingBag, Wrench, Check, Plus, X, Loader2, AlertCircle } from 'lucide-react';
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
