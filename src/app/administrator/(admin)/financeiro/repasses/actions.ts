'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { registrarAuditoria } from '@/lib/financeiro/auditoria';
import { ehUuid } from '@/lib/upload-imagem-server';
import { apagarArquivoDocumento } from '@/lib/documentos/arquivo-server';
import { keyDoComprovanteValida } from '@/lib/repasses/comprovante-server';
import { notificarGestorRepasse } from '@/lib/emails/repasse';
import { METODO_REPASSE, METODOS_REPASSE } from '@/lib/repasses/rotulos';
import { resumoDestino } from '@/lib/recebimento-tipos';
import { formatarData, formatarHora } from '@/lib/datas';
import { carregarRepasses, lerFiltros } from './_lib/consulta';
import type { RepasseMetodo } from '@/types/supabase';

/**
 * Ações do admin em Financeiro → Repasses (SPEC §101). O pagamento em si acontece fora (Pix/TED
 * pelo banco); aqui se REGISTRA: lote + itens + lançamento contábil, de forma atômica (funções SQL
 * `registrar_repasse` / `cancelar_repasse`). Toda ação grava `financeiro_auditoria`.
 */

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function requireAdmin(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };
  if (!(await checkRoleInDb(user.id, ['admin']))) return { ok: false, error: 'Acesso não autorizado.' };
  return { ok: true, userId: user.id };
}

const ERROS_DO_BANCO: Record<string, string> = {
  gestor_sem_recebimento: 'Este gestor ainda não informou onde receber. Peça para ele preencher “Recebimentos” no painel.',
  pedido_nao_liberado: 'Algum pedido não está mais liberado para repasse (já repassado, retido ou ainda no prazo). Atualize a tela e tente de novo.',
  sem_pedidos: 'Selecione ao menos um pedido.',
  data_futura: 'A data do pagamento não pode ser futura.',
  metodo_invalido: 'Meio de pagamento inválido.',
  apenas_admin: 'Acesso não autorizado.',
  motivo_obrigatorio: 'Informe o motivo (mínimo de 5 caracteres).',
  repasse_inexistente: 'Repasse não encontrado.',
  repasse_ja_cancelado: 'Este repasse já foi cancelado.',
};

function mensagemDoBanco(texto: string | undefined): string {
  const achado = Object.keys(ERROS_DO_BANCO).find((k) => texto?.includes(k));
  return achado ? ERROS_DO_BANCO[achado] : 'Não foi possível concluir agora. Tente novamente.';
}

function revalidar(repasseId?: string) {
  revalidatePath('/administrator/financeiro/repasses');
  if (repasseId) revalidatePath(`/administrator/financeiro/repasses/${repasseId}`);
  revalidatePath('/administrator/pedidos');
  revalidatePath('/painel/receitas');
  revalidatePath('/painel/receitas/repasses');
}

export type RegistrarRepasseEntrada = {
  /** Id que o repasse terá — o mesmo da pasta do comprovante enviado antes. */
  repasseId: string;
  gestorId: string;
  pedidoIds: string[];
  metodo: RepasseMetodo;
  /** ISO com fuso (o formulário envia o horário de Brasília). */
  pagoEm: string;
  referencia: string;
  observacao: string;
  comprovante: { key: string; nome: string } | null;
};

export async function registrarRepasse(
  e: RegistrarRepasseEntrada,
): Promise<Resultado<{ repasseId: string; numero: number; valorTotal: number }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const falhou = async (error: string) => {
    // O comprovante já subiu antes do registro; sem repasse, não deixa arquivo órfão.
    if (e.comprovante && ehUuid(e.gestorId) && ehUuid(e.repasseId) && keyDoComprovanteValida(e.comprovante.key, e.gestorId, e.repasseId)) {
      await apagarArquivoDocumento(e.comprovante.key);
    }
    return { ok: false as const, error };
  };

  if (!ehUuid(e.repasseId) || !ehUuid(e.gestorId) || !e.pedidoIds.length || !e.pedidoIds.every(ehUuid)) {
    return falhou('Dados do repasse inválidos. Atualize a tela e tente de novo.');
  }
  if (!METODOS_REPASSE.includes(e.metodo)) return falhou('Escolha o meio de pagamento.');
  const pagoEm = new Date(e.pagoEm);
  if (Number.isNaN(pagoEm.getTime())) return falhou('Informe a data e a hora do pagamento.');
  const referencia = e.referencia.trim();
  const observacao = e.observacao.trim();
  if (referencia.length > 120) return falhou('A referência bancária aceita até 120 caracteres.');
  if (observacao.length > 500) return falhou('A observação aceita até 500 caracteres.');
  if (e.comprovante && !keyDoComprovanteValida(e.comprovante.key, e.gestorId, e.repasseId)) {
    return falhou('Comprovante inválido. Envie o arquivo de novo.');
  }

  const { data, error } = await supabaseAdmin.rpc('registrar_repasse', {
    p_repasse_id: e.repasseId,
    p_gestor: e.gestorId,
    p_pedidos: e.pedidoIds,
    p_metodo: e.metodo,
    p_pago_em: pagoEm.toISOString(),
    p_referencia: referencia || null,
    p_observacao: observacao || null,
    p_admin: auth.userId,
    p_comprovante_key: e.comprovante?.key ?? null,
    p_comprovante_nome: e.comprovante?.nome.slice(0, 200) ?? null,
  });
  if (error || !data) {
    if (error && !Object.keys(ERROS_DO_BANCO).some((k) => error.message.includes(k))) console.error('[repasses] falha ao registrar:', error);
    return falhou(mensagemDoBanco(error?.message));
  }

  const { data: lote } = await supabaseAdmin.from('repasse').select('*').eq('id', e.repasseId).single();
  await registrarAuditoria({
    adminId: auth.userId,
    acao: 'repasse.registrar',
    entidade: 'repasse',
    entidadeId: e.repasseId,
    depois: {
      numero: data.numero, valor_total: data.valor_total, gestor_id: e.gestorId, metodo: e.metodo,
      pago_em: pagoEm.toISOString(), referencia: referencia || null, pedidos: e.pedidoIds, comprovante: !!e.comprovante,
    },
  });

  if (lote) {
    after(() => notificarGestorRepasse({
      gestorId: lote.gestor_id, repasseId: lote.id, numero: lote.numero, valorTotal: Number(lote.valor_total),
      pedidos: data.pedidos, metodo: lote.metodo, pagoEm: lote.pago_em, destino: lote.destino_snapshot,
      temComprovante: !!lote.comprovante_key,
    }));
  }

  revalidar(e.repasseId);
  return { ok: true, repasseId: e.repasseId, numero: data.numero, valorTotal: Number(data.valor_total) };
}

