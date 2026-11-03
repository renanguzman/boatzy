import { isValidCNPJ, isValidCPF, maskCpfCnpj, onlyDigits } from '@/lib/validators';
import type { DestinoRepasse, PixTipoChave, RecebimentoTipo, TipoConta } from '@/types/supabase';

/**
 * Dados de recebimento do gestor (SPEC §101): Pix ou conta bancária. Módulo puro — o
 * formulário (cliente) e a action (servidor) validam com as mesmas regras.
 */

export const TIPOS_CHAVE_PIX: { valor: PixTipoChave; rotulo: string; dica: string }[] = [
  { valor: 'cpf', rotulo: 'CPF', dica: '000.000.000-00' },
  { valor: 'cnpj', rotulo: 'CNPJ', dica: '00.000.000/0000-00' },
  { valor: 'email', rotulo: 'E-mail', dica: 'voce@exemplo.com' },
  { valor: 'telefone', rotulo: 'Celular', dica: '(21) 99999-9999' },
  { valor: 'aleatoria', rotulo: 'Chave aleatória', dica: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
];

/** Bancos mais comuns (COMPE). Qualquer outro: digite o código de 3 dígitos. */
export const BANCOS: { codigo: string; nome: string }[] = [
  { codigo: '001', nome: 'Banco do Brasil' },
  { codigo: '033', nome: 'Santander' },
  { codigo: '077', nome: 'Banco Inter' },
  { codigo: '104', nome: 'Caixa Econômica Federal' },
  { codigo: '208', nome: 'BTG Pactual' },
  { codigo: '212', nome: 'Banco Original' },
  { codigo: '237', nome: 'Bradesco' },
  { codigo: '260', nome: 'Nubank' },
  { codigo: '290', nome: 'PagBank' },
  { codigo: '323', nome: 'Mercado Pago' },
  { codigo: '336', nome: 'C6 Bank' },
  { codigo: '341', nome: 'Itaú Unibanco' },
  { codigo: '422', nome: 'Banco Safra' },
  { codigo: '748', nome: 'Sicredi' },
  { codigo: '756', nome: 'Sicoob' },
];

export const nomeDoBanco = (codigo: string | null | undefined): string | null =>
  BANCOS.find((b) => b.codigo === codigo)?.nome ?? null;

export const ROTULO_TIPO_CHAVE: Record<PixTipoChave, string> = Object.fromEntries(
  TIPOS_CHAVE_PIX.map((t) => [t.valor, t.rotulo]),
) as Record<PixTipoChave, string>;

export const ROTULO_TIPO_CONTA: Record<TipoConta, string> = { corrente: 'Conta corrente', poupanca: 'Poupança' };

export type EntradaRecebimento = {
  tipo: RecebimentoTipo;
  pixTipoChave: PixTipoChave;
  pixChave: string;
  bancoCodigo: string;
  bancoNome: string;
  agencia: string;
  conta: string;
  contaDigito: string;
  tipoConta: TipoConta;
  titularNome: string;
  titularDocumento: string;
};

export type CampoRecebimento =
  | 'pixChave' | 'bancoCodigo' | 'bancoNome' | 'agencia' | 'conta' | 'contaDigito' | 'titularNome' | 'titularDocumento';
export type ErrosRecebimento = Partial<Record<CampoRecebimento, string>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Chave Pix na forma que o banco espera (CPF/CNPJ só dígitos, celular +55…, e-mail minúsculo). */
export function normalizarChavePix(tipo: PixTipoChave, valor: string): string {
  const v = valor.trim();
  switch (tipo) {
    case 'cpf':
    case 'cnpj':
      return onlyDigits(v);
    case 'email':
      return v.toLowerCase();
    case 'telefone': {
      const d = onlyDigits(v).replace(/^55(?=\d{10,11}$)/, '');
      return `+55${d}`;
    }
    case 'aleatoria':
      return v.toLowerCase();
  }
}

function validarChavePix(tipo: PixTipoChave, valor: string): string | null {
  const v = valor.trim();
  if (!v) return 'Informe a chave Pix.';
  switch (tipo) {
    case 'cpf': return isValidCPF(v) ? null : 'CPF inválido.';
    case 'cnpj': return isValidCNPJ(v) ? null : 'CNPJ inválido.';
    case 'email': return EMAIL.test(v) && v.length <= 120 ? null : 'E-mail inválido.';
    case 'telefone': {
      const d = onlyDigits(v).replace(/^55(?=\d{10,11}$)/, '');
      return /^\d{10,11}$/.test(d) ? null : 'Celular inválido. Use DDD + número.';
    }
    case 'aleatoria': return UUID.test(v) ? null : 'Chave aleatória inválida. Cole a chave completa.';
  }
}

export type RecebimentoNormalizado = {
  tipo: RecebimentoTipo;
  pix_tipo_chave: PixTipoChave | null;
  pix_chave: string | null;
  banco_codigo: string | null;
  banco_nome: string | null;
  agencia: string | null;
  conta: string | null;
  conta_digito: string | null;
  tipo_conta: TipoConta | null;
  titular_nome: string;
  titular_documento: string;
};

/** Valida a entrada e devolve os valores normalizados prontos para gravar. */
export function validarRecebimento(
  e: EntradaRecebimento,
): { ok: true; dados: RecebimentoNormalizado } | { ok: false; erros: ErrosRecebimento } {
  const erros: ErrosRecebimento = {};

  const titularNome = e.titularNome.trim().replace(/\s+/g, ' ');
  if (titularNome.length < 3) erros.titularNome = 'Informe o nome completo do titular.';
  else if (titularNome.length > 120) erros.titularNome = 'Use no máximo 120 caracteres.';

  const titularDocumento = onlyDigits(e.titularDocumento);
  if (!(titularDocumento.length === 11 ? isValidCPF(titularDocumento) : titularDocumento.length === 14 && isValidCNPJ(titularDocumento))) {
    erros.titularDocumento = 'Informe um CPF ou CNPJ válido.';
  }

  if (e.tipo === 'pix') {
    const msg = validarChavePix(e.pixTipoChave, e.pixChave);
    if (msg) erros.pixChave = msg;
  } else {
    const banco = onlyDigits(e.bancoCodigo);
    if (!/^\d{3}$/.test(banco)) erros.bancoCodigo = 'Informe o código do banco (3 dígitos).';
    const bancoNome = (nomeDoBanco(banco) ?? e.bancoNome).trim();
    if (bancoNome.length < 2) erros.bancoNome = 'Informe o nome do banco.';
    if (!/^\d{1,6}$/.test(onlyDigits(e.agencia))) erros.agencia = 'Agência inválida (só números).';
    if (!/^\d{1,12}$/.test(onlyDigits(e.conta))) erros.conta = 'Conta inválida (só números, sem o dígito).';
    if (e.contaDigito.trim() && !/^[0-9xX]$/.test(e.contaDigito.trim())) erros.contaDigito = 'Dígito inválido.';
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros };

  const pix = e.tipo === 'pix';
  const banco = onlyDigits(e.bancoCodigo);
  return {
    ok: true,
    dados: {
      tipo: e.tipo,
      pix_tipo_chave: pix ? e.pixTipoChave : null,
      pix_chave: pix ? normalizarChavePix(e.pixTipoChave, e.pixChave) : null,
      banco_codigo: pix ? null : banco,
      banco_nome: pix ? null : (nomeDoBanco(banco) ?? e.bancoNome.trim()),
      agencia: pix ? null : onlyDigits(e.agencia),
      conta: pix ? null : onlyDigits(e.conta),
      conta_digito: pix ? null : e.contaDigito.trim().toUpperCase() || null,
      tipo_conta: pix ? null : e.tipoConta,
      titular_nome: titularNome,
      titular_documento: titularDocumento,
    },
  };
}

type Destino = Pick<
  DestinoRepasse,
  'tipo' | 'pix_tipo_chave' | 'pix_chave' | 'banco_codigo' | 'banco_nome' | 'agencia' | 'conta' | 'conta_digito' | 'tipo_conta'
>;

/** Chave Pix legível (CPF/CNPJ e celular formatados). `ocultar` mascara o meio, para e-mails e telas de resumo. */
export function formatarChavePix(tipo: PixTipoChave | null, chave: string | null, ocultar = false): string {
  if (!chave) return '—';
  let texto = chave;
  if (tipo === 'cpf' || tipo === 'cnpj') texto = maskCpfCnpj(chave);
  else if (tipo === 'telefone') {
    const d = onlyDigits(chave).replace(/^55/, '');
    texto = d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : chave;
  }
  if (!ocultar) return texto;
  if (tipo === 'email') {
    const [u, d] = texto.split('@');
    return `${u.slice(0, 2)}***@${d ?? ''}`;
  }
  return texto.length <= 6 ? '***' : `${texto.slice(0, 3)}***${texto.slice(-3)}`;
}

/** Uma linha: "Pix · CPF 123.456.789-09" ou "Nubank (260) · ag. 0001 · cc 123456-7". */
export function resumoDestino(d: Destino, ocultar = false): string {
  if (d.tipo === 'pix') {
    return `Pix · ${d.pix_tipo_chave ? ROTULO_TIPO_CHAVE[d.pix_tipo_chave] : 'chave'} ${formatarChavePix(d.pix_tipo_chave, d.pix_chave, ocultar)}`;
  }
  const conta = `${d.conta ?? ''}${d.conta_digito ? `-${d.conta_digito}` : ''}`;
  const sigla = d.tipo_conta === 'poupanca' ? 'cp' : 'cc';
  return `${d.banco_nome ?? 'Banco'} (${d.banco_codigo ?? '—'}) · ag. ${d.agencia ?? '—'} · ${sigla} ${ocultar ? `***${conta.slice(-2)}` : conta}`;
}
