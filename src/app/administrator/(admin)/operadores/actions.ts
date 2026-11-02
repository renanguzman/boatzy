'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { apagarFotoPerfil } from '@/lib/operador';
import { ehUuid } from '@/lib/upload-imagem-server';
import { notificarGestorDecisaoPerfil } from '@/lib/emails/operador-perfil';
import type { DecisaoPerfil } from '@/lib/operador-tipos';

/**
 * Perfil do operador — decisão do admin (SPEC §99). A mudança de status acontece na função SQL
 * `decidir_operador_perfil`; aqui ficam a autorização (o layout não protege Server Actions) e os
 * efeitos de fora do banco: foto antiga no R2, e-mail + aviso no sino do gestor e o cache.
 */

export type DecidirPerfilEntrada = {
  ownerId: string;
  decisao: DecisaoPerfil;
  /** Visível ao gestor (obrigatória ao devolver ou retirar do ar). */
  observacao: string;
  /** Só a equipe vê. */
  observacaoInterna: string;
  /** `updated_at` que o admin viu: se o gestor mexeu enquanto isso, a decisão é recusada. */
  versao: string;
};

export type DecidirPerfilResultado = { ok: true; status: string } | { ok: false; error: string };

const ERROS_DO_BANCO: Record<string, string> = {
  apenas_admin: 'Acesso não autorizado.',
  perfil_inexistente: 'Este operador ainda não tem perfil.',
  perfil_desatualizado: 'O gestor alterou o perfil enquanto você analisava. Recarregue a página e revise de novo.',
  perfil_fora_de_analise: 'Este perfil não está mais em análise. Recarregue a página.',
  perfil_incompleto: 'O perfil está incompleto e não pode ser publicado.',
  perfil_nao_publicado: 'Não há versão no ar para retirar.',
  perfil_nao_retirado: 'Este perfil não está retirado do ar.',
  observacao_obrigatoria: 'Escreva a observação para o gestor.',
};

export async function decidirPerfilOperador(entrada: DecidirPerfilEntrada): Promise<DecidirPerfilResultado> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };
  if (!(await checkRoleInDb(user.id, ['admin']))) return { ok: false, error: 'Acesso não autorizado.' };
  if (!ehUuid(entrada.ownerId)) return { ok: false, error: 'Operador inválido.' };

  const observacao = entrada.observacao.trim().slice(0, 1000);
  const interna = entrada.observacaoInterna.trim().slice(0, 1000);

  const { data, error } = await supabaseAdmin.rpc('decidir_operador_perfil', {
    p_owner: entrada.ownerId,
    p_decisao: entrada.decisao,
    p_admin_id: user.id,
    p_observacao: observacao || null,
    p_observacao_interna: interna || null,
    p_versao: entrada.versao,
  });
  if (error || !data) {
    const chave = Object.keys(ERROS_DO_BANCO).find((k) => error?.message?.includes(k));
    if (!chave) console.error('[operadores] falha ao decidir o perfil:', error);
    return { ok: false, error: chave ? ERROS_DO_BANCO[chave] : 'Não foi possível registrar a decisão. Tente novamente.' };
  }

  // Foto que saiu de uso e aviso ao gestor — depois da resposta (a observação interna nunca vai).
  after(async () => {
    await apagarFotoPerfil(entrada.ownerId, data.foto_antiga);
    await notificarGestorDecisaoPerfil({
      ownerId: entrada.ownerId, decisao: entrada.decisao, observacao: observacao || null, revisao: data.revisao,
    });
  });

  revalidatePath('/administrator/operadores');
  revalidatePath(`/administrator/operadores/${entrada.ownerId}`);
  revalidatePath('/administrator');
  revalidatePath('/painel');
  revalidatePath('/painel/perfil');
  revalidatePath(`/operadores/${entrada.ownerId}`);
  return { ok: true, status: data.status };
}
