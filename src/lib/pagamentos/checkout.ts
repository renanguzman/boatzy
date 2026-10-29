import 'server-only';

import { getTranslations } from 'next-intl/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isValidCPF, onlyDigits } from '@/lib/validators';
import { lerAsaasConfig } from '@/lib/asaas/config';
import { AsaasError, mensagemErroAsaas } from '@/lib/asaas/client';
import { garantirClienteAsaas, garantirClienteAsaasTomador } from '@/lib/asaas/clientes';
import { buscarCobrancaPorReferencia, criarCobranca, obterQrCodePix } from '@/lib/asaas/cobrancas';
import type { AsaasCobranca } from '@/lib/asaas/tipos';
import { getFormasPagamento, type FormaPagamento } from '@/lib/financeiro/config';
import type { FormaPagamentoCodigo, Json } from '@/types/supabase';
import { cancelarCobrancasPendentes, PAGAMENTO_PAGO } from './pedidos';
import { registrarEventoPedido } from './historico';
import { opcoesParcelas, VALOR_MINIMO_COBRANCA } from './valores';
import { FUSO_HORARIO } from '@/lib/datas';
import { mesmoTomador, validarTomador, type CampoTomador, type Tomador, type TomadorForm, type TomadorRegistro } from './tomador';

export type PixParaPagar = { imagem: string; payload: string; expiraEm: string | null };

export type IniciarPagamentoResultado =
  | { ok: true; forma: 'pix'; pix: PixParaPagar }
  | { ok: true; forma: 'cartao_credito'; faturaUrl: string }
  | { ok: false; error: string; campo?: 'cpf' | CampoTomador };

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://boatzy.app').trim().replace(/\/+$/, '');
}

/** "AAAA-MM-DD HH:mm:ss" (Brasília) → ISO. */
function dataAsaasParaIso(d: string | null | undefined): string | null {
  if (!d || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(d)) return null;
  return `${d.replace(' ', 'T')}-03:00`;
}

