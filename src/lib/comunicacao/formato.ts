/**
 * Formatação dos contatos nas comunicações da reserva (SPEC §96) — sem dependências de servidor.
 */

/** Celular legível: (48) 99999-0000 para números do Brasil (com ou sem +55); senão +DDI… */
export function formatarCelular(tel: string | null | undefined): string | null {
  let d = (tel ?? '').replace(/\D/g, '');
  if (!d) return null;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return d.length >= 8 ? `+${d}` : null;
}

/**
 * Destino mascarado para a linha do tempo de cliente e gestor: r•••@gmail.com / (••) •••••-0000.
 * O admin vê o destino completo.
 */
export function mascararDestino(destino: string | null | undefined): string | null {
  if (!destino) return null;
  const arroba = destino.indexOf('@');
  if (arroba > 0) return `${destino[0]}•••${destino.slice(arroba)}`;
  const d = destino.replace(/\D/g, '');
  return d.length >= 4 ? `•••• ${d.slice(-4)}` : '••••';
}
