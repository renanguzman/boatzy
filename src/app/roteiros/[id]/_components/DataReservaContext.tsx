'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

export type ModalidadeReserva = 'roteiro' | 'diaria';

/**
 * Escolhas do cliente na página do roteiro: data, flexibilidade (± dias,
 * informada ao gestor), modelo de cobrança e diárias (Por Diária — o calendário
 * do card de reserva destaca o período). Pré-preenchidas a partir da busca.
 */
type DataReservaValor = {
  data: string | null;
  flex: number;
  modalidade: ModalidadeReserva;
  diarias: number;
  setData: (data: string | null) => void;
  setFlex: (flex: number) => void;
  setModalidade: (m: ModalidadeReserva) => void;
  setDiarias: (n: number) => void;
};

const DataReservaContext = createContext<DataReservaValor | null>(null);

export function DataReservaProvider({
  children, dataInicial = null, flexInicial = 0, modalidadeInicial = 'roteiro', diariasIniciais = 1,
}: {
  children: ReactNode;
  /** Já validada contra o calendário (só dia disponível). */
  dataInicial?: string | null;
  flexInicial?: number;
  modalidadeInicial?: ModalidadeReserva;
  diariasIniciais?: number;
}) {
  const [data, setData] = useState<string | null>(dataInicial);
  const [flex, setFlex] = useState(flexInicial);
  const [modalidade, setModalidade] = useState<ModalidadeReserva>(modalidadeInicial);
  const [diarias, setDiarias] = useState(Math.max(1, diariasIniciais));
  return (
    <DataReservaContext.Provider value={{ data, flex, modalidade, diarias, setData, setFlex, setModalidade, setDiarias }}>
      {children}
    </DataReservaContext.Provider>
  );
}

export function useDataReserva(): DataReservaValor {
  const ctx = useContext(DataReservaContext);
  if (!ctx) throw new Error('useDataReserva deve ser usado dentro de DataReservaProvider');
  return ctx;
}
