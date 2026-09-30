import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import type { Database, ReservaModalidadePreco, ReservaStatus, ReservaTipo } from '@/types/supabase';

/**
 * Carrega TUDO o que se relaciona a um pedido para a tela de detalhe do admin:
 * pedido, cliente, gestor, reserva (com adicionais, atendentes, aceite do
 * termo), descontos/cupom, cada tentativa de pagamento com cartão, parcelas,
 * movimentos e estornos, os eventos crus do webhook do Asaas e a auditoria.
 */

type Tabela<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

export type UsuarioDetalhe = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  cpf_cnpj: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type ReservaDetalhe = {
  id: string;
  tipo: ReservaTipo;
  status: ReservaStatus;
  item_nome: string;
  roteiro_id: string | null;
  embarcacao_id: string | null;
  data_reserva: string;
  data_fim_reserva: string | null;
  flexibilidade: number | null;
  quantidade_pessoas: number;
  quantidade_diarias: number | null;
  modalidade_preco: ReservaModalidadePreco;
  preco_base: number | null;
  total_adicionais: number;
  taxa_servico: number | null;
  taxa_percent: number | null;
  total_estimado: number | null;
  cupom_id: string | null;
  cupom_codigo: string | null;
  desconto_valor: number;
  observacao_gestor: string | null;
  solicitado_em: string;
  respondido_em: string | null;
  aceita_em: string | null;
  cancelada_em: string | null;
  expirada_em: string | null;
  pagamento_exigido: boolean;
  roteiro: { nome: string; duracao_horas: number | null; municipios: { nome: string; estados: { uf: string } | null } | null } | null;
  embarcacao: { nome: string } | null;
  reserva_adicional: { id: string; descricao: string; valor: number; tipo: string }[];
  reserva_atendente: { equipe_membro: { nome_completo: string; is_gestor: boolean; telefone: string | null } | null }[];
};

export type PagamentoDetalhe = Tabela<'pagamento'> & {
  pagamento_cartao: Tabela<'pagamento_cartao'> | Tabela<'pagamento_cartao'>[] | null;
  pagamento_parcela: Tabela<'pagamento_parcela'>[];
  pagamento_transacao: Tabela<'pagamento_transacao'>[];
  pagamento_estorno: Tabela<'pagamento_estorno'>[];
};

export type AuditoriaDetalhe = Tabela<'financeiro_auditoria'> & { admin: { name: string; email: string } | null };

export type DetalhePedido = {
  pedido: Tabela<'pedido'>;
  cliente: UsuarioDetalhe | null;
  gestor: UsuarioDetalhe | null;
  descontos: Tabela<'pedido_desconto'>[];
  reserva: ReservaDetalhe | null;
  pagamentos: PagamentoDetalhe[];
  eventos: Tabela<'asaas_webhook_evento'>[];
  auditoria: AuditoriaDetalhe[];
  clienteAsaas: Tabela<'cliente_asaas'>[];
  aceites: { id: string; evidencia_hash: string; aceito_em: string; termo_versao: number; termo_identificador: string }[];
  cupom: { id: string; codigo: string; tipo_desconto: string; valor: number; ativo: boolean } | null;
  cupomUso: { valor_desconto: number; criado_em: string } | null;
  taxaAtualGestor: { percent: number; origem: 'geral' | 'especifica' } | null;
};

const USUARIO = 'id, name, email, phone, cpf_cnpj, avatar_url, created_at';

