'use client';

import { Calendar, X } from 'lucide-react';
import { STATUS_BADGE, STATUS_LABEL } from '../_lib/constants';
import { presetEsteAno, presetEsteMes, presetUltimos30Dias, presetUltimos6Meses } from '../_lib/periodo';
import type { Filtros } from '../_lib/types';
import type { ReservaStatus } from '@/types/supabase';

const TODOS_STATUS: ReservaStatus[] = ['pendente', 'confirmada', 'recusada', 'cancelada', 'concluida'];

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition';

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1.5">{children}</label>;
}

export default function FiltrosReceitas({
  filtros,
  onChange,
  embarcacoes,
  roteiros,
  clientes,
}: {
  filtros: Filtros;
  onChange: (novo: Filtros) => void;
  embarcacoes: { id: string; nome: string }[];
  roteiros: { id: string; nome: string }[];
  clientes: { id: string; name: string }[];
}) {
  function set<K extends keyof Filtros>(key: K, value: Filtros[K]) {
    onChange({ ...filtros, [key]: value });
  }

  function toggleStatus(status: ReservaStatus) {
    const ativo = filtros.status.includes(status);
    const novo = ativo ? filtros.status.filter((s) => s !== status) : [...filtros.status, status];
    set('status', novo);
  }

  function aplicarPreset(preset: { de: string; ate: string }) {
    onChange({ ...filtros, de: preset.de, ate: preset.ate });
  }

  function limparFiltros() {
    onChange({ ...filtros, embarcacaoId: '', roteiroId: '', clienteId: '' });
  }

  const temFiltroExtra = filtros.embarcacaoId || filtros.roteiroId || filtros.clienteId;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <Label>De</Label>
          <input type="date" value={filtros.de} onChange={(e) => set('de', e.target.value)} className={inputClass} />
        </div>
        <div>
          <Label>Até</Label>
          <input type="date" value={filtros.ate} onChange={(e) => set('ate', e.target.value)} className={inputClass} />
        </div>
        <div>
          <Label>Embarcação</Label>
          <select value={filtros.embarcacaoId} onChange={(e) => set('embarcacaoId', e.target.value)} className={inputClass}>
            <option value="">Todas</option>
            {embarcacoes.map((e) => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Roteiro</Label>
          <select value={filtros.roteiroId} onChange={(e) => set('roteiroId', e.target.value)} className={inputClass}>
            <option value="">Todos</option>
            {roteiros.map((r) => (
              <option key={r.id} value={r.id}>{r.nome}</option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <Label>Cliente</Label>
          <select value={filtros.clienteId} onChange={(e) => set('clienteId', e.target.value)} className={inputClass}>
            <option value="">Todos</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <Label>Status</Label>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {TODOS_STATUS.map((s) => {
              const ativo = filtros.status.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                    ativo ? STATUS_BADGE[s] : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1" />
          {[
            { label: 'Este mês', preset: presetEsteMes() },
            { label: 'Últimos 30 dias', preset: presetUltimos30Dias() },
            { label: 'Últimos 6 meses', preset: presetUltimos6Meses() },
            { label: 'Este ano', preset: presetEsteAno() },
          ].map(({ label, preset }) => (
            <button
              key={label}
              type="button"
              onClick={() => aplicarPreset(preset)}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-slate-500 bg-slate-50 hover:bg-slate-100 hover:text-[#0B2447] transition-colors"
            >
              {label}
            </button>
          ))}
        </div>

        {temFiltroExtra ? (
          <button
            type="button"
            onClick={limparFiltros}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Limpar embarcação/roteiro/cliente
          </button>
        ) : null}
      </div>
    </div>
  );
}
