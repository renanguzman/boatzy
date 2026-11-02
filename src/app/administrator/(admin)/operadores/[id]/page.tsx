import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Clock, ExternalLink, Eye, FileDiff, Star } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatarData, formatarDataHora, partesNoFuso } from '@/lib/datas';
import { formatarTelefoneE164 } from '@/lib/countries';
import { ehUuid } from '@/lib/upload-imagem-server';
import { getOperadorPerfil, getResumoOperador, listarEventosPerfil } from '@/lib/operador';
import { STATUS_PERFIL_INFO, montarOperadorPublico, type OperadorPublico } from '@/lib/operador-tipos';
import OperadorSecao from '@/components/operador/OperadorSecao';
import type { OperadorPerfilConteudo } from '@/types/supabase';
import PainelDecisaoPerfil from '../_components/PainelDecisaoPerfil';
import TimelinePerfil from '../_components/TimelinePerfil';

const CAMPOS: { chave: keyof OperadorPerfilConteudo; rotulo: string }[] = [
  { chave: 'foto_url', rotulo: 'Foto' },
  { chave: 'nome_publico', rotulo: 'Nome de exibição' },
  { chave: 'headline', rotulo: 'Frase de apresentação' },
  { chave: 'bio', rotulo: 'Apresentação' },
];

