import { redirect } from 'next/navigation';
import { Ship } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import AdminEmbarcacoesGrid, { type AdminEmbarcacaoListItem } from './_components/AdminEmbarcacoesGrid';
import FiltroStatusPublicacao from '@/components/publicacao/FiltroStatusPublicacao';
import { contarPorStatus } from '@/lib/publicacao/server';
import type { PublicacaoStatus } from '@/types/supabase';

const STATUSES: PublicacaoStatus[] = ['em_analise', 'retorno', 'ativo', 'em_manutencao', 'inativo'];

const PAGE_SIZES = [10, 25, 50] as const;

// Colunas ordenáveis no servidor (apenas colunas da própria tabela embarcacao).
const SORT_COLUMNS: Record<string, string> = {
  nome: 'nome',
  status: 'status',
  capacidade: 'capacidade',
  created_at: 'created_at',
  enviado_analise_em: 'enviado_analise_em',
};

type SearchParams = { q?: string; page?: string; per?: string; sort?: string; dir?: string; st?: string };

export default async function AdminEmbarcacoesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/administrator/login');

  const sp = await searchParams;

  // Abas de status: sem escolha explícita, abre na fila "Em análise" (se houver).
  const contagem = await contarPorStatus('embarcacao', STATUSES);
  const st: PublicacaoStatus | 'todos' =
    sp.st === 'todos' || STATUSES.includes(sp.st as PublicacaoStatus) ? (sp.st as PublicacaoStatus | 'todos')
    : contagem.em_analise > 0 ? 'em_analise' : 'todos';
  // Na fila de análise, sem ordenação escolhida: mais antigos primeiro.
  const filaPadrao = st === 'em_analise' && !sp.sort;

  const perPage = PAGE_SIZES.includes(Number(sp.per) as (typeof PAGE_SIZES)[number]) ? Number(sp.per) : 10;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const sortCol = filaPadrao ? 'enviado_analise_em' : SORT_COLUMNS[sp.sort ?? ''] ?? 'created_at';
  const ascending = filaPadrao ? true : sp.dir === 'asc';
  // Remove caracteres que quebram a sintaxe do or() do PostgREST.
  const q = (sp.q ?? '').trim().replace(/[,()"]/g, '');

  // Busca por gestor: resolve os owner_ids que casam com o termo antes da query principal.
  let ownerIdsBusca: string[] = [];
  if (q) {
    const { data: owners } = await supabaseAdmin
      .from('users')
      .select('id')
      .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(100);
    ownerIdsBusca = (owners ?? []).map((o) => o.id);
  }

  let query = supabaseAdmin
    .from('embarcacao')
    .select(`
      id,
      nome,
      status,
      enviado_analise_em,
      revisao,
      capacidade,
      owner_id,
      created_at,
      embarcacao_tipo ( nome ),
      municipios ( nome, estados ( uf ) ),
      embarcacao_imagens ( url_imagem, principal ),
      roteiro ( id, nome )
    `, { count: 'exact' });

  if (st !== 'todos') query = query.eq('status', st);

  if (q) {
    const orParts = [`nome.ilike.%${q}%`];
    if (ownerIdsBusca.length > 0) orParts.push(`owner_id.in.(${ownerIdsBusca.join(',')})`);
    query = query.or(orParts.join(','));
  }

  // Desempate por id para paginação estável quando a coluna ordenada repete valores.
  const { data, count } = await query
    .order(sortCol, { ascending })
    .order('id', { ascending: true })
    .range((page - 1) * perPage, page * perPage - 1);

  const total = count ?? 0;

  const rows = (data ?? []) as unknown as (Omit<AdminEmbarcacaoListItem, 'gestor'> & { owner_id: string })[];

  // Gestores apenas da página atual: owner_id não possui FK declarada no PostgREST.
  const ownerIds = [...new Set(rows.map((r) => r.owner_id))];
  const { data: gestores } = ownerIds.length
    ? await supabaseAdmin.from('users').select('id, name, email').in('id', ownerIds)
    : { data: [] };

  const gestorById = new Map((gestores ?? []).map((g) => [g.id, { name: g.name, email: g.email }]));

  const embarcacoes: AdminEmbarcacaoListItem[] = rows.map((r) => ({
    ...r,
    gestor: gestorById.get(r.owner_id) ?? null,
  }));

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 rounded-xl bg-[#0B2447]/5 flex items-center justify-center">
          <Ship className="w-5 h-5 text-[#0B2447]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Embarcações</h1>
          <p className="text-sm text-slate-500">
            Todas as embarcações cadastradas na plataforma, com o gestor responsável.
            Analise os cadastros enviados, publique, devolva para ajustes ou retire do ar.
          </p>
        </div>
      </div>

      <FiltroStatusPublicacao
        atual={st}
        opcoes={[
          { value: 'todos', count: Object.values(contagem).reduce((a, b) => a + b, 0) },
          ...STATUSES.map((value) => ({ value, count: contagem[value] ?? 0 })),
        ]}
      />

      <AdminEmbarcacoesGrid
        embarcacoes={embarcacoes}
        total={total}
        page={page}
        perPage={perPage}
      />
    </div>
  );
}
