'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import type { CupomTipoDesconto } from '@/types/supabase';

type ActionResult = { ok: boolean; error?: string };

async function requireAdmin(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const isAdmin = await checkRoleInDb(user.id, ['admin']);
  if (!isAdmin) return { ok: false, error: 'Acesso não autorizado.' };

  return { ok: true };
}

export type CupomPayload = {
  codigo: string;
  descricao: string;
  tipoDesconto: CupomTipoDesconto;
  valor: string;
  valorDescontoMaximo: string;
  valorMinimoPedido: string;
  dataInicio: string;
  dataFim: string;
  limiteUsoTotal: string;
  limiteUsoPorCliente: string;
  ativo: boolean;
  parceiroId: string | null;
};

type CriarResult = { ok: true; cupomId: string } | { ok: false; error: string };

/** Normaliza o código: maiúsculas, sem espaços nas pontas nem no meio. */
function normalizarCodigo(codigo: string): string {
  return codigo.trim().toUpperCase().replace(/\s+/g, '');
}

/** Converte string do form em number|null, tratando vazio como "não informado". */
function paraNumero(v: string): number | null {
  if (!v || !v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function paraInteiro(v: string): number | null {
  if (!v || !v.trim()) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

/** Validação de negócio comum a criar/atualizar. Retorna mensagem de erro ou null. */
function validarPayload(payload: CupomPayload): string | null {
  const codigo = normalizarCodigo(payload.codigo);
  if (!codigo) return 'O código do cupom é obrigatório.';
  if (!/^[A-Z0-9_-]+$/.test(codigo)) {
    return 'O código só pode ter letras, números, "_" e "-" (sem espaços ou acentos).';
  }

  const valor = paraNumero(payload.valor);
  if (valor === null || valor <= 0) return 'O valor do desconto é obrigatório e deve ser maior que zero.';
  if (payload.tipoDesconto === 'percentual' && valor > 100) {
    return 'O desconto percentual não pode ser maior que 100%.';
  }

  const teto = paraNumero(payload.valorDescontoMaximo);
  if (teto !== null) {
    if (payload.tipoDesconto !== 'percentual') {
      return 'O teto de desconto só se aplica a cupons percentuais.';
    }
    if (teto <= 0) return 'O teto de desconto deve ser maior que zero.';
  }

  const minimo = paraNumero(payload.valorMinimoPedido);
  if (minimo !== null && minimo < 0) return 'O valor mínimo do pedido não pode ser negativo.';

  if (payload.dataInicio && payload.dataFim && payload.dataFim < payload.dataInicio) {
    return 'A data de término não pode ser anterior à data de início.';
  }

  const limiteTotal = paraInteiro(payload.limiteUsoTotal);
  if (limiteTotal !== null && limiteTotal < 1) return 'O limite de uso total deve ser de ao menos 1.';

  const limiteCliente = paraInteiro(payload.limiteUsoPorCliente);
  if (limiteCliente !== null && limiteCliente < 1) return 'O limite de uso por cliente deve ser de ao menos 1.';

  return null;
}

function montarRegistro(payload: CupomPayload) {
  return {
    codigo: normalizarCodigo(payload.codigo),
    descricao: payload.descricao.trim() || null,
    tipo_desconto: payload.tipoDesconto,
    // valor já foi validado como obrigatório em validarPayload (sempre chamada antes de montarRegistro).
    valor: Number(payload.valor),
    valor_desconto_maximo: paraNumero(payload.valorDescontoMaximo),
    valor_minimo_pedido: paraNumero(payload.valorMinimoPedido),
    data_inicio: payload.dataInicio || null,
    data_fim: payload.dataFim || null,
    limite_uso_total: paraInteiro(payload.limiteUsoTotal),
    limite_uso_por_cliente: paraInteiro(payload.limiteUsoPorCliente),
    ativo: payload.ativo,
    parceiro_id: payload.parceiroId || null,
  };
}

export async function criarCupom(payload: CupomPayload): Promise<CriarResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error! };

  const erroValidacao = validarPayload(payload);
  if (erroValidacao) return { ok: false, error: erroValidacao };

  const { data, error } = await supabaseAdmin
    .from('cupom')
    .insert(montarRegistro(payload))
    .select('id')
    .single();

  if (error || !data) {
    if (error?.code === '23505') return { ok: false, error: 'Já existe um cupom com esse código.' };
    return { ok: false, error: error?.message ?? 'Erro ao salvar cupom.' };
  }

  revalidatePath('/administrator/cupons');
  return { ok: true, cupomId: data.id };
}

export async function atualizarCupom(cupomId: string, payload: CupomPayload): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const erroValidacao = validarPayload(payload);
  if (erroValidacao) return { ok: false, error: erroValidacao };

  const { error } = await supabaseAdmin
    .from('cupom')
    .update(montarRegistro(payload))
    .eq('id', cupomId);

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Já existe um cupom com esse código.' };
    return { ok: false, error: error.message };
  }

  revalidatePath('/administrator/cupons');
  return { ok: true };
}

/**
 * Ativa ou pausa um cupom sem mexer na vigência por data — toggle direto
 * na lista, sem cascata (mesmo padrão de alternarStatusRoteiroAdmin).
 */
export async function alternarStatusCupom(cupomId: string, ativo: boolean): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await supabaseAdmin
    .from('cupom')
    .update({ ativo })
    .eq('id', cupomId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/administrator/cupons');
  return { ok: true };
}

/**
 * Exclusão definitiva — bloqueada se o cupom já tiver algum uso
 * registrado (rastreabilidade para o repasse ao parceiro). Cupons
 * usados devem ser desativados (alternarStatusCupom), não excluídos.
 * O FK `cupom_uso.cupom_id ... ON DELETE RESTRICT` é a rede de
 * segurança para o caso de corrida com um uso concorrente.
 */
export async function excluirCupom(cupomId: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { count } = await supabaseAdmin
    .from('cupom_uso')
    .select('id', { count: 'exact', head: true })
    .eq('cupom_id', cupomId);

  if ((count ?? 0) > 0) {
    return { ok: false, error: 'Este cupom já foi utilizado e não pode ser excluído — desative-o em vez disso.' };
  }

  const { error } = await supabaseAdmin.from('cupom').delete().eq('id', cupomId);

  if (error) {
    if (error.code === '23503') {
      return { ok: false, error: 'Este cupom já foi utilizado e não pode ser excluído — desative-o em vez disso.' };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath('/administrator/cupons');
  return { ok: true };
}

type CriarParceiroResult = { ok: true; parceiroId: string; nome: string } | { ok: false; error: string };

/** Cadastro rápido de parceiro a partir do formulário de cupom (sem tela própria ainda). */
export async function criarParceiro(nome: string): Promise<CriarParceiroResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error! };

  const nomeTratado = nome.trim();
  if (!nomeTratado) return { ok: false, error: 'O nome do parceiro é obrigatório.' };

  const { data, error } = await supabaseAdmin
    .from('parceiro')
    .insert({ nome: nomeTratado })
    .select('id, nome')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'Erro ao cadastrar parceiro.' };

  revalidatePath('/administrator/cupons');
  return { ok: true, parceiroId: data.id, nome: data.nome };
}
