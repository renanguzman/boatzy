'use client';

import { ArrowDown } from 'lucide-react';
import { formatarData } from '@/lib/datas';
import type { CalendarioCliente } from '@/lib/disponibilidade';
import CalendarioReserva from './CalendarioReserva';
import { useDataReserva } from './DataReservaContext';

/**
 * Seção "Disponibilidade e preços" da página do roteiro: o calendário que o
 * gestor configura no painel, sempre à vista. Escolher um dia aqui preenche o
 * card de reserva (DataReservaContext). No modelo Roteiro mostra o total por
 * dia; no Por Diária, o período das diárias escolhidas no card.
 */
export default function DisponibilidadeSecao({ calendario }: { calendario: CalendarioCliente }) {
  const { data, setData, modalidade, diarias } = useDataReserva();
  const temModeloRoteiro = modalidade === 'roteiro';
  const total = data ? calendario.dias.find(d => d.data === data)?.total ?? null : null;

  function irParaReserva() {
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('reservar')?.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <div className="mb-10" id="disponibilidade">
      <h2 className="text-xl font-bold text-[#0B2447] mb-1">Disponibilidade e preços</h2>
      <p className="text-sm text-slate-500 mb-4">
        {temModeloRoteiro
          ? 'Escolha o dia do passeio. Os valores já incluem a taxa de serviço.'
          : 'Escolha o dia de saída do passeio.'}
      </p>
      <div className="rounded-2xl border border-slate-200 p-4 sm:p-5">
        <CalendarioReserva
          calendario={calendario}
          selecionada={data}
          onSelecionar={setData}
          modalidade={modalidade}
          diarias={diarias}
        />
      </div>
      {data && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[#0B2447]/[0.04] px-4 py-3 lg:hidden">
          <p className="text-sm text-slate-700">
            <strong className="text-[#0B2447]">{formatarData(data, { weekday: 'short', day: '2-digit', month: 'short' })}</strong>
            {total != null && temModeloRoteiro && <> · {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</>}
          </p>
          <button type="button" onClick={irParaReserva}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B3D91] px-3 py-2 text-xs font-semibold text-white">
            Continuar a reserva <ArrowDown className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
