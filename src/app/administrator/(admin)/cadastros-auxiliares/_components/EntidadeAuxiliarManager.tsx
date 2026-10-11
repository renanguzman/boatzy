'use client';

import { useMemo, useState, useTransition } from 'react';
import { Check, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

export type ItemAuxiliar = { id: string; nome: string };

type Props = {
  titulo: string;
  itens: ItemAuxiliar[];
  icon: React.ElementType;
  placeholderNovo: string;
  onCriar: (nome: string) => Promise<{ ok: boolean; error?: string }>;
  onAtualizar: (id: string, nome: string) => Promise<{ ok: boolean; error?: string }>;
  /** Sem `confirmado`, retorna `error: 'EM_USO'` + `vinculos` se o item estiver em uso. */
  onExcluir: (id: string, confirmado?: boolean) => Promise<{ ok: boolean; error?: string; vinculos?: number }>;
  /** Chamado após qualquer mutação bem-sucedida, para a página recarregar os dados do servidor. */
  onRefresh: () => void;
};

/**
 * CRUD simples (id + nome) para um catálogo auxiliar — reutilizado para
 * Acessórios, Comodidades e Equipamentos de Segurança em `/administrator/cadastros-auxiliares`.
 * Lista com busca local, adição inline, edição inline e exclusão com aviso
 * de vínculos existentes (a ligação com embarcação é `ON DELETE CASCADE`).
 */
export default function EntidadeAuxiliarManager({
  titulo, itens, icon: Icon, placeholderNovo, onCriar, onAtualizar, onExcluir, onRefresh,
}: Props) {
  const [busca, setBusca] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoNome, setEditandoNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | 'novo' | null>(null);
  const [, startTransition] = useTransition();

  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const base = termo ? itens.filter((i) => i.nome.toLowerCase().includes(termo)) : itens;
    return [...base].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [itens, busca]);

  function handleCriar() {
    const nome = novoNome.trim();
    if (!nome || pendingId) return;
    setErro(null);
    setPendingId('novo');
    startTransition(async () => {
      const result = await onCriar(nome);
      setPendingId(null);
      if (result.ok) {
        setNovoNome('');
        onRefresh();
      } else {
        setErro(result.error ?? 'Erro ao criar.');
      }
    });
  }

  function iniciarEdicao(item: ItemAuxiliar) {
    setEditandoId(item.id);
    setEditandoNome(item.nome);
    setErro(null);
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setEditandoNome('');
  }

  function handleSalvarEdicao(id: string) {
    const nome = editandoNome.trim();
    if (!nome || pendingId) return;
    setErro(null);
    setPendingId(id);
    startTransition(async () => {
      const result = await onAtualizar(id, nome);
      setPendingId(null);
      if (result.ok) {
        cancelarEdicao();
        onRefresh();
      } else {
        setErro(result.error ?? 'Erro ao salvar.');
      }
    });
  }

  function handleExcluir(item: ItemAuxiliar) {
    if (pendingId) return;
    setErro(null);
    setPendingId(item.id);
    startTransition(async () => {
      const result = await onExcluir(item.id, false);
      if (result.ok) {
        setPendingId(null);
        onRefresh();
        return;
      }
      if (result.error === 'EM_USO') {
        const n = result.vinculos ?? 0;
        const confirma = confirm(
          `"${item.nome}" está vinculado a ${n} embarcação${n === 1 ? '' : 'ões'}. Excluir também remove esse vínculo. Esta ação não pode ser desfeita. Continuar?`,
        );
        if (!confirma) {
          setPendingId(null);
          return;
        }
        const result2 = await onExcluir(item.id, true);
        setPendingId(null);
        if (result2.ok) onRefresh();
        else setErro(result2.error ?? 'Erro ao excluir.');
        return;
      }
      setPendingId(null);
      setErro(result.error ?? 'Erro ao excluir.');
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <Icon className="w-4 h-4 text-[#0B2447]" />
        <h2 className="text-sm font-bold text-[#0B2447] tracking-wide uppercase">{titulo}</h2>
        <span className="ml-auto text-xs text-slate-400">{itens.length} cadastrado{itens.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="p-6 space-y-4">
        {erro && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-600">
            {erro}
          </div>
        )}

        {/* Adicionar novo */}
        <div className="flex items-center gap-2">
          <input
            className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800
              placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition"
            placeholder={placeholderNovo}
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCriar(); } }}
          />
          <button
            type="button"
            onClick={handleCriar}
            disabled={!novoNome.trim() || pendingId === 'novo'}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold
              transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {pendingId === 'novo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Adicionar
          </button>
        </div>

        {/* Busca local */}
        {itens.length > 6 && (
          <label className="relative block">
            <span className="sr-only">Buscar</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar na lista…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-4 py-2 text-sm text-slate-800
                placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:bg-white transition"
            />
          </label>
        )}

        {/* Lista */}
        {itensFiltrados.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">
            {busca ? 'Nenhum item encontrado.' : 'Nenhum item cadastrado ainda.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-50 -mx-2">
            {itensFiltrados.map((item) => {
              const isEditando = editandoId === item.id;
              const isPending = pendingId === item.id;
              return (
                <li key={item.id} className="flex items-center gap-2 px-2 py-2">
                  {isEditando ? (
                    <>
                      <input
                        autoFocus
                        className="flex-1 rounded-lg border border-[#0B2447]/30 px-3 py-1.5 text-sm text-slate-800
                          focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20"
                        value={editandoNome}
                        onChange={(e) => setEditandoNome(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); handleSalvarEdicao(item.id); }
                          if (e.key === 'Escape') cancelarEdicao();
                        }}
                      />
                      <button
                        type="button"
                        title="Salvar"
                        disabled={!editandoNome.trim() || isPending}
                        onClick={() => handleSalvarEdicao(item.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40"
                      >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        title="Cancelar"
                        onClick={cancelarEdicao}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-slate-700">{item.nome}</span>
                      <button
                        type="button"
                        title="Editar"
                        disabled={!!pendingId}
                        onClick={() => iniciarEdicao(item)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#0B2447] hover:bg-slate-100 transition-colors disabled:opacity-40"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Excluir"
                        disabled={!!pendingId}
                        onClick={() => handleExcluir(item)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                      >
                        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