/** Revisão do perfil de um operador (SPEC §99): prévia fiel, o que mudou, decisão e histórico. */
export default async function AdminOperadorDetalhePage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ver?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/administrator/login');

  const { id } = await params;
  const { ver } = await searchParams;
  if (!ehUuid(id)) notFound();

  const [{ data: conta }, { data: papeis }, perfil, resumo, eventos] = await Promise.all([
    supabaseAdmin.from('users').select('name, email, phone, created_at').eq('id', id).maybeSingle(),
    supabaseAdmin.from('user_roles').select('role').eq('user_id', id),
    getOperadorPerfil(id),
    getResumoOperador(id),
    listarEventosPerfil(id, { incluirInterna: true }),
  ]);
  if (!conta || !(papeis ?? []).some((p) => p.role === 'gestor')) notFound();

  const status = perfil?.status ?? 'sem_perfil';
  const info = STATUS_PERFIL_INFO[status];
  const publicado = perfil?.publicado ?? null;
  const rascunho: OperadorPerfilConteudo | null = perfil
    ? { nome_publico: perfil.nome_publico, headline: perfil.headline, bio: perfil.bio, foto_url: perfil.foto_url }
    : null;
  const desdeAno = partesNoFuso(new Date(conta.created_at)).ano;
  const extras = {
    desdeAno, media: resumo.media, totalAvaliacoes: resumo.totalAvaliacoes, experiencias: resumo.experiencias,
    embarcacoes: resumo.embarcacoes, passeiosRealizados: resumo.passeiosRealizados,
  };

  // Qual versão mostrar na prévia: a enviada (rascunho) ou a que está no ar.
  const verNoAr = ver === 'no-ar' ? true : ver === 'enviada' ? false : !(status === 'em_analise' || !publicado);
  const conteudoPrevia = verNoAr ? publicado : rascunho;
  const previa: OperadorPublico | null = conteudoPrevia ? montarOperadorPublico(id, conteudoPrevia, extras, conta.name) : null;

  // O que mudou entre a versão no ar e a enviada.
  const alterados = publicado && rascunho
    ? CAMPOS.filter(({ chave }) => (publicado[chave] ?? '') !== (rascunho[chave] ?? ''))
    : [];

  const tab = (alvo: 'enviada' | 'no-ar', rotulo: string, ativa: boolean) => (
    <Link href={`/administrator/operadores/${id}?ver=${alvo}`} replace aria-current={ativa ? 'page' : undefined}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${ativa ? 'bg-marinho text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
      {rotulo}
    </Link>
  );

  return (
    <div className="space-y-6 p-8">
      <div>
        <Link href="/administrator/operadores" className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0B2447]">
          <ArrowLeft className="h-3.5 w-3.5" /> Operadores
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-[#0B2447]">{perfil?.nome_publico ?? conta.name}</h1>
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${info.classe}`}>{info.rotulo}</span>
        </div>
        {status === 'em_analise' && perfil?.enviado_analise_em && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5" /> Enviado para análise em {formatarDataHora(perfil.enviado_analise_em)}
          </p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          {/* Prévia fiel ao site */}
          <section aria-labelledby="previa-titulo" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="previa-titulo" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-marinho">
                <Eye className="h-4 w-4" /> Como aparece no site
              </h2>
              {rascunho && publicado && (
                <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
                  {tab('enviada', 'Versão enviada', !verNoAr)}
                  {tab('no-ar', 'No ar agora', verNoAr)}
                </div>
              )}
            </div>
            {previa ? (
              <OperadorSecao operador={previa} linkPerfil={false} />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
                {status === 'sem_perfil' ? 'Este gestor ainda não começou o perfil.' : 'Não há versão para mostrar.'}
              </div>
            )}
            {verNoAr && status === 'em_analise' && (
              <p className="text-xs text-slate-500">Esta é a versão que o público vê hoje. A versão enviada está na outra aba.</p>
            )}
          </section>

          {alterados.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/50">
              <div className="flex items-center gap-2.5 border-b border-amber-200 px-6 py-3.5">
                <FileDiff className="h-4 w-4 text-amber-700" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-amber-900">O que mudou desde a versão no ar</h2>
              </div>
              <ul className="divide-y divide-amber-200/70">
                {alterados.map(({ chave, rotulo }) => (
                  <li key={chave} className="px-6 py-3 text-sm">
                    <p className="font-semibold text-amber-950">{rotulo}</p>
                    {chave === 'foto_url' ? (
                      <p className="mt-0.5 text-amber-900/80">A foto foi trocada — veja nas abas acima.</p>
                    ) : (
                      <div className="mt-1 grid gap-2 sm:grid-cols-2">
                        <p className="whitespace-pre-line rounded-lg bg-white/80 px-3 py-2 text-slate-500 line-through decoration-slate-300">{publicado?.[chave] || '(vazio)'}</p>
                        <p className="whitespace-pre-line rounded-lg bg-white px-3 py-2 text-slate-800">{rascunho?.[chave] || '(vazio)'}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <PainelDecisaoPerfil ownerId={id} status={status} temPublicado={!!publicado} versao={perfil?.updated_at ?? ''} />

          <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-marinho">Operador</h2>
            </div>
            <dl className="space-y-3 px-6 py-5 text-sm">
              {([
                ['Nome na conta', conta.name],
                ['E-mail', conta.email],
                ['Celular', formatarTelefoneE164(conta.phone)],
                ['Na plataforma desde', formatarData(conta.created_at)],
                ['Experiências no ar', String(resumo.experiencias)],
                ['Embarcações no ar', String(resumo.embarcacoes)],
                ['Passeios realizados', String(resumo.passeiosRealizados)],
              ] as const).map(([rotulo, valor]) => (
                <div key={rotulo} className="flex items-baseline justify-between gap-4">
                  <dt className="text-slate-500">{rotulo}</dt>
                  <dd className="min-w-0 truncate text-right font-medium text-slate-800">{valor}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-4 border-t border-slate-100 pt-3">
                <dt className="text-slate-500">Avaliação média</dt>
                <dd className="text-right font-medium text-slate-800">
                  {resumo.media !== null ? (
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {resumo.media.toFixed(1).replace('.', ',')} <span className="text-xs font-normal text-slate-400">({resumo.totalAvaliacoes})</span>
                    </span>
                  ) : <span className="text-slate-400">Sem avaliações</span>}
                </dd>
              </div>
              {resumo.avaliacoesPendentes > 0 && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {resumo.avaliacoesPendentes} avaliaç{resumo.avaliacoesPendentes === 1 ? 'ão aguarda' : 'ões aguardam'} moderação e ainda não entram na média.{' '}
                  <Link href="/administrator/avaliacoes" className="font-semibold underline">Moderar</Link>
                </p>
              )}
              {perfil?.status === 'aprovado' && (
                <Link href={`/operadores/${id}`} target="_blank"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B3D91] hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir a página pública
                </Link>
              )}
            </dl>
          </section>

          <TimelinePerfil eventos={eventos} />
        </div>
      </div>
    </div>
  );
}
