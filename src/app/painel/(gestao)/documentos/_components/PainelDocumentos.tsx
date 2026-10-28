'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Ship, IdCard, Plus, Eye, RefreshCw, Pencil, Trash2, ChevronDown, History, FilePlus2, X, UserRound,
  AlertTriangle, Loader2, ShieldCheck,
} from 'lucide-react';
import ResumoValidadeCards, { type FiltroSituacao } from '@/components/painel/documentos/ResumoValidadeCards';
import { PrazoValidade, SeloValidade } from '@/components/painel/documentos/SeloValidade';
import { formatarData } from '@/lib/datas';
import {
  TIPOS_DOCUMENTO, TIPOS_INSCRICAO, TIPOS_POR_ESCOPO, nomeCurtoDocumento, rotuloCategoria, rotuloFuncao,
} from '@/lib/documentos/tipos';
import { situacaoValidade, type ResumoValidade, type SituacaoValidade } from '@/lib/documentos/validade';
import type { DocumentoItem, MembroCondutor } from '@/lib/documentos/server';
import { excluirDocumento } from '../actions';

type Aba = 'embarcacoes' | 'condutores';

const ORDEM_SITUACAO: Record<SituacaoValidade, number> = { vencido: 0, vence_em_breve: 1, em_dia: 2, sem_validade: 3 };

function ordemTipo(d: DocumentoItem) {
  return TIPOS_POR_ESCOPO[d.escopo].indexOf(d.tipo);
}

function situacaoDoc(d: DocumentoItem): SituacaoValidade {
  return situacaoValidade(d.data_validade);
}

/** Pior situação de um conjunto de documentos (o que pede atenção primeiro). */
function piorSituacao(docs: DocumentoItem[]): SituacaoValidade | null {
  if (docs.length === 0) return null;
  return docs.map(situacaoDoc).sort((a, b) => ORDEM_SITUACAO[a] - ORDEM_SITUACAO[b])[0];
}

function confere(d: DocumentoItem, filtro: FiltroSituacao | null): boolean {
  if (!filtro || filtro === 'pendente') return true;
  const s = situacaoDoc(d);
  return filtro === 'em_dia' ? s === 'em_dia' || s === 'sem_validade' : s === filtro;
}

const ROTULO_FILTRO: Record<FiltroSituacao, string> = {
  vencido: 'Vencidos',
  vence_em_breve: 'Vencem em breve',
  em_dia: 'Em dia',
  pendente: 'Embarcações sem documento de inscrição',
};

