import 'server-only';

/**
 * Configuração da integração com a Pagar.me (Stone) — cartão de crédito
 * (SPEC §109). Lida só no servidor.
 *
 * - API v5 em `https://api.pagar.me/core/v5` (o mesmo endpoint para teste e
 *   produção — o tipo da chave decide).
 * - Ambiente pelo prefixo: `sk_test_`/`pk_test_` = sandbox; `sk_`/`pk_` = produção.
 *   Chave secreta e pública de ambientes diferentes → configuração recusada.
 * - A chave pública (`pk_…`) vai para o navegador, que tokeniza o cartão
 *   direto na Pagar.me; a secreta nunca sai do servidor.
 */

export type PagarmeAmbiente = 'sandbox' | 'producao';

const URL_PADRAO = 'https://api.pagar.me/core/v5';

export type PagarmeConfig = {
  apiUrl: string;
  secretKey: string;
  publicKey: string;
  ambiente: PagarmeAmbiente;
};

export type PagarmeConfigResultado = { ok: true; config: PagarmeConfig } | { ok: false; erro: string };

function ambienteDaChave(chave: string, tipo: 'sk' | 'pk'): PagarmeAmbiente | null {
  if (chave.startsWith(`${tipo}_test_`)) return 'sandbox';
  if (chave.startsWith(`${tipo}_`)) return 'producao';
  return null;
}

export function lerPagarmeConfig(): PagarmeConfigResultado {
  const secretKey = (process.env.PAGARME_SECRET_KEY ?? '').trim();
  const publicKey = (process.env.NEXT_PUBLIC_PAGARME_PUBLIC_KEY ?? '').trim();
  if (!secretKey) return { ok: false, erro: 'PAGARME_SECRET_KEY não configurada.' };
  if (!publicKey) return { ok: false, erro: 'NEXT_PUBLIC_PAGARME_PUBLIC_KEY não configurada.' };

  const ambiente = ambienteDaChave(secretKey, 'sk');
  if (!ambiente) return { ok: false, erro: 'PAGARME_SECRET_KEY não começa com "sk_test_" nem "sk_".' };
  const ambientePublica = ambienteDaChave(publicKey, 'pk');
  if (!ambientePublica) return { ok: false, erro: 'NEXT_PUBLIC_PAGARME_PUBLIC_KEY não começa com "pk_test_" nem "pk_".' };
  if (ambiente !== ambientePublica) {
    return { ok: false, erro: 'A chave secreta e a chave pública da Pagar.me são de ambientes diferentes (teste × produção).' };
  }

  const apiUrl = (process.env.PAGARME_API_URL ?? '').trim().replace(/\/+$/, '') || URL_PADRAO;
  return { ok: true, config: { apiUrl, secretKey, publicKey, ambiente } };
}

/**
 * Usuário e senha do Basic Auth que a Pagar.me envia nos webhooks (D-S7).
 * Senha com pelo menos 16 caracteres; sem as duas, o endpoint recusa tudo.
 */
export function lerCredenciaisWebhook(): { usuario: string; senha: string } | null {
  const usuario = (process.env.PAGARME_WEBHOOK_USER ?? '').trim();
  const senha = (process.env.PAGARME_WEBHOOK_PASSWORD ?? '').trim();
  if (!usuario || senha.length < 16 || /\s/.test(usuario + senha) || usuario.includes(':')) return null;
  return { usuario, senha };
}

/** URL pública do endpoint de webhook deste deploy (para cadastrar no dashboard da Pagar.me). */
export function urlWebhookPagarmeSugerida(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/+$/, '');
  return `${base}/api/webhooks/pagarme`;
}
