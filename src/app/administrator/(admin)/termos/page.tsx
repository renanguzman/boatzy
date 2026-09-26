import { redirect } from 'next/navigation';
import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { TermoUsoStatus } from '@/types/supabase';
import AdminTermosGrid, { type AdminTermoListItem } from './_components/AdminTermosGrid';
import TermosAbas from './_components/TermosAbas';

const PAGE_SIZES = [10, 25, 50] as const;

// Colunas ordenáveis no servidor (apenas colunas da própria tabela).
const SORT_COLUMNS: Record<string, string> = {
  identificador: 'identificador',
  titulo: 'titulo',
  versao: 'versao',
  status: 'status',
  data_cadastro: 'data_cadastro',
};

const STATUS_VALIDOS: TermoUsoStatus[] = ['rascunho', 'publicado', 'arquivado'];

type SearchParams = { q?: string; page?: string; per?: string; sort?: string; dir?: string; status?: string };

export default async function AdminTermosPage({
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
  const sortCol = SORT_COLUMNS[sp.sort ?? ''] ?? 'data_cadastro';
  const ascending = sp.dir === 'asc';
  const status = STATUS_VALIDOS.find((s) => s === sp.status);
  // Remove caracteres que quebram a sintaxe do or() do PostgREST.
  const q = (sp.q ?? '').trim().replace(/[,()"]/g, '');

  let query = supabaseAdmin
    .from('termos_uso_plataforma')
    .select('id, identificador, versao, titulo, status, publicado_em, data_cadastro', { count: 'exact' });

  if (q) query = query.or(`titulo.ilike.%${q}%,identificador.ilike.%${q}%`);
  if (status) query = query.eq('status', status);

  // Desempate por id para paginação estável quando a coluna ordenada repete valores.
  const { data, count } = await query
    .order(sortCol, { ascending })
    .order('id', { ascending: true })
    .range((page - 1) * perPage, page * perPage - 1);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#0B2447]/5 flex items-center justify-center">
            <FileText className="w-5 h-5 text-[#0B2447]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0B2447]">Termos de Uso</h1>
            <p className="text-sm text-slate-500">
              Textos dos termos aceitos pelos usuários em cada ponto da plataforma. Versões publicadas
              são imutáveis — para alterar um texto vigente, crie uma nova versão.
            </p>
          </div>
        </div>
        <Link
          href="/administrator/termos/novo"
          className="flex items-center gap-2 bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-md shadow-[#0B2447]/10 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Novo termo
        </Link>
      </div>

      <TermosAbas ativa="textos" />

      <AdminTermosGrid
        termos={(data ?? []) as AdminTermoListItem[]}
        total={count ?? 0}
        page={page}
        perPage={perPage}
      />
    </div>
  );
}