export default function PainelDocumentos({
  documentos,
  embarcacoes,
  condutores,
  resumo,
  filtroInicial,
  abaInicial,
}: {
  documentos: DocumentoItem[];
  embarcacoes: { id: string; nome: string }[];
  condutores: MembroCondutor[];
  resumo: ResumoValidade;
  filtroInicial: FiltroSituacao | null;
  abaInicial: Aba;
}) {
  const [filtro, setFiltro] = useState<FiltroSituacao | null>(filtroInicial);
  const [aba, setAba] = useState<Aba>(filtroInicial === 'pendente' ? 'embarcacoes' : abaInicial);

  const ativos = useMemo(() => documentos.filter((d) => !d.arquivado_em), [documentos]);
  const historico = useMemo(() => documentos.filter((d) => d.arquivado_em), [documentos]);

  const porEmbarcacao = useMemo(() => {
    return embarcacoes.map((e) => {
      const docs = ativos.filter((d) => d.embarcacao_id === e.id).sort((a, b) => ordemTipo(a) - ordemTipo(b));
      return {
        ...e,
        docs,
        antigos: historico.filter((d) => d.embarcacao_id === e.id),
        semInscricao: !docs.some((d) => TIPOS_INSCRICAO.includes(d.tipo)),
        semDpem: !docs.some((d) => d.tipo === 'dpem'),
      };
    });
  }, [embarcacoes, ativos, historico]);

  const porCondutor = useMemo(() => {
    return condutores
      .map((m) => ({
        ...m,
        docs: ativos.filter((d) => d.equipe_membro_id === m.id).sort((a, b) => ordemTipo(a) - ordemTipo(b)),
        antigos: historico.filter((d) => d.equipe_membro_id === m.id),
      }))
      // Inativos só aparecem se tiverem documento.
      .filter((m) => m.ativo || m.docs.length > 0);
  }, [condutores, ativos, historico]);

  const embarcacoesVisiveis = porEmbarcacao.filter((e) =>
    !filtro ? true : filtro === 'pendente' ? e.semInscricao : e.docs.some((d) => confere(d, filtro)),
  );
  const condutoresVisiveis = porCondutor.filter((m) =>
    !filtro ? true : filtro === 'pendente' ? false : m.docs.some((d) => confere(d, filtro)),
  );

  function selecionarFiltro(f: FiltroSituacao | null) {
    setFiltro(f);
    if (f === 'pendente') setAba('embarcacoes');
  }

  const totalDocsCondutores = ativos.filter((d) => d.escopo === 'condutor').length;
  const totalDocsEmbarcacoes = ativos.length - totalDocsCondutores;

  return (
    <div className="space-y-6">
      <ResumoValidadeCards resumo={resumo} selecionado={filtro} onSelecionar={selecionarFiltro} />

      {/* Abas — a área cresce com novas abas (ex.: Manutenção) sem mudar o resto. */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
        <div role="tablist" aria-label="Documentos" className="inline-flex rounded-xl bg-slate-100 p-1 self-start">
          {([
            { id: 'embarcacoes', rotulo: 'Embarcações', icone: Ship, n: totalDocsEmbarcacoes },
            { id: 'condutores', rotulo: 'Condutores', icone: IdCard, n: totalDocsCondutores },
          ] as const).map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={aba === t.id}
              onClick={() => setAba(t.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                aba === t.id ? 'bg-white text-[#0B2447] shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <t.icone className="h-4 w-4" />
              {t.rotulo}
              <span className={`rounded-full px-1.5 text-[11px] ${aba === t.id ? 'bg-slate-100 text-slate-600' : 'bg-slate-200/70 text-slate-500'}`}>{t.n}</span>
            </button>
          ))}
        </div>
        {filtro && (
          <button
            type="button"
            onClick={() => setFiltro(null)}
            className="inline-flex items-center gap-1.5 self-start rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Mostrando: {ROTULO_FILTRO[filtro]} <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {aba === 'embarcacoes' ? (
        embarcacoes.length === 0 ? (
          <Vazio
            icone={Ship}
            titulo="Nenhuma embarcação cadastrada"
            texto="Cadastre uma embarcação para guardar os documentos dela aqui."
            acao={{ href: '/painel/embarcacoes/novo', rotulo: 'Cadastrar embarcação' }}
          />
        ) : embarcacoesVisiveis.length === 0 ? (
          <Vazio icone={ShieldCheck} titulo="Nada por aqui" texto="Nenhuma embarcação com documentos nessa situação." />
        ) : (
          <div className="space-y-4">
            {embarcacoesVisiveis.map((e) => (
              <CartaoAlvo
                key={e.id}
                icone={<Ship className="h-5 w-5 text-[#0B2447]" />}
                titulo={e.nome}
                situacao={e.semInscricao ? 'pendente' : piorSituacao(e.docs)}
                novoHref={`/painel/documentos/novo?escopo=embarcacao&embarcacao=${e.id}`}
                antigos={e.antigos}
              >
                {e.semInscricao && (!filtro || filtro === 'pendente') && (
                  <LinhaPendente
                    titulo="Documento de inscrição (TIE ou TIEM)"
                    texto="Ainda não enviado — é o principal documento da embarcação."
                    href={`/painel/documentos/novo?escopo=embarcacao&embarcacao=${e.id}&tipo=tie`}
                    rotulo="Enviar"
                    destaque
                  />
                )}
                {e.docs.filter((d) => confere(d, filtro)).map((d) => (
                  <LinhaDocumento key={d.id} d={d} />
                ))}
                {e.semDpem && !filtro && (
                  <LinhaPendente
                    titulo="Seguro DPEM"
                    texto="Recomendado — seguro obrigatório, exigido na renovação do TIE."
                    href={`/painel/documentos/novo?escopo=embarcacao&embarcacao=${e.id}&tipo=dpem`}
                    rotulo="Adicionar"
                  />
                )}
              </CartaoAlvo>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Habilitações náuticas de quem conduz suas embarcações. Ao enviar uma habilitação, o condutor é vinculado à sua
            equipe — e, se ainda não estiver nela, é cadastrado automaticamente.
          </p>
          {condutoresVisiveis.length === 0 ? (
            <Vazio icone={IdCard} titulo="Nada por aqui" texto="Nenhum condutor com documentos nessa situação." />
          ) : (
            condutoresVisiveis.map((m) => (
              <CartaoAlvo
                key={m.id}
                icone={<UserRound className="h-5 w-5 text-[#0B2447]" />}
                titulo={m.is_gestor ? `${m.nome_completo} (você)` : m.nome_completo}
                selos={
                  <>
                    {rotuloFuncao(m.funcao) && (
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">{rotuloFuncao(m.funcao)}</span>
                    )}
                    {!m.ativo && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Inativo</span>}
                    {m.incompleto && (
                      <Link
                        href={`/painel/equipe/${m.id}/editar`}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
                      >
                        <AlertTriangle className="h-3 w-3" /> Completar cadastro
                      </Link>
                    )}
                  </>
                }
                situacao={piorSituacao(m.docs)}
                novoHref={`/painel/documentos/novo?escopo=condutor&membro=${m.id}`}
                antigos={m.antigos}
              >
                {m.docs.filter((d) => confere(d, filtro)).map((d) => (
                  <LinhaDocumento key={d.id} d={d} />
                ))}
                {m.docs.length === 0 && (
                  <LinhaPendente
                    titulo="Habilitação náutica"
                    texto="Nenhuma habilitação cadastrada para esta pessoa."
                    href={`/painel/documentos/novo?escopo=condutor&membro=${m.id}&tipo=cha`}
                    rotulo="Enviar CHA"
                  />
                )}
              </CartaoAlvo>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function CartaoAlvo({
  icone,
  titulo,
  selos,
  situacao,
  novoHref,
  antigos,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  selos?: React.ReactNode;
  situacao: SituacaoValidade | 'pendente' | null;
  novoHref: string;
  antigos: DocumentoItem[];
  children: React.ReactNode;
}) {
  const [verHistorico, setVerHistorico] = useState(false);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100">{icone}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-[#0B2447] [overflow-wrap:anywhere]">{titulo}</h3>
          {selos && <div className="mt-0.5 flex flex-wrap items-center gap-1.5">{selos}</div>}
        </div>
        {/* No celular, selo e botão descem para a linha de baixo — o nome não fica cortado. */}
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
          {situacao ? <SeloValidade situacao={situacao} /> : <span />}
          <Link
            href={novoHref}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" /> Documento
          </Link>
        </div>
      </header>
      <ul className="divide-y divide-slate-100">{children}</ul>
      {antigos.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-2 sm:px-5">
          <button
            type="button"
            onClick={() => setVerHistorico((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
            aria-expanded={verHistorico}
          >
            <History className="h-3.5 w-3.5" />
            Histórico ({antigos.length})
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${verHistorico ? 'rotate-180' : ''}`} />
          </button>
          {verHistorico && (
            <ul className="mt-2 space-y-1.5 pb-1">
              {antigos.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-600">{nomeCurtoDocumento(d.tipo, d.titulo)}</span>
                  {d.numero && <span>nº {d.numero}</span>}
                  <span>validade {formatarData(d.data_validade)}</span>
                  <span>substituído em {formatarData(d.arquivado_em)}</span>
                  <span className="ml-auto flex items-center gap-1">
                    {d.tem_arquivo && <BotaoVerArquivo id={d.id} compacto />}
                    <BotaoExcluir id={d.id} nome={nomeCurtoDocumento(d.tipo, d.titulo)} compacto />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function LinhaDocumento({ d }: { d: DocumentoItem }) {
  const info = TIPOS_DOCUMENTO[d.tipo];
  const extras = [rotuloCategoria(d.categoria), d.dados.tipo_embarcacao, d.dados.area_navegacao, d.dados.atividade].filter(Boolean);
  const alvo = d.escopo === 'embarcacao' ? `embarcacao=${d.embarcacao_id}` : `membro=${d.equipe_membro_id}`;
  return (
    <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 min-w-[3.25rem] shrink-0 items-center justify-center rounded-lg bg-[#0B2447]/5 px-2 text-xs font-bold text-[#0B2447]">
          {d.tipo === 'outro' ? 'DOC' : info.sigla}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">
            {d.tipo === 'outro' ? d.titulo : info.nome}
            {d.numero && <span className="ml-2 whitespace-nowrap font-normal text-slate-400">nº {d.numero}</span>}
          </p>
          <PrazoValidade validade={d.data_validade} />
          {(extras.length > 0 || d.titular) && (
            <p className="mt-0.5 truncate text-xs text-slate-400">
              {[d.titular, ...extras].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <SeloValidade validade={d.data_validade} />
        <div className="flex items-center gap-0.5">
          {d.tem_arquivo && <BotaoVerArquivo id={d.id} />}
          {d.tipo !== 'outro' && (
            <Link
              href={`/painel/documentos/novo?escopo=${d.escopo}&${alvo}&tipo=${d.tipo}`}
              title="Renovar: enviar o documento novo"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> <span className="hidden md:inline">Renovar</span>
            </Link>
          )}
          <Link href={`/painel/documentos/${d.id}/editar`} title="Editar dados" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <Pencil className="h-4 w-4" />
          </Link>
          <BotaoExcluir id={d.id} nome={d.tipo === 'outro' ? (d.titulo ?? 'documento') : info.sigla} />
        </div>
      </div>
    </li>
  );
}

function LinhaPendente({
  titulo, texto, href, rotulo, destaque = false,
}: { titulo: string; texto: string; href: string; rotulo: string; destaque?: boolean }) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 min-w-[3.25rem] shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400">
          <FilePlus2 className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${destaque ? 'text-slate-800' : 'text-slate-500'}`}>{titulo}</p>
          <p className="text-xs text-slate-400">{texto}</p>
        </div>
      </div>
      <Link
        href={href}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
          destaque ? 'bg-[#0B2447] text-white hover:bg-[#0B3D91]' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}
      >
        <Plus className="h-3.5 w-3.5" /> {rotulo}
      </Link>
    </li>
  );
}

function BotaoVerArquivo({ id, compacto = false }: { id: string; compacto?: boolean }) {
  return (
    <a
      href={`/api/painel/documentos/${id}/arquivo`}
      target="_blank"
      rel="noopener noreferrer"
      title="Ver o arquivo enviado"
      className={`rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 ${compacto ? 'p-1' : 'p-2'}`}
    >
      <Eye className={compacto ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
    </a>
  );
}

function BotaoExcluir({ id, nome, compacto = false }: { id: string; nome: string; compacto?: boolean }) {
  const [pendente, startTransition] = useTransition();
  function excluir() {
    if (!confirm(`Excluir o ${nome}? O arquivo também será apagado.`)) return;
    startTransition(async () => {
      const r = await excluirDocumento(id);
      if (!r.ok) alert(r.error ?? 'Não foi possível excluir.');
    });
  }
  return (
    <button
      type="button"
      onClick={excluir}
      disabled={pendente}
      title="Excluir"
      className={`rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 ${compacto ? 'p-1' : 'p-2'}`}
    >
      {pendente ? <Loader2 className={`animate-spin ${compacto ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} /> : <Trash2 className={compacto ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
    </button>
  );
}

function Vazio({
  icone: Icone, titulo, texto, acao,
}: { icone: typeof Ship; titulo: string; texto: string; acao?: { href: string; rotulo: string } }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white py-14 text-center">
      <Icone className="mb-3 h-10 w-10 text-slate-200" />
      <p className="text-sm font-medium text-slate-500">{titulo}</p>
      <p className="mt-1 text-xs text-slate-400">{texto}</p>
      {acao && (
        <Link href={acao.href} className="mt-4 rounded-xl bg-[#0B2447] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B3D91]">
          {acao.rotulo}
        </Link>
      )}
    </div>
  );
}
