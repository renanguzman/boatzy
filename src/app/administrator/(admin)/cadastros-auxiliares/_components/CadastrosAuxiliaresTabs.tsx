'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Sparkles, Waves } from 'lucide-react';
import EntidadeAuxiliarManager, { type ItemAuxiliar } from './EntidadeAuxiliarManager';
import {
  criarAcessorio, atualizarAcessorio, excluirAcessorio,
  criarComodidade, atualizarComodidade, excluirComodidade,
  criarEquipamentoSeguranca, atualizarEquipamentoSeguranca, excluirEquipamentoSeguranca,
} from '../actions';

type Aba = 'acessorios' | 'comodidades' | 'equipamentos';

const ABAS: { id: Aba; label: string; icon: React.ElementType }[] = [
  { id: 'acessorios', label: 'Acessórios', icon: Waves },
  { id: 'comodidades', label: 'Comodidades', icon: Sparkles },
  { id: 'equipamentos', label: 'Equipamentos de Segurança', icon: ShieldCheck },
];

type Props = {
  acessorios: ItemAuxiliar[];
  comodidades: ItemAuxiliar[];
  equipamentosSeguranca: ItemAuxiliar[];
};

/**
 * Painel com 3 abas — um `EntidadeAuxiliarManager` por catálogo auxiliar da
 * embarcação. Os dados vêm do servidor (page.tsx); após qualquer mutação, a
 * aba chama `router.refresh()` para buscar a lista atualizada.
 */
export default function CadastrosAuxiliaresTabs({ acessorios, comodidades, equipamentosSeguranca }: Props) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>('acessorios');

  function onRefresh() {
    router.refresh();
  }

  return (
    <div>
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6 w-fit">
        {ABAS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              aba === id ? 'bg-white text-[#0B2447] shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {aba === 'acessorios' && (
        <EntidadeAuxiliarManager
          titulo="Acessórios"
          itens={acessorios}
          icon={Waves}
          placeholderNovo="ex: Caiaque"
          onCriar={criarAcessorio}
          onAtualizar={atualizarAcessorio}
          onExcluir={excluirAcessorio}
          onRefresh={onRefresh}
        />
      )}
      {aba === 'comodidades' && (
        <EntidadeAuxiliarManager
          titulo="Comodidades"
          itens={comodidades}
          icon={Sparkles}
          placeholderNovo="ex: Ar-Condicionado"
          onCriar={criarComodidade}
          onAtualizar={atualizarComodidade}
          onExcluir={excluirComodidade}
          onRefresh={onRefresh}
        />
      )}
      {aba === 'equipamentos' && (
        <EntidadeAuxiliarManager
          titulo="Equipamentos de Segurança"
          itens={equipamentosSeguranca}
          icon={ShieldCheck}
          placeholderNovo="ex: Colete Salva-Vidas"
          onCriar={criarEquipamentoSeguranca}
          onAtualizar={atualizarEquipamentoSeguranca}
          onExcluir={excluirEquipamentoSeguranca}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
