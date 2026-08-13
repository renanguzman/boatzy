import { redirect } from 'next/navigation';
import { Percent } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getTaxaGeral } from '@/lib/taxas';
import TaxaGeralCard from './_components/TaxaGeralCard';
import AdminTaxasGestoresGrid, { type AdminGestorTaxaItem } from './_components/AdminTaxasGestoresGrid';

const PAGE_SIZES = [10, 25, 50] as const;

// Colunas ordenáveis no servidor (colunas diretas da tabela users).
const SORT_COLUMNS: Record<string, string> = {
  nome: 'name',
  cadastro: 'created_at',
};

type SearchParams = { q?: string; page?: string; per?: string; sort?: string; dir?: string };

export default async function AdminTaxasPage({
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
  const sortCol = SORT_COLUMNS[sp.sort ?? ''] ?? 'name';
  const ascending = sp.dir !== 'desc';
  // Remove caracteres que quebram a sintaxe do or() do PostgREST.
  const q = (sp.q ?? '').trim().replace(/[,()"]/g, '');

  const taxaGeral = await getTaxaGeral();

  // Ids de todos os usuários com role 'gestor' — universo de quem pode ter taxa específica.
  const { data: gestorRoles } = await supabaseAdmin
    .from('user_roles')
    .select('user_id')
    .eq('role', 'gestor');
  const gestorIds = [...new Set((gestorRoles ?? []).map((r) => r.user_id))];

  let gestores: AdminGestorTaxaItem[] = [];
  let total = 0;

  if (gestorIds.length > 0) {
    let query = supabaseAdmin
      .from('users')
      .select('id, name, email, created_at', { count: 'exact' })
      .in('id', gestorIds);

    if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`);

    // Desempate por id para paginação estável quando a coluna ordenada repete valores.
    const { data, count } = await query
      .order(sortCol, { ascending })
      .order('id', { ascending: true })
      .range((page - 1) * perPage, page * perPage - 1);

    total = count ?? 0;
    const rows = data ?? [];
    const pageIds = rows.map((r) => r.id);

    const { data: overrides } =
      pageIds.length > 0
        ? await supabaseAdmin
            .from('usuario_taxa')
            .select('user_id, taxa_percent, ativo, data_validade, observacao')
            .in('user_id', pageIds)
        : { data: [] as { user_id: string; taxa_percent: number; ativo: boolean; data_validade: string | null; observacao: string | null }[] };

    const overridesByUser = new Map((overrides ?? []).map((o) => [o.user_id, o]));

    gestores = rows.map((r) => {
      const override = overridesByUser.get(r.id) ?? null;
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        createdAt: r.created_at,
        taxaEspecifica: override
          ? {
              taxaPercent: Number(override.taxa_percent),
              ativo: override.ativo,
              dataValidade: override.data_validade,
              observacao: override.observacao,
            }
          : null,
      };
    });
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#0B2447]/5 flex items-center justify-center">
          <Percent className="w-5 h-5 text-[#0B2447]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Taxas</h1>
          <p className="text-sm text-slate-500">
            Taxa geral da plataforma e taxas específicas por gestor.
          </p>
        </div>
      </div>

      <div className="mb-8">
        <TaxaGeralCard taxaAtual={taxaGeral} />
      </div>

      <AdminTaxasGestoresGrid
        gestores={gestores}
        total={total}
        page={page}
        perPage={perPage}
        taxaGeralPercent={taxaGeral?.taxaPercent ?? null}
      />
    </div>
  );
}
