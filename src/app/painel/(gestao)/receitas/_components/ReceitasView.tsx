'use client';

import { useMemo, useState } from 'react';
import FiltrosReceitas from './FiltrosReceitas';
import ReceitasInsights from './ReceitasInsights';
import ReceitasGrid from './ReceitasGrid';
import { STATUS_RECEITA } from '../_lib/constants';
import { presetEsteMes, periodoAnterior, formatPeriodoLabel } from '../_lib/periodo';
import type { Filtros, ReservaReceita } from '../_lib/types';

export type { ReservaReceita };

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function sum(rows: ReservaReceita[]): number {
  return rows.reduce((acc, r) => acc + (r.total_estimado ?? 0), 0);
}

function uniqueEmbarcacoes(reservas: ReservaReceita[]): { id: string; nome: string }[] {
  const map = new Map<string, string>();
  for (const r of reservas) if (r.embarcacao) map.set(r.embarcacao.id, r.embarcacao.nome);
  return [...map.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
}

function uniqueRoteiros(reservas: ReservaReceita[]): { id: string; nome: string }[] {
  const map = new Map<string, string>();
  for (const r of reservas) if (r.roteiro) map.set(r.roteiro.id, r.roteiro.nome);
  return [...map.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
}

function uniqueClientes(reservas: ReservaReceita[]): { id: string; name: string }[] {
  const map = new Map<string, string>();
  for (const r of reservas) if (r.cliente) map.set(r.cliente.id, r.cliente.name);
  return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

function passaFiltrosBase(
  r: ReservaReceita,
  filtros: Pick<Filtros, 'embarcacaoId' | 'roteiroId' | 'clienteId'>,
): boolean {
  if (filtros.embarcacaoId && r.embarcacao?.id !== filtros.embarcacaoId) return false;
  if (filtros.roteiroId && r.roteiro?.id !== filtros.roteiroId) return false;
  if (filtros.clienteId && r.cliente?.id !== filtros.clienteId) return false;
  return true;
}

export default function ReceitasView({ reservas }: { reservas: ReservaReceita[] }) {
  const [filtros, setFiltros] = useState<Filtros>(() => ({
    ...presetEsteMes(),
    embarcacaoId: '',
    roteiroId: '',
    clienteId: '',
    status: [...STATUS_RECEITA],
  }));

  const embarcacoes = useMemo(() => uniqueEmbarcacoes(reservas), [reservas]);
  const roteiros = useMemo(() => uniqueRoteiros(reservas), [reservas]);
  const clientes = useMemo(() => uniqueClientes(reservas), [reservas]);

  // Filtro unificado — alimenta KPIs, gráficos e o grid, sempre em sincronia.
  const filtered = useMemo(() => {
    return reservas.filter((r) => {
      if (r.data_reserva < filtros.de || r.data_reserva > filtros.ate) return false;
      if (!passaFiltrosBase(r, filtros)) return false;
      if (filtros.status.length > 0 && !filtros.status.includes(r.status)) return false;
      return true;
    });
  }, [reservas, filtros]);

  const kpis = useMemo(() => {
    const receita = sum(filtered);
    const totalReservas = filtered.length;
    const ticketMedio = totalReservas > 0 ? receita / totalReservas : 0;

    // Valor pendente: informativo, sempre relativo a 'pendente' — independe do
    // filtro de status escolhido, para o gestor não perder essa visão.
    const pendentes = reservas.filter(
      (r) =>
        r.status === 'pendente' &&
        r.data_reserva >= filtros.de &&
        r.data_reserva <= filtros.ate &&
        passaFiltrosBase(r, filtros),
    );
    const valorPendente = sum(pendentes);

    // Período anterior: mesma duração, mesmos filtros de embarcação/roteiro/cliente/status.
    const anterior = periodoAnterior(filtros.de, filtros.ate);
    const receitaAnteriorRows = reservas.filter(
      (r) =>
        r.data_reserva >= anterior.de &&
        r.data_reserva <= anterior.ate &&
        passaFiltrosBase(r, filtros) &&
        (filtros.status.length === 0 || filtros.status.includes(r.status)),
    );
    const receitaAnterior = sum(receitaAnteriorRows);
    const variacaoPct = receitaAnterior > 0 ? ((receita - receitaAnterior) / receitaAnterior) * 100 : null;

    return { receita, receitaAnterior, variacaoPct, ticketMedio, totalReservas, valorPendente };
  }, [filtered, reservas, filtros]);

  const tendenciaMensal = useMemo(() => {
    const somaPorMes = new Map<string, number>();
    for (const r of filtered) {
      const key = r.data_reserva.slice(0, 7);
      somaPorMes.set(key, (somaPorMes.get(key) ?? 0) + (r.total_estimado ?? 0));
    }
    const inicio = new Date(`${filtros.de}T12:00:00`);
    const fim = new Date(`${filtros.ate}T12:00:00`);
    const meses: { mes: string; valor: number }[] = [];
    const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
    const limite = new Date(fim.getFullYear(), fim.getMonth(), 1);
    while (cursor <= limite && meses.length < 36) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      meses.push({
        mes: `${MESES_CURTOS[cursor.getMonth()]}/${String(cursor.getFullYear()).slice(2)}`,
        valor: somaPorMes.get(key) ?? 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return meses;
  }, [filtered, filtros.de, filtros.ate]);

  const porEmbarcacao = useMemo(() => {
    const map = new Map<string, { nome: string; valor: number }>();
    for (const r of filtered) {
      if (!r.embarcacao) continue;
      const cur = map.get(r.embarcacao.id) ?? { nome: r.embarcacao.nome, valor: 0 };
      cur.valor += r.total_estimado ?? 0;
      map.set(r.embarcacao.id, cur);
    }
    return [...map.values()].sort((a, b) => b.valor - a.valor).slice(0, 8);
  }, [filtered]);

  const porRoteiro = useMemo(() => {
    const map = new Map<string, { nome: string; valor: number }>();
    for (const r of filtered) {
      if (!r.roteiro) continue;
      const cur = map.get(r.roteiro.id) ?? { nome: r.roteiro.nome, valor: 0 };
      cur.valor += r.total_estimado ?? 0;
      map.set(r.roteiro.id, cur);
    }
    return [...map.values()].sort((a, b) => b.valor - a.valor).slice(0, 8);
  }, [filtered]);

  const topClientes = useMemo(() => {
    const map = new Map<string, { nome: string; valor: number; reservas: number }>();
    for (const r of filtered) {
      if (!r.cliente) continue;
      const cur = map.get(r.cliente.id) ?? { nome: r.cliente.name, valor: 0, reservas: 0 };
      cur.valor += r.total_estimado ?? 0;
      cur.reservas += 1;
      map.set(r.cliente.id, cur);
    }
    return [...map.values()].sort((a, b) => b.valor - a.valor).slice(0, 8);
  }, [filtered]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B2447]">Receitas</h1>
        <p className="text-sm text-slate-500 mt-1">
          Visão financeira das suas reservas — filtre por período, embarcação, roteiro ou cliente.
        </p>
      </div>

      <FiltrosReceitas
        filtros={filtros}
        onChange={setFiltros}
        embarcacoes={embarcacoes}
        roteiros={roteiros}
        clientes={clientes}
      />

      <ReceitasInsights
        kpis={kpis}
        tendenciaMensal={tendenciaMensal}
        porEmbarcacao={porEmbarcacao}
        porRoteiro={porRoteiro}
        topClientes={topClientes}
      />

      <ReceitasGrid
        reservas={filtered}
        periodoLabel={formatPeriodoLabel(filtros.de, filtros.ate)}
        totalReceita={kpis.receita}
      />
    </div>
  );
}
