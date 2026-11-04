/**
 * Telefone do membro da equipe — SPEC §104. Brasileiro: só dígitos com DDD (10–11), como sempre.
 * Estrangeiro: E.164 com "+" (ex.: +5491112345678). O "+" distingue os dois formatos no banco.
 */
import { applyPhoneMask, onlyDigits } from '@/lib/validators';
import { formatarTelefoneE164 } from '@/lib/countries';

export const telefoneMembroInternacional = (tel: string | null | undefined): boolean => !!tel && tel.trim().startsWith('+');

/** Brasil: DDD + número (10–11 dígitos). Internacional: "+" e 8–15 dígitos. */
export function telefoneMembroValido(tel: string): boolean {
  const d = onlyDigits(tel);
  return telefoneMembroInternacional(tel) ? d.length >= 8 && d.length <= 15 : d.length >= 10 && d.length <= 11;
}

/** Valor que vai para o banco: "+dígitos" (internacional) ou só dígitos. */
export function normalizarTelefoneMembro(tel: string): string {
  const d = onlyDigits(tel);
  return telefoneMembroInternacional(tel) ? `+${d}` : d;
}

/** Para exibição: "+54 11 1234 5678" ou "(11) 91234-5678"; "—" quando vazio. */
export function formatarTelefoneMembro(tel: string | null | undefined): string {
  if (!tel) return '—';
  if (telefoneMembroInternacional(tel)) return formatarTelefoneE164(tel);
  const d = onlyDigits(tel);
  if (d.length === 11) return applyPhoneMask(d, '(##) #####-####');
  if (d.length === 10) return applyPhoneMask(d, '(##) ####-####');
  return tel;
}
