// Validadores e máscaras usados no cadastro do cliente (/entrar).

// ─── CPF ──────────────────────────────────────────────────────────────────

/** Remove tudo que não for dígito. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Aplica a máscara de CPF: 000.000.000-00 (progressiva conforme digita). */
export function maskCPF(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/** Valida CPF pelos dígitos verificadores (rejeita sequências repetidas). */
export function isValidCPF(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // 000.000.000-00 etc.

  const calcCheck = (base: string, factor: number): number => {
    let total = 0;
    for (const digit of base) total += parseInt(digit, 10) * factor--;
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const d1 = calcCheck(cpf.slice(0, 9), 10);
  if (d1 !== parseInt(cpf[9], 10)) return false;

  const d2 = calcCheck(cpf.slice(0, 10), 11);
  return d2 === parseInt(cpf[10], 10);
}

// ─── CEP ──────────────────────────────────────────────────────────────────

/** Aplica a máscara de CEP: 00000-000. */
export function maskCEP(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

// ─── Telefone ─────────────────────────────────────────────────────────────

/**
 * Aplica uma máscara de formato "(##) #####-####" a um valor de dígitos.
 * "#" representa um dígito; qualquer outro caractere é literal.
 */
export function applyPhoneMask(digits: string, mask: string): string {
  const d = onlyDigits(digits);
  let out = '';
  let i = 0;
  for (const ch of mask) {
    if (i >= d.length) break;
    if (ch === '#') {
      out += d[i++];
    } else {
      out += ch;
    }
  }
  return out;
}

/** Conta quantos dígitos "#" a máscara comporta. */
export function maskDigitCount(mask: string): number {
  return (mask.match(/#/g) ?? []).length;
}

// ─── Senha ────────────────────────────────────────────────────────────────

export type PasswordRule = {
  id: string;
  label: string;
  test: (pw: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: 'Pelo menos 8 caracteres', test: (pw) => pw.length >= 8 },
  { id: 'upper', label: 'Uma letra maiúscula', test: (pw) => /[A-Z]/.test(pw) },
  { id: 'lower', label: 'Uma letra minúscula', test: (pw) => /[a-z]/.test(pw) },
  { id: 'number', label: 'Um número', test: (pw) => /\d/.test(pw) },
  { id: 'special', label: 'Um caractere especial (!@#$…)', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

/** True quando a senha satisfaz todas as regras. */
export function isStrongPassword(pw: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(pw));
}
