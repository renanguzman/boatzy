'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getDatasReservadasEmbarcacao, getDisponibilidadeRoteiro, expandirIntervalo, somarDiasISO } from '@/lib/reservas';
import { getTaxaEfetiva } from '@/lib/taxas';
import { expirarPedidosVencidosSemFalhar } from '@/lib/pagamentos/pedidos';
import { formatCurrencyPrecise } from '@/lib/utils';
import type { CupomTipoDesconto, ReservaModalidadePreco, PrecoPessoaModoCapacidade } from '@/types/supabase';
import { obterTermoParaAceite, validarAceite, gravarAceite, type AceitePreparado } from '@/lib/termos/aceite';
import type { AceiteErroCodigo, AceiteTermoCliente } from '@/lib/termos/tipos';
import { hojeISO } from '@/lib/datas';

export type CriarReservaInput = {
  tipo: 'roteiro' | 'embarcacao';
  roteiroId?: string;
  embarcacaoId?: string;
  data: string; // 'yyyy-mm-dd'
  flex?: number;
  pessoas: number;
  adicionaisIds: string[]; // ids de roteiro_catalogo (apenas roteiro)
  cupomCodigo?: string;
  /** Modelo de cobrança escolhido (só se aplica a `tipo: 'roteiro'`). Padrão 'roteiro'. */
  modalidade?: ReservaModalidadePreco;
  /** Quantidade de diárias — obrigatório quando `modalidade === 'diaria'`. */
  diarias?: number;
  /** Aceite do termo `reserva_cliente` feito na tela — obrigatório quando há versão vigente. */
  aceiteTermo?: AceiteTermoCliente;
};

export type CriarReservaResult =
  | { ok: true; reservaId: string; aceite: { evidenciaHash: string; aceitoEm: string } | null }
  | { ok: false; error: string; aceiteCodigo?: AceiteErroCodigo | 'aceite_ausente' };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Dados resolvidos no servidor para montar a reserva, comuns aos dois tipos. */
type AlvoResolvido = {
  nome: string;
  ownerId: string;
  roteiroId: string | null;
  embarcacaoId: string | null;
  /** Taxa de serviço efetiva (%) do gestor dono do alvo — específica ou geral (ver SPEC §14). */
  taxaPercent: number;
  /** Modelo de cobrança efetivamente resolvido ('roteiro' sempre para `tipo: 'embarcacao'`). */
  modalidade: ReservaModalidadePreco;
  /** Valor unitário do modelo (dia, diária ou pessoa) — snapshot gravado em `reserva.preco_base`. */
  precoUnitario: number | null;
  /** Multiplicador do subtotal: diárias, pessoas, ou 1 (modelo Roteiro). */
  multiplicador: number;
  /** Diárias mínimas exigidas pelo roteiro no modelo Por Diária. */
  precoDiariaMinimo: number;
  /** Config do modelo Por Pessoa do roteiro — usada para validar grupo mínimo e capacidade. */
  pessoaCapacidadeMinima: number | null;
  pessoaCapacidadeMaxima: number | null;
  pessoaModoCapacidade: PrecoPessoaModoCapacidade;
};

type Adicional = { roteiro_catalogo_id: string; descricao: string; valor: number; tipo: 'produto' | 'servico' };

type ResolverAlvoInput = {
  tipo: 'roteiro' | 'embarcacao';
  roteiroId?: string;
  embarcacaoId?: string;
  adicionaisIds: string[];
  /** Modelo de cobrança escolhido (ignorado para `tipo: 'embarcacao'`, sempre 'roteiro'). */
  modalidade: ReservaModalidadePreco;
  diarias?: number;
  pessoas: number;
};

type ResolverAlvoResult =
  | { ok: true; alvo: AlvoResolvido; adicionais: Adicional[] }
  | { ok: false; error: string };

