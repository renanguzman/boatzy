'use server';

import { createClient } from '@/lib/supabase/server';
import { checkRoleInDb } from '@/lib/roles';
import { formatarData } from '@/lib/datas';
import { METODO_REPASSE, SITUACAO_ADMIN } from '@/lib/repasses/rotulos';
import { carregarRepasses, lerFiltros as lerFiltrosRepasses } from '../repasses/_lib/consulta';
import {
  carregarBalancete, carregarDemonstrativo, detalhePedidosPeriodo, lerFiltros, razaoCompleto,
} from './_lib/consulta';

/**
 * Exportações para o escritório de contabilidade (SPEC §101). Cada ação recebe a querystring da
 * tela (mesmos filtros) e devolve linhas planas; o navegador monta o XLSX/CSV.
 */

type Linhas = Record<string, string | number>[];
type Resultado = { ok: true; linhas: Linhas } | { ok: false; error: string };

async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };
  if (!(await checkRoleInDb(user.id, ['admin']))) return { ok: false, error: 'Acesso não autorizado.' };
  return { ok: true };
}

const filtros = (qs: string) => lerFiltros(Object.fromEntries(new URLSearchParams(qs)));
const BASE = { competencia: 'Competência (data do passeio)', caixa: 'Caixa (data do recebimento/pagamento)' } as const;

export async function exportarRazao(querystring: string): Promise<Resultado> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const f = filtros(querystring);
  const linhas = await razaoCompleto(f);
  return {
    ok: true,
    linhas: linhas.map((l) => ({
      'Data de competência': formatarData(l.data_competencia),
      'Data de caixa': formatarData(l.data_caixa),
      Tipo: l.tipo,
      Histórico: l.descricao ?? '',
      Pedido: l.pedido_numero ?? '',
      Repasse: l.repasse_numero ?? '',
      Gestor: l.gestor_nome,
      'CPF/CNPJ do gestor': l.gestor_documento ?? '',
      'Conta': l.conta_codigo,
      'Nome da conta': l.conta_nome,
      'Código na contabilidade': l.codigo_contabilidade ?? '',
      'Débito (R$)': l.natureza === 'D' ? l.valor : '',
      'Crédito (R$)': l.natureza === 'C' ? l.valor : '',
    })),
  };
}

export async function exportarBalancete(querystring: string): Promise<Resultado> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const f = filtros(querystring);
  const { contas } = await carregarBalancete(f);
  return {
    ok: true,
    linhas: contas.map((c) => ({
      Conta: c.conta_codigo,
      Nome: c.conta_nome,
      Grupo: c.grupo,
      'Código na contabilidade': c.codigo_contabilidade ?? '',
      'Débitos (R$)': c.debitos,
      'Créditos (R$)': c.creditos,
      'Saldo (R$)': c.saldo,
      Período: `${formatarData(f.de)} a ${formatarData(f.ate)}`,
      Base: BASE[f.base],
    })),
  };
}

export async function exportarDemonstrativo(querystring: string): Promise<Resultado> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const f = filtros(querystring);
  const { linhas } = await carregarDemonstrativo(f);
  return {
    ok: true,
    linhas: linhas.map((l) => ({
      Gestor: l.nome,
      'CPF/CNPJ': l.documento ?? '',
      Pedidos: l.pedidos,
      'Bruto pago pelos clientes (R$)': l.bruto,
      'Tarifa Asaas (R$)': l.tarifa,
      'Descontos/cupons (R$)': l.desconto,
      'Comissão Boatzy (R$)': l.comissao,
      'Devido ao gestor (R$)': l.devido,
      'Repassado (R$)': l.repassado,
      'Saldo do período (R$)': Math.round((l.devido - l.repassado) * 100) / 100,
      Período: `${formatarData(f.de)} a ${formatarData(f.ate)}`,
      Base: BASE[f.base],
    })),
  };
}

/** Uma linha por pedido pago: a divisão Asaas / gestor / Boatzy e a situação do repasse. */
export async function exportarDetalhePedidos(querystring: string): Promise<Resultado> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const f = filtros(querystring);
  const pedidos = await detalhePedidosPeriodo(f);
  return {
    ok: true,
    linhas: pedidos.map((p) => {
      const tarifa = p.valor_tarifa != null ? Number(p.valor_tarifa) : '';
      const receitaLiquida = p.valor_tarifa != null
        ? Math.round((Number(p.valor_comissao) - Number(p.valor_desconto) - Number(p.valor_tarifa)) * 100) / 100
        : '';
      return {
        Pedido: p.numero,
        Tipo: p.tipo === 'avulso' ? 'Cobrança avulsa' : 'Reserva',
        'Data do pagamento': formatarData(p.recebido_em),
        'Data do passeio': formatarData(p.fim_passeio),
        Item: p.item_nome,
        Cliente: p.cliente_nome,
        'CPF do cliente': p.cliente_documento ?? '',
        'E-mail do cliente': p.cliente_email,
        Gestor: p.gestor_nome,
        'CPF/CNPJ do gestor': p.gestor_documento ?? '',
        'Bruto pago (R$)': Number(p.pagamento_valor),
        'Tarifa Asaas (R$)': tarifa,
        'Líquido recebido (R$)': p.valor_liquido != null ? Number(p.valor_liquido) : '',
        'Valor do gestor (R$)': Number(p.valor_itens),
        'Comissão Boatzy (R$)': Number(p.valor_comissao),
        'Desconto/cupom (R$)': Number(p.valor_desconto),
        'Receita líquida Boatzy (R$)': receitaLiquida,
        'Situação do repasse': SITUACAO_ADMIN[p.situacao].label,
        'Liberado em': p.liberado_em ? formatarData(p.liberado_em) : '',
        'Repasse nº': p.repasse_numero ?? '',
        'Repasse pago em': p.repasse_pago_em ? formatarData(p.repasse_pago_em) : '',
        Período: `${formatarData(f.de)} a ${formatarData(f.ate)}`,
        Base: BASE[f.base],
      };
    }),
  };
}

export async function exportarRepassesPeriodo(querystring: string): Promise<Resultado> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const f = filtros(querystring);
  const { linhas } = await carregarRepasses({
    ...lerFiltrosRepasses({}), aba: 'repassados', gestor: f.gestor, de: f.de, ate: f.ate,
  }, false);
  return {
    ok: true,
    linhas: linhas.map((r) => ({
      Repasse: r.numero,
      Situação: r.status === 'pago' ? 'Pago' : 'Cancelado',
      'Data do pagamento': formatarData(r.pago_em),
      Gestor: r.gestor_nome,
      'CPF/CNPJ do gestor': r.destino_snapshot.gestor_documento ?? r.gestor_documento ?? '',
      Meio: METODO_REPASSE[r.metodo],
      'Titular do destino': r.destino_snapshot.titular_nome,
      'CPF/CNPJ do titular': r.destino_snapshot.titular_documento,
      Referência: r.referencia ?? '',
      Pedidos: r.itens,
      'Valor (R$)': Number(r.valor_total),
      Comprovante: r.comprovante_key ? 'Anexado' : 'Pendente',
    })),
  };
}
