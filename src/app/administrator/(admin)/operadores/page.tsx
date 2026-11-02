import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { ChevronLeft, ChevronRight, Search, Star, UserCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatarData } from '@/lib/datas';
import { getResumosOperadores } from '@/lib/operador';
import { STATUS_PERFIL_INFO } from '@/lib/operador-tipos';
import type { OperadorPerfilConteudo, OperadorPerfilStatus } from '@/types/supabase';

const PAGE_SIZES = [10, 25, 50] as const;

type StatusLista = OperadorPerfilStatus | 'sem_perfil';
type Aba = StatusLista | 'todos';

const ABAS: { chave: Aba; rotulo: string }[] = [
  { chave: 'em_analise', rotulo: 'Em análise' },
  { chave: 'aprovado', rotulo: 'Aprovados' },
  { chave: 'devolvido', rotulo: 'Devolvidos' },
  { chave: 'retirado', rotulo: 'Retirados' },
  { chave: 'rascunho', rotulo: 'Rascunhos' },
  { chave: 'sem_perfil', rotulo: 'Sem perfil' },
  { chave: 'todos', rotulo: 'Todos' },
];

type Linha = {
  id: string;
  conta: string;
  email: string;
  avatar: string | null;
  status: StatusLista;
  nomePublico: string | null;
  foto: string | null;
  enviadoEm: string | null;
};

type SearchParams = { st?: string; q?: string; page?: string; per?: string };

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Perfis de operador (SPEC §99): fila de análise e visão de todos os gestores — quem já se
 * apresentou, quem ainda não. Poucos gestores no MVP: a lista é montada e filtrada no servidor,
 * em memória, sem estado no navegador (abas, busca e páginas são links e um formulário GET).
 */
