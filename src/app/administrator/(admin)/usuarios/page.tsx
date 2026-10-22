import { redirect } from 'next/navigation';
import { Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { contarSolicitacoesGestorPendentes } from '@/lib/solicitacao-gestor';
import type { UserRole } from '@/types/supabase';
import UsuariosAbas from './_components/UsuariosAbas';
import UsuariosGrid, { type UsuarioListItem } from './_components/UsuariosGrid';

const PAGE_SIZES = [10, 25, 50] as const;
const PAPEIS: UserRole[] = ['cliente', 'gestor', 'admin'];

// Colunas ordenáveis no servidor (colunas da própria tabela users).
const SORT_COLUMNS: Record<string, string> = {
  nome: 'name',
  cadastro: 'created_at',
};

type SearchParams = { q?: string; papel?: string; page?: string; per?: string; sort?: string; dir?: string };

/**
 * Lista de todas as contas da plataforma — somente leitura (SPEC §62).
 * Substitui a antiga /painel/usuarios: não cria contas nem concede papéis;
 * o papel de gestor vem da aprovação do pedido, e o de admin só por SQL.
 */
export default async function AdminUsuariosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/administrator/login');

  const sp = await searchParams;
  const perPage = PAGE_SIZES.includes(Number(sp.per) as (typeof PAGE_SIZES)[number]) ? Number(sp.per) : 10;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const sortCol = SORT_COLUMNS[sp.sort ?? ''] ?? 'created_at';
  const ascending = sp.dir === 'asc';
  const papel = PAPEIS.includes(sp.papel as UserRole) ? (sp.papel as UserRole) : null;
  // Remove caracteres que quebram a sintaxe do or() do PostgREST.
  const q = (sp.q ?? '').trim().replace(/[,()"]/g, '');
  const qDigitos = q.replace(/\D/g, '');

  // `papeis` traz todos os papéis da conta; `filtro` (inner join) só existe para filtrar por papel.
  let query = supabaseAdmin
    .from('users')
    .select(
      `id, name, email, cpf_cnpj, phone, avatar_url, created_at,
       papeis:user_roles ( role )${papel ? ', filtro:user_roles!inner ( role )' : ''}`,
      { count: 'exact' },
    );

  if (papel) query = query.eq('filtro.role', papel);
  if (q) {
    const orParts = [`name.ilike.%${q}%`, `email.ilike.%${q}%`];
    if (qDigitos.length >= 3) orParts.push(`cpf_cnpj.ilike.%${qDigitos}%`, `phone.ilike.%${qDigitos}%`);
    query = query.or(orParts.join(','));
  }

  // Desempate por id para paginação estável quando a coluna ordenada repete valores.
  const [{ data, count }, pendentes] = await Promise.all([
    query
      .order(sortCol, { ascending })
      .order('id', { ascending: true })
      .range((page - 1) * perPage, page * perPage - 1),
    contarSolicitacoesGestorPendentes(),
  ]);

  const usuarios = ((data ?? []) as unknown as (Omit<UsuarioListItem, 'papeis'> & { papeis: { role: UserRole }[] })[])
    .map((u) => ({ ...u, papeis: u.papeis.map((p) => p.role) }));

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 rounded-xl bg-[#0B2447]/5 flex items-center justify-center">
          <Users className="w-5 h-5 text-[#0B2447]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Usuários</h1>
          <p className="text-sm text-slate-500">
            Todas as contas da plataforma e os pedidos de acesso de gestor.
          </p>
        </div>
      </div>

      <UsuariosAbas ativa="usuarios" pendentes={pendentes} />

      <UsuariosGrid usuarios={usuarios} total={count ?? 0} page={page} perPage={perPage} />
    </div>
  );
}
