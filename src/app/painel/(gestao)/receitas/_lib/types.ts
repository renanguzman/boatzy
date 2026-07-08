import type { ReservaStatus, ReservaTipo } from '@/types/supabase';

export type ReservaReceita = {
  id: string;
  tipo: ReservaTipo;
  data_reserva: string;
  item_nome: string;
  quantidade_pessoas: number;
  preco_base: number | null;
  total_adicionais: number;
  taxa_servico: number | null;
  total_estimado: number | null;
  status: ReservaStatus;
  solicitado_em: string;
  cliente: { id: string; name: string } | null;
  roteiro: { id: string; nome: string } | null;
  embarcacao: { id: string; nome: string } | null;
};

export type Filtros = {
  de: string; // yyyy-mm-dd
  ate: string; // yyyy-mm-dd
  embarcacaoId: string; // '' = todas
  roteiroId: string; // '' = todos
  clienteId: string; // '' = todos
  status: ReservaStatus[];
};
