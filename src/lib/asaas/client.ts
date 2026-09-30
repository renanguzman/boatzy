import 'server-only';

import { lerAsaasConfig } from './config';

/**
 * Cliente HTTP mínimo da API v3 do Asaas.
 *
 * - Autenticação pelo header `access_token` (não é Bearer) + `User-Agent`
 *   obrigatório para contas criadas a partir de 06/2024.
 * - `429`: não repete — devolve `AsaasError` com o tempo de espera do header
 *   `RateLimit-Reset`. Limites: 25 mil requisições / 12h, 50 GETs concorrentes.
 * - Timeout: devolve `AsaasError` com `codigo = 'timeout'`. Em criações
 *   (POST), o chamador deve **consultar antes de repetir** (pelo
 *   `externalReference`) — repetir às cegas pode duplicar cobrança/transferência.
 * - Nunca loga a chave nem o corpo das requisições.
 */

export type AsaasErroItem = { code: string; description: string };

export class AsaasError extends Error {
  readonly status: number;
  readonly codigo: string | null;
  readonly erros: AsaasErroItem[];
  /** Segundos até liberar o limite (só em `429`). */
  readonly esperarSegundos: number | null;

  constructor(
    mensagem: string,
    opts: { status: number; codigo?: string | null; erros?: AsaasErroItem[]; esperarSegundos?: number | null },
  ) {
    super(mensagem);
    this.name = 'AsaasError';
    this.status = opts.status;
    this.codigo = opts.codigo ?? opts.erros?.[0]?.code ?? null;
    this.erros = opts.erros ?? [];
    this.esperarSegundos = opts.esperarSegundos ?? null;
  }
}

type Metodo = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type AsaasRequestOpts = {
  metodo?: Metodo;
  corpo?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  timeoutMs?: number;
};

const TIMEOUT_PADRAO_MS = 15_000;

export async function asaasRequest<T>(caminho: string, opts: AsaasRequestOpts = {}): Promise<T> {
  const cfg = lerAsaasConfig();
  if (!cfg.ok) throw new AsaasError(cfg.erro, { status: 0, codigo: 'config' });
  const { apiUrl, apiKey, ambiente } = cfg.config;

  const metodo = opts.metodo ?? 'GET';
  const url = new URL(`${apiUrl}${caminho.startsWith('/') ? caminho : `/${caminho}`}`);
  for (const [chave, valor] of Object.entries(opts.query ?? {})) {
    if (valor !== undefined && valor !== null && valor !== '') url.searchParams.set(chave, String(valor));
  }

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: metodo,
      headers: {
        access_token: apiKey,
        'User-Agent': `Boatzy/1.0 (Next.js; ${ambiente})`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: opts.corpo === undefined ? undefined : JSON.stringify(opts.corpo),
      signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_PADRAO_MS),
      cache: 'no-store',
    });
  } catch (err) {
    const timeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    console.error('[asaas]', metodo, caminho, timeout ? 'timeout' : 'falha de rede');
    throw new AsaasError(
      timeout ? 'O Asaas não respondeu a tempo.' : 'Falha de rede ao chamar o Asaas.',
      { status: 0, codigo: timeout ? 'timeout' : 'rede' },
    );
  }

  const texto = await resposta.text();
  let dados: unknown = null;
  if (texto) {
    try {
      dados = JSON.parse(texto);
    } catch {
      dados = null;
    }
  }

  if (resposta.ok) return dados as T;

  if (resposta.status === 429) {
    const reset = Number(resposta.headers.get('RateLimit-Reset'));
    const esperar = Number.isFinite(reset) && reset > 0 ? reset : null;
    console.error('[asaas]', metodo, caminho, 429, 'limite de requisições', esperar ? `(${esperar}s)` : '');
    throw new AsaasError(
      esperar
        ? `Limite de requisições do Asaas atingido. Tente de novo em ${esperar}s.`
        : 'Limite de requisições do Asaas atingido.',
      { status: 429, codigo: 'rate_limit', esperarSegundos: esperar },
    );
  }

  const erros = extrairErros(dados);
  console.error('[asaas]', metodo, caminho, resposta.status, erros.map((e) => e.code).join(',') || '-');

  const mensagem =
    erros.map((e) => e.description).filter(Boolean).join(' ') ||
    (resposta.status === 401
      ? 'Chave de API do Asaas inválida, expirada ou desabilitada.'
      : `Erro ${resposta.status} ao chamar o Asaas.`);
  throw new AsaasError(mensagem, { status: resposta.status, erros });
}

function extrairErros(dados: unknown): AsaasErroItem[] {
  if (!dados || typeof dados !== 'object' || !('errors' in dados)) return [];
  const lista = (dados as { errors: unknown }).errors;
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map((e) => ({ code: String(e.code ?? ''), description: String(e.description ?? '') }));
}

/** Mensagem segura para exibir ao admin a partir de qualquer erro. */
export function mensagemErroAsaas(err: unknown): string {
  if (err instanceof AsaasError) return err.message;
  return err instanceof Error ? err.message : 'Erro inesperado ao chamar o Asaas.';
}
