import { redirect } from 'next/navigation';
import { Star } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import AvaliacoesGrid, { type AvaliacaoListItem } from './_components/AvaliacoesGrid';

const PAGE_SIZES = [10, 25, 50] as const;

// Colunas ordenáveis no servidor (apenas colunas da própria tabela avaliacao).
const SORT_COLUMNS: Record<string, string> = {
  data: 'created_at',
  nota: 'nota',
  status: 'status',
};

type SearchParams = { q?: string; page?: string; per?: string; sort?: string; dir?: string };

export default async function AdminAvaliacoesPage({
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

  // Busca em tabelas relacionadas: resolve os ids que casam com o termo antes da query principal.
  let clienteIds: string[] = [];
  let roteiroIds: string[] = [];
  let embarcacaoIds: string[] = [];
  if (q) {
    const [{ data: clientes }, { data: roteiros }, { data: embarcacoes }] = await Promise.all([
      supabaseAdmin.from('users').select('id').or(`name.ilike.%${q}%,email.ilike.%${q}%`).limit(100),
      supabaseAdmin.from('roteiro').select('id').ilike('nome', `%${q}%`).limit(100),
      supabaseAdmin.from('embarcacao').select('id').ilike('nome', `%${q}%`).limit(100),
    ]);
    clienteIds = (clientes ?? []).map((c) => c.id);
    roteiroIds = (roteiros ?? []).map((r) => r.id);
    embarcacaoIds = (embarcacoes ?? []).map((e) => e.id);
  }

  let query = supabaseAdmin
    .from('avaliacao')
    .select(
      `id, nota, comentario, status, created_at,
       cliente:users!avaliacao_cliente_id_fkey ( name, email ),
       roteiro ( id, nome ),
       embarcacao ( id, nome )`,
      { count: 'exact' },
    );

  if (q) {
    const orParts = [`comentario.ilike.%${q}%`];
    if (clienteIds.length > 0) orParts.push(`cliente_id.in.(${clienteIds.join(',')})`);
    if (roteiroIds.length > 0) orParts.push(`roteiro_id.in.(${roteiroIds.join(',')})`);
    if (embarcacaoIds.length > 0) orParts.push(`embarcacao_id.in.(${embarcacaoIds.join(',')})`);
    query = query.or(orParts.join(','));
  }

  // Desempate por id para paginação estável quando a coluna ordenada repete valores.
  const { data, count } = await query
    .order(sortCol, { ascending })
    .order('id', { ascending: true })
    .range((page - 1) * perPage, page * perPage - 1);

  const total = count ?? 0;
  const avaliacoes = (data ?? []) as unknown as AvaliacaoListItem[];

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 rounded-xl bg-[#0B2447]/5 flex items-center justify-center">
          <Star className="w-5 h-5 text-[#0B2447]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Avaliações</h1>
          <p className="text-sm text-slate-500">
            Todas as avaliações enviadas por clientes na plataforma. Aprove para publicar no site,
            edite ou exclua quando necessário.
          </p>
        </div>
      </div>

      <AvaliacoesGrid
        avaliacoes={avaliacoes}
        total={total}
        page={page}
        perPage={perPage}
      />
    </div>
  );
}