/**
 * Resolve o alvo (roteiro ou embarcação) e seus adicionais no servidor —
 * fonte da verdade de preço/owner. Reaproveitado por `criarReserva` e pela
 * pré-visualização de cupom (`validarCupom`): nunca confiamos num subtotal
 * vindo do cliente.
 */
async function resolverAlvo(input: ResolverAlvoInput): Promise<ResolverAlvoResult> {
  if (input.tipo === 'embarcacao') {
    if (!input.embarcacaoId) return { ok: false, error: 'Embarcação inválida.' };
    const { data: emb, error: embErr } = await supabaseAdmin
      .from('embarcacao')
      .select('id, nome, preco_base, owner_id, status')
      .eq('id', input.embarcacaoId)
      .eq('status', 'ativo')
      .single();
    if (embErr || !emb) return { ok: false, error: 'Embarcação não encontrada ou indisponível.' };
    return {
      ok: true,
      alvo: {
        nome: emb.nome,
        precoUnitario: emb.preco_base != null ? Number(emb.preco_base) : null,
        multiplicador: 1,
        ownerId: emb.owner_id,
        roteiroId: null,
        embarcacaoId: emb.id,
        taxaPercent: await getTaxaEfetiva(emb.owner_id),
        modalidade: 'roteiro',
        precoDiariaMinimo: 1,
        pessoaCapacidadeMinima: null,
        pessoaCapacidadeMaxima: null,
        pessoaModoCapacidade: 'exclusivo',
      },
      adicionais: [],
    };
  }

  if (!input.roteiroId) return { ok: false, error: 'Roteiro inválido.' };
  const { data: roteiro, error: roteiroErr } = await supabaseAdmin
    .from('roteiro')
    .select(`
      id, nome, preco_base, owner_id, embarcacao_id, ativo,
      preco_diaria_ativo, preco_diaria_valor, preco_diaria_minimo,
      preco_pessoa_ativo, preco_pessoa_valor,
      preco_pessoa_capacidade_minima, preco_pessoa_capacidade_maxima, preco_pessoa_modo_capacidade
    `)
    .eq('id', input.roteiroId)
    .eq('ativo', true)
    .single();
  if (roteiroErr || !roteiro) return { ok: false, error: 'Roteiro não encontrado ou indisponível.' };

  if (input.modalidade === 'diaria' && !roteiro.preco_diaria_ativo) {
    return { ok: false, error: 'Este roteiro não tem o modelo Por Diária disponível.' };
  }
  if (input.modalidade === 'pessoa' && !roteiro.preco_pessoa_ativo) {
    return { ok: false, error: 'Este roteiro não tem o modelo Por Pessoa disponível.' };
  }

  const precoUnitario =
    input.modalidade === 'diaria'
      ? roteiro.preco_diaria_valor != null ? Number(roteiro.preco_diaria_valor) : null
      : input.modalidade === 'pessoa'
        ? roteiro.preco_pessoa_valor != null ? Number(roteiro.preco_pessoa_valor) : null
        : roteiro.preco_base != null ? Number(roteiro.preco_base) : null;

  const multiplicador =
    input.modalidade === 'diaria' ? Math.max(1, input.diarias ?? 1)
    : input.modalidade === 'pessoa' ? input.pessoas
    : 1;

  const alvo: AlvoResolvido = {
    nome: roteiro.nome,
    precoUnitario,
    multiplicador,
    ownerId: roteiro.owner_id,
    roteiroId: roteiro.id,
    embarcacaoId: roteiro.embarcacao_id,
    taxaPercent: await getTaxaEfetiva(roteiro.owner_id),
    modalidade: input.modalidade,
    precoDiariaMinimo: roteiro.preco_diaria_minimo || 1,
    pessoaCapacidadeMinima: roteiro.preco_pessoa_capacidade_minima,
    pessoaCapacidadeMaxima: roteiro.preco_pessoa_capacidade_maxima,
    pessoaModoCapacidade: roteiro.preco_pessoa_modo_capacidade,
  };

  // Reconstrói os adicionais selecionados a partir dos ids (snapshot dos valores atuais).
  let adicionais: Adicional[] = [];
  const ids = [...new Set(input.adicionaisIds)].filter(Boolean);
  if (ids.length > 0) {
    const { data: itens } = await supabaseAdmin
      .from('roteiro_catalogo')
      .select('id, valor_customizado, roteiro_id, catalogo ( descricao, valor, tipo )')
      .eq('roteiro_id', roteiro.id)
      .in('id', ids);

    adicionais = (itens ?? [])
      .filter((it) => it.catalogo)
      .map((it) => {
        const cat = it.catalogo as unknown as { descricao: string; valor: number; tipo: 'produto' | 'servico' };
        return {
          roteiro_catalogo_id: it.id,
          descricao: cat.descricao,
          valor: it.valor_customizado ?? cat.valor,
          tipo: cat.tipo,
        };
      });
  }

  return { ok: true, alvo, adicionais };
}

