import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus, TicketPercent } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import AdminCuponsGrid, { type AdminCupomListItem } from './_components/AdminCuponsGrid';

const PAGE_SIZES = [10, 25, 50] as const;

// Colunas ordenáveis no servidor (apenas colunas da própria tabela cupom).
const SORT_COLUMNS: Record<string, string> = {
  codigo: 'codigo',
  valor: 'valor',
  validade: 'data_fim',
  status: 'ativo',
  created_at: 'created_at',
};

type SearchParams = { q?: string; page?: string; per?: string; sort?: string; dir?: string };

export default async function AdminCuponsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/administrator/login');

  const sp = await searchParams;
  const perPage = PAGE_SIZES.includes(Number(sp.per) as (typeof PAGE_SIZES)[number]) ? Number(sp.per) : 10;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const sortCol = SORT_COLUMNS[sp.sort ?? ''] ?? 'created_at';
  const ascending = sp.dir === 'asc';
  // Remove caracteres que quebram a sintaxe do or() do PostgREST.
  const q = (sp.q ?? '').trim().replace(/[,()"]/g, '');

  // Busca por parceiro: resolve os parceiro_ids que casam com o termo antes da query principal.
  let parceiroIdsBusca: string[] = [];
  if (q) {
    const { data: parceiros } = await supabaseAdmin
      .from('parceiro')
      .select('id')
      .ilike('nome', `%${q}%`)
      .limit(100);
    parceiroIdsBusca = (parceiros ?? []).map((p) => p.id);
  }

  let query = supabaseAdmin
    .from('cupom')
    .select(`
      id,
      codigo,
      descricao,
      tipo_desconto,
      valor,
      valor_desconto_maximo,
      valor_minimo_pedido,
      data_inicio,
      data_fim,
      limite_uso_total,
      limite_uso_por_cliente,
      ativo,
      created_at,
      parceiro ( id, nome ),
      cupom_uso ( count )
    `, { count: 'exact' });

  if (q) {
    const orParts = [`codigo.ilike.%${q}%`, `descricao.ilike.%${q}%`];
    if (parceiroIdsBusca.length > 0) orParts.push(`parceiro_id.in.(${parceiroIdsBusca.join(',')})`);
    query = query.or(orParts.join(','));
  }

  // Desempate por id para paginação estável quando a coluna ordenada repete valores.
  const { data, count } = await query
    .order(sortCol, { ascending })
    .order('id', { ascending: true })
    .range((page - 1) * perPage, page * perPage - 1);

  const total = count ?? 0;

  const rows = (data ?? []) as unknown as {
    id: string;
    codigo: string;
    descricao: string | null;
    tipo_desconto: 'percentual' | 'valor_fixo';
    valor: number;
    valor_desconto_maximo: number | null;
    valor_minimo_pedido: number | null;
    data_inicio: string | null;
    data_fim: string | null;
    limite_uso_total: number | null;
    limite_uso_por_cliente: number | null;
    ativo: boolean;
    created_at: string;
    parceiro: { id: string; nome: string } | null;
    cupom_uso: { count: number }[];
  }[];

  const cupons: AdminCupomListItem[] = rows.map((r) => ({
    ...r,
    usosCount: r.cupom_uso[0]?.count ?? 0,
  }));

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#0B2447]/5 flex items-center justify-center">
            <TicketPercent className="w-5 h-5 text-[#0B2447]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0B2447]">Cupons</h1>
            <p className="text-sm text-slate-500">
              Cupons de desconto da plataforma: crie, edite, pause ou remova, com rastreio de uso
              para eventual repasse a parceiros.
            </p>
          </div>
        </div>
        <Link
          href="/administrator/cupons/novo"
          className="flex items-center gap-2 bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-md shadow-[#0B2447]/10 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Novo cupom
        </Link>
      </div>

      <AdminCuponsGrid
        cupons={cupons}
        total={total}
        page={page}
        perPage={perPage}
      />
    </div>
  );
}
