import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Fingerprint, History, Lock, Info } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import TermoMarkdown from '@/components/termos/TermoMarkdown';
import {
  TERMOS_IDENTIFICADORES,
  TERMO_PUBLICO_ALVO_LABEL,
  isTermoIdentificador,
  termoIdentificadorLabel,
} from '@/lib/termos/identificadores';
import TermoStatusBadge from '../_components/TermoStatusBadge';
import TermoAcoesPainel from '../_components/TermoAcoesPainel';

function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function Linha({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-50 last:border-0">
      <dt className="text-xs text-slate-400 shrink-0">{label}</dt>
      <dd className="text-xs font-medium text-slate-700 text-right">{children}</dd>
    </div>
  );
}

export default async function VisualizarTermoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/administrator/login');

  const { id } = await params;

  const { data: termo } = await supabaseAdmin
    .from('termos_uso_plataforma')
    .select('*')
    .eq('id', id)
    .single();

  if (!termo) notFound();

  const autorIds = [termo.criado_por, termo.publicado_por].filter((v): v is string => !!v);
  const [{ data: autores }, { data: versoes }] = await Promise.all([
    autorIds.length
      ? supabaseAdmin.from('users').select('id, name').in('id', autorIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabaseAdmin
      .from('termos_uso_plataforma')
      .select('id, versao, status, publicado_em')
      .eq('identificador', termo.identificador)
      .order('versao', { ascending: false }),
  ]);

  const nomeAutor = new Map((autores ?? []).map((a) => [a.id, a.name]));
  const info = isTermoIdentificador(termo.identificador) ? TERMOS_IDENTIFICADORES[termo.identificador] : null;

  return (
    <div className="p-8">
      <Link
        href="/administrator/termos"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-[#0B2447] transition mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Termos de Uso
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-[#0B2447]">{termoIdentificadorLabel(termo.identificador)}</h1>
        <span className="text-sm font-semibold text-slate-500">v{termo.versao}</span>
        <TermoStatusBadge status={termo.status} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">
        {/* ── Documento ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {termo.status === 'rascunho' ? (
            <div className="flex items-center gap-2 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs text-slate-500">
              <Info className="w-3.5 h-3.5" />
              Rascunho — ainda não é exibido aos usuários. Revise o texto e publique quando estiver pronto.
            </div>
          ) : (
            <div className="flex items-center gap-2 px-6 py-3 bg-emerald-50/60 border-b border-emerald-100 text-xs text-emerald-800">
              <Lock className="w-3.5 h-3.5" />
              Versão publicada — texto imutável. Para alterar, crie uma nova versão.
            </div>
          )}

          <article className="px-8 py-8 sm:px-12 sm:py-10">
            <header className="mb-8 pb-5 border-b-2 border-[#0B2447]">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">Boatzy · Documento</p>
              <h2 className="text-2xl font-bold text-[#0B2447]">{termo.titulo}</h2>
              <p className="mt-2 text-xs text-slate-500">
                Versão {termo.versao}
                {termo.publicado_em && <> · Vigente desde {fmtDataHora(termo.publicado_em)}</>}
                {termo.conteudo_hash && (
                  <> · Código de verificação <span className="font-mono">{termo.conteudo_hash.slice(0, 12).toUpperCase()}</span></>
                )}
              </p>
            </header>
            <TermoMarkdown conteudo={termo.conteudo} />
          </article>
        </div>

        {/* ── Lateral ───────────────────────────────────────────────────── */}
        <aside className="space-y-5 xl:sticky xl:top-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <TermoAcoesPainel
              termo={{
                id: termo.id,
                identificador: termo.identificador,
                versao: termo.versao,
                titulo: termo.titulo,
                status: termo.status,
              }}
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Detalhes</h3>
            <dl>
              <Linha label="Identificador"><span className="font-mono">{termo.identificador}</span></Linha>
              <Linha label="Público">{info ? TERMO_PUBLICO_ALVO_LABEL[info.publicoAlvo] : '—'}</Linha>
              <Linha label="Leitura até o fim">{termo.exige_rolagem_completa ? 'Exigida' : 'Não exigida'}</Linha>
              <Linha label="Confirmação digitada">{termo.exige_confirmacao_digitada ? 'Exigida' : 'Não exigida'}</Linha>
              <Linha label="Cadastro">
                {fmtDataHora(termo.data_cadastro)}
                {termo.criado_por && nomeAutor.get(termo.criado_por) && (
                  <span className="block text-slate-400 font-normal">por {nomeAutor.get(termo.criado_por)}</span>
                )}
              </Linha>
              {termo.publicado_em && (
                <Linha label="Publicação">
                  {fmtDataHora(termo.publicado_em)}
                  {termo.publicado_por && nomeAutor.get(termo.publicado_por) && (
                    <span className="block text-slate-400 font-normal">por {nomeAutor.get(termo.publicado_por)}</span>
                  )}
                </Linha>
              )}
              {termo.arquivado_em && <Linha label="Arquivamento">{fmtDataHora(termo.arquivado_em)}</Linha>}
            </dl>
            {termo.descricao_interna && (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{termo.descricao_interna}</p>
            )}
          </div>

          {termo.conteudo_hash && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                <Fingerprint className="w-3.5 h-3.5" /> Integridade (SHA-256)
              </h3>
              <p className="font-mono text-[11px] leading-relaxed text-slate-600 break-all select-all">{termo.conteudo_hash}</p>
              <p className="mt-2 text-[11px] text-slate-400">
                Impressão digital do título + conteúdo, calculada pelo banco na publicação. Cada aceite guarda
                este código e prova qual texto exato foi aceito.
              </p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              <History className="w-3.5 h-3.5" /> Versões deste termo
            </h3>
            <ul className="space-y-1">
              {(versoes ?? []).map((v) => (
                <li key={v.id}>
                  <Link
                    href={`/administrator/termos/${v.id}`}
                    className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs transition ${
                      v.id === termo.id ? 'bg-[#0B2447]/5 font-semibold text-[#0B2447]' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>
                      v{v.versao}
                      {v.publicado_em && (
                        <span className="text-slate-400 font-normal"> · {fmtDataHora(v.publicado_em).split(',')[0]}</span>
                      )}
                    </span>
                    <TermoStatusBadge status={v.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