type CupomValidado = {
  id: string;
  codigo: string;
  tipoDesconto: CupomTipoDesconto;
  valor: number;
  /** Já aplicado o teto de desconto (quando percentual), mas ainda NÃO capado no total da reserva. */
  descontoValor: number;
};

type ValidarRegrasResult = { ok: true; cupom: CupomValidado } | { ok: false; error: string };

/**
 * Valida um código de cupom contra todas as regras de negócio (existência,
 * status, vigência, pedido mínimo, limites de uso) e calcula o desconto
 * bruto. Não grava nada — quem chama decide se registra tentativa/uso.
 */
async function validarRegrasCupom(codigoBruto: string, clienteId: string, subtotal: number): Promise<ValidarRegrasResult> {
  const codigo = codigoBruto.trim().toUpperCase().replace(/\s+/g, '');
  if (!codigo) return { ok: false, error: 'Informe um código de cupom.' };

  const { data: cupom } = await supabaseAdmin
    .from('cupom')
    .select(`
      id, codigo, tipo_desconto, valor, valor_desconto_maximo, valor_minimo_pedido,
      data_inicio, data_fim, limite_uso_total, limite_uso_por_cliente, ativo
    `)
    .eq('codigo', codigo)
    .maybeSingle();

  if (!cupom) return { ok: false, error: 'Cupom inválido.' };
  if (!cupom.ativo) return { ok: false, error: 'Este cupom não está mais disponível.' };

  const hoje = hojeISO(); // horário de Brasília (o servidor roda em UTC)
  if (cupom.data_inicio && cupom.data_inicio > hoje) return { ok: false, error: 'Este cupom ainda não é válido.' };
  if (cupom.data_fim && cupom.data_fim < hoje) return { ok: false, error: 'Este cupom expirou.' };

  if (cupom.valor_minimo_pedido != null && subtotal < Number(cupom.valor_minimo_pedido)) {
    return {
      ok: false,
      error: `Este cupom exige um pedido mínimo de ${formatCurrencyPrecise(Number(cupom.valor_minimo_pedido))}.`,
    };
  }

  if (cupom.limite_uso_total != null) {
    const { count } = await supabaseAdmin
      .from('cupom_uso')
      .select('id', { count: 'exact', head: true })
      .eq('cupom_id', cupom.id);
    if ((count ?? 0) >= cupom.limite_uso_total) {
      return { ok: false, error: 'Este cupom atingiu o limite de usos.' };
    }
  }

  if (cupom.limite_uso_por_cliente != null) {
    const { count } = await supabaseAdmin
      .from('cupom_uso')
      .select('id', { count: 'exact', head: true })
      .eq('cupom_id', cupom.id)
      .eq('cliente_id', clienteId);
    if ((count ?? 0) >= cupom.limite_uso_por_cliente) {
      return { ok: false, error: 'Você já utilizou este cupom o máximo de vezes permitido.' };
    }
  }

  const valor = Number(cupom.valor);
  let descontoValor = cupom.tipo_desconto === 'percentual' ? subtotal * (valor / 100) : valor;
  if (cupom.tipo_desconto === 'percentual' && cupom.valor_desconto_maximo != null) {
    descontoValor = Math.min(descontoValor, Number(cupom.valor_desconto_maximo));
  }

  return {
    ok: true,
    cupom: { id: cupom.id, codigo: cupom.codigo, tipoDesconto: cupom.tipo_desconto, valor, descontoValor },
  };
}

