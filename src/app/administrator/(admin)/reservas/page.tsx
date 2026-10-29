import Link from 'next/link';
import { CalendarCheck, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabase';
import type { ReservaStatus } from '@/types/supabase';
import { RESERVA_STATUS, formatarDataCurta } from '../pedidos/_lib/rotulos';

/**
 * Reservas da plataforma (SPEC §96) — todas, com ou sem pedido no Boatzy. Busca por passeio,
 * cliente/gestor (nome ou e-mail) ou id; filtro por status; abre o detalhe com a linha do tempo
 * de comunicações.
 */

const POR_PAGINA = 25;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS = Object.keys(RESERVA_STATUS) as ReservaStatus[];

type SearchParams = Record<string, string | undefined>;

type Linha = {
  id: string;
  item_nome: string;
  data_reserva: string;
  quantidade_pessoas: number;
  status: ReservaStatus;
  roteiro: { nome: string; horario_saida: string | null } | null;
  cliente: { name: string; email: string } | null;
  owner: { name: string } | null;
};

export default async function AdminReservasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().replace(/[,()"]/g, '');
  const status = STATUS.includes(sp.status as ReservaStatus) ? (sp.status as ReservaStatus) : null;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  let consulta = supabaseAdmin
    .from('reserva')
    .select(
      `id, item_nome, data_reserva, quantidade_pessoas, status, roteiro ( nome, horario_saida ),
       cliente:users!reserva_cliente_id_fkey ( name, email ), owner:users!reserva_owner_id_fkey ( name )`,
      { count: 'exact' },
    )
    .order('data_reserva', { ascending: false })
    .order('solicitado_em', { ascending: false })
    .range((page - 1) * POR_PAGINA, page * POR_PAGINA - 1);
  if (status) consulta = consulta.eq('status', status);
  if (q) {
    if (UUID.test(q)) {
      consulta = consulta.eq('id', q);
    } else {
      const { data: usuarios } = await supabaseAdmin
        .from('users')
        .select('id')
        .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(200);
      const ids = (usuarios ?? []).map((u) => u.id);
      consulta = consulta.or(
        [`item_nome.ilike.%${q}%`, ...(ids.length ? [`cliente_id.in.(${ids.join(',')})`, `owner_id.in.(${ids.join(',')})`] : [])].join(','),
      );
    }
  }
  const { data, count } = await consulta;
  const linhas = (data ?? []) as unknown as Linha[];
  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const url = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (p > 1) params.set('page', String(p));
    const s = params.toString();
    return `/administrator/reservas${s ? `?${s}` : ''}`;
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#0B2447]/5 flex items-center justify-center">
          <CalendarCheck className="w-5 h-5 text-[#0B2447]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Reservas</h1>
          <p className="text-sm text-slate-500">
            Todas as reservas da plataforma — com ou sem pagamento pelo Boatzy —, com os dados completos e a linha do tempo de comunicações.
          </p>
        </div>
      </div>

      <form className="mb-4 flex flex-wrap gap-2" action="/administrator/reservas">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Passeio, cliente, gestor (nome ou e-mail) ou id da reserva"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20"
          />
        </div>
        <select name="status" defaultValue={status ?? ''} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
          <option value="">Todos os status</option>
          {STATUS.map((s) => <option key={s} value={s}>{RESERVA_STATUS[s].label}</option>)}
        </select>
        <button type="submit" className="rounded-xl bg-[#0B2447] px-4 py-2.5 text-sm font-semibold text-white">Buscar</button>
      </form>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Data do passeio</th>
              <th className="px-4 py-3">Passeio</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Gestor</th>
              <th className="px-4 py-3 text-center">Pessoas</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Nenhuma reserva encontrada.</td></tr>
            )}
            {linhas.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                  <Link href={`/administrator/reservas/${r.id}`} className="font-semibold text-[#0B3D91] hover:underline">
                    {formatarDataCurta(r.data_reserva)}
                  </Link>
                  {r.roteiro?.horario_saida && <span className="block text-[11px] text-slate-400">saída {r.roteiro.horario_saida.slice(0, 5)}</span>}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <Link href={`/administrator/reservas/${r.id}`} className="hover:text-[#0B3D91]">{r.roteiro?.nome ?? r.item_nome}</Link>
                  <span className="block font-mono text-[11px] text-slate-400">{r.id.slice(0, 8).toUpperCase()}</span>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {r.cliente?.name ?? '—'}
                  {r.cliente?.email && <span className="block text-[11px] text-slate-400">{r.cliente.email}</span>}
                </td>
                <td className="px-4 py-3 text-slate-700">{r.owner?.name ?? '—'}</td>
                <td className="px-4 py-3 text-center text-slate-700">{r.quantidade_pessoas}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${RESERVA_STATUS[r.status].cls}`}>
                    {RESERVA_STATUS[r.status].label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>{total} reserva{total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          {page > 1 && <Link href={url(page - 1)} className="rounded-lg border border-slate-200 bg-white p-1.5 hover:bg-slate-50" aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Link>}
          <span>Página {page} de {paginas}</span>
          {page < paginas && <Link href={url(page + 1)} className="rounded-lg border border-slate-200 bg-white p-1.5 hover:bg-slate-50" aria-label="Próxima página"><ChevronRight className="h-4 w-4" /></Link>}
        </div>
      </div>
    </div>
  );
}
