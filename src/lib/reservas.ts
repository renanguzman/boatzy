import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import type { PrecoPessoaModoCapacidade, ReservaModalidadePreco } from '@/types/supabase';

/** Data de hoje (yyyy-mm-dd) no fuso do Brasil — evita concluir reservas "de hoje" à noite por causa do UTC. */
function hojeBrasil(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

/**
 * Transição automática (lazy) confirmada → concluída: reservas confirmadas cuja
 * data já passou viram 'concluida', habilitando a avaliação pelo cliente.
 * Chamada ao carregar /minhas-reservas e /painel/agendamentos — não há cron.
 */
export async function concluirReservasVencidas(): Promise<void> {
  const { error } = await supabaseAdmin
    .from('reserva')
    .update({ status: 'concluida' })
    .eq('status', 'confirmada')
    .lt('data_reserva', hojeBrasil());

  if (error) {
    console.error('[reservas] falha ao concluir reservas vencidas:', error);
  }
}

/**
 * Datas ('yyyy-mm-dd') com reserva CONFIRMADA que bloqueiam o calendário de
 * uma EMBARCAÇÃO — reserva direta dela OU via qualquer roteiro que a
 * utilize (reserva.embarcacao_id é preenchido nos dois casos, migration
 * 022). A embarcação é o recurso físico compartilhado entre vários
 * roteiros, por isso o bloqueio precisa valer para todos eles.
 */
export async function getDatasReservadasEmbarcacao(embarcacaoId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('reserva')
    .select('data_reserva')
    .eq('embarcacao_id', embarcacaoId)
    .eq('status', 'confirmada');

  if (error) {
    console.error('[reservas] falha ao buscar datas reservadas da embarcação:', error);
    return [];
  }
  return (data ?? []).map((r) => r.data_reserva);
}

/** Soma `dias` dias a uma data ISO ('yyyy-mm-dd'), devolvendo outra data ISO. */
export function somarDiasISO(inicio: string, dias: number): string {
  const d = new Date(`${inicio}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Expande um intervalo de datas ('yyyy-mm-dd', inclusive nas duas pontas) dia a dia. */
export function expandirIntervalo(inicio: string, fim: string): string[] {
  const datas: string[] = [];
  let atual = new Date(`${inicio}T12:00:00Z`);
  const limite = new Date(`${fim}T12:00:00Z`);
  while (atual.getTime() <= limite.getTime()) {
    datas.push(atual.toISOString().slice(0, 10));
    atual = new Date(atual.getTime() + 24 * 60 * 60 * 1000);
  }
  return datas;
}

export type DisponibilidadeRoteiro = {
  /**
   * Datas ('yyyy-mm-dd') indisponíveis para qualquer reserva exclusiva —
   * modelo Roteiro, Por Diária (todo o intervalo de diárias), Por Pessoa no
   * modo exclusivo, ou qualquer reserva confirmada de OUTRO roteiro que use
   * a mesma embarcação (recurso físico compartilhado).
   */
  datasExclusivasOcupadas: string[];
  /**
   * Vagas já ocupadas por data, apenas para reservas confirmadas do modelo
   * Por Pessoa DESTE roteiro quando ele opera em capacidade compartilhada
   * (várias reservas de clientes diferentes dividem a mesma data).
   */
  vagasPessoaOcupadas: Record<string, number>;
};

/**
 * Disponibilidade de um ROTEIRO nos 3 modelos de cobrança: combina as
 * reservas confirmadas do próprio roteiro (roteiro_id — protege o roteiro
 * mesmo sem embarcação vinculada, ou se ela mudou depois da confirmação, já
 * que reserva.embarcacao_id é um snapshot) com as da embarcação vinculada
 * ATUALMENTE (embarcacaoId deve vir do roteiro.embarcacao_id vigente).
 *
 * Uma reserva Por Pessoa deste roteiro só é tratada como "vaga compartilhada"
 * (soma em `vagasPessoaOcupadas` em vez de travar o dia) quando
 * `pessoaModoCapacidade` (config ATUAL do roteiro) é 'compartilhado' — toda
 * reserva de outro roteiro/modelo trava o dia inteiro (`datasExclusivasOcupadas`),
 * pois a embarcação é um recurso físico único.
 */
export async function getDisponibilidadeRoteiro(params: {
  roteiroId: string;
  embarcacaoId: string | null;
  pessoaModoCapacidade: PrecoPessoaModoCapacidade;
}): Promise<DisponibilidadeRoteiro> {
  const { roteiroId, embarcacaoId, pessoaModoCapacidade } = params;
  const condicoes = [`roteiro_id.eq.${roteiroId}`];
  if (embarcacaoId) condicoes.push(`embarcacao_id.eq.${embarcacaoId}`);

  const resultado: DisponibilidadeRoteiro = { datasExclusivasOcupadas: [], vagasPessoaOcupadas: {} };

  const { data, error } = await supabaseAdmin
    .from('reserva')
    .select('roteiro_id, data_reserva, data_fim_reserva, modalidade_preco, quantidade_pessoas')
    .eq('status', 'confirmada')
    .or(condicoes.join(','));

  if (error) {
    console.error('[reservas] falha ao buscar disponibilidade do roteiro:', error);
    return resultado;
  }

  const exclusivas = new Set<string>();

  for (const r of data ?? []) {
    const datas = expandirIntervalo(r.data_reserva, r.data_fim_reserva ?? r.data_reserva);
    const vagaCompartilhada =
      r.roteiro_id === roteiroId && r.modalidade_preco === 'pessoa' && pessoaModoCapacidade === 'compartilhado';

    if (vagaCompartilhada) {
      for (const d of datas) {
        resultado.vagasPessoaOcupadas[d] = (resultado.vagasPessoaOcupadas[d] ?? 0) + r.quantidade_pessoas;
      }
    } else {
      for (const d of datas) exclusivas.add(d);
    }
  }

  resultado.datasExclusivasOcupadas = [...exclusivas];
  return resultado;
}

/**
 * Verdadeiro se a reserva informada (ainda pendente) conflita com alguma
 * reserva CONFIRMADA já existente do roteiro/embarcação — usado ao
 * confirmar uma solicitação no painel (`/painel/agendamentos`). Considera o
 * intervalo inteiro (modelo Por Diária) e a capacidade compartilhada
 * (modelo Por Pessoa): duas reservas Por Pessoa da mesma data só conflitam
 * quando juntas ultrapassam `pessoaCapacidadeMaxima`.
 */
export async function haConflitoReservaRoteiro(params: {
  roteiroId: string;
  embarcacaoId: string | null;
  pessoaModoCapacidade: PrecoPessoaModoCapacidade;
  pessoaCapacidadeMaxima: number | null;
  modalidadePreco: ReservaModalidadePreco;
  dataReserva: string;
  dataFimReserva: string | null;
  quantidadePessoas: number;
}): Promise<boolean> {
  const disponibilidade = await getDisponibilidadeRoteiro({
    roteiroId: params.roteiroId,
    embarcacaoId: params.embarcacaoId,
    pessoaModoCapacidade: params.pessoaModoCapacidade,
  });

  const intervalo = expandirIntervalo(params.dataReserva, params.dataFimReserva ?? params.dataReserva);
  const exclusivas = new Set(disponibilidade.datasExclusivasOcupadas);

  if (intervalo.some((d) => exclusivas.has(d))) return true;

  if (params.modalidadePreco === 'pessoa' && params.pessoaModoCapacidade === 'compartilhado') {
    const maxima = params.pessoaCapacidadeMaxima ?? 0;
    return intervalo.some(
      (d) => (disponibilidade.vagasPessoaOcupadas[d] ?? 0) + params.quantidadePessoas > maxima,
    );
  }

  return false;
}
