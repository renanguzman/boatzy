import 'server-only';

import { lerPagarmeConfig } from './config';

/**
 * Cliente HTTP mínimo da API v5 da Pagar.me (SPEC §109).
 *
 * - Basic Auth com a chave secreta como usuário e senha vazia.
 * - Timeout → `PagarmeError` com `codigo = 'timeout'`. Em criações (POST
 *   /orders) o chamador **consulta antes de repetir** (pelo `code` do pedido)
 *   — repetir às cegas pode cobrar duas vezes.
 * - Nunca loga a chave nem o corpo das requisições (o corpo do pedido leva o
 *   token do cartão e dados pessoais).
 */

export class PagarmeError extends Error {
  readonly status: number;
  readonly codigo: string | null;
  readonly erros: string[];

  constructor(mensagem: string, opts: { status: number; codigo?: string | null; erros?: string[] }) {
    super(mensagem);
    this.name = 'PagarmeError';
    this.status = opts.status;
    this.codigo = opts.codigo ?? null;
    this.erros = opts.erros ?? [];
  }
}

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type PagarmeRequestOpts = {
  metodo?: Metodo;
  corpo?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  timeoutMs?: number;
};

const TIMEOUT_PADRAO_MS = 20_000;

export async function pagarmeRequest<T>(caminho: string, opts: PagarmeRequestOpts = {}): Promise<T> {
  const cfg = lerPagarmeConfig();
  if (!cfg.ok) throw new PagarmeError(cfg.erro, { status: 0, codigo: 'config' });
  const { apiUrl, secretKey } = cfg.config;

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
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: opts.corpo === undefined ? undefined : JSON.stringify(opts.corpo),
      signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_PADRAO_MS),
      cache: 'no-store',
    });
  } catch (err) {
    const timeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    console.error('[pagarme]', metodo, caminho, timeout ? 'timeout' : 'falha de rede');
    throw new PagarmeError(
      timeout ? 'A Pagar.me não respondeu a tempo.' : 'Falha de rede ao chamar a Pagar.me.',
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

  const erros = extrairErros(dados);
  console.error('[pagarme]', metodo, caminho, resposta.status, erros.length ? `${erros.length} erro(s)` : '-');

  if (resposta.status === 429) {
    throw new PagarmeError('Limite de requisições da Pagar.me atingido. Tente de novo em instantes.', {
      status: 429, codigo: 'rate_limit',
    });
  }
  const mensagem =
    (dados && typeof dados === 'object' && typeof (dados as { message?: unknown }).message === 'string'
      ? [(dados as { message: string }).message, ...erros].join(' ')
      : erros.join(' ')) ||
    (resposta.status === 401
      ? 'Chave da Pagar.me inválida, expirada ou sem permissão.'
      : `Erro ${resposta.status} ao chamar a Pagar.me.`);
  throw new PagarmeError(mensagem, { status: resposta.status, codigo: resposta.status === 404 ? 'nao_encontrado' : null, erros });
}

/** `errors` da v5: `{ "campo": ["mensagem", …] }`. */
function extrairErros(dados: unknown): string[] {
  if (!dados || typeof dados !== 'object' || !('errors' in dados)) return [];
  const erros = (dados as { errors: unknown }).errors;
  if (!erros || typeof erros !== 'object') return [];
  return Object.entries(erros as Record<string, unknown>).flatMap(([campo, msgs]) =>
    (Array.isArray(msgs) ? msgs : [msgs]).map((m) => `${campo}: ${String(m)}`),
  );
}

/** Mensagem segura para exibir ao admin a partir de qualquer erro. */
export function mensagemErroPagarme(err: unknown): string {
  if (err instanceof PagarmeError) return err.message;
  return err instanceof Error ? err.message : 'Erro inesperado ao chamar a Pagar.me.';
}

/** Reais → centavos inteiros (a API v5 trabalha só com centavos). */
export const paraCentavos = (reais: number): number => Math.round(reais * 100);

/** Centavos → reais. */
export const deCentavos = (centavos: number | null | undefined): number | null =>
  centavos == null ? null : Math.round(Number(centavos)) / 100;
