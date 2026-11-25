import { onlyDigits } from '@/lib/validators';
import { paisValido } from './estrangeiro';
import { UFS } from './tomador';

/**
 * Dados de cobrança do cartão (Pagar.me, SPEC §109) — endereço de cobrança e
 * celular, exigidos pelo antifraude. Puro: validado no checkout (navegador) e
 * de novo no servidor. O número do cartão NUNCA passa por aqui: ele vai do
 * navegador direto para a Pagar.me (tokenização).
 */

export type EnderecoCobrancaForm = {
  pais: string;          // ISO alfa-2
  cep: string;           // CEP (Brasil) ou código postal
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;        // UF (Brasil) ou estado/província
};

export type TelefoneForm = { ddi: string; numero: string };

export type CampoCobranca =
  | 'pais' | 'cep' | 'logradouro' | 'numero' | 'bairro' | 'cidade' | 'estado' | 'telefone';

export const ENDERECO_COBRANCA_VAZIO: EnderecoCobrancaForm = {
  pais: 'BR', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
};

/** DDI sugerido pelo país do endereço (editável no formulário). */
const DDI: Record<string, string> = {
  BR: '55', AR: '54', UY: '598', CL: '56', PY: '595', BO: '591', PE: '51', CO: '57', VE: '58', EC: '593',
  US: '1', CA: '1', MX: '52', PT: '351', ES: '34', FR: '33', DE: '49', IT: '39', GB: '44', NL: '31',
  CH: '41', BE: '32', AT: '43', IE: '353', SE: '46', NO: '47', DK: '45', FI: '358', PL: '48', IL: '972',
  AU: '61', NZ: '64', JP: '81', CN: '86', KR: '82', IN: '91', ZA: '27', AE: '971',
};

export const ddiDoPais = (pais: string): string => DDI[pais] ?? '';

const limpo = (v: unknown, max = 120): string =>
  (typeof v === 'string' ? v : '').replace(/\s+/g, ' ').trim().slice(0, max);

export type DadosCobrancaValidos = {
  endereco: {
    pais: string; cep: string; logradouro: string; numero: string; complemento: string | null;
    bairro: string | null; cidade: string; estado: string;
  };
  telefone: { ddi: string; area: string; numero: string };
};

/**
 * Valida endereço de cobrança e celular. Brasil: CEP de 8 dígitos, UF válida e
 * bairro obrigatório. Exterior: código postal livre (3–10), estado/província
 * livre, bairro opcional. Celular: DDI 1–3 dígitos + 8 a 13 dígitos (com DDD).
 */
export function validarDadosCobranca(entrada: {
  endereco?: Partial<EnderecoCobrancaForm> | null;
  telefone?: Partial<TelefoneForm> | null;
}): { ok: true; dados: DadosCobrancaValidos } | { ok: false; campo: CampoCobranca } {
  const e = entrada.endereco ?? {};
  const pais = limpo(e.pais, 2).toUpperCase();
  if (pais !== 'BR' && !paisValido(pais)) return { ok: false, campo: 'pais' };
  const br = pais === 'BR';

  const cep = br ? onlyDigits(limpo(e.cep, 12)) : limpo(e.cep, 12).toUpperCase().replace(/[^A-Z0-9 -]/g, '');
  if (br ? cep.length !== 8 : cep.replace(/[ -]/g, '').length < 3) return { ok: false, campo: 'cep' };
  const logradouro = limpo(e.logradouro);
  if (logradouro.length < 2) return { ok: false, campo: 'logradouro' };
  const numero = limpo(e.numero, 20);
  if (!numero) return { ok: false, campo: 'numero' };
  const bairro = limpo(e.bairro);
  if (br && !bairro) return { ok: false, campo: 'bairro' };
  const cidade = limpo(e.cidade);
  if (cidade.length < 2) return { ok: false, campo: 'cidade' };
  const estado = br ? limpo(e.estado, 2).toUpperCase() : limpo(e.estado, 60);
  if (br ? !(UFS as readonly string[]).includes(estado) : estado.length < 2) return { ok: false, campo: 'estado' };

  const ddi = onlyDigits(limpo(entrada.telefone?.ddi, 4));
  const tel = onlyDigits(limpo(entrada.telefone?.numero, 20));
  if (!/^\d{1,3}$/.test(ddi) || tel.length < (br ? 10 : 8) || tel.length > (br ? 11 : 13)) {
    return { ok: false, campo: 'telefone' };
  }

  return {
    ok: true,
    dados: {
      endereco: { pais, cep, logradouro, numero, complemento: limpo(e.complemento) || null, bairro: bairro || null, cidade, estado },
      telefone: { ddi, area: tel.slice(0, 2), numero: tel.slice(2) },
    },
  };
}

/** Endereço no formato da Pagar.me v5: `line_1` = "número, rua, bairro". */
export function enderecoParaPagarme(e: DadosCobrancaValidos['endereco']) {
  return {
    line_1: [e.numero, e.logradouro, e.bairro].filter(Boolean).join(', ').slice(0, 256),
    ...(e.complemento ? { line_2: e.complemento.slice(0, 128) } : {}),
    zip_code: e.cep.replace(/[ -]/g, ''),
    city: e.cidade,
    state: e.estado,
    country: e.pais,
  };
}
