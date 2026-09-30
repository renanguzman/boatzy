import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { isValidCPF, onlyDigits } from '@/lib/validators';
import { lerAsaasConfig } from '@/lib/asaas/config';
import { AsaasError, mensagemErroAsaas } from '@/lib/asaas/client';
import { garantirClienteAsaas } from '@/lib/asaas/clientes';
import { buscarCobrancaPorReferencia, criarCobranca, obterQrCodePix } from '@/lib/asaas/cobrancas';
import type { AsaasCobranca } from '@/lib/asaas/tipos';
import { getFormasPagamento } from '@/lib/financeiro/config';
import type { FormaPagamentoCodigo, Json } from '@/types/supabase';
import { cancelarCobrancasPendentes, PAGAMENTO_PAGO } from './pedidos';
import { opcoesParcelas, VALOR_MINIMO_COBRANCA } from './valores';
import { FUSO_HORARIO } from '@/lib/datas';

export type PixParaPagar = { imagem: string; payload: string; expiraEm: string | null };

export type IniciarPagamentoResultado =
  | { ok: true; forma: 'pix'; pix: PixParaPagar }
  | { ok: true; forma: 'cartao_credito'; faturaUrl: string }
  | { ok: false; error: string; campo?: 'cpf' };

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
 * Inicia (ou retoma) o pagamento do pedido de uma reserva pelo cliente.
 *
 * - Reaproveita a cobrança pendente da mesma forma/parcelas (recarregar a
 *   página não gera outra cobrança); trocar de forma remove a anterior no Asaas.
 * - Cria o `pagamento` ANTES da cobrança e usa o id dele como
 *   `externalReference`: se a criação der timeout, consulta o Asaas por essa
 *   referência antes de desistir (evita cobrança duplicada).
 * - CPF é obrigatório para cobrar; se faltar no cadastro, vem do formulário e
 *   é salvo em `users.cpf_cnpj`.
 */