/** Leitura simples do estado de bloqueio — não consome tentativa. */
async function checarBloqueioCupom(clienteId: string): Promise<{ bloqueado: boolean; bloqueadoAte: string | null }> {
  const { data } = await supabaseAdmin
    .from('cupom_tentativa')
    .select('bloqueado_ate')
    .eq('cliente_id', clienteId)
    .maybeSingle();

  const bloqueadoAte = data?.bloqueado_ate ?? null;
  const bloqueado = bloqueadoAte != null && new Date(bloqueadoAte).getTime() > Date.now();
  return { bloqueado, bloqueadoAte: bloqueado ? bloqueadoAte : null };
}

const MSG_BLOQUEADO = 'Muitas tentativas incorretas com cupom. Tente novamente mais tarde.';

const MSG_CUPOM_SEM_TAXA = 'Este cupom não se aplica a esta reserva: ela não tem taxa de serviço.';

function arredondarCentavos(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * O cupom sai SÓ da taxa de serviço (decisão D7, SPEC §20.8/§34): o desconto
 * nunca passa do valor da taxa, então o cliente paga no mínimo o valor dos
 * itens e o gestor recebe esse valor integral.
 */
function limitarDescontoATaxa(descontoCupom: number, taxaServico: number): number {
  return arredondarCentavos(Math.max(0, Math.min(descontoCupom, taxaServico)));
}

export type ValidarCupomInput = {
  tipo: 'roteiro' | 'embarcacao';
  roteiroId?: string;
  embarcacaoId?: string;
  adicionaisIds: string[];
  codigo: string;
  /** Modelo de cobrança escolhido — afeta o subtotal usado para validar o cupom. Padrão 'roteiro'. */
  modalidade?: ReservaModalidadePreco;
  diarias?: number;
  pessoas: number;
};

export type ValidarCupomResult =
  | {
      ok: true;
      cupom: {
        codigo: string;
        tipoDesconto: CupomTipoDesconto;
        valor: number;
        descontoValor: number;
        /** true quando o desconto do cupom foi reduzido ao valor da taxa de serviço. */
        limitadoTaxa: boolean;
      };
    }
  | { ok: false; error: string; bloqueadoAte?: string };

/**
 * Pré-visualização do cupom (botão "Aplicar" em /reservas/novo) — mostra o
 * desconto na hora, mas não grava nada em `cupom_uso`. A validação final e
 * autoritativa é refeita em `criarReserva` no momento do envio.
 */
export async function validarCupom(input: ValidarCupomInput): Promise<ValidarCupomResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Você precisa estar logado para aplicar um cupom.' };

  const bloqueio = await checarBloqueioCupom(user.id);
  if (bloqueio.bloqueado) {
    return { ok: false, error: MSG_BLOQUEADO, bloqueadoAte: bloqueio.bloqueadoAte! };
  }

  const alvoResult = await resolverAlvo({ ...input, modalidade: input.modalidade ?? 'roteiro' });
  if (!alvoResult.ok) return { ok: false, error: alvoResult.error };

  const { alvo, adicionais } = alvoResult;
  if (alvo.precoUnitario == null) {
    return { ok: false, error: 'Este item não tem um valor definido para aplicar cupom.' };
  }

  const totalAdicionais = adicionais.reduce((sum, a) => sum + Number(a.valor), 0);
  const subtotal = alvo.precoUnitario * alvo.multiplicador + totalAdicionais;

  const resultado = await validarRegrasCupom(input.codigo, user.id, subtotal);

  const { data: tentativaRows } = await supabaseAdmin.rpc('registrar_tentativa_cupom', {
    p_cliente_id: user.id,
    p_sucesso: resultado.ok,
  });
  const status = tentativaRows?.[0];

  if (!resultado.ok) {
    if (status?.bloqueado) {
      return { ok: false, error: MSG_BLOQUEADO, bloqueadoAte: status.bloqueado_ate ?? undefined };
    }
    return { ok: false, error: resultado.error };
  }

  const taxaServicoBruta = Math.round(subtotal * (alvo.taxaPercent / 100));
  const descontoValor = limitarDescontoATaxa(resultado.cupom.descontoValor, taxaServicoBruta);
  if (descontoValor <= 0) return { ok: false, error: MSG_CUPOM_SEM_TAXA };

  return {
    ok: true,
    cupom: {
      codigo: resultado.cupom.codigo,
      tipoDesconto: resultado.cupom.tipoDesconto,
      valor: resultado.cupom.valor,
      descontoValor,
      limitadoTaxa: descontoValor < arredondarCentavos(resultado.cupom.descontoValor),
    },
  };
}