export async function carregarDetalhePedido(id: string): Promise<DetalhePedido | null> {
  const { data: bruto } = await supabaseAdmin
    .from('pedido')
    .select(
      `*, cliente:users!pedido_cliente_id_fkey ( ${USUARIO} ),
       gestor:users!pedido_gestor_id_fkey ( ${USUARIO} ),
       pedido_desconto ( * )`,
    )
    .eq('id', id)
    .maybeSingle();
  if (!bruto) return null;

  const { cliente, gestor, pedido_desconto, ...pedido } = bruto as unknown as Tabela<'pedido'> & {
    cliente: UsuarioDetalhe | null;
    gestor: UsuarioDetalhe | null;
    pedido_desconto: Tabela<'pedido_desconto'>[];
  };

  const [reservaRes, pagamentosRes, auditoriaRes, clienteAsaasRes, aceitesRes, taxaEspRes, taxaGeralRes] = await Promise.all([
    supabaseAdmin
      .from('reserva')
      .select(
        `id, tipo, status, item_nome, roteiro_id, embarcacao_id, data_reserva, data_fim_reserva, flexibilidade,
         quantidade_pessoas, quantidade_diarias, modalidade_preco, preco_base, total_adicionais, taxa_servico,
         taxa_percent, total_estimado, cupom_id, cupom_codigo, desconto_valor, observacao_gestor, solicitado_em,
         respondido_em, aceita_em, cancelada_em, expirada_em, pagamento_exigido,
         roteiro ( nome, duracao_horas, municipios ( nome, estados ( uf ) ) ),
         embarcacao ( nome ),
         reserva_adicional ( id, descricao, valor, tipo ),
         reserva_atendente ( equipe_membro ( nome_completo, is_gestor, telefone ) )`,
      )
      .eq('id', pedido.reserva_id)
      .maybeSingle(),
    supabaseAdmin
      .from('pagamento')
      .select('*, pagamento_cartao ( * ), pagamento_parcela ( * ), pagamento_transacao ( * ), pagamento_estorno ( * )')
      .eq('pedido_id', id)
      .order('criado_em', { ascending: true }),
    supabaseAdmin
      .from('financeiro_auditoria')
      .select('*')
      .eq('entidade', 'pedido')
      .eq('entidade_id', id)
      .order('criado_em', { ascending: true }),
    cliente
      ? supabaseAdmin.from('cliente_asaas').select('*').eq('user_id', cliente.id)
      : Promise.resolve({ data: [] as Tabela<'cliente_asaas'>[] }),
    supabaseAdmin
      .from('termos_uso_aceite')
      .select('id, evidencia_hash, aceito_em, termo_versao, termo_identificador')
      .eq('contexto_tipo', 'reserva')
      .eq('contexto_id', pedido.reserva_id),
    supabaseAdmin
      .from('usuario_taxa')
      .select('taxa_percent, ativo, data_validade')
      .eq('user_id', pedido.gestor_id)
      .maybeSingle(),
    supabaseAdmin.from('taxa_plataforma').select('taxa_percent').eq('singleton', true).maybeSingle(),
  ]);

  const reserva = (reservaRes.data ?? null) as unknown as ReservaDetalhe | null;
  const pagamentos = ((pagamentosRes.data ?? []) as unknown as PagamentoDetalhe[]).map((p) => ({
    ...p,
    pagamento_parcela: [...(p.pagamento_parcela ?? [])].sort((a, b) => a.numero - b.numero),
    pagamento_transacao: [...(p.pagamento_transacao ?? [])].sort((a, b) => a.ocorrido_em.localeCompare(b.ocorrido_em)),
    pagamento_estorno: [...(p.pagamento_estorno ?? [])].sort((a, b) => a.solicitado_em.localeCompare(b.solicitado_em)),
  }));

  // Eventos crus do webhook: pelas cobranças e parcelas deste pedido.
  const idsAsaas = [
    ...new Set(
      pagamentos.flatMap((p) => [p.asaas_payment_id, ...p.pagamento_parcela.map((pp) => pp.asaas_payment_id)]).filter((v): v is string => !!v),
    ),
  ];
  const { data: eventos } = idsAsaas.length
    ? await supabaseAdmin.from('asaas_webhook_evento').select('*').in('recurso_id', idsAsaas).order('recebido_em', { ascending: true })
    : { data: [] as Tabela<'asaas_webhook_evento'>[] };

  // Nome dos admins da auditoria.
  const auditoriaBruta = (auditoriaRes.data ?? []) as Tabela<'financeiro_auditoria'>[];
  const idsAdmins = [...new Set(auditoriaBruta.map((a) => a.admin_id).filter((v): v is string => !!v))];
  const { data: admins } = idsAdmins.length
    ? await supabaseAdmin.from('users').select('id, name, email').in('id', idsAdmins)
    : { data: [] as { id: string; name: string; email: string }[] };
  const adminPorId = new Map((admins ?? []).map((a) => [a.id, a]));

  // Cupom (cadastro atual) + registro de uso desta reserva.
  const cupomId = pedido_desconto.find((d) => d.cupom_id)?.cupom_id ?? reserva?.cupom_id ?? null;
  const [cupomRes, usoRes] = cupomId
    ? await Promise.all([
        supabaseAdmin.from('cupom').select('id, codigo, tipo_desconto, valor, ativo').eq('id', cupomId).maybeSingle(),
        supabaseAdmin
          .from('cupom_uso')
          .select('valor_desconto, criado_em')
          .eq('cupom_id', cupomId)
          .eq('reserva_id', pedido.reserva_id)
          .maybeSingle(),
      ])
    : [{ data: null }, { data: null }];

  // Taxa que valeria HOJE para o gestor (para comparar com a congelada no pedido).
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const esp = taxaEspRes.data;
  const especificaVigente = esp && esp.ativo && (!esp.data_validade || esp.data_validade >= hoje);
  const taxaAtualGestor = especificaVigente
    ? { percent: Number(esp.taxa_percent), origem: 'especifica' as const }
    : taxaGeralRes.data
      ? { percent: Number(taxaGeralRes.data.taxa_percent), origem: 'geral' as const }
      : null;

  return {
    pedido,
    cliente,
    gestor,
    descontos: pedido_desconto ?? [],
    reserva,
    pagamentos,
    eventos: eventos ?? [],
    auditoria: auditoriaBruta.map((a) => ({ ...a, admin: a.admin_id ? adminPorId.get(a.admin_id) ?? null : null })),
    clienteAsaas: (clienteAsaasRes.data ?? []) as Tabela<'cliente_asaas'>[],
    aceites: aceitesRes.data ?? [],
    cupom: cupomRes.data
      ? { ...cupomRes.data, valor: Number(cupomRes.data.valor), tipo_desconto: String(cupomRes.data.tipo_desconto) }
      : null,
    cupomUso: usoRes.data ? { valor_desconto: Number(usoRes.data.valor_desconto), criado_em: usoRes.data.criado_em } : null,
    taxaAtualGestor,
  };
}