/** Anexa (ou troca) o comprovante de um repasse já registrado. */
export async function anexarComprovante(input: { repasseId: string; key: string; nome: string }): Promise<Resultado> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!ehUuid(input.repasseId)) return { ok: false, error: 'Repasse inválido.' };

  const { data: repasse } = await supabaseAdmin
    .from('repasse').select('gestor_id, status, comprovante_key, comprovante_nome').eq('id', input.repasseId).maybeSingle();
  if (!repasse) return { ok: false, error: 'Repasse não encontrado.' };
  if (!keyDoComprovanteValida(input.key, repasse.gestor_id, input.repasseId)) {
    await apagarArquivoDocumento(input.key);
    return { ok: false, error: 'Comprovante inválido. Envie o arquivo de novo.' };
  }

  const { error } = await supabaseAdmin
    .from('repasse')
    .update({ comprovante_key: input.key, comprovante_nome: input.nome.slice(0, 200) })
    .eq('id', input.repasseId);
  if (error) {
    console.error('[repasses] falha ao anexar comprovante:', error);
    await apagarArquivoDocumento(input.key);
    return { ok: false, error: 'Não foi possível anexar agora. Tente novamente.' };
  }
  if (repasse.comprovante_key && repasse.comprovante_key !== input.key) await apagarArquivoDocumento(repasse.comprovante_key);

  await registrarAuditoria({
    adminId: auth.userId, acao: 'repasse.comprovante', entidade: 'repasse', entidadeId: input.repasseId,
    antes: { comprovante: repasse.comprovante_nome }, depois: { comprovante: input.nome },
  });
  revalidar(input.repasseId);
  return { ok: true };
}

export async function cancelarRepasse(input: { repasseId: string; motivo: string }): Promise<Resultado> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!ehUuid(input.repasseId)) return { ok: false, error: 'Repasse inválido.' };
  const motivo = input.motivo.trim();
  if (motivo.length < 5) return { ok: false, error: ERROS_DO_BANCO.motivo_obrigatorio };

  const { data: antes } = await supabaseAdmin.from('repasse').select('numero, valor_total, gestor_id, status').eq('id', input.repasseId).maybeSingle();
  const { error } = await supabaseAdmin.rpc('cancelar_repasse', { p_repasse: input.repasseId, p_admin: auth.userId, p_motivo: motivo });
  if (error) {
    if (!Object.keys(ERROS_DO_BANCO).some((k) => error.message.includes(k))) console.error('[repasses] falha ao cancelar:', error);
    return { ok: false, error: mensagemDoBanco(error.message) };
  }

  await registrarAuditoria({
    adminId: auth.userId, acao: 'repasse.cancelar', entidade: 'repasse', entidadeId: input.repasseId,
    antes, depois: { status: 'cancelado' }, motivo,
  });
  revalidar(input.repasseId);
  return { ok: true };
}

/** Linhas planas dos repasses (mesmos filtros da tela) para planilha. */
export async function exportarRepasses(
  querystring: string,
): Promise<{ ok: true; linhas: Record<string, string | number>[] } | { ok: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const filtros = lerFiltros(Object.fromEntries(new URLSearchParams(querystring)));
  const { linhas } = await carregarRepasses(filtros, false);
  return {
    ok: true,
    linhas: linhas.map((r) => ({
      Repasse: r.numero,
      Situação: r.status === 'pago' ? 'Pago' : 'Cancelado',
      'Data do pagamento': formatarData(r.pago_em),
      'Hora (Brasília)': formatarHora(r.pago_em),
      Gestor: r.gestor_nome,
      'CPF/CNPJ do gestor': r.destino_snapshot.gestor_documento ?? r.gestor_documento ?? '',
      Meio: METODO_REPASSE[r.metodo],
      'Destino': resumoDestino(r.destino_snapshot),
      'Titular do destino': r.destino_snapshot.titular_nome,
      'CPF/CNPJ do titular': r.destino_snapshot.titular_documento,
      Referência: r.referencia ?? '',
      Pedidos: r.itens,
      'Valor (R$)': Number(r.valor_total),
      Comprovante: r.comprovante_key ? 'Anexado' : 'Pendente',
      Observação: r.observacao ?? '',
      'Cancelado em': r.cancelado_em ? formatarData(r.cancelado_em) : '',
      'Motivo do cancelamento': r.motivo_cancelamento ?? '',
    })),
  };
}
