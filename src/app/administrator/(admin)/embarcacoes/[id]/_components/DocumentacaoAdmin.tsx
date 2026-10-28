import { Eye, FilePlus2, History, UserRound } from 'lucide-react';
import { formatarData } from '@/lib/datas';
import { maskCPF } from '@/lib/validators';
import { formatarTelefoneE164 } from '@/lib/countries';
import { SeloValidade } from '@/components/painel/documentos/SeloValidade';
import { SecaoRevisao } from '@/components/publicacao/RevisaoAdmin';
import type { DocumentoItem } from '@/lib/documentos/server';
import type { MembroComHabilitacoes } from '@/lib/documentos/admin';
import { TIPOS_DOCUMENTO, TIPOS_INSCRICAO, nomeCurtoDocumento, rotuloCategoria, rotuloFuncao } from '@/lib/documentos/tipos';
import { situacaoValidade, textoPrazo } from '@/lib/documentos/validade';

/**
 * Documentação no detalhe da embarcação do admin (SPEC §95.9) — somente leitura.
 * O admin vê só "Vencido" em destaque: um documento perto de vencer aparece como
 * em dia (o filtro "Vence em até 60 dias" da lista é o lugar para isso).
 */

const situacaoAdmin = (validade: string | null) => {
  const s = situacaoValidade(validade);
  return s === 'vence_em_breve' ? 'em_dia' : s;
};

function Prazo({ validade }: { validade: string | null }) {
  if (!validade) return <span className="text-xs text-slate-400">Sem data de validade</span>;
  const vencido = situacaoValidade(validade) === 'vencido';
  return (
    <span className="text-xs text-slate-500">
      {vencido ? 'Venceu em' : 'Válido até'} <strong className="font-semibold text-slate-700">{formatarData(validade)}</strong>
      {vencido && <span className="ml-1 text-red-600">· {textoPrazo(validade)}</span>}
    </span>
  );
}

