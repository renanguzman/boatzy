'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { checkRoleInDb } from '@/lib/roles';
import { lerAsaasConfig, lerTokenWebhook, type AsaasAmbiente } from '@/lib/asaas/config';
import { mensagemErroAsaas } from '@/lib/asaas/client';
import { consultarSaldo } from '@/lib/asaas/financeiro';
import { criarWebhook, listarWebhooks, reativarFilaWebhook } from '@/lib/asaas/webhooks';
import { criarChavePixAleatoria, listarChavesPix } from '@/lib/asaas/pix';
import { registrarAuditoria } from '@/lib/financeiro/auditoria';
import {
  reprocessarEventoManual,
  reprocessarPendentes,
  type ResumoReprocessamento,
} from '@/lib/asaas/eventos';
import type { AsaasWebhookEventoStatus } from '@/types/supabase';

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const CAMINHO = '/administrator/financeiro/integracao';

async function requireAdmin(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const isAdmin = await checkRoleInDb(user.id, ['admin']);
  if (!isAdmin) return { ok: false, error: 'Acesso não autorizado.' };

  return { ok: true, userId: user.id };
}

/** Chamada real à API (saldo da conta) — confirma chave, URL e User-Agent de uma vez. */
export async function testarConexaoAsaas(): Promise<
  ActionResult<{ saldo: number; ambiente: AsaasAmbiente; latenciaMs: number }>
> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const cfg = lerAsaasConfig();
  if (!cfg.ok) return { ok: false, error: cfg.erro };

  const inicio = Date.now();
  try {
    const saldo = await consultarSaldo();
    return { ok: true, saldo, ambiente: cfg.config.ambiente, latenciaMs: Date.now() - inicio };
  } catch (err) {
    return { ok: false, error: mensagemErroAsaas(err) };
  }
}

/**
 * Confirma que a URL é o nosso endpoint, sem redirecionamento (o Asaas não segue
 * redirects em POST — cada entrega falharia e a fila seria pausada): um POST sem
 * token deve devolver o 401 do próprio endpoint.
 */
async function verificarEndpointWebhook(url: string): Promise<string | null> {
  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
  } catch {
    return 'Não foi possível acessar a URL informada.';
  }

  if (resposta.status >= 300 && resposta.status < 400) {
    const destino = resposta.headers.get('location');
    return `A URL redireciona${destino ? ` para ${destino}` : ''} — o Asaas não segue redirecionamentos. Cadastre a URL final.`;
  }
  if (resposta.status === 404) {
    return 'Endpoint não encontrado nessa URL (404). O código da integração já foi publicado nesse domínio?';
  }
  const corpo = (await resposta.json().catch(() => null)) as { error?: string } | null;
  if (resposta.status !== 401 || corpo?.error !== 'unauthorized') {
    return `Resposta inesperada da URL (${resposta.status}). Confira se ela aponta para /api/webhooks/asaas deste sistema.`;
  }
  return null;
}

/** Cadastra o webhook do Boatzy na conta Asaas, com o token de ASAAS_WEBHOOK_TOKEN. */
export async function cadastrarWebhookAsaas(input: { url: string; email: string }): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const token = lerTokenWebhook();
  if (!token) {
    return { ok: false, error: 'Configure ASAAS_WEBHOOK_TOKEN (32–255 caracteres, sem espaços) antes de cadastrar.' };
  }

  const url = input.url.trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: 'URL inválida.' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, error: 'A URL precisa ser https.' };
  if (['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname)) {
    return { ok: false, error: 'O Asaas não alcança localhost — use um túnel (cloudflared/ngrok) ou um deploy de preview.' };
  }

  const email = input.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'E-mail inválido.' };

  const erroEndpoint = await verificarEndpointWebhook(url);
  if (erroEndpoint) return { ok: false, error: erroEndpoint };

  try {
    const existentes = await listarWebhooks();
    if (existentes.some((w) => w.url.replace(/\/+$/, '') === url.replace(/\/+$/, ''))) {
      return { ok: false, error: 'Já existe um webhook cadastrado para essa URL.' };
    }
    await criarWebhook({ url, email, authToken: token });
  } catch (err) {
    return { ok: false, error: mensagemErroAsaas(err) };
  }

  console.info('[admin/financeiro] webhook Asaas cadastrado por', auth.userId, url);
  revalidatePath(CAMINHO);
  return { ok: true };
}

/** Retoma a fila de um webhook pausado pelo Asaas (após 15 falhas seguidas). */
export async function reativarWebhookAsaas(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!id) return { ok: false, error: 'Webhook inválido.' };

  try {
    await reativarFilaWebhook(id);
  } catch (err) {
    return { ok: false, error: mensagemErroAsaas(err) };
  }

  console.info('[admin/financeiro] fila do webhook Asaas reativada por', auth.userId, id);
  revalidatePath(CAMINHO);
  return { ok: true };
}

export async function reprocessarEventoAsaas(id: string): Promise<ActionResult<{ status: AsaasWebhookEventoStatus | null }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!id) return { ok: false, error: 'Evento inválido.' };

  try {
    const status = await reprocessarEventoManual(id);
    revalidatePath(CAMINHO);
    return { ok: true, status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erro ao reprocessar.' };
  }
}

export async function reprocessarPendentesAsaas(): Promise<ActionResult<{ resumo: ResumoReprocessamento }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  try {
    const resumo = await reprocessarPendentes();
    revalidatePath(CAMINHO);
    return { ok: true, resumo };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erro ao reprocessar.' };
  }
}

/**
 * Cria uma chave Pix aleatória (EVP) na conta Asaas do ambiente atual. Sem
 * chave ativa o Asaas recusa cobranças Pix. Só cria se ainda não houver
 * nenhuma chave ativa ou aguardando ativação.
 */
export async function criarChavePixAsaas(): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  try {
    const existentes = await listarChavesPix();
    if (existentes.some((k) => k.status === 'ACTIVE' || k.status === 'AWAITING_ACTIVATION')) {
      return { ok: false, error: 'A conta já tem uma chave Pix ativa ou aguardando ativação.' };
    }
    const chave = await criarChavePixAleatoria();
    await registrarAuditoria({
      adminId: auth.userId,
      acao: 'asaas.chave_pix.criar',
      entidade: 'asaas_chave_pix',
      entidadeId: chave.id,
      depois: { id: chave.id, type: chave.type, status: chave.status },
    });
  } catch (err) {
    return { ok: false, error: mensagemErroAsaas(err) };
  }

  revalidatePath(CAMINHO);
  return { ok: true };
}
