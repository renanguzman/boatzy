'use client';

import Link from 'next/link';
import { FileCheck2, Lock, ShieldCheck, Info } from 'lucide-react';
import DocumentoEmbutido from '@/components/painel/documentos/DocumentoEmbutido';
import { nomeApresentavel, normalizarNome, similaridadeNomes, SIMILARIDADE_SUGESTAO } from '@/lib/documentos/nomes';
import type { DocumentoAtual, RascunhoDocumento } from '@/lib/documentos/rascunho';

/** Documentos ativos da embarcação já salvos (edição). */
export type DocumentosEmbarcacaoAtuais = {
  /** TIE, TIEM ou PRPM ativo. */
  inscricao: DocumentoAtual | null;
  dpem: DocumentoAtual | null;
  /** Outros documentos ativos (vistorias, licenças…), geridos no menu Documentos. */
  outros: number;
};

export type RascunhosEmbarcacao = { inscricao: RascunhoDocumento | null; dpem: RascunhoDocumento | null };

export const RASCUNHOS_VAZIOS: RascunhosEmbarcacao = { inscricao: null, dpem: null };

/**
 * Etapa "Documentos" do cadastro/edição de embarcação (SPEC §95.10): só os documentos da
 * embarcação — inscrição na Capitania (TIE, TIEM ou PRPM) e seguro DPEM. Opcional: sem
 * eles a embarcação é salva e fica com a documentação "pendente". Habilitações de quem
 * conduz ficam na Equipe e no pedido de acesso do gestor.
 */
export default function EtapaDocumentacao({
  rascunhos, onChange, atuais = null, nomeEmbarcacao, embarcacoesConhecidas, proprietarioSugerido, onUsarNome, desabilitado,
}: {
  rascunhos: RascunhosEmbarcacao;
  onChange: (r: RascunhosEmbarcacao) => void;
  atuais?: DocumentosEmbarcacaoAtuais | null;
  /** Nome digitado no cadastro (confronta com o lido no TIE). */
  nomeEmbarcacao: string;
  embarcacoesConhecidas: string[];
  /** A frente do TIE não traz o proprietário: sugerimos o nome do gestor. */
  proprietarioSugerido: string;
  /** Cadastro ainda sem nome: oferece usar o nome lido no documento. */
  onUsarNome: (nome: string) => void;
  desabilitado?: boolean;
}) {
  const lidoNoDocumento = rascunhos.inscricao?.campos.embarcacaoNome.trim() ?? '';
  const nomeCadastro = nomeEmbarcacao.trim();
  const nomeDiferente =
    !!lidoNoDocumento && !!nomeCadastro && normalizarNome(lidoNoDocumento) !== normalizarNome(nomeCadastro)
    && similaridadeNomes(lidoNoDocumento, nomeCadastro) < SIMILARIDADE_SUGESTAO;

  const avisosInscricao = lidoNoDocumento && !nomeCadastro ? (
    <p className="flex flex-wrap items-center gap-2 rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-2.5 text-sm text-teal-900">
      <Info className="h-4 w-4 shrink-0" /> O documento é da embarcação <strong>{lidoNoDocumento}</strong>.
      <button type="button" onClick={() => onUsarNome(nomeApresentavel(lidoNoDocumento))} className="font-semibold underline">
        Usar como nome do cadastro
      </button>
    </p>
  ) : nomeDiferente ? (
    <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        O documento é da embarcação <strong>{lidoNoDocumento}</strong>, mas o cadastro se chama <strong>{nomeCadastro}</strong>.
        Confira se este é o documento desta embarcação.
      </span>
    </p>
  ) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3.5 shadow-sm sm:px-5">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
        <p className="text-sm text-slate-600">
          A equipe Boatzy <strong className="font-semibold text-slate-700">só aprova a embarcação com o documento de inscrição (TIE)</strong>.
          Depois, acompanhamos a validade e avisamos antes de vencer. Os documentos são{' '}
          <strong className="font-semibold text-slate-700">privados</strong> — nunca aparecem no site. Não está com eles agora? Salve e envie depois.
        </p>
      </div>

      <DocumentoEmbutido
        escopo="embarcacao"
        tipos={['tie', 'tiem', 'prpm']}
        titulo="Inscrição na Capitania"
        descricao="O documento da embarcação. Necessário para a aprovação — a equipe Boatzy confere antes de publicar."
        selo="obrigatorio"
        icone={FileCheck2}
        atual={atuais?.inscricao}
        valor={rascunhos.inscricao}
        onChange={(inscricao) => onChange({ ...rascunhos, inscricao })}
        embarcacoesConhecidas={embarcacoesConhecidas}
        titularSugerido={proprietarioSugerido}
        placeholderEmbarcacao={nomeCadastro || undefined}
        avisos={avisosInscricao}
        desabilitado={desabilitado}
      />

      <DocumentoEmbutido
        escopo="embarcacao"
        tipos={['dpem']}
        titulo="Seguro DPEM"
        descricao="Seguro obrigatório de danos pessoais causados por embarcações. Renovação anual."
        selo="recomendado"
        icone={ShieldCheck}
        atual={atuais?.dpem}
        valor={rascunhos.dpem}
        onChange={(dpem) => onChange({ ...rascunhos, dpem })}
        embarcacoesConhecidas={embarcacoesConhecidas}
        titularSugerido={proprietarioSugerido}
        placeholderEmbarcacao={nomeCadastro || undefined}
        desabilitado={desabilitado}
      />

      <p className="px-1 text-xs text-slate-400">
        {atuais && atuais.outros > 0
          ? `Esta embarcação tem mais ${atuais.outros} ${atuais.outros === 1 ? 'documento' : 'documentos'} (vistorias, licenças…) no menu `
          : 'Outros documentos com vencimento (vistorias, licenças…) você guarda no menu '}
        <Link href="/painel/documentos" target="_blank" className="font-semibold text-teal-700 hover:underline">Documentos</Link>.
        {' '}A habilitação de quem conduz fica na <Link href="/painel/equipe" target="_blank" className="font-semibold text-teal-700 hover:underline">Equipe</Link>.
      </p>
    </div>
  );
}