export async function iniciarPagamento(input: {
  reservaId: string;
  userId: string;
  forma: FormaPagamentoCodigo;
  parcelas: number;
  cpf?: string;
}): Promise<IniciarPagamentoResultado> {
  const cfg = lerAsaasConfig();
  if (!cfg.ok) {
    console.error('[pagamentos/checkout] Asaas não configurado:', cfg.erro);
    return { ok: false, error: 'Pagamento indisponível no momento. Tente novamente mais tarde.' };
  }
  const ambiente = cfg.config.ambiente;

  const { data: pedido } = await supabaseAdmin
    .from('pedido')
    .select('id, numero, status, valor_total, expira_em, reserva:reserva_id ( id, item_nome, data_reserva )')
    .eq('reserva_id', input.reservaId)
    .eq('cliente_id', input.userId)
    .maybeSingle();
  const reserva = (pedido as unknown as { reserva: { id: string; item_nome: string; data_reserva: string } | null } | null)?.reserva;
  if (!pedido || !reserva) return { ok: false, error: 'Pedido não encontrado.' };
  if (pedido.status !== 'aguardando_pagamento') return { ok: false, error: 'Este pedido não está mais aguardando pagamento.' };
  if (!pedido.expira_em || new Date(pedido.expira_em) <= new Date()) {
    return { ok: false, error: 'O prazo para pagar este pedido terminou.' };
  }

  const valorTotal = Number(pedido.valor_total);
  if (valorTotal < VALOR_MINIMO_COBRANCA) {
    return { ok: false, error: 'O valor deste pedido está abaixo do mínimo para pagamento online. Fale com o gestor.' };
  }

  // Forma e parcelas permitidas pela configuração global (Admin → Financeiro → Configurações).
  const formas = await getFormasPagamento();
  const forma = formas.find((f) => f.codigo === input.forma && f.ativo);
  if (!forma) return { ok: false, error: 'Forma de pagamento indisponível.' };
  const parcelas = input.forma === 'cartao_credito' ? Math.trunc(input.parcelas) || 1 : 1;
  const permitidas = opcoesParcelas(
    valorTotal,
    forma.parcelas_max,
    forma.valor_minimo_parcela != null ? Number(forma.valor_minimo_parcela) : null,
  );
  if (!permitidas.includes(parcelas)) return { ok: false, error: 'Número de parcelas indisponível.' };

  // Já existe pagamento confirmado aguardando o webhook? Não cobra de novo.
  const { count: pagos } = await supabaseAdmin
    .from('pagamento')
    .select('id', { count: 'exact', head: true })
    .eq('pedido_id', pedido.id)
    .in('status', PAGAMENTO_PAGO);
  if (pagos) return { ok: false, error: 'Recebemos seu pagamento e estamos confirmando. Atualize a página em instantes.' };

  // Reaproveita a cobrança pendente equivalente.
  const { data: pendente } = await supabaseAdmin
    .from('pagamento')
    .select('id, asaas_payment_id, fatura_url')
    .eq('pedido_id', pedido.id)
    .eq('status', 'pendente')
    .eq('forma_pagamento', input.forma)
    .eq('numero_parcelas', parcelas)
    .eq('ambiente', ambiente)
    .not('asaas_payment_id', 'is', null)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();

  try {
    if (pendente?.asaas_payment_id) {
      await cancelarCobrancasPendentes(pedido.id, { excetoPagamentoId: pendente.id });
      if (input.forma === 'pix') {
        return { ok: true, forma: 'pix', pix: await carregarQrCode(pendente.id, pendente.asaas_payment_id) };
      }
      if (pendente.fatura_url) return { ok: true, forma: 'cartao_credito', faturaUrl: pendente.fatura_url };
    }

    // Troca de forma (ou 1ª tentativa): remove qualquer cobrança pendente anterior.
    const cancelamento = await cancelarCobrancasPendentes(pedido.id);
    if (!cancelamento.ok) {
      return { ok: false, error: 'Não foi possível trocar a forma de pagamento agora. Tente novamente em instantes.' };
    }

    // Dados do cliente (CPF obrigatório para o Asaas).
    const { data: usuario } = await supabaseAdmin
      .from('users')
      .select('name, email, phone, cpf_cnpj')
      .eq('id', input.userId)
      .single();
    if (!usuario) return { ok: false, error: 'Cadastro não encontrado.' };
    let cpf = usuario.cpf_cnpj && isValidCPF(usuario.cpf_cnpj) ? onlyDigits(usuario.cpf_cnpj) : null;
    if (!cpf) {
      if (!input.cpf || !isValidCPF(input.cpf)) {
        return { ok: false, error: 'Informe um CPF válido para pagar.', campo: 'cpf' };
      }
      cpf = onlyDigits(input.cpf);
      await supabaseAdmin.from('users').update({ cpf_cnpj: cpf }).eq('id', input.userId);
    }

    const customer = await garantirClienteAsaas({
      userId: input.userId,
      ambiente,
      nome: usuario.name,
      cpfCnpj: cpf,
      email: usuario.email,
      celular: usuario.phone ? onlyDigits(usuario.phone) : null,
    });

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
    if (errPagamento || !pagamento) return { ok: false, error: 'Não foi possível iniciar o pagamento.' };

    const dataPasseio = new Date(`${reserva.data_reserva}T12:00:00`).toLocaleDateString('pt-BR', { timeZone: FUSO_HORARIO });
    let cobranca: AsaasCobranca | null = null;
    try {
      cobranca = await criarCobranca({
        customer,
        billingType: input.forma === 'pix' ? 'PIX' : 'CREDIT_CARD',
        valorTotal,
        parcelas,
        vencimento: dataSaoPaulo(new Date(pedido.expira_em)),
        descricao: `Boatzy · Pedido #${pedido.numero} · ${reserva.item_nome} · ${dataPasseio}`,
        externalReference: pagamento.id,
        urlRetorno: input.forma === 'cartao_credito' ? `${baseUrl()}/reservas/${input.reservaId}/pagar?retorno=1` : undefined,
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
          return { ok: false, error: 'O pagamento por Pix está indisponível no momento. Use o cartão de crédito ou tente mais tarde.' };
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

    if (input.forma === 'pix') {
      return { ok: true, forma: 'pix', pix: await carregarQrCode(pagamento.id, cobranca.id) };
    }
    if (!cobranca.invoiceUrl) return { ok: false, error: 'Não foi possível abrir a página de pagamento.' };
    return { ok: true, forma: 'cartao_credito', faturaUrl: cobranca.invoiceUrl };
  } catch (err) {
    console.error('[pagamentos/checkout] falha ao iniciar pagamento', input.reservaId, mensagemErroAsaas(err));
    return { ok: false, error: 'Não foi possível gerar a cobrança agora. Tente novamente em instantes.' };
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