export default async function AdminOperadoresPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/administrator/login');

  const sp = await searchParams;
  const q = semAcento((sp.q ?? '').trim());
  const perPage = PAGE_SIZES.includes(Number(sp.per) as (typeof PAGE_SIZES)[number]) ? Number(sp.per) : 10;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const [{ data: gestores }, { data: perfis }] = await Promise.all([
    supabaseAdmin.from('user_roles').select('users ( id, name, email, avatar_url )').eq('role', 'gestor'),
    supabaseAdmin.from('operador_perfil').select('owner_id, status, nome_publico, foto_url, enviado_analise_em, publicado'),
  ]);

  const perfilPorId = new Map((perfis ?? []).map((p) => [p.owner_id, p]));
  const todas: Linha[] = [];
  for (const g of gestores ?? []) {
    const u = g.users as unknown as { id: string; name: string; email: string; avatar_url: string | null } | null;
    if (!u) continue;
    const p = perfilPorId.get(u.id);
    const pub = p?.publicado as OperadorPerfilConteudo | null | undefined;
    todas.push({
      id: u.id, conta: u.name, email: u.email, avatar: u.avatar_url,
      status: p?.status ?? 'sem_perfil',
      nomePublico: p?.nome_publico ?? pub?.nome_publico ?? null,
      foto: pub?.foto_url ?? p?.foto_url ?? null,
      enviadoEm: p?.enviado_analise_em ?? null,
    });
  }

  const contagem = (aba: Aba) => (aba === 'todos' ? todas.length : todas.filter((l) => l.status === aba).length);
  const filaAnalise = contagem('em_analise');
  const aba: Aba = ABAS.some((a) => a.chave === sp.st) ? (sp.st as Aba) : filaAnalise > 0 ? 'em_analise' : 'todos';

  const filtradas = todas
    .filter((l) => aba === 'todos' || l.status === aba)
    .filter((l) => !q || semAcento(`${l.conta} ${l.email} ${l.nomePublico ?? ''}`).includes(q))
    // Fila: o mais antigo primeiro. Demais: ordem alfabética.
    .sort((a, b) => (aba === 'em_analise'
      ? (a.enviadoEm ?? '').localeCompare(b.enviadoEm ?? '')
      : (a.nomePublico ?? a.conta).localeCompare(b.nomePublico ?? b.conta, 'pt-BR')) || a.id.localeCompare(b.id));

  const total = filtradas.length;
  const totalPaginas = Math.max(1, Math.ceil(total / perPage));
  const paginaAtual = Math.min(page, totalPaginas);
  const pagina = filtradas.slice((paginaAtual - 1) * perPage, paginaAtual * perPage);
  const resumos = await getResumosOperadores(pagina.map((l) => l.id));

  const href = (extra: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const base: Record<string, string | null> = { st: aba, q: sp.q?.trim() || null, per: perPage === 10 ? null : String(perPage), page: null };
    for (const [k, v] of Object.entries({ ...base, ...extra })) if (v) params.set(k, v);
    return `/administrator/operadores?${params.toString()}`;
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0B2447]/5">
          <UserCheck className="h-5 w-5 text-[#0B2447]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Operadores</h1>
          <p className="text-sm text-slate-500">
            Foto, nome e apresentação de cada gestor. O perfil só vai ao site depois da sua aprovação.
          </p>
        </div>
      </div>

      <nav aria-label="Filtrar por situação" className="mb-4 flex flex-wrap gap-2">
        {ABAS.map(({ chave, rotulo }) => {
          const ativa = chave === aba;
          const n = contagem(chave);
          const fila = chave === 'em_analise' && n > 0;
          return (
            <Link key={chave} href={href({ st: chave })} aria-current={ativa ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                ativa ? 'border-marinho bg-marinho text-white'
                  : fila ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}>
              {rotulo}
              <span className={`rounded-full px-1.5 py-px text-[10px] ${ativa ? 'bg-white/20' : fila ? 'bg-amber-200/70' : 'bg-slate-100 text-slate-500'}`}>{n}</span>
            </Link>
          );
        })}
      </nav>

      <form method="get" action="/administrator/operadores" className="mb-5 flex flex-col gap-3 sm:flex-row">
        <input type="hidden" name="st" value={aba} />
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <label htmlFor="busca-operadores" className="sr-only">Buscar operador</label>
          <input id="busca-operadores" name="q" defaultValue={sp.q ?? ''} placeholder="Buscar por nome ou e-mail…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#0B2447]/40 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20" />
        </div>
        <button type="submit" className="rounded-xl bg-[#0B2447] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B3D91]">Buscar</button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {pagina.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <UserCheck className="mb-4 h-12 w-12 text-slate-200" />
            <p className="text-sm font-medium text-slate-500">Nenhum operador nesta lista</p>
            <p className="mt-1 text-xs text-slate-400">
              {aba === 'em_analise' ? 'Não há perfis aguardando análise.' : 'Tente outro filtro ou outros termos de busca.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pl-6 pr-4 pt-4">Operador</th>
                  <th className="px-4 pb-3 pt-4">Situação</th>
                  <th className="px-4 pb-3 pt-4">Avaliação</th>
                  <th className="px-4 pb-3 pt-4">Experiências</th>
                  <th className="px-4 pb-3 pt-4">Enviado em</th>
                  <th className="pb-3 pl-4 pr-6 pt-4"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {pagina.map((l) => {
                  const r = resumos.get(l.id);
                  const info = STATUS_PERFIL_INFO[l.status];
                  const foto = l.foto ?? l.avatar;
                  return (
                    <tr key={l.id} className="border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50/60">
                      <td className="py-3.5 pl-6 pr-4">
                        <div className="flex items-center gap-3">
                          {foto ? (
                            <Image src={foto} alt="" width={36} height={36} unoptimized className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                              {(l.conta[0] ?? '?').toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold leading-tight text-[#0B2447]">{l.nomePublico ?? l.conta}</p>
                            <p className="mt-0.5 truncate text-xs text-slate-400">{l.nomePublico && l.nomePublico !== l.conta ? `${l.conta} · ` : ''}{l.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${info.classe}`}>{info.rotulo}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-600">
                        {r && r.media !== null ? (
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            <strong className="text-[#0B2447]">{r.media.toFixed(1).replace('.', ',')}</strong>
                            <span className="text-xs text-slate-400">({r.totalAvaliacoes})</span>
                          </span>
                        ) : <span className="text-xs text-slate-300">Sem avaliações</span>}
                        {r && r.avaliacoesPendentes > 0 && (
                          <span className="ml-2 rounded-full bg-amber-50 px-1.5 py-px text-[10px] font-semibold text-amber-700" title="Avaliações aguardando moderação">
                            +{r.avaliacoesPendentes} a moderar
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-sm tabular-nums text-slate-600">{r?.experiencias ?? 0}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-600">{l.enviadoEm ? formatarData(l.enviadoEm) : '—'}</td>
                      <td className="py-3.5 pl-4 pr-6 text-right">
                        <Link href={`/administrator/operadores/${l.id}`}
                          className={`inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold ${
                            l.status === 'em_analise' ? 'bg-[#0B2447] text-white hover:bg-[#0B3D91]' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}>
                          {l.status === 'em_analise' ? 'Analisar' : 'Ver'}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row">
            <p className="text-xs text-slate-400">
              Mostrando <span className="font-semibold text-slate-600">{(paginaAtual - 1) * perPage + 1}–{Math.min(paginaAtual * perPage, total)}</span>{' '}
              de <span className="font-semibold text-slate-600">{total}</span> operador{total !== 1 ? 'es' : ''}
            </p>
            {totalPaginas > 1 && (
              <div className="flex items-center gap-2">
                {paginaAtual > 1 && (
                  <Link href={href({ page: paginaAtual - 1 <= 1 ? null : String(paginaAtual - 1) })} aria-label="Página anterior"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></Link>
                )}
                <span className="text-xs font-semibold text-slate-600">Página {paginaAtual} de {totalPaginas}</span>
                {paginaAtual < totalPaginas && (
                  <Link href={href({ page: String(paginaAtual + 1) })} aria-label="Próxima página"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
