function toISO(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

function hoje(): Date {
  return new Date();
}

export function presetEsteMes(): { de: string; ate: string } {
  const d = hoje();
  const de = new Date(d.getFullYear(), d.getMonth(), 1);
  return { de: toISO(de), ate: toISO(d) };
}

export function presetUltimos30Dias(): { de: string; ate: string } {
  const d = hoje();
  const de = new Date(d);
  de.setDate(de.getDate() - 29);
  return { de: toISO(de), ate: toISO(d) };
}

export function presetUltimos6Meses(): { de: string; ate: string } {
  const d = hoje();
  const de = new Date(d.getFullYear(), d.getMonth() - 5, 1);
  return { de: toISO(de), ate: toISO(d) };
}

export function presetEsteAno(): { de: string; ate: string } {
  const d = hoje();
  const de = new Date(d.getFullYear(), 0, 1);
  return { de: toISO(de), ate: toISO(d) };
}

// Janela imediatamente anterior, com a mesma duração (em dias) do período informado —
// usada para calcular a variação % da receita.
export function periodoAnterior(de: string, ate: string): { de: string; ate: string } {
  const dDe = new Date(`${de}T00:00:00`);
  const dAte = new Date(`${ate}T00:00:00`);
  const duracaoDias = Math.max(1, Math.round((dAte.getTime() - dDe.getTime()) / 86_400_000) + 1);

  const anteriorAte = new Date(dDe);
  anteriorAte.setDate(anteriorAte.getDate() - 1);
  const anteriorDe = new Date(anteriorAte);
  anteriorDe.setDate(anteriorDe.getDate() - (duracaoDias - 1));

  return { de: toISO(anteriorDe), ate: toISO(anteriorAte) };
}

export function formatPeriodoLabel(de: string, ate: string): string {
  const f = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${f(de)} a ${f(ate)}`;
}
