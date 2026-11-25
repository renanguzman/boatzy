import 'server-only';

import { getTranslations } from 'next-intl/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isValidCPF, onlyDigits } from '@/lib/validators';
import { lerPagarmeConfig } from '@/lib/pagarme/config';
import { mensagemErroPagarme, PagarmeError, paraCentavos } from '@/lib/pagarme/client';
import { buscarPedidoPorCode, criarPedidoCartao } from '@/lib/pagarme/pedidos';
import type { PagarmeCliente, PagarmePedido } from '@/lib/pagarme/tipos';
import { FUSO_HORARIO } from '@/lib/datas';
import type { PagamentoStatus } from '@/types/supabase';
import { carregarPedidoCheckout, formasDoCheckout } from './checkout';
import { cancelarCobrancasPendentes, PAGAMENTO_PAGO } from './pedidos';
import { registrarEventoPedido } from './historico';
import { validarDocumentoEstrangeiro } from './estrangeiro';
import { validarTomador, type CampoTomador, type Tomador, type TomadorForm } from './tomador';
import { enderecoParaPagarme, validarDadosCobranca, type CampoCobranca, type EnderecoCobrancaForm, type TelefoneForm } from './cartao-dados';
import { valorParcelado } from './valores';
import { aplicarPedidoPagarme, motivoRecusa, type MotivoRecusa } from './pagarme';

/**
 * Pagamento com cartão de crédito pela Pagar.me (Stone) — checkout
 * transparente (SPEC §109). O navegador tokeniza o cartão direto na Pagar.me;
 * aqui chega só o `cardToken` (uso único, ~60 s).
 *
 * Mesmas regras do `iniciarPagamento` (pedido do cliente, prazo, forma e
 * parcelas liberadas, titular próprio/terceiro/estrangeiro) + endereço de
 * cobrança e celular (antifraude) + juros do parcelamento pagos pelo cliente,
 * recalculados aqui (nunca confia no valor do navegador).
 *
 * A resposta da Pagar.me já traz o resultado: aprovado confirma o pedido na
 * hora; em análise espera o webhook; recusado devolve o motivo traduzido.
 */

/** Tentativas de cartão por pedido por hora (proteção contra teste de cartões). */
const MAX_TENTATIVAS_HORA = 5;

export type PagarComCartaoInput = {
  pedidoId: string;
  userId: string;
  cardToken: string;
  parcelas: number;
  endereco: EnderecoCobrancaForm;
  telefone: TelefoneForm;
  cpf?: string;
  estrangeiro?: { pais: string; documento: string } | null;
  tomador?: TomadorForm | null;
};

export type PagarComCartaoResultado =
  | { ok: true; situacao: 'aprovado' | 'em_analise' }
  | {
      ok: false;
      error: string;
      campo?: 'cpf' | 'pais' | 'documentoEstrangeiro' | CampoTomador | `cobranca.${CampoCobranca}`;
      motivo?: MotivoRecusa;
    };

const TOKEN = /^token_[A-Za-z0-9]{8,64}$/;

