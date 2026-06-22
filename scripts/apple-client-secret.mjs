#!/usr/bin/env node
/**
 * Gera o "Client Secret" (JWT ES256) da Apple para usar no Supabase
 * (Authentication → Providers → Apple → Secret Key for OAuth).
 *
 * A chave privada (.p8) é lida do disco e NÃO sai da sua máquina.
 *
 * Uso:
 *   node scripts/apple-client-secret.mjs \
 *     --team RP2V9XC6MV \
 *     --kid  <KEY_ID> \
 *     --sub  <SERVICES_ID> \
 *     --key  ./AuthKey_XXXXXXXXXX.p8
 *
 * Ou via variáveis de ambiente:
 *   APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_SERVICES_ID, APPLE_KEY_PATH
 */

import { readFileSync } from 'node:fs';
import { createSign, createPrivateKey } from 'node:crypto';

function arg(name, env) {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return process.env[env];
}

const TEAM_ID = arg('team', 'APPLE_TEAM_ID');
const KEY_ID = arg('kid', 'APPLE_KEY_ID');
const SERVICES_ID = arg('sub', 'APPLE_SERVICES_ID');
const KEY_PATH = arg('key', 'APPLE_KEY_PATH');

const missing = [];
if (!TEAM_ID) missing.push('--team (Team ID)');
if (!KEY_ID) missing.push('--kid (Key ID)');
if (!SERVICES_ID) missing.push('--sub (Services ID)');
if (!KEY_PATH) missing.push('--key (caminho do .p8)');
if (missing.length) {
  console.error('Faltam parâmetros:\n  ' + missing.join('\n  '));
  process.exit(1);
}

const base64url = (input) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const now = Math.floor(Date.now() / 1000);
// A Apple permite no máximo 6 meses (15777000s). Usamos ~6 meses.
const exp = now + 15777000;

const header = { alg: 'ES256', kid: KEY_ID, typ: 'JWT' };
const payload = {
  iss: TEAM_ID,
  iat: now,
  exp,
  aud: 'https://appleid.apple.com',
  sub: SERVICES_ID,
};

const signingInput =
  base64url(JSON.stringify(header)) + '.' + base64url(JSON.stringify(payload));

let privateKey;
try {
  privateKey = createPrivateKey(readFileSync(KEY_PATH, 'utf8'));
} catch (e) {
  console.error(`Não foi possível ler a chave .p8 em "${KEY_PATH}": ${e.message}`);
  process.exit(1);
}

// ES256 = ECDSA P-256 + SHA-256, com assinatura no formato JOSE (R||S = 64 bytes).
const signature = createSign('SHA256')
  .update(signingInput)
  .sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });

const jwt = signingInput + '.' + base64url(signature);

console.log('\n=== Client Secret (cole no Supabase → Apple → Secret Key for OAuth) ===\n');
console.log(jwt);
console.log('\nValidade: ~6 meses. Expira em:', new Date(exp * 1000).toISOString());
console.log('Lembre de regenerar antes dessa data.\n');