export async function criarReserva(input: CriarReservaInput): Promise<CriarReservaResult> {
  // Cliente deve estar logado.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Você precisa estar logado para solicitar uma reserva.' };

  // Validação dos campos obrigatórios.
  if (!input.data || !ISO_DATE.test(input.data)) return { ok: false, error: 'Data inválida.' };
  if (!input.pessoas || input.pessoas < 1) return { ok: false, error: 'Informe o número de pessoas.' };

  const modalidade: ReservaModalidadePreco = input.tipo === 'embarcacao' ? 'roteiro' : (input.modalidade ?? 'roteiro');
  if (modalidade === 'diaria' && (!input.diarias || input.diarias < 1)) {
    return { ok: false, error: 'Informe a quantidade de diárias.' };
  }

  const alvoResult = await resolverAlvo({ ...input, modalidade, pessoas: input.pessoas });
  if (!alvoResult.ok) return { ok: false, error: alvoResult.error };
  const { alvo, adicionais } = alvoResult;

  if (modalidade === 'diaria' && input.diarias! < alvo.precoDiariaMinimo) {
    return {
      ok: false,
      error: `Este roteiro exige no mínimo ${alvo.precoDiariaMinimo} diária${alvo.precoDiariaMinimo > 1 ? 's' : ''}.`,
    };
  }
  if (modalidade === 'pessoa' && alvo.pessoaCapacidadeMinima && input.pessoas < alvo.pessoaCapacidadeMinima) {
    return { ok: false, error: `Este roteiro exige um grupo mínimo de ${alvo.pessoaCapacidadeMinima} pessoas.` };
  }

  const dataFim = modalidade === 'diaria' ? somarDiasISO(input.data, input.diarias! - 1) : null;

  // Pedidos com prazo de pagamento vencido liberam a data antes da checagem.
  await expirarPedidosVencidosSemFalhar();

  // Bloqueia a data (ou o intervalo, no modelo Por Diária) se a embarcação
  // (ou o roteiro, quando sem vínculo) já tiver reserva CONFIRMADA que
  // conflite — valida sempre pela embarcação quando ela existe, pois uma
  // mesma embarcação pode atender vários roteiros. No modelo Por Pessoa
  // compartilhado, só há conflito se ultrapassar a capacidade máxima.
  if (input.tipo === 'embarcacao') {
    const datasIndisponiveis = await getDatasReservadasEmbarcacao(alvo.embarcacaoId!);
    if (datasIndisponiveis.includes(input.data)) {
      return { ok: false, error: 'Essa data não está mais disponível. Escolha outra data.' };
    }
  } else {
    const disponibilidade = await getDisponibilidadeRoteiro({
      roteiroId: alvo.roteiroId!,
      embarcacaoId: alvo.embarcacaoId,
      pessoaModoCapacidade: alvo.pessoaModoCapacidade,
    });
    const intervalo = expandirIntervalo(input.data, dataFim ?? input.data);
    const exclusivas = new Set(disponibilidade.datasExclusivasOcupadas);
    if (intervalo.some((d) => exclusivas.has(d))) {
      return { ok: false, error: 'Essa data não está mais disponível. Escolha outra data.' };
    }
    if (modalidade === 'pessoa' && alvo.pessoaModoCapacidade === 'compartilhado') {
      const maxima = alvo.pessoaCapacidadeMaxima ?? 0;
      const semVaga = intervalo.some(
        (d) => (disponibilidade.vagasPessoaOcupadas[d] ?? 0) + input.pessoas > maxima,
      );
      if (semVaga) {
        return { ok: false, error: 'Não há vagas suficientes nessa data. Escolha outra data ou reduza o número de pessoas.' };
      }
    }
  }

  // Cálculo (servidor) — mesma fórmula do resumo/BookingCard.
  const precoUnitario = alvo.precoUnitario;
  const totalAdicionais = adicionais.reduce((sum, a) => sum + Number(a.valor), 0);
  const subtotal = (precoUnitario != null ? precoUnitario * alvo.multiplicador : 0) + totalAdicionais;
  const taxaServico = precoUnitario != null ? Math.round(subtotal * (alvo.taxaPercent / 100)) : null;
  const totalBruto = precoUnitario != null && taxaServico != null ? subtotal + taxaServico : null;

  // Termo da reserva: se há versão vigente, o aceite é obrigatório e é
  // validado ANTES de criar a reserva (gravado logo após, com o id dela).
  // Sem versão vigente publicada, a reserva segue sem aceite.
  let aceitePreparado: AceitePreparado | null = null;
  const termoVigente = await obterTermoParaAceite('reserva_cliente', user.id);
  if (termoVigente) {
    if (!input.aceiteTermo) {
      return { ok: false, error: 'Leia e aceite os termos da reserva para continuar.', aceiteCodigo: 'aceite_ausente' };
    }
    const validacao = await validarAceite({
      identificador: 'reserva_cliente',
      termoId: input.aceiteTermo.termoId,
      userId: user.id,
      contexto: { tipo: 'reserva' },
      evidencias: input.aceiteTermo.evidencias,
    });
    if (!validacao.ok) return { ok: false, error: validacao.error, aceiteCodigo: validacao.codigo };
    aceitePreparado = validacao;
  }

  // Cupom (opcional) — última validação antes de gravar; nunca confia na
  // pré-visualização feita pelo cliente em validarCupom.
  let cupomAplicado: { id: string; codigo: string } | null = null;
  let descontoValor = 0;

  if (input.cupomCodigo && input.cupomCodigo.trim()) {
    if (precoUnitario == null || totalBruto == null) {
      return { ok: false, error: 'Este item não tem um valor definido para aplicar cupom.' };
    }

    const bloqueio = await checarBloqueioCupom(user.id);
    if (bloqueio.bloqueado) {
      return { ok: false, error: MSG_BLOQUEADO };
    }

    const resultado = await validarRegrasCupom(input.cupomCodigo, user.id, subtotal);
    await supabaseAdmin.rpc('registrar_tentativa_cupom', { p_cliente_id: user.id, p_sucesso: resultado.ok });

    if (!resultado.ok) {
      return { ok: false, error: resultado.error };
    }

    cupomAplicado = { id: resultado.cupom.id, codigo: resultado.cupom.codigo };
    descontoValor = limitarDescontoATaxa(resultado.cupom.descontoValor, taxaServico ?? 0);
    if (descontoValor <= 0) return { ok: false, error: MSG_CUPOM_SEM_TAXA };
  }

  const totalEstimado = totalBruto != null ? Math.max(0, totalBruto - descontoValor) : null;

  // Cria a reserva como 'pendente'.
  const { data: reserva, error: insertErr } = await supabaseAdmin
    .from('reserva')
    .insert({
      tipo: input.tipo,
      roteiro_id: alvo.roteiroId,
      embarcacao_id: alvo.embarcacaoId,
      cliente_id: user.id,
      owner_id: alvo.ownerId,
      data_reserva: input.data,
      data_fim_reserva: dataFim,
      modalidade_preco: modalidade,
      quantidade_diarias: modalidade === 'diaria' ? input.diarias : null,
      flexibilidade: input.flex && input.flex > 0 ? input.flex : null,
      quantidade_pessoas: input.pessoas,
      item_nome: alvo.nome,
      preco_base: precoUnitario,
      total_adicionais: totalAdicionais,
      taxa_servico: taxaServico,
      // Sempre gravada, mesmo com preço "a combinar": a comissão cobrada no pagamento usa a
      // taxa efetiva do gestor no momento da SOLICITAÇÃO (decisão D7, SPEC §34).
      taxa_percent: alvo.taxaPercent,
      total_estimado: totalEstimado,
      cupom_id: cupomAplicado?.id ?? null,
      cupom_codigo: cupomAplicado?.codigo ?? null,
      desconto_valor: descontoValor,
      status: 'pendente',
    })
    .select('id')
    .single();

  if (insertErr || !reserva) {
    return { ok: false, error: insertErr?.message ?? 'Não foi possível criar a reserva.' };
  }

  // Snapshot dos adicionais (apenas roteiro).
  if (adicionais.length > 0) {
    const { error: addErr } = await supabaseAdmin.from('reserva_adicional').insert(
      adicionais.map((a) => ({
        reserva_id: reserva.id,
        roteiro_catalogo_id: a.roteiro_catalogo_id,
        descricao: a.descricao,
        valor: a.valor,
        tipo: a.tipo,
      })),
    );
    if (addErr) {
      // Reverte a reserva para não deixar registro órfão sem os itens escolhidos.
      await supabaseAdmin.from('reserva').delete().eq('id', reserva.id);
      return { ok: false, error: 'Não foi possível registrar os adicionais da reserva.' };
    }
  }

  // Prova do aceite do termo, já vinculada à reserva. Sem prova, sem reserva.
  // Gravada antes do cupom: se o cupom falhar depois, a reserva é desfeita mas
  // o aceite permanece (registro imutável) — continua sendo um fato verdadeiro.
  let aceite: { evidenciaHash: string; aceitoEm: string } | null = null;
  if (aceitePreparado) {
    const gravado = await gravarAceite(aceitePreparado, reserva.id);
    if (!gravado.ok) {
      await supabaseAdmin.from('reserva').delete().eq('id', reserva.id);
      return { ok: false, error: gravado.error, aceiteCodigo: gravado.codigo };
    }
    aceite = { evidenciaHash: gravado.evidenciaHash, aceitoEm: gravado.aceitoEm };
  }

  // Registro atômico do uso do cupom — trava final (lock + recheck) contra
  // corrida no limite de uso entre a pré-visualização e este momento.
  if (cupomAplicado) {
    const { data: usoOk } = await supabaseAdmin.rpc('registrar_uso_cupom', {
      p_cupom_id: cupomAplicado.id,
      p_cliente_id: user.id,
      p_reserva_id: reserva.id,
      p_valor_desconto: descontoValor,
    });
    if (!usoOk) {
      await supabaseAdmin.from('reserva').delete().eq('id', reserva.id);
      return {
        ok: false,
        error: 'Esse cupom deixou de estar disponível enquanto sua solicitação era processada. Tente novamente sem o cupom ou com outro código.',
      };
    }
  }

  return { ok: true, reservaId: reserva.id, aceite };
}
