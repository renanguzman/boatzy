/**
 * Pagador estrangeiro (sem CPF) — SPEC §100. Puro: usado no checkout (navegador)
 * e revalidado no servidor. O Asaas não guarda o documento do estrangeiro; ele
 * fica em `users.documento_estrangeiro` e no snapshot `pagamento_tomador`.
 */

/** Países do topo da lista (público principal do Boatzy). */
const PAISES_DESTAQUE = ['AR', 'UY', 'CL'] as const;

/** Demais países, ordenados pelo nome no idioma da tela. */
const PAISES_DEMAIS = [
  'PY', 'BO', 'PE', 'CO', 'VE', 'EC', 'GY', 'SR', 'US', 'CA', 'MX', 'CR', 'PA', 'GT', 'HN', 'SV', 'NI',
  'CU', 'DO', 'PR', 'JM', 'TT', 'BS', 'PT', 'ES', 'FR', 'DE', 'IT', 'GB', 'IE', 'NL', 'BE', 'LU', 'CH',
  'AT', 'SE', 'NO', 'DK', 'FI', 'IS', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'GR', 'HR', 'SI', 'RS', 'UA',
  'RU', 'TR', 'IL', 'AE', 'SA', 'QA', 'EG', 'MA', 'ZA', 'NG', 'KE', 'IN', 'CN', 'JP', 'KR', 'TW', 'HK',
  'SG', 'TH', 'VN', 'PH', 'ID', 'MY', 'AU', 'NZ', 'AO', 'MZ', 'CV',
] as const;

const TODOS = new Set<string>([...PAISES_DESTAQUE, ...PAISES_DEMAIS]);

export const paisValido = (codigo: string | null | undefined): boolean => !!codigo && TODOS.has(codigo);

export function nomePais(codigo: string, idioma: string): string {
  try {
    return new Intl.DisplayNames([idioma], { type: 'region' }).of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
}

/** Lista para o `<select>`: destaque no topo, o resto em ordem alfabética do idioma. */
export function opcoesPaises(idioma: string): { codigo: string; nome: string; destaque: boolean }[] {
  const mapear = (codigos: readonly string[], destaque: boolean) =>
    codigos.map((codigo) => ({ codigo, nome: nomePais(codigo, idioma), destaque }));
  return [
    ...mapear(PAISES_DESTAQUE, true),
    ...mapear(PAISES_DEMAIS, false).sort((a, b) => a.nome.localeCompare(b.nome, idioma)),
  ];
}

/** Tira espaços, pontos e hífens e põe em maiúsculas: "ab-123.456" → "AB123456". */
export function normalizarDocumentoEstrangeiro(valor: string): string {
  return valor.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
}

/** Qualquer documento oficial: 4 a 20 letras/números (sem dígito verificador — varia por país). */
export const documentoEstrangeiroValido = (normalizado: string): boolean => /^[A-Z0-9]{4,20}$/.test(normalizado);

export type DocumentoEstrangeiro = { pais: string; documento: string };

/** Valida e normaliza o que veio do formulário; `campo` diz o que corrigir. */
export function validarDocumentoEstrangeiro(
  entrada: { pais?: string | null; documento?: string | null } | null | undefined,
): { ok: true; valor: DocumentoEstrangeiro } | { ok: false; campo: 'pais' | 'documentoEstrangeiro' } {
  const pais = (entrada?.pais ?? '').trim().toUpperCase();
  if (!paisValido(pais)) return { ok: false, campo: 'pais' };
  const documento = normalizarDocumentoEstrangeiro(entrada?.documento ?? '');
  if (!documentoEstrangeiroValido(documento)) return { ok: false, campo: 'documentoEstrangeiro' };
  return { ok: true, valor: { pais, documento } };
}

/** Só o miolo visível: "AB123456" → "••••3456". */
export function documentoEstrangeiroMascarado(documento: string | null | undefined): string | null {
  if (!documento) return null;
  return documento.length <= 4 ? documento : `${'•'.repeat(documento.length - 4)}${documento.slice(-4)}`;
}

/** "AB123456 · AR" — documento estrangeiro com o país emissor (telas de admin e gestor). */
export function documentoEstrangeiroRotulo(documento: string | null | undefined, pais: string | null | undefined): string | null {
  return documento ? (pais ? `${documento} · ${pais}` : documento) : null;
}

export type UsuarioDocumento = {
  cpf_cnpj?: string | null;
  documento_estrangeiro?: string | null;
  pais_documento?: string | null;
};

/** Valor inicial do checkout: estrangeiro marcado se já informou documento ou se navega fora do pt-BR. */
export function estrangeiroInicial(
  usuario: UsuarioDocumento | null,
  idioma: string,
): { ativo: boolean; pais: string; documento: string } {
  const doc = usuario?.documento_estrangeiro ?? '';
  return {
    ativo: !!doc || idioma !== 'pt-BR',
    pais: usuario?.pais_documento ?? '',
    documento: doc,
  };
}

/** Documento a exibir nos painéis: CPF/CNPJ do cadastro ou o documento estrangeiro com o país. */
export function documentoDoUsuario(u: UsuarioDocumento | null | undefined): { tipo: 'cpf_cnpj' | 'estrangeiro'; valor: string; pais?: string } | null {
  if (!u) return null;
  if (u.cpf_cnpj) return { tipo: 'cpf_cnpj', valor: u.cpf_cnpj };
  if (u.documento_estrangeiro) return { tipo: 'estrangeiro', valor: u.documento_estrangeiro, pais: u.pais_documento ?? undefined };
  return null;
}
