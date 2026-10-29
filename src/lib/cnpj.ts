import 'server-only';

import { isValidCNPJ, onlyDigits } from '@/lib/validators';

/**
 * Consulta de CNPJ na API pública do OpenCNPJ (https://opencnpj.org) — usada
 * no checkout para preencher a empresa em nome de quem sai o pagamento
 * (SPEC §97). `GET https://api.opencnpj.org/{cnpj}` (só dígitos): 200 com os
 * dados da Receita, 404 se não existe, 429 no limite por IP. Sem chave.
 */

export type DadosCnpj = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  /** "Ativa", "Baixada", "Inapta", "Suspensa"… (cru da Receita). */
  situacao: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  telefone: string | null; // só dígitos (DDD + número)
};

export type ConsultaCnpj =
  | { ok: true; dados: DadosCnpj }
  | { ok: false; motivo: 'invalido' | 'nao_encontrado' | 'limite' | 'indisponivel' };

type RespostaOpenCnpj = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  situacao_cadastral?: string;
  tipo_logradouro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  uf?: string;
  municipio?: string;
  telefones?: { ddd?: string; numero?: string; is_fax?: boolean }[];
};

const texto = (v: string | null | undefined) => (v ?? '').replace(/\s+/g, ' ').trim() || null;

export async function consultarCnpj(valor: string): Promise<ConsultaCnpj> {
  const cnpj = onlyDigits(valor);
  if (!isValidCNPJ(cnpj)) return { ok: false, motivo: 'invalido' };

  let resposta: Response;
  try {
    resposta = await fetch(`https://api.opencnpj.org/${cnpj}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
  } catch {
    console.error('[cnpj] OpenCNPJ sem resposta', cnpj.slice(0, 8));
    return { ok: false, motivo: 'indisponivel' };
  }
  if (resposta.status === 404) return { ok: false, motivo: 'nao_encontrado' };
  if (resposta.status === 429) return { ok: false, motivo: 'limite' };
  if (!resposta.ok) {
    console.error('[cnpj] OpenCNPJ', resposta.status);
    return { ok: false, motivo: 'indisponivel' };
  }

  const d = (await resposta.json().catch(() => null)) as RespostaOpenCnpj | null;
  const razaoSocial = texto(d?.razao_social);
  if (!d || !razaoSocial) return { ok: false, motivo: 'indisponivel' };

  // "RUA" + "XV DE NOVEMBRO" → "RUA XV DE NOVEMBRO" (sem repetir quando o logradouro já traz o tipo).
  const tipo = texto(d.tipo_logradouro);
  const nomeLogradouro = texto(d.logradouro);
  const logradouro = nomeLogradouro && tipo && !nomeLogradouro.toUpperCase().startsWith(tipo.toUpperCase())
    ? `${tipo} ${nomeLogradouro}`
    : nomeLogradouro;
  const numero = texto(d.numero);
  const fone = d.telefones?.find((t) => !t.is_fax && t.ddd && t.numero);
  const telefone = fone ? onlyDigits(`${fone.ddd}${fone.numero}`) : '';
  const cep = onlyDigits(d.cep ?? '');
  const uf = texto(d.uf)?.toUpperCase() ?? null;

  return {
    ok: true,
    dados: {
      cnpj,
      razaoSocial,
      nomeFantasia: texto(d.nome_fantasia),
      situacao: texto(d.situacao_cadastral),
      cep: cep.length === 8 ? cep : null,
      logradouro,
      numero: numero && /^S\/?N$/i.test(numero) ? 'S/N' : numero,
      complemento: texto(d.complemento),
      bairro: texto(d.bairro),
      cidade: texto(d.municipio),
      uf: uf && /^[A-Z]{2}$/.test(uf) ? uf : null,
      telefone: telefone.length >= 10 && telefone.length <= 11 ? telefone : null,
    },
  };
}
