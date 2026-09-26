import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createHash } from 'node:crypto';
import { ArrowLeft, ShieldCheck, ShieldAlert, ExternalLink, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import TermoMarkdown from '@/components/termos/TermoMarkdown';
import { formatarDataHoraBR, protocoloAceite } from '@/lib/termos/formato';
import { montarComprovante, montarFicha, type ContextoReserva, type FichaSecao } from '../_lib/ficha';
import BaixarComprovanteButton from '../_components/BaixarComprovanteButton';

function Secao({ secao }: { secao: FichaSecao }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <h2 className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-[#0B2447]">
        {secao.titulo}
      </h2>
      <dl className="px-5 py-2">
        {secao.linhas.map((l) => (
          <div key={l.rotulo} className="grid grid-cols-[150px_1fr] gap-3 py-2 border-b border-slate-50 last:border-0">
            <dt className="text-xs text-slate-400">{l.rotulo}</dt>
            <dd
              className={`text-xs break-all ${l.mono ? 'font-mono text-[11px]' : 'font-medium'} ${
                l.destaque === 'ok' ? 'text-emerald-700' : l.destaque === 'alerta' ? 'text-red-600' : 'text-slate-700'
              }`}
            >
              {l.link ? (
                <a href={l.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#0B3D91] hover:underline">
                  {l.valor} <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              ) : (
                l.valor
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default async function AceiteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/administrator/login');

  const { id } = await params;

  const { data: aceite } = await supabaseAdmin
    .from('termos_uso_aceite')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!aceite) notFound();

  const [{ data: termo }, { data: reservaRaw }, { data: problemas }, { data: admin }] = await Promise.all([
    supabaseAdmin
      .from('termos_uso_plataforma')
      .select('id, titulo, versao, conteudo, publicado_em')
      .eq('id', aceite.termo_id)
      .maybeSingle(),
    aceite.contexto_tipo === 'reserva' && aceite.contexto_id
      ? supabaseAdmin.from('reserva').select('item_nome, data_reserva, status').eq('id', aceite.contexto_id).maybeSingle()
      : Promise.resolve({ data: null }),
    // Auditoria da cadeia inteira: hash e encadeamento deste registro são checados junto com os demais.
    supabaseAdmin.rpc('verificar_cadeia_termos_aceite'),
    supabaseAdmin.from('users').select('name, email').eq('id', user.id).maybeSingle(),
  ]);

  // Verificação independente do texto: SHA-256 do texto atual do termo × hash gravado no aceite.
  const textoConfere = termo
    ? createHash('sha256').update(`${termo.titulo}\n\n${termo.conteudo}`, 'utf8').digest('hex') === aceite.termo_conteudo_hash
    : null;

  const integridade = {
    problemasDesteAceite: (problemas ?? []).filter((p) => p.aceite_id === aceite.id).map((p) => p.problema),
    problemasNaCadeia: (problemas ?? []).length,
    textoConfere,
    verificadoEm: new Date().toISOString(),
  };

  const secoes = montarFicha({ aceite, termo, reserva: reservaRaw as ContextoReserva, integridade });
  const comprovante = montarComprovante({
    aceite,
    secoes,
    termo: termo ? { titulo: termo.titulo, versao: termo.versao, conteudo: termo.conteudo } : null,
    geradoPor: admin ? `${admin.name} (${admin.email})` : user.id,
  });

  const integro = integridade.problemasDesteAceite.length === 0 && textoConfere !== false;

  return (
    <div className="p-8">
      <Link
        href="/administrator/termos/aceites"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-[#0B2447] transition mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Aceites
      </Link>

      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Registro de aceite</p>
        <h1 className="text-2xl font-bold text-[#0B2447] font-mono">{protocoloAceite(aceite.evidencia_hash)}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {aceite.usuario_nome ?? 'Usuário'} · {formatarDataHoraBR(aceite.aceito_em, { segundos: true })}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5">
          {secoes.map((s) => <Secao key={s.titulo} secao={s} />)}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
            <BaixarComprovanteButton comprovante={comprovante} />
            <p className="text-[11px] text-slate-400">
              Ficha completa de evidências + íntegra do termo aceito, com protocolo e hashes em todas as páginas.
            </p>
          </div>

          <div className={`rounded-2xl border p-5 ${integro ? 'border-emerald-200 bg-emerald-50/60' : 'border-red-200 bg-red-50'}`}>
            <div className="flex items-start gap-3">
              {integro
                ? <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                : <ShieldAlert className="w-6 h-6 text-red-600 shrink-0" />}
              <div>
                <p className={`text-sm font-bold ${integro ? 'text-emerald-800' : 'text-red-700'}`}>
                  {integro ? 'Registro íntegro' : 'Falha de integridade'}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  {integro
                    ? 'O hash do registro confere, o elo com o registro anterior é válido e o texto do termo corresponde ao aceito.'
                    : 'Este registro ou o texto do termo não corresponde ao que foi gravado. Veja a seção "Integridade do registro".'}
                </p>
                {integridade.problemasNaCadeia > 0 && integro && (
                  <p className="text-xs text-amber-700 mt-2">
                    Atenção: há {integridade.problemasNaCadeia} problema(s) em outros registros da cadeia.
                  </p>
                )}
              </div>
            </div>
          </div>

          <Link
            href={`/administrator/termos/${aceite.termo_id}`}
            className="flex items-center gap-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-sm font-semibold text-[#0B2447] hover:bg-slate-50 transition"
          >
            <FileText className="w-4 h-4" /> Ver versão do termo no cadastro
          </Link>
        </aside>
      </div>

      {termo && (
        <details className="mt-6 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group">
          <summary className="cursor-pointer px-5 py-4 text-sm font-bold text-[#0B2447] hover:bg-slate-50 transition list-none flex items-center justify-between">
            Íntegra do texto aceito — {termo.titulo} (versão {termo.versao})
            <span className="text-xs font-semibold text-slate-400 group-open:hidden">Mostrar</span>
            <span className="text-xs font-semibold text-slate-400 hidden group-open:inline">Ocultar</span>
          </summary>
          <div className="px-8 py-6 border-t border-slate-100 max-w-4xl">
            <TermoMarkdown conteudo={termo.conteudo} />
          </div>
        </details>
      )}
    </div>
  );
}
