import { applyPhoneMask, isValidCNPJ, isValidCPF, maskCEP, maskCpfCnpj, onlyDigits } from '@/lib/validators';
import type { Database, PagamentoTomadorTipo } from '@/types/supabase';

/**
 * Em nome de quem sai o pagamento — comprovante e, no futuro, nota fiscal
 * (SPEC §97). Puro: usado no checkout (navegador) e revalidado no servidor.
 */

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

/** Formulário do checkout (valores como digitados, com máscara). */
export type TomadorForm = {
  tipo: PagamentoTomadorTipo;
  nome: string;
  documento: string;
  nomeFantasia: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};

/** Campos que podem ser recusados (complemento é opcional). */
export type CampoTomador = Exclude<keyof TomadorForm, 'tipo' | 'nomeFantasia' | 'complemento'>;

/** Dados normalizados (só dígitos, sem vazios) — o formato de `pagamento_tomador`. */
export type Tomador = Omit<TomadorRegistro, 'pagamento_id' | 'criado_em'>;

/** Linha gravada, como o comprovante/painéis a leem. */
export type TomadorRegistro = Database['public']['Tables']['pagamento_tomador']['Row'];

export const TOMADOR_VAZIO: TomadorForm = {
  tipo: 'proprio', nome: '', documento: '', nomeFantasia: '', telefone: '',
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
};

/** Telefone BR com máscara progressiva: (00) 0000-0000 → (00) 00000-0000. */
export function maskTelefoneBR(valor: string): string {
  const d = onlyDigits(valor).slice(0, 11);
  return applyPhoneMask(d, d.length > 10 ? '(##) #####-####' : '(##) ####-####');
}

const limpo = (v: string | null | undefined, max = 200) => {
  const s = (v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  return s || null;
};

/**
 * Valida o tomador de terceiro (CPF/CNPJ). Outra pessoa: nome completo, CPF,
 * telefone e endereço completo. Empresa: razão social, CNPJ e endereço
 * (telefone opcional). Devolve o 1º campo com problema.
 */
export function validarTomador(entrada: TomadorForm):
  | { ok: true; tomador: Tomador }
  | { ok: false; campo: CampoTomador } {
  // No servidor o objeto vem do navegador: campo ausente ou de outro tipo vira ''.
  const form = Object.fromEntries(
    Object.keys(TOMADOR_VAZIO).map((k) => {
      const v = (entrada as Record<string, unknown> | null)?.[k];
      return [k, typeof v === 'string' ? v : ''];
    }),
  ) as TomadorForm;
  const tipo = form.tipo === 'cnpj' ? 'cnpj' : 'cpf';
  const nome = limpo(form.nome);
  const documento = onlyDigits(form.documento);
  const telefone = onlyDigits(form.telefone);
  const cep = onlyDigits(form.cep);
  const uf = form.uf.trim().toUpperCase();

  if (tipo === 'cpf' ? !isValidCPF(documento) : !isValidCNPJ(documento)) return { ok: false, campo: 'documento' };
  if (!nome || nome.length < 2 || (tipo === 'cpf' && nome.split(' ').length < 2)) return { ok: false, campo: 'nome' };
  if (tipo === 'cpf' ? telefone.length < 10 || telefone.length > 11 : telefone.length > 0 && (telefone.length < 10 || telefone.length > 11)) {
    return { ok: false, campo: 'telefone' };
  }
  if (cep.length !== 8) return { ok: false, campo: 'cep' };
  if (!limpo(form.logradouro)) return { ok: false, campo: 'logradouro' };
  if (!limpo(form.numero, 20)) return { ok: false, campo: 'numero' };
  if (!limpo(form.bairro)) return { ok: false, campo: 'bairro' };
  if (!limpo(form.cidade)) return { ok: false, campo: 'cidade' };
  if (!(UFS as readonly string[]).includes(uf)) return { ok: false, campo: 'uf' };

  return {
    ok: true,
    tomador: {
      tipo,
      nome,
      documento,
      nome_fantasia: tipo === 'cnpj' ? limpo(form.nomeFantasia) : null,
      email: null,
      telefone: telefone || null,
      cep,
      logradouro: limpo(form.logradouro),
      numero: limpo(form.numero, 20),
      complemento: limpo(form.complemento),
      bairro: limpo(form.bairro),
      cidade: limpo(form.cidade),
      uf,
    },
  };
}

/** Mesmo tomador? Decide se a cobrança pendente pode ser reaproveitada ou precisa ser refeita. */
export function mesmoTomador(gravado: TomadorRegistro | null, desejado: Tomador | null): boolean {
  // `null` = o próprio cliente (pagamentos antigos não têm linha).
  if (!desejado) return !gravado || gravado.tipo === 'proprio';
  if (!gravado || gravado.tipo === 'proprio') return false;
  const campos = ['tipo', 'nome', 'documento', 'telefone', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'] as const;
  return campos.every((c) => (gravado[c] ?? null) === (desejado[c] ?? null));
}

/** Linha gravada → formulário (o checkout reabre com o tomador da cobrança pendente). */
export function tomadorParaForm(t: TomadorRegistro | null): TomadorForm | null {
  if (!t || t.tipo === 'proprio') return null;
  return {
    tipo: t.tipo,
    nome: t.nome,
    documento: maskCpfCnpj(t.documento),
    nomeFantasia: t.nome_fantasia ?? '',
    telefone: t.telefone ? maskTelefoneBR(t.telefone) : '',
    cep: t.cep ? maskCEP(t.cep) : '',
    logradouro: t.logradouro ?? '',
    numero: t.numero ?? '',
    complemento: t.complemento ?? '',
    bairro: t.bairro ?? '',
    cidade: t.cidade ?? '',
    uf: t.uf ?? '',
  };
}

/** "Rua X, 123 — Sala 4 · Centro · Florianópolis/SC · CEP 88000-000" (ou `null` sem endereço). */
export function enderecoTomador(t: Pick<TomadorRegistro, 'logradouro' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'uf' | 'cep'>): string | null {
  if (!t.logradouro) return null;
  return [
    `${t.logradouro}${t.numero ? `, ${t.numero}` : ''}${t.complemento ? ` — ${t.complemento}` : ''}`,
    t.bairro,
    t.cidade ? `${t.cidade}${t.uf ? `/${t.uf}` : ''}` : t.uf,
    t.cep ? `CEP ${maskCEP(t.cep)}` : null,
  ].filter(Boolean).join(' · ');
}

/** CPF/CNPJ com máscara completa. */
export function documentoTomador(doc: string): string {
  return maskCpfCnpj(doc);
}

/** CPF/CNPJ só com o miolo visível (***.456.789-** / **.345.678/****-**). */
export function documentoMascarado(doc: string | null | undefined): string | null {
  const d = onlyDigits(doc ?? '');
  if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  if (d.length === 14) return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/****-**`;
  return null;
}