function VerArquivo({ id, compacto = false }: { id: string; compacto?: boolean }) {
  return (
    <a
      href={`/api/painel/documentos/${id}/arquivo`}
      target="_blank"
      rel="noopener noreferrer"
      title="Ver o arquivo enviado"
      className={`inline-flex items-center gap-1 rounded-lg font-semibold text-slate-500 hover:bg-slate-100 hover:text-[#0B2447] ${
        compacto ? 'p-1 text-[11px]' : 'px-2 py-1.5 text-xs'}`}
    >
      <Eye className={compacto ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      {!compacto && 'Ver arquivo'}
    </a>
  );
}

function LinhaDoc({ d }: { d: DocumentoItem }) {
  const info = TIPOS_DOCUMENTO[d.tipo];
  const extras = [rotuloCategoria(d.categoria), d.dados.tipo_embarcacao, d.dados.area_navegacao, d.dados.atividade].filter(Boolean);
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 min-w-[3.25rem] shrink-0 items-center justify-center rounded-lg bg-[#0B2447]/5 px-2 text-xs font-bold text-[#0B2447]">
          {d.tipo === 'outro' ? 'DOC' : info.sigla}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">
            {d.tipo === 'outro' ? d.titulo : info.nome}
            {d.numero && <span className="ml-2 whitespace-nowrap font-normal text-slate-400">nº {d.numero}</span>}
          </p>
          <Prazo validade={d.data_validade} />
          {(extras.length > 0 || d.titular) && (
            <p className="mt-0.5 text-xs text-slate-400 [overflow-wrap:anywhere]">{[d.titular, ...extras].filter(Boolean).join(' · ')}</p>
          )}
          <p className="mt-0.5 text-[11px] text-slate-400">
            Enviado em {formatarData(d.created_at)}{d.origem !== 'manual' ? ' · dados lidos do arquivo' : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <SeloValidade situacao={situacaoAdmin(d.data_validade)} />
        {d.tem_arquivo ? <VerArquivo id={d.id} /> : <span className="px-2 text-xs text-slate-300">sem arquivo</span>}
      </div>
    </li>
  );
}

function Faltando({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <span className="mt-0.5 inline-flex h-9 min-w-[3.25rem] shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400">
        <FilePlus2 className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-500">{titulo}</p>
        <p className="text-xs text-slate-400">{texto}</p>
      </div>
    </li>
  );
}

function Historico({ docs }: { docs: DocumentoItem[] }) {
  if (docs.length === 0) return null;
  return (
    <details className="group mt-2 border-t border-slate-100 pt-2">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">
        <History className="h-3.5 w-3.5" /> Histórico ({docs.length})
      </summary>
      <ul className="mt-2 space-y-1.5">
        {docs.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-600">{nomeCurtoDocumento(d.tipo, d.titulo)}</span>
            {d.numero && <span>nº {d.numero}</span>}
            <span>validade {formatarData(d.data_validade)}</span>
            <span>substituído em {formatarData(d.arquivado_em)}</span>
            {d.tem_arquivo && <span className="ml-auto"><VerArquivo id={d.id} compacto /></span>}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Situação da embarcação: Vencida > Não enviada > Em dia (mesma regra da lista). */
function SeloEmbarcacao({ ativos }: { ativos: DocumentoItem[] }) {
  if (ativos.some((d) => situacaoValidade(d.data_validade) === 'vencido')) return <SeloValidade situacao="vencido" />;
  if (!ativos.some((d) => TIPOS_INSCRICAO.includes(d.tipo))) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 whitespace-nowrap">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" /> Não enviada
      </span>
    );
  }
  return <SeloValidade situacao="em_dia" />;
}

function Cabecalho({ titulo, selo, texto }: { titulo: string; selo?: React.ReactNode; texto: string }) {
  return (
    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="text-sm font-bold text-[#0B2447]">{titulo}</p>
        <p className="text-xs text-slate-400">{texto}</p>
      </div>
      {selo}
    </div>
  );
}

export function DocumentosEmbarcacaoAdmin({ documentos }: { documentos: DocumentoItem[] }) {
  const ativos = documentos.filter((d) => !d.arquivado_em);
  const antigos = documentos.filter((d) => d.arquivado_em);
  const temInscricao = ativos.some((d) => TIPOS_INSCRICAO.includes(d.tipo));
  const temDpem = ativos.some((d) => d.tipo === 'dpem');
  const ordem = (d: DocumentoItem) => (d.tipo === 'outro' ? 99 : Object.keys(TIPOS_DOCUMENTO).indexOf(d.tipo));

  return (
    <div id="documentacao" className="scroll-mt-6">
      <SecaoRevisao titulo="Documentação da embarcação">
        <Cabecalho
          titulo={ativos.length > 0 ? `${ativos.length} ${ativos.length === 1 ? 'documento enviado' : 'documentos enviados'}` : 'Nenhum documento enviado'}
          texto="Enviados pelo gestor no painel. Visíveis só para o gestor e a administração."
          selo={<SeloEmbarcacao ativos={ativos} />}
        />
        <ul className="divide-y divide-slate-100">
          {[...ativos].sort((a, b) => ordem(a) - ordem(b)).map((d) => <LinhaDoc key={d.id} d={d} />)}
          {!temInscricao && (
            <Faltando titulo="TIE / TIEM não enviado" texto="Título de Inscrição da Embarcação — documento obrigatório da Marinha." />
          )}
          {!temDpem && <Faltando titulo="DPEM não enviado" texto="Seguro obrigatório (recomendado)." />}
        </ul>
        <Historico docs={antigos} />
      </SecaoRevisao>
    </div>
  );
}

export function EquipeHabilitacoesAdmin({ equipe }: { equipe: MembroComHabilitacoes[] }) {
  return (
    <div id="equipe" className="scroll-mt-6">
      <SecaoRevisao titulo={`Equipe e habilitações (${equipe.length})`}>
        <p className="mb-3 text-xs text-slate-400">
          O gestor e as pessoas da equipe vinculadas a esta embarcação, com as habilitações enviadas (CHA, CIR).
        </p>
        {equipe.length === 0 ? (
          <p className="text-sm text-slate-400">Ninguém da equipe vinculado a esta embarcação.</p>
        ) : (
          <ul className="space-y-3">
            {equipe.map((m) => <CartaoMembro key={m.id} m={m} />)}
          </ul>
        )}
      </SecaoRevisao>
    </div>
  );
}

function CartaoMembro({ m }: { m: MembroComHabilitacoes }) {
  const ativos = m.documentos.filter((d) => !d.arquivado_em);
  const antigos = m.documentos.filter((d) => d.arquivado_em);
  const incompleto = !m.is_gestor && (!m.cpf || !m.telefone);
  const contato = [
    m.cpf ? `CPF ${maskCPF(m.cpf)}` : null,
    m.telefone ? formatarTelefoneE164(m.telefone) : null,
    m.email,
  ].filter(Boolean);

  return (
    <li className={`rounded-xl border border-slate-100 px-4 py-3 ${m.ativo ? '' : 'opacity-70'}`}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100">
          <UserRound className="h-4 w-4 text-slate-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 [overflow-wrap:anywhere]">{m.nome_completo}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {m.is_gestor && <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">Gestor (proprietário)</span>}
            {rotuloFuncao(m.funcao) && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{rotuloFuncao(m.funcao)}</span>}
            {!m.ativo && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Inativo</span>}
            {incompleto && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Cadastro incompleto</span>}
          </div>
          {contato.length > 0 && <p className="mt-1 text-xs text-slate-400 [overflow-wrap:anywhere]">{contato.join(' · ')}</p>}
        </div>
      </div>
      {ativos.length > 0 ? (
        <ul className="mt-1 divide-y divide-slate-100 border-t border-slate-100">
          {ativos.map((d) => <LinhaDoc key={d.id} d={d} />)}
        </ul>
      ) : (
        <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-400">Nenhuma habilitação enviada.</p>
      )}
      <Historico docs={antigos} />
    </li>
  );
}