function dataSaoPaulo(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

export type FormaPermitida = { codigo: FormaPagamentoCodigo; nome: string; opcoesParcelas: number[] };

/**
 * Formas e parcelas que o cliente pode usar neste pedido: as formas ativas na
 * configuração global (Admin → Financeiro) e, na cobrança avulsa, só as que o
 * gestor liberou, com o nº de parcelas limitado pelos dois (SPEC §34.16).
 */
export function formasPermitidasDoPedido(
  formas: FormaPagamento[],
  pedido: { valor_total: number; avulso?: { formas_permitidas: FormaPagamentoCodigo[]; parcelas_max: number } | null },
): FormaPermitida[] {
  const total = Number(pedido.valor_total);
  return formas
    .filter((f) => f.ativo && (!pedido.avulso || pedido.avulso.formas_permitidas.includes(f.codigo as FormaPagamentoCodigo)))
    .map((f) => {
      const max = pedido.avulso ? Math.min(f.parcelas_max, pedido.avulso.parcelas_max) : f.parcelas_max;
      return {
        codigo: f.codigo as FormaPagamentoCodigo,
        nome: f.nome,
        opcoesParcelas: f.codigo === 'cartao_credito'
          ? opcoesParcelas(total, max, f.valor_minimo_parcela != null ? Number(f.valor_minimo_parcela) : null)
          : [1],
      };
    });
}

/** Página de pagamento do pedido: `/reservas/[id]/pagar` (reserva) ou `/cobrancas/[id]` (avulso). */
export function caminhoPagamentoPedido(p: { id: string; tipo: string; reserva_id: string | null }): string {
  return p.tipo === 'avulso' || !p.reserva_id ? `/cobrancas/${p.id}` : `/reservas/${p.reserva_id}/pagar`;
}

async function carregarQrCode(pagamentoId: string, asaasPaymentId: string): Promise<PixParaPagar> {
  const qr = await obterQrCodePix(asaasPaymentId);
  const expiraEm = dataAsaasParaIso(qr.expirationDate);
  await supabaseAdmin
    .from('pagamento')
    .update({ pix_qrcode_payload: qr.payload, pix_qrcode_expira_em: expiraEm })
    .eq('id', pagamentoId);
  return { imagem: qr.encodedImage, payload: qr.payload, expiraEm };
}

/**
 * Inicia (ou retoma) o pagamento de um pedido pelo cliente — pedido da reserva
 * ou cobrança avulsa (SPEC §34.16).
 *
 * - Reaproveita a cobrança pendente da mesma forma/parcelas (recarregar a
 *   página não gera outra cobrança); trocar de forma remove a anterior no Asaas.
 * - Cria o `pagamento` ANTES da cobrança e usa o id dele como
 *   `externalReference`: se a criação der timeout, consulta o Asaas por essa
 *   referência antes de desistir (evita cobrança duplicada).
 * - CPF é obrigatório para cobrar; se faltar no cadastro, vem do formulário e
 *   é salvo em `users.cpf_cnpj`.
 * - `tomador`: em nome de quem sai o pagamento (SPEC §97). Outra pessoa ou
 *   empresa → a cobrança vai para um customer do Asaas com esses dados (o CPF
 *   do cliente deixa de ser exigido); trocar o tomador refaz a cobrança. O
 *   snapshot fica em `pagamento_tomador` (comprovante, gestor e admin).
 */
export async function iniciarPagamento(input: {
  pedidoId: string;
  userId: string;
  forma: FormaPagamentoCodigo;
  parcelas: number;
  cpf?: string;
  tomador?: TomadorForm | null;
}): Promise<IniciarPagamentoResultado> {
  const t = await getTranslations('Pagamento.erros');
  const cfg = lerAsaasConfig();
  if (!cfg.ok) {
    console.error('[pagamentos/checkout] Asaas não configurado:', cfg.erro);
    return { ok: false, error: t('indisponivel') };
  }
  const ambiente = cfg.config.ambiente;

  type ReservaCheckout = { id: string; item_nome: string; data_reserva: string };
  const { data } = await supabaseAdmin
    .from('pedido')
    .select(
      `id, numero, tipo, status, valor_total, expira_em, reserva_id,
       reserva:reserva_id ( id, item_nome, data_reserva ),
       pedido_avulso ( titulo, formas_permitidas, parcelas_max, reserva:reserva_id ( id, item_nome, data_reserva ) )`,
    )
    .eq('id', input.pedidoId)
    .eq('cliente_id', input.userId)
    .maybeSingle();
  const pedido = data as unknown as {
    id: string; numero: number; tipo: string; status: string; valor_total: number; expira_em: string | null;
    reserva_id: string | null; reserva: ReservaCheckout | null;
    pedido_avulso: {
      titulo: string; formas_permitidas: FormaPagamentoCodigo[]; parcelas_max: number; reserva: ReservaCheckout | null;
    } | null;
  } | null;
  const avulso = pedido?.tipo === 'avulso' ? pedido.pedido_avulso : null;
  const reserva = avulso ? avulso.reserva : pedido?.reserva;
  if (!pedido || !reserva || (pedido.tipo === 'avulso' && !avulso)) return { ok: false, error: t('pedidoNaoEncontrado') };
  if (pedido.status !== 'aguardando_pagamento') return { ok: false, error: t('naoAguardando') };
  if (!pedido.expira_em || new Date(pedido.expira_em) <= new Date()) {
    return { ok: false, error: t('prazoTerminou') };
  }

  const valorTotal = Number(pedido.valor_total);
  if (valorTotal < VALOR_MINIMO_COBRANCA) {
    return { ok: false, error: t('abaixoMinimo') };
  }

  // Forma e parcelas permitidas pela configuração global (Admin → Financeiro → Configurações)
  // e, na cobrança avulsa, pelo que o gestor liberou.
  const forma = formasPermitidasDoPedido(await getFormasPagamento(), { valor_total: valorTotal, avulso })
    .find((f) => f.codigo === input.forma);
  if (!forma) return { ok: false, error: t('formaIndisponivel') };
  const parcelas = input.forma === 'cartao_credito' ? Math.trunc(input.parcelas) || 1 : 1;
  if (!forma.opcoesParcelas.includes(parcelas)) return { ok: false, error: t('parcelasIndisponivel') };

  // Tomador de terceiro (CPF/CNPJ) revalidado aqui; `null` = o próprio cliente.
  let terceiro: Tomador | null = null;
  if (input.tomador && input.tomador.tipo !== 'proprio') {
    const v = validarTomador(input.tomador);
    if (!v.ok) {
      const tTomador = await getTranslations('Pagamento.tomador.erros');
      return { ok: false, error: tTomador(v.campo === 'documento' ? (input.tomador.tipo === 'cnpj' ? 'cnpj' : 'cpf') : v.campo), campo: v.campo };
    }
    terceiro = v.tomador;
  }

  // Já existe pagamento confirmado aguardando o webhook? Não cobra de novo.
  const { count: pagos } = await supabaseAdmin
    .from('pagamento')
    .select('id', { count: 'exact', head: true })
    .eq('pedido_id', pedido.id)
    .in('status', PAGAMENTO_PAGO);
  if (pagos) return { ok: false, error: t('confirmandoPago') };

  // Reaproveita a cobrança pendente equivalente (mesma forma, parcelas e tomador).
  const { data: pendenteBruto } = await supabaseAdmin
    .from('pagamento')
    .select('id, asaas_payment_id, fatura_url, pagamento_tomador ( * )')
    .eq('pedido_id', pedido.id)
    .eq('status', 'pendente')
    .eq('forma_pagamento', input.forma)
    .eq('numero_parcelas', parcelas)
    .eq('ambiente', ambiente)
    .not('asaas_payment_id', 'is', null)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  const pendente = pendenteBruto as unknown as {
    id: string; asaas_payment_id: string | null; fatura_url: string | null;
    pagamento_tomador: TomadorRegistro | TomadorRegistro[] | null;
  } | null;
  const tomadorPendente = Array.isArray(pendente?.pagamento_tomador)
    ? (pendente.pagamento_tomador[0] ?? null)
    : (pendente?.pagamento_tomador ?? null);

  try {
    if (pendente?.asaas_payment_id && mesmoTomador(tomadorPendente, terceiro)) {
      await cancelarCobrancasPendentes(pedido.id, { excetoPagamentoId: pendente.id });
      if (input.forma === 'pix') {
        return { ok: true, forma: 'pix', pix: await carregarQrCode(pendente.id, pendente.asaas_payment_id) };
      }
      if (pendente.fatura_url) return { ok: true, forma: 'cartao_credito', faturaUrl: pendente.fatura_url };
    }

    // Troca de forma/tomador (ou 1ª tentativa): remove qualquer cobrança pendente anterior.
    const cancelamento = await cancelarCobrancasPendentes(pedido.id);
    if (!cancelamento.ok) {
      return { ok: false, error: t('trocarForma') };
    }

    let customer: string;
    let tomador: Tomador;
    if (terceiro) {
      try {
        customer = await garantirClienteAsaasTomador({ userId: input.userId, tomador: terceiro });
      } catch (err) {
        // Dados recusados pelo Asaas (ex.: CEP inexistente): mostra o motivo para o cliente corrigir.
        if (err instanceof AsaasError && err.status === 400) {
          return { ok: false, error: t('tomadorRecusado', { motivo: err.message }) };
        }
        throw err;
      }
      tomador = terceiro;
    } else {
      // Dados do cliente (CPF obrigatório para o Asaas).
      const { data: usuario } = await supabaseAdmin
        .from('users')
        .select('name, email, phone, cpf_cnpj')
        .eq('id', input.userId)
        .single();
      if (!usuario) return { ok: false, error: t('cadastro') };
      let cpf = usuario.cpf_cnpj && isValidCPF(usuario.cpf_cnpj) ? onlyDigits(usuario.cpf_cnpj) : null;
      if (!cpf) {
        if (!input.cpf || !isValidCPF(input.cpf)) {
          return { ok: false, error: t('cpfInvalido'), campo: 'cpf' };
        }
        cpf = onlyDigits(input.cpf);
        await supabaseAdmin.from('users').update({ cpf_cnpj: cpf }).eq('id', input.userId);
      }

      const celular = usuario.phone ? onlyDigits(usuario.phone) : null;
      customer = await garantirClienteAsaas({
        userId: input.userId,
        ambiente,
        nome: usuario.name,
        cpfCnpj: cpf,
        email: usuario.email,
        celular,
      });
      tomador = {
        tipo: 'proprio', nome: usuario.name.trim() || 'Cliente Boatzy', documento: cpf, nome_fantasia: null,
        email: usuario.email, telefone: celular && celular.length >= 10 && celular.length <= 11 ? celular : null,
        cep: null, logradouro: null, numero: null, complemento: null, bairro: null, cidade: null, uf: null,
      };
    }

    const { data: pagamento, error: errPagamento } = await supabaseAdmin
      .from('pagamento')
      .insert({
        pedido_id: pedido.id,
        forma_pagamento: input.forma,
        ambiente,
        numero_parcelas: parcelas,
        valor: valorTotal,
        asaas_customer_id: customer,
      })
      .select('id')
      .single();
    if (errPagamento || !pagamento) return { ok: false, error: t('iniciar') };

    // Snapshot do tomador: sem ele o comprovante sairia em nome errado — não segue sem gravar.
    const { error: errTomador } = await supabaseAdmin
      .from('pagamento_tomador')
      .insert({ pagamento_id: pagamento.id, ...tomador });
    if (errTomador) {
      console.error('[pagamentos/checkout] falha ao gravar tomador', pagamento.id, errTomador.message);
      await supabaseAdmin.from('pagamento').update({ status: 'cancelado' }).eq('id', pagamento.id);
      return { ok: false, error: t('iniciar') };
    }

    const dataPasseio = new Date(`${reserva.data_reserva}T12:00:00`).toLocaleDateString('pt-BR', { timeZone: FUSO_HORARIO });
    let cobranca: AsaasCobranca | null = null;
    try {
      cobranca = await criarCobranca({
        customer,
        billingType: input.forma === 'pix' ? 'PIX' : 'CREDIT_CARD',
        valorTotal,
        parcelas,
        vencimento: dataSaoPaulo(new Date(pedido.expira_em)),
        descricao: avulso
          ? `Boatzy · Cobrança #${pedido.numero} · ${avulso.titulo} · ref. ${reserva.item_nome} ${dataPasseio}`
          : `Boatzy · Pedido #${pedido.numero} · ${reserva.item_nome} · ${dataPasseio}`,
        externalReference: pagamento.id,
        urlRetorno: input.forma === 'cartao_credito' ? `${baseUrl()}${caminhoPagamentoPedido(pedido)}?retorno=1` : undefined,
      });
    } catch (err) {
      // Timeout/falha de rede: a cobrança pode ter sido criada — consulta antes de desistir.
      if (err instanceof AsaasError && (err.codigo === 'timeout' || err.codigo === 'rede')) {
        cobranca = await buscarCobrancaPorReferencia(pagamento.id).catch(() => null);
      }
      if (!cobranca) {
        // Guarda o motivo no histórico da tentativa (aparece em Admin → Pedidos).
        await supabaseAdmin.from('pagamento').update({ status: 'cancelado' }).eq('id', pagamento.id);
        await supabaseAdmin.from('pagamento_transacao').insert({
          pagamento_id: pagamento.id,
          tipo: 'falha_criacao',
          valor: valorTotal,
          payload: {
            erro: mensagemErroAsaas(err),
            codigo: err instanceof AsaasError ? err.codigo : null,
            status_http: err instanceof AsaasError ? err.status : null,
          },
        });
        if (err instanceof AsaasError && input.forma === 'pix' && /chave pix/i.test(err.message)) {
          console.error('[pagamentos/checkout] conta Asaas sem chave Pix ativa:', err.message);
          return { ok: false, error: t('pixIndisponivel') };
        }
        throw err;
      }
    }

    await supabaseAdmin
      .from('pagamento')
      .update({
        asaas_payment_id: cobranca.id,
        asaas_parcelamento_id: cobranca.installment ?? null,
        status_asaas: cobranca.status,
        vencimento: cobranca.dueDate ?? null,
        fatura_url: cobranca.invoiceUrl ?? null,
        numero_fatura: cobranca.invoiceNumber ?? null,
        ultimo_payload: cobranca as unknown as Json,
      })
      .eq('id', pagamento.id);
    await supabaseAdmin
      .from('pagamento_transacao')
      .insert({ pagamento_id: pagamento.id, tipo: 'criacao', status_asaas: cobranca.status, valor: valorTotal });
    await registrarEventoPedido({
      pedidoId: pedido.id,
      evento: 'cobranca_gerada',
      atorId: input.userId,
      atorPapel: 'cliente',
      dados: {
        pagamento_id: pagamento.id, forma: input.forma, parcelas, asaas_payment_id: cobranca.id,
        tomador_tipo: tomador.tipo, tomador_nome: tomador.nome, tomador_documento: tomador.documento,
      },
    });

    if (input.forma === 'pix') {
      return { ok: true, forma: 'pix', pix: await carregarQrCode(pagamento.id, cobranca.id) };
    }
    if (!cobranca.invoiceUrl) return { ok: false, error: t('abrirPagina') };
    return { ok: true, forma: 'cartao_credito', faturaUrl: cobranca.invoiceUrl };
  } catch (err) {
    console.error('[pagamentos/checkout] falha ao iniciar pagamento', input.pedidoId, mensagemErroAsaas(err));
    return { ok: false, error: t('gerarCobranca') };
  }
}

/**
 * QR Code do Pix pendente do pedido, para a página de pagamento já abrir com
 * ele (recarregar a página não gera outra cobrança). `null` se não houver.
 */
export async function retomarPixPendente(pedidoId: string): Promise<PixParaPagar | null> {
  const cfg = lerAsaasConfig();
  if (!cfg.ok) return null;
  const { data: pendente } = await supabaseAdmin
    .from('pagamento')
    .select('id, asaas_payment_id')
    .eq('pedido_id', pedidoId)
    .eq('status', 'pendente')
    .eq('forma_pagamento', 'pix')
    .eq('ambiente', cfg.config.ambiente)
    .not('asaas_payment_id', 'is', null)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!pendente?.asaas_payment_id) return null;
  try {
    return await carregarQrCode(pendente.id, pendente.asaas_payment_id);
  } catch (err) {
    console.error('[pagamentos/checkout] falha ao retomar QR Pix', pendente.id, mensagemErroAsaas(err));
    return null;
  }
}
