import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import type { AtendenteOption } from '@/lib/equipe-types';

export type { AtendenteOption };

/**
 * Garante que exista a linha `is_gestor = true` do próprio gestor em
 * `equipe_membro` e devolve o seu id. É a opção "Você (gestor)" na hora de
 * confirmar uma reserva. Idempotente (índice único parcial owner_id WHERE
 * is_gestor). Herda nome/CPF/telefone de `users` quando disponíveis.
 */
export async function ensureGestorEquipeMembro(ownerId: string): Promise<string | null> {
  const { data: existente } = await supabaseAdmin
    .from('equipe_membro')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('is_gestor', true)
    .maybeSingle();

  if (existente) return existente.id;

  const { data: perfil } = await supabaseAdmin
    .from('users')
    .select('name, cpf_cnpj, phone')
    .eq('id', ownerId)
    .maybeSingle();

  const { data: criado, error } = await supabaseAdmin
    .from('equipe_membro')
    .insert({
      owner_id: ownerId,
      user_id: ownerId,
      is_gestor: true,
      nome_completo: perfil?.name?.trim() || 'Gestor',
      cpf: perfil?.cpf_cnpj ?? null,
      telefone: perfil?.phone ?? null,
      ativo: true,
    })
    .select('id')
    .single();

  if (error) {
    // Corrida: outra requisição criou a linha ao mesmo tempo — relê.
    const { data: rec } = await supabaseAdmin
      .from('equipe_membro')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('is_gestor', true)
      .maybeSingle();
    if (rec) return rec.id;
    console.error('[equipe] falha ao criar linha do gestor:', error);
    return null;
  }

  return criado.id;
}

/**
 * Descobre a embarcação "vigente" de uma reserva:
 *  - tipo 'embarcacao' → a própria reserva.embarcacao_id;
 *  - tipo 'roteiro'    → a embarcação vinculada ao roteiro AGORA
 *    (mesma regra usada na checagem de conflito de datas), com
 *    fallback para o snapshot em reserva.embarcacao_id.
 */
export function resolveEmbarcacaoIdDaReserva(r: {
  tipo: 'roteiro' | 'embarcacao';
  embarcacao_id: string | null;
  roteiro: { embarcacao_id: string | null } | null;
}): string | null {
  if (r.tipo === 'embarcacao') return r.embarcacao_id;
  return r.roteiro?.embarcacao_id ?? r.embarcacao_id;
}

/**
 * Opções de atendente para uma reserva: o próprio gestor ("Você (gestor)")
 * + membros ATIVOS vinculados à embarcação da reserva. Ordenado com o
 * gestor primeiro.
 */
export async function getAtendenteOptions(
  ownerId: string,
  embarcacaoId: string | null,
): Promise<AtendenteOption[]> {
  const gestorId = await ensureGestorEquipeMembro(ownerId);

  const opcoes: AtendenteOption[] = [];

  if (gestorId) {
    const { data: gestorRow } = await supabaseAdmin
      .from('equipe_membro')
      .select('id, nome_completo, foto_url, telefone')
      .eq('id', gestorId)
      .single();
    if (gestorRow) {
      opcoes.push({
        id: gestorRow.id,
        nome_completo: gestorRow.nome_completo,
        foto_url: gestorRow.foto_url,
        telefone: gestorRow.telefone,
        is_gestor: true,
      });
    }
  }

  if (embarcacaoId) {
    const { data: vinculos } = await supabaseAdmin
      .from('equipe_membro_embarcacao')
      .select('equipe_membro ( id, nome_completo, foto_url, telefone, ativo, owner_id, is_gestor )')
      .eq('embarcacao_id', embarcacaoId);

    type VinculoRow = {
      equipe_membro: {
        id: string;
        nome_completo: string;
        foto_url: string | null;
        telefone: string | null;
        ativo: boolean;
        owner_id: string;
        is_gestor: boolean;
      } | null;
    };

    for (const v of (vinculos ?? []) as unknown as VinculoRow[]) {
      const m = v.equipe_membro;
      if (!m || !m.ativo || m.is_gestor || m.owner_id !== ownerId) continue;
      opcoes.push({
        id: m.id,
        nome_completo: m.nome_completo,
        foto_url: m.foto_url,
        telefone: m.telefone,
        is_gestor: false,
      });
    }
  }

  return opcoes;
}

/**
 * Atendentes já indicados numa reserva (para exibir no painel e ao cliente).
 */
export async function getAtendentesDaReserva(reservaId: string): Promise<AtendenteOption[]> {
  const { data } = await supabaseAdmin
    .from('reserva_atendente')
    .select('equipe_membro ( id, nome_completo, foto_url, telefone, is_gestor )')
    .eq('reserva_id', reservaId);

  type Row = {
    equipe_membro: {
      id: string;
      nome_completo: string;
      foto_url: string | null;
      telefone: string | null;
      is_gestor: boolean;
    } | null;
  };

  return ((data ?? []) as unknown as Row[])
    .map((r) => r.equipe_membro)
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .map((m) => ({
      id: m.id,
      nome_completo: m.nome_completo,
      foto_url: m.foto_url,
      telefone: m.telefone,
      is_gestor: m.is_gestor,
    }))
    .sort((a, b) => Number(b.is_gestor) - Number(a.is_gestor));
}
