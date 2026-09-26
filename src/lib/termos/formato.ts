/** Formatação de datas das evidências — sempre no horário de Brasília, para não variar entre servidor e navegador. */

export function formatarDataHoraBR(iso: string | null | undefined, opts: { segundos?: boolean } = {}): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', ...(opts.segundos ? { second: '2-digit' } : {}),
    timeZone: 'America/Sao_Paulo',
  });
}

/** Protocolo exibido ao usuário: 12 primeiros caracteres do hash, em maiúsculas. */
export function protocoloAceite(evidenciaHash: string): string {
  return evidenciaHash.slice(0, 12).toUpperCase();
}
