import 'server-only';

/**
 * Configuração da integração com o Asaas, lida só no servidor.
 *
 * O ambiente é deduzido do prefixo da chave (`$aact_hmlg_` = sandbox,
 * `$aact_prod_` = produção). Se `ASAAS_API_URL` estiver definida, ela
 * precisa bater com o ambiente da chave — evita, por exemplo, apontar uma
 * chave de produção para o sandbox (ou o contrário) por engano.
 *
 * Atenção: no `.env*` o `$` da chave precisa ser escapado (`\$aact_…`), senão
 * o Next expande `$aact_…` como referência a outra variável e a chave chega
 * truncada. Ver docs do Next, `environment-variables.md`.
 */

export type AsaasAmbiente = 'sandbox' | 'producao';

const URL_PADRAO: Record<AsaasAmbiente, string> = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  producao: 'https://api.asaas.com/v3',
};

export type AsaasConfig = {
  apiUrl: string;
  apiKey: string;
  ambiente: AsaasAmbiente;
};

export type AsaasConfigResultado =
  | { ok: true; config: AsaasConfig }
  | { ok: false; erro: string };

function ambienteDaChave(apiKey: string): AsaasAmbiente | null {
  if (apiKey.startsWith('$aact_hmlg_')) return 'sandbox';
  if (apiKey.startsWith('$aact_prod_')) return 'producao';
  return null;
}

export function lerAsaasConfig(): AsaasConfigResultado {
  // No .env* o "$" vai escapado e o Next remove a barra; no painel da Vercel o valor entra
  // literal — se alguém digitar "\$aact_…" lá, a barra sobra. Aceita as duas formas.
  const apiKey = (process.env.ASAAS_API_KEY ?? '').trim().replace(/^\\(?=\$aact_)/, '');
  if (!apiKey) return { ok: false, erro: 'ASAAS_API_KEY não configurada.' };

  const ambiente = ambienteDaChave(apiKey);
  if (!ambiente) {
    return {
      ok: false,
      erro:
        'ASAAS_API_KEY não começa com "$aact_hmlg_" nem "$aact_prod_". ' +
        'Confira se o "$" foi escapado no .env (ASAAS_API_KEY=\\$aact_…).',
    };
  }

  const apiUrl = (process.env.ASAAS_API_URL ?? '').trim().replace(/\/+$/, '') || URL_PADRAO[ambiente];
  const urlEhSandbox = apiUrl.includes('sandbox');
  if (ambiente === 'sandbox' && !urlEhSandbox) {
    return { ok: false, erro: `Chave de sandbox apontando para ${apiUrl}. Use ${URL_PADRAO.sandbox}.` };
  }
  if (ambiente === 'producao' && urlEhSandbox) {
    return { ok: false, erro: `Chave de produção apontando para ${apiUrl}. Use ${URL_PADRAO.producao}.` };
  }

  return { ok: true, config: { apiUrl, apiKey, ambiente } };
}

/** Token que o Asaas envia no header `asaas-access-token` dos webhooks (32–255 caracteres, sem espaços). */
export function lerTokenWebhook(): string | null {
  const token = (process.env.ASAAS_WEBHOOK_TOKEN ?? '').trim();
  if (token.length < 32 || token.length > 255 || /\s/.test(token)) return null;
  return token;
}

/** URL pública do endpoint de webhook deste deploy (sugestão para cadastro no Asaas). */
export function urlWebhookSugerida(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/+$/, '');
  return `${base}/api/webhooks/asaas`;
}