export async function pagarComCartao(input: PagarComCartaoInput): Promise<PagarComCartaoResultado> {
  const t = await getTranslations('Pagamento');
  const cfg = lerPagarmeConfig();
  if (!cfg.ok) {
    console.error('[pagamentos/cartao] Pagar.me não configurada:', cfg.erro);
    return { ok: false, error: t('erros.indisponivel') };
  }
  if (typeof input.cardToken !== 'string' || !TOKEN.test(input.cardToken)) {
    return { ok: false, error: t('cartao.erros.token') };
  }

  const carregado = await carregarPedidoCheckout(input.pedidoId, input.userId);
  if (!carregado.ok) return { ok: false, error: t(`erros.${carregado.erro}`) };
  const pedido = carregado.pedido;

  const forma = (await formasDoCheckout({ valor_total: pedido.valor_total, avulso: pedido.avulso }))
    .find((f) => f.codigo === 'cartao_credito' && f.gateway === 'pagarme');
  if (!forma) return { ok: false, error: t('erros.formaIndisponivel') };
  const parcelas = Math.trunc(input.parcelas) || 1;
  if (!forma.opcoesParcelas.includes(parcelas)) return { ok: false, error: t('erros.parcelasIndisponivel') };

  // Endereço de cobrança e celular (antifraude).
  const cobranca = validarDadosCobranca({ endereco: input.endereco, telefone: input.telefone });
  if (!cobranca.ok) return { ok: false, error: t(`cartao.erros.${cobranca.campo}`), campo: `cobranca.${cobranca.campo}` };

  // Titular: terceiro (CPF/CNPJ), estrangeiro (documento oficial) ou o próprio cliente com CPF.
  let terceiro: Tomador | null = null;
  if (input.tomador && input.tomador.tipo !== 'proprio') {
    const v = validarTomador(input.tomador);
    if (!v.ok) {
      const chave = v.campo === 'documento' ? (input.tomador.tipo === 'cnpj' ? 'cnpj' : 'cpf') : v.campo;
      return { ok: false, error: t(`tomador.erros.${chave}`), campo: v.campo };
    }
    terceiro = v.tomador;
  }
  let estrangeiro: { pais: string; documento: string } | null = null;
  if (input.estrangeiro && !terceiro) {
    const v = validarDocumentoEstrangeiro(input.estrangeiro);
    if (!v.ok) return { ok: false, error: t(v.campo === 'pais' ? 'erros.paisInvalido' : 'erros.documentoEstrangeiroInvalido'), campo: v.campo };
    estrangeiro = v.valor;
  }

  // Já pago (ou em análise) aguardando confirmação? Não cobra de novo.
  const { data: abertos } = await supabaseAdmin
    .from('pagamento')
    .select('status')
    .eq('pedido_id', pedido.id)
    .in('status', [...PAGAMENTO_PAGO, 'em_analise']);
  if (abertos?.some((p) => PAGAMENTO_PAGO.includes(p.status as PagamentoStatus))) return { ok: false, error: t('erros.confirmandoPago') };
  if (abertos?.length) return { ok: false, error: t('cartao.erros.emAnalise') };

  // Limite de tentativas (teste de cartões roubados).
  const umaHoraAtras = new Date(Date.now() - 60 * 60_000).toISOString();
  const { count: tentativas } = await supabaseAdmin
    .from('pagamento')
    .select('id', { count: 'exact', head: true })
    .eq('pedido_id', pedido.id)
    .eq('gateway', 'pagarme')
    .gte('criado_em', umaHoraAtras);
  if ((tentativas ?? 0) >= MAX_TENTATIVAS_HORA) {
    console.warn('[pagamentos/cartao] limite de tentativas', pedido.id, input.userId);
    return { ok: false, error: t('cartao.erros.limite') };
  }

  const { data: usuario } = await supabaseAdmin
    .from('users')
    .select('name, email, cpf_cnpj')
    .eq('id', input.userId)
    .single();
  if (!usuario) return { ok: false, error: t('erros.cadastro') };
  const nomeCliente = usuario.name.trim() || 'Cliente Boatzy';

  // Snapshot do titular (comprovante) e o customer da Pagar.me.
  const { endereco, telefone } = cobranca.dados;
  const enderecoPagarme = enderecoParaPagarme(endereco);
  const celular = { country_code: telefone.ddi, area_code: telefone.area, number: telefone.numero };
  let tomador: Tomador;
  let cliente: PagarmeCliente;
  if (terceiro) {
    tomador = terceiro;
    cliente = {
      name: terceiro.nome, email: usuario.email, code: input.userId,
      type: terceiro.tipo === 'cnpj' ? 'company' : 'individual',
      document: terceiro.documento, document_type: terceiro.tipo === 'cnpj' ? 'CNPJ' : 'CPF',
      address: enderecoPagarme, phones: { mobile_phone: celular },
    };
  } else if (estrangeiro) {
    await supabaseAdmin
      .from('users')
      .update({ documento_estrangeiro: estrangeiro.documento, pais_documento: estrangeiro.pais })
      .eq('id', input.userId);
    tomador = {
      tipo: 'proprio', nome: nomeCliente, documento: estrangeiro.documento, pais: estrangeiro.pais, nome_fantasia: null,
      email: usuario.email, telefone: null,
      cep: null, logradouro: null, numero: null, complemento: null, bairro: null, cidade: null, uf: null,
    };
    // A Pagar.me só tem PASSPORT para documento estrangeiro — vale para DNI, cédula, RUT… (SPEC §109).
    cliente = {
      name: nomeCliente, email: usuario.email, code: input.userId, type: 'individual',
      document: estrangeiro.documento, document_type: 'PASSPORT',
      address: enderecoPagarme, phones: { mobile_phone: celular },
    };
  } else {
    let cpf = usuario.cpf_cnpj && isValidCPF(usuario.cpf_cnpj) ? onlyDigits(usuario.cpf_cnpj) : null;
    if (!cpf) {
      if (!input.cpf || !isValidCPF(input.cpf)) return { ok: false, error: t('erros.cpfInvalido'), campo: 'cpf' };
      cpf = onlyDigits(input.cpf);
      await supabaseAdmin.from('users').update({ cpf_cnpj: cpf }).eq('id', input.userId);
    }
    const tel = `${telefone.area}${telefone.numero}`;
    tomador = {
      tipo: 'proprio', nome: nomeCliente, documento: cpf, pais: null, nome_fantasia: null,
      email: usuario.email, telefone: telefone.ddi === '55' && tel.length >= 10 && tel.length <= 11 ? tel : null,
      cep: null, logradouro: null, numero: null, complemento: null, bairro: null, cidade: null, uf: null,
    };
    cliente = {
      name: nomeCliente, email: usuario.email, code: input.userId, type: 'individual',
      document: cpf, document_type: 'CPF', address: enderecoPagarme, phones: { mobile_phone: celular },
    };
  }

  // Pix pendente do mesmo pedido: remove antes, para o cliente não pagar duas vezes.
  const cancelamento = await cancelarCobrancasPendentes(pedido.id);
  if (!cancelamento.ok) return { ok: false, error: t('erros.trocarForma') };

  const valores = valorParcelado(pedido.valor_total, parcelas, forma.juros);

  const { data: pagamento, error: errPagamento } = await supabaseAdmin
    .from('pagamento')
    .insert({
      pedido_id: pedido.id,
      forma_pagamento: 'cartao_credito',
      gateway: 'pagarme',
      ambiente: cfg.config.ambiente,
      numero_parcelas: parcelas,
      valor: valores.total,
      valor_juros: valores.juros,
    })
    .select('id')
    .single();
  if (errPagamento || !pagamento) {
    console.error('[pagamentos/cartao] falha ao criar pagamento', pedido.id, errPagamento?.message);
    return { ok: false, error: t('erros.iniciar') };
  }
  const { error: errTomador } = await supabaseAdmin.from('pagamento_tomador').insert({ pagamento_id: pagamento.id, ...tomador });
  if (errTomador) {
    console.error('[pagamentos/cartao] falha ao gravar tomador', pagamento.id, errTomador.message);
    await supabaseAdmin.from('pagamento').update({ status: 'cancelado' }).eq('id', pagamento.id);
    return { ok: false, error: t('erros.iniciar') };
  }

  const dataPasseio = new Date(`${pedido.reserva.data_reserva}T12:00:00`).toLocaleDateString('pt-BR', { timeZone: FUSO_HORARIO });
  let resposta: PagarmePedido | null = null;
  try {
    resposta = await criarPedidoCartao({
      code: pagamento.id,
      itemCodigo: String(pedido.numero),
      descricao: pedido.avulso
        ? `Boatzy · Cobrança #${pedido.numero} · ${pedido.avulso.titulo} · ref. ${pedido.reserva.item_nome} ${dataPasseio}`
        : `Boatzy · Pedido #${pedido.numero} · ${pedido.reserva.item_nome} · ${dataPasseio}`,
      valorCentavos: paraCentavos(valores.total),
      parcelas,
      cardToken: input.cardToken,
      cliente,
      enderecoCobranca: enderecoPagarme,
      metadata: { pedido_id: pedido.id, pagamento_id: pagamento.id, pedido_numero: String(pedido.numero) },
    });
  } catch (err) {
    // Timeout/rede: o pedido pode ter sido criado — consulta pelo `code` antes de desistir.
    if (err instanceof PagarmeError && (err.codigo === 'timeout' || err.codigo === 'rede')) {
      resposta = await buscarPedidoPorCode(pagamento.id).catch(() => null);
    }
    if (!resposta) {
      const mensagem = mensagemErroPagarme(err);
      console.error('[pagamentos/cartao] falha ao criar pedido na Pagar.me', pagamento.id, mensagem);
      await supabaseAdmin.from('pagamento').update({ status: 'cancelado' }).eq('id', pagamento.id);
      await supabaseAdmin.from('pagamento_transacao').insert({
        pagamento_id: pagamento.id,
        gateway: 'pagarme',
        tipo: 'falha_criacao',
        valor: valores.total,
        payload: {
          erro: mensagem,
          codigo: err instanceof PagarmeError ? err.codigo : null,
          status_http: err instanceof PagarmeError ? err.status : null,
        },
      });
      // 4xx = dados recusados (ex.: endereço/documento): o cliente pode corrigir.
      if (err instanceof PagarmeError && err.status >= 400 && err.status < 500 && err.status !== 401) {
        return { ok: false, error: t('cartao.erros.dadosRecusados') };
      }
      return { ok: false, error: t('erros.gerarCobranca') };
    }
  }

  const r = await aplicarPedidoPagarme(resposta, { evento: null, eventoId: null, ocorridoEm: null, origem: 'checkout' });
  await registrarEventoPedido({
    pedidoId: pedido.id,
    evento: 'cobranca_gerada',
    atorId: input.userId,
    atorPapel: 'cliente',
    dados: {
      pagamento_id: pagamento.id, forma: 'cartao_credito', gateway: 'pagarme', parcelas,
      juros: valores.juros, gateway_pedido_id: resposta.id, resultado: r.statusNovo ?? null,
      tomador_tipo: tomador.tipo, tomador_nome: tomador.nome, tomador_documento: tomador.documento,
    },
  });

  if (r.statusNovo === 'confirmado' || r.statusNovo === 'recebido') return { ok: true, situacao: 'aprovado' };
  if (r.statusNovo === 'em_analise' || r.statusNovo === 'pendente') return { ok: true, situacao: 'em_analise' };
  const motivo = motivoRecusa(r.cobranca ?? null);
  return { ok: false, error: t(`cartao.recusa.${motivo}`), motivo };
}
