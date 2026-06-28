'use client';

/** Logo oficial (colorido) do Google Calendar. */
function GoogleCalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <path fill="#fff" d="M152.62 47.38H47.38v105.24h105.24z" />
      <path fill="#EA4335" d="M152.62 200 200 152.62l-9.51-4.75-37.87 4.75-4.75 23.69z" />
      <path fill="#FBBC04" d="M200 47.38h-47.38v105.24H200z" />
      <path fill="#34A853" d="M152.62 152.62H47.38V200h105.24z" />
      <path fill="#188038" d="M0 152.62v31.07C0 192.27 7.73 200 16.31 200h31.07v-47.38z" />
      <path fill="#1967D2" d="M200 47.38V16.31C200 7.73 192.27 0 183.69 0h-31.07v47.38z" />
      <path fill="#4285F4" d="M152.62 0H16.31C7.73 0 0 7.73 0 16.31v136.31h47.38V47.38h105.24z" />
      <path
        fill="#4285F4"
        d="M68.45 129.17c-3.94-2.66-6.66-6.54-8.16-11.66l9.13-3.76c.84 3.2 2.3 5.68 4.38 7.44 2.07 1.76 4.6 2.63 7.56 2.63 3.03 0 5.62-.92 7.78-2.76 2.16-1.84 3.24-4.19 3.24-7.03 0-2.91-1.14-5.29-3.41-7.13-2.28-1.84-5.13-2.76-8.54-2.76h-5.28v-9.04h4.74c2.93 0 5.4-.79 7.41-2.38 2.01-1.59 3.02-3.76 3.02-6.52 0-2.46-.9-4.42-2.7-5.88-1.8-1.46-4.08-2.2-6.84-2.2-2.7 0-4.84.72-6.43 2.16-1.59 1.44-2.74 3.21-3.46 5.28l-9.04-3.76c1.2-3.42 3.42-6.44 6.69-9.04 3.27-2.6 7.45-3.91 12.55-3.91 3.76 0 7.14.72 10.13 2.18 2.99 1.46 5.34 3.48 7.03 6.06 1.69 2.59 2.53 5.49 2.53 8.71 0 3.28-.79 6.06-2.38 8.33-1.59 2.28-3.54 4.02-5.85 5.24v.54c3.05 1.27 5.54 3.21 7.5 5.81 1.95 2.6 2.93 5.71 2.93 9.34 0 3.63-.92 6.87-2.76 9.72-1.84 2.85-4.38 5.09-7.62 6.73-3.25 1.64-6.9 2.46-10.95 2.46-4.69.01-9.02-1.34-12.96-4z"
      />
      <path fill="#4285F4" d="M115.97 84.66l-9.96 7.2-5.01-7.59 17.94-12.94h6.84v61.07h-9.81z" />
    </svg>
  );
}

type Props = {
  /** Título do evento (nome do item + nome do cliente). */
  titulo: string;
  /** Data da reserva em 'yyyy-mm-dd' (evento de dia inteiro). */
  dataReserva: string;
  /** Descrição do evento. */
  detalhes: string;
  /** Local (opcional). */
  local?: string | null;
};

/** Formata 'yyyy-mm-dd' (+offset de dias) como 'YYYYMMDD' para o template do Google Calendar. */
function toCalDate(iso: string, addDays = 0): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + addDays);
  return `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, '0')}${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export default function AdicionarAoCalendario({ titulo, dataReserva, detalhes, local }: Props) {
  // Evento de dia inteiro: a data final é exclusiva (dia seguinte).
  const dates = `${toCalDate(dataReserva)}/${toCalDate(dataReserva, 1)}`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: titulo,
    dates,
    details: detalhes,
  });
  if (local) params.set('location', local);

  const url = `https://calendar.google.com/calendar/render?${params.toString()}`;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <h2 className="text-sm font-bold text-[#0B2447] mb-1.5">Lembrete</h2>
      <p className="text-xs text-slate-500 mb-4">
        Adicione esta reserva à sua agenda com os dados já preenchidos.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-[#0B3D91]/40 hover:bg-slate-50 hover:text-[#0B3D91] transition-all"
      >
        <GoogleCalendarIcon className="h-4 w-4" />
        Adicionar ao Google Calendar
      </a>
    </section>
  );
}
