import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { SolicitacaoGestorStatus } from '@/types/supabase';
import UsuariosAbas from '../_components/UsuariosAbas';
import SolicitacoesLista, { type SolicitacaoItem } from '../_components/SolicitacoesLista';

const POR_PAGINA = 20;
const STATUS: { valor: SolicitacaoGestorStatus; label: string }[] = [
  { valor: 'pendente', label: 'Pendentes' },
  { valor: 'aprovada', label: 'Aprovados' },
  { valor: 'recusada', label: 'Recusados' },
];

type SearchParams = { st?: string; page?: string };

/**
 * Fila de pedidos de acesso de gestor (SPEC §62). Pendentes do mais antigo
 * para o mais novo; decididos do mais recente para o mais antigo.
 */
export default async function AdminSolicitacoesGestorPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/administrator/login');

  const sp = await searchParams;
  const status = STATUS.some((s) => s.valor === sp.st) ? (sp.st as SolicitacaoGestorStatus) : 'pendente';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const contar = async (st: SolicitacaoGestorStatus) => {
    const { count } = await supabaseAdmin
      .from('solicitacao_gestor')
      .select('id', { count: 'exact', head: true })
      .eq('status', st);
    return count ?? 0;
  };

  const [contagens, { data, count }] = await Promise.all([
    Promise.all(STATUS.map((s) => contar(s.valor))),
    supabaseAdmin
      .from('solicitacao_gestor')
      .select(
        `id, status, nome, telefone, documento, qtd_embarcacoes, mensagem, observacao, observacao_interna,
         created_at, decidido_em,
         usuario:users!solicitacao_gestor_user_id_fkey ( id, email, created_at ),
         decisor:users!solicitacao_gestor_decidido_por_fkey ( name ),
         municipios ( nome ), estados ( uf )`,
        { count: 'exact' },
      )
      .eq('status', status)
      .order(status === 'pendente' ? 'created_at' : 'decidido_em', { ascending: status === 'pendente' })
      .order('id', { ascending: true })
      .range((page - 1) * POR_PAGINA, page * POR_PAGINA - 1),
  ]);

  const itens = (data ?? []) as unknown as SolicitacaoItem[];
  const total = count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const href = (st: SolicitacaoGestorStatus, p = 1) =>
    `/administrator/usuarios/solicitacoes?st=${st}${p > 1 ? `&page=${p}` : ''}`;

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 rounded-xl bg-[#0B2447]/5 flex items-center justify-center">
          <Users className="w-5 h-5 text-[#0B2447]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Usuários</h1>
          <p className="text-sm text-slate-500">
            Aprove quem pode anunciar embarcações. Ao aprovar, a conta ganha acesso ao painel de gestor.
          </p>
        </div>
      </div>

      <UsuariosAbas ativa="solicitacoes" pendentes={contagens[0]} />

      <div className="flex flex-wrap gap-2 mb-5">
        {STATUS.map((s, i) => (
          <Link
            key={s.valor}
            href={href(s.valor)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              s.valor === status
                ? 'bg-[#0B2447] border-[#0B2447] text-white'
                : 'bg-white border-slate-200 text-slate-500 hover:text-[#0B2447]'
            }`}
          >
            {s.label}
            <span className={`rounded-full px-1.5 text-[10px] font-bold ${
              s.valor === status ? 'bg-white text-[#0B2447]' : s.valor === 'pendente' && contagens[i] > 0 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {contagens[i]}
            </span>
          </Link>
        ))}
      </div>

      <SolicitacoesLista itens={itens} status={status} />

      {totalPaginas > 1 && (
        <div className="mt-5 flex items-center justify-between text-xs text-slate-400">
          <span>Página {page} de {totalPaginas}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={href(status, page - 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-600 hover:text-[#0B2447]">
                Anterior
              </Link>
            )}
            {page < totalPaginas && (
              <Link href={href(status, page + 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-600 hover:text-[#0B2447]">
                Próxima
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
