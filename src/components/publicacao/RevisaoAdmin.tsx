import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, FileDiff, Pencil, User } from 'lucide-react';
import { formatarDataHora } from '@/lib/datas';
import { rotuloCampos, type StatusPublicacaoQualquer } from '@/lib/publicacao/config';
import StatusPublicacaoBadge from './StatusPublicacaoBadge';

/**
 * Peças das telas de revisão do administrator (embarcação, roteiro e
 * anúncio): cabeçalho com status e datas de controle, aviso de campos
 * alterados desde a última aprovação, galeria e lista de dados.
 */

export function CabecalhoRevisao({ voltarHref, voltarLabel, titulo, subtitulo, status, gestor, controle, editarHref }: {
  voltarHref: string;
  voltarLabel: string;
  titulo: string;
  subtitulo?: string;
  status: StatusPublicacaoQualquer;
  gestor: { name: string; email: string } | null;
  controle: {
    created_at: string;
    enviado_analise_em: string | null;
    aprovado_em: string | null;
    primeira_aprovacao_em: string | null;
    revisao: number;
  };
  /** Cadastro completo (com pré-visualização) — edição do admin. */
  editarHref?: string;
}) {
  const datas: [string, string | null][] = [
    ['Cadastrado em', controle.created_at],
    ['Enviado para análise em', controle.enviado_analise_em],
    ['Última aprovação', controle.aprovado_em],
    ['Publicado pela 1ª vez', controle.primeira_aprovacao_em],
  ];
  return (
    <div className="mb-6">
      <Link href={voltarHref} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-marinho">
        <ArrowLeft className="h-4 w-4" /> {voltarLabel}
      </Link>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-marinho">{titulo}</h1>
            <StatusPublicacaoBadge status={status} />
            {controle.revisao > 1 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                {controle.revisao}ª análise
              </span>
            )}
          </div>
          {subtitulo && <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>}
          {gestor && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
              <User className="h-4 w-4 text-slate-400" /> {gestor.name} · <span className="text-slate-400">{gestor.email}</span>
            </p>
          )}
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
            {datas.filter(([, v]) => v).map(([label, v]) => (
              <div key={label} className="text-xs">
                <dt className="inline text-slate-400">{label}: </dt>
                <dd className="inline font-medium text-slate-600">{formatarDataHora(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
        {editarHref && (
          <Link href={editarHref}
            className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl border border-marinho/20 bg-white px-4 py-2.5 text-sm font-semibold text-marinho hover:bg-marinho/5 transition">
            <Pencil className="h-4 w-4" /> Cadastro completo e pré-visualização
          </Link>
        )}
      </div>
    </div>
  );
}

/** Campos sensíveis que mudaram desde a última aprovação (`null` = primeira análise). */
export function CamposAlteradosCard({ campos }: { campos: string[] | null }) {
  return (
    <div className={`mb-6 flex gap-3 rounded-2xl border p-4 ${
      campos && campos.length > 0 ? 'border-sky-200 bg-sky-50/60' : 'border-slate-100 bg-white'}`}>
      <FileDiff className="mt-0.5 h-5 w-5 flex-shrink-0 text-sky-600" />
      <div className="text-sm">
        {campos === null ? (
          <p className="text-slate-600"><strong>Primeira análise:</strong> este cadastro nunca foi aprovado — revise todos os dados.</p>
        ) : campos.length === 0 ? (
          <p className="text-slate-600">Nenhum campo sensível mudou desde a última aprovação.</p>
        ) : (
          <p className="text-sky-900">
            <strong>Alterado desde a última aprovação:</strong> {rotuloCampos(campos)}
          </p>
        )}
      </div>
    </div>
  );
}

export function SecaoRevisao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-sm font-bold text-marinho tracking-wide uppercase">{titulo}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export function GaleriaRevisao({ fotos, destacar }: {
  fotos: { url_imagem: string; titulo: string | null; principal: boolean }[];
  destacar?: boolean;
}) {
  if (fotos.length === 0) return <p className="text-sm text-slate-400">Sem fotos.</p>;
  return (
    <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${destacar ? 'rounded-xl ring-2 ring-sky-300 ring-offset-4' : ''}`}>
      {fotos.map(f => (
        <a key={f.url_imagem} href={f.url_imagem} target="_blank" rel="noreferrer"
          className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-100 bg-slate-100">
          <Image src={f.url_imagem} alt={f.titulo ?? ''} fill sizes="240px" className="object-cover transition group-hover:scale-105" />
          {f.principal && (
            <span className="absolute left-2 top-2 rounded-full bg-marinho px-2 py-0.5 text-[10px] font-semibold text-white">Principal</span>
          )}
          {f.titulo && (
            <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-4 text-[11px] text-white">{f.titulo}</span>
          )}
        </a>
      ))}
    </div>
  );
}

/** Lista rótulo/valor; `chave` liga a linha ao campo sensível para destacar se mudou. */
export function DadosRevisao({ linhas, alterados }: {
  linhas: { label: string; valor: React.ReactNode; chave?: string; largo?: boolean }[];
  alterados: string[] | null;
}) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {linhas.map(l => {
        const mudou = !!l.chave && !!alterados?.includes(l.chave);
        return (
          <div key={l.label} className={`${l.largo ? 'sm:col-span-2' : ''} ${mudou ? '-m-2 rounded-xl bg-sky-50 p-2 ring-1 ring-sky-200' : ''}`}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {l.label}{mudou && <span className="ml-1.5 normal-case text-sky-600">· alterado</span>}
            </dt>
            <dd className="mt-0.5 text-sm text-slate-700 whitespace-pre-line">{l.valor ?? '—'}</dd>
          </div>
        );
      })}
    </dl>
  );
}
