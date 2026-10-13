'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { hojeISO } from '@/lib/datas';
import { notificarGestorDecisaoPublicacao } from '@/lib/emails/publicacao-decisao';
import { transicionarPublicacao } from './server';
import type { PublicacaoEntidade, StatusPublicacaoQualquer } from './config';

type ActionResult = { ok: true } | { ok: false; error: string };

const ENTIDADES: PublicacaoEntidade[] = ['embarcacao', 'roteiro', 'anuncio_venda'];

async function usuarioComPapel(papeis: ('gestor' | 'admin')[]): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Não autenticado.' };
  if (!(await checkRoleInDb(user.id, papeis))) return { error: 'Acesso não autorizado.' };
  return { userId: user.id };
}

/** Telas que mostram o status (painel, administrator e site público). */
function revalidarTelas(entidade: PublicacaoEntidade, id: string) {
  if (entidade === 'embarcacao') {
    revalidatePath('/painel/embarcacoes');
    revalidatePath(`/painel/embarcacoes/${id}/editar`);
    revalidatePath('/painel/roteiros'); // visibilidade dos roteiros depende da embarcação
    revalidatePath('/administrator/embarcacoes');
    revalidatePath(`/administrator/embarcacoes/${id}`);
    revalidatePath(`/embarcacoes/${id}`, 'layout');
  } else if (entidade === 'roteiro') {
    revalidatePath('/painel/roteiros');
    revalidatePath(`/painel/roteiros/${id}/editar`);
    revalidatePath('/administrator/roteiros');
    revalidatePath(`/administrator/roteiros/${id}`);
    revalidatePath(`/roteiros/${id}`, 'layout');
  } else {
    revalidatePath('/painel/vendas');
    revalidatePath(`/painel/vendas/${id}/editar`);
    revalidatePath('/administrator/vendas');
    revalidatePath(`/administrator/vendas/${id}`);
    revalidatePath(`/vendas/${id}`, 'layout');
  }
  revalidatePath('/administrator');
}

/**
 * Ações do dono do registro: reenviar/solicitar reativação (→ Em análise),
 * inativar, colocar em manutenção, pausar, marcar como vendido, cancelar.
 * A posse e a transição são validadas no banco.
 */
export async function alterarStatusPublicacao(
  entidade: PublicacaoEntidade,
  id: string,
  para: StatusPublicacaoQualquer,
  mensagem?: string,
): Promise<ActionResult> {
  if (!ENTIDADES.includes(entidade)) return { ok: false, error: 'Registro inválido.' };
  const auth = await usuarioComPapel(['gestor', 'admin']);
  if ('error' in auth) return { ok: false, error: auth.error };

  const r = await transicionarPublicacao({
    entidade, id, para, atorId: auth.userId, papel: 'gestor',
    // Mensagem opcional do gestor para a equipe ao (re)enviar para análise.
    observacao: para === 'em_analise' ? mensagem : null,
  });
  if (!r.ok) return r;

  revalidarTelas(entidade, id);
  return { ok: true };
}

export type DecisaoAdmin = 'aprovar' | 'devolver' | 'moderar';

/**
 * Decisões do administrator: aprovar (publica), devolver (Retorno, com
 * observação obrigatória) e moderar (tira do ar com observação: Inativo
 * para embarcação/roteiro, Pausado para anúncio). A observação vai para o
 * gestor (timeline + e-mail); a interna fica só para o admin.
 */
export async function decidirPublicacaoAdmin(input: {
  entidade: PublicacaoEntidade;
  id: string;
  decisao: DecisaoAdmin;
  observacao?: string;
  observacaoInterna?: string;
}): Promise<ActionResult> {
  if (!ENTIDADES.includes(input.entidade)) return { ok: false, error: 'Registro inválido.' };
  const auth = await usuarioComPapel(['admin']);
  if ('error' in auth) return { ok: false, error: auth.error };

  const para: StatusPublicacaoQualquer =
    input.decisao === 'aprovar' ? 'ativo'
    : input.decisao === 'devolver' ? 'retorno'
    : input.entidade === 'anuncio_venda' ? 'pausado' : 'inativo';

  const r = await transicionarPublicacao({
    entidade: input.entidade, id: input.id, para,
    atorId: auth.userId, papel: 'admin',
    observacao: input.observacao, observacaoInterna: input.observacaoInterna,
  });
  if (!r.ok) return r;

  if (r.tipo === 'aprovacao' || r.tipo === 'retorno' || r.tipo === 'moderacao') {
    const tipo = r.tipo;
    after(() => notificarGestorDecisaoPublicacao({
      entidade: input.entidade, id: input.id, tipo, observacao: input.observacao?.trim() || null,
    }));
  }

  revalidarTelas(input.entidade, input.id);
  return { ok: true };
}

/**
 * Reservas futuras ainda em aberto que envolvem o registro — o gestor é
 * avisado antes de tirá-lo do ar (as reservas continuam valendo).
 */
export async function contarReservasFuturas(
  entidade: Exclude<PublicacaoEntidade, 'anuncio_venda'>,
  id: string,
): Promise<number> {
  const auth = await usuarioComPapel(['gestor', 'admin']);
  if ('error' in auth) return 0;

  let filtro = entidade === 'roteiro' ? `roteiro_id.eq.${id}` : `embarcacao_id.eq.${id}`;
  if (entidade === 'embarcacao') {
    const { data: roteiros } = await supabaseAdmin.from('roteiro').select('id').eq('embarcacao_id', id);
    if (roteiros && roteiros.length > 0) filtro += `,roteiro_id.in.(${roteiros.map(r => r.id).join(',')})`;
  }

  const { count } = await supabaseAdmin
    .from('reserva')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', auth.userId)
    .or(filtro)
    .in('status', ['pendente', 'aguardando_pagamento', 'confirmada'])
    .gte('data_reserva', hojeISO());
  return count ?? 0;
}
