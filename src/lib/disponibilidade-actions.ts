'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { getFechamentosEmbarcacao, getOcupacaoRoteiro, type OcupacaoDia } from '@/lib/reservas';

/**
 * Disponibilidade do calendário do roteiro (etapa "Preço e disponibilidade"):
 * dias fechados/abertos do roteiro e dias em que o barco inteiro foi fechado.
 * Usadas pelo cadastro e pela edição (gestor dono ou admin).
 */

type Resultado = { ok: boolean; error?: string };

async function usuarioAtual(): Promise<{ id: string; isAdmin: boolean } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, isAdmin: await checkRoleInDb(user.id, ['admin']) };
}

async function podeGerenciar(tabela: 'roteiro' | 'embarcacao', id: string): Promise<boolean> {
  const usuario = await usuarioAtual();
  if (!usuario) return false;
  let query = supabaseAdmin.from(tabela).select('id').eq('id', id);
  if (!usuario.isAdmin) query = query.eq('owner_id', usuario.id);
  const { data } = await query.maybeSingle();
  return data != null;
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Substitui as exceções de disponibilidade do roteiro: data → false (dia
 * fechado) ou true (dia aberto fora dos dias de operação).
 */
export async function salvarDisponibilidadeRoteiro(
  roteiroId: string,
  dias: Record<string, boolean>,
): Promise<Resultado> {
  if (!(await podeGerenciar('roteiro', roteiroId))) return { ok: false, error: 'Roteiro não encontrado ou sem permissão.' };

  const linhas = Object.entries(dias)
    .filter(([data]) => DATA_ISO.test(data))
    .map(([data, disponivel]) => ({ roteiro_id: roteiroId, data, disponivel }));

  const { error: erroApagar } = await supabaseAdmin
    .from('roteiro_disponibilidade_dia')
    .delete()
    .eq('roteiro_id', roteiroId);
  if (erroApagar) return { ok: false, error: erroApagar.message };

  if (linhas.length === 0) return { ok: true };
  const { error } = await supabaseAdmin.from('roteiro_disponibilidade_dia').insert(linhas);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Fecha/reabre o barco inteiro (todos os roteiros dele) nas datas informadas.
 * Grava só a diferença — outro roteiro do mesmo barco pode ter fechado dias
 * enquanto este formulário estava aberto.
 */
export async function salvarFechamentosEmbarcacao(
  embarcacaoId: string,
  adicionar: string[],
  remover: string[],
): Promise<Resultado> {
  if (!(await podeGerenciar('embarcacao', embarcacaoId))) return { ok: false, error: 'Embarcação não encontrada ou sem permissão.' };

  const novas = adicionar.filter(d => DATA_ISO.test(d));
  const removidas = remover.filter(d => DATA_ISO.test(d));

  if (removidas.length > 0) {
    const { error } = await supabaseAdmin
      .from('embarcacao_disponibilidade_bloqueio')
      .delete()
      .eq('embarcacao_id', embarcacaoId)
      .in('data', removidas);
    if (error) return { ok: false, error: error.message };
  }
  if (novas.length > 0) {
    const { error } = await supabaseAdmin
      .from('embarcacao_disponibilidade_bloqueio')
      .upsert(novas.map(data => ({ embarcacao_id: embarcacaoId, data })), {
        onConflict: 'embarcacao_id,data',
        ignoreDuplicates: true,
      });
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Agenda do barco para o calendário do roteiro quando o gestor escolhe (ou
 * troca) a embarcação no formulário: reservas que ocupam o barco e dias em
 * que ele foi fechado.
 */
export async function carregarAgendaEmbarcacao(
  embarcacaoId: string,
  roteiroId: string | null,
): Promise<{ ocupacao: OcupacaoDia[]; fechamentosBarco: string[] } | null> {
  if (!(await podeGerenciar('embarcacao', embarcacaoId))) return null;
  const [ocupacao, fechamentosBarco] = await Promise.all([
    getOcupacaoRoteiro({ roteiroId, embarcacaoId }),
    getFechamentosEmbarcacao(embarcacaoId),
  ]);
  return { ocupacao, fechamentosBarco };
}
