'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera, FileUp, FileText, IdCard, FileCheck2, Info, RefreshCw, ScanLine, Sparkles, Trash2, ExternalLink,
  type LucideIcon,
} from 'lucide-react';
import { formatarTamanho } from '@/lib/upload';
import { TIPOS_DOCUMENTO, nomeCurtoDocumento, rotuloCategoria } from '@/lib/documentos/tipos';
import { situacaoValidade } from '@/lib/documentos/validade';
import type { ProgressoLeitura } from '@/lib/documentos/ocr';
import { MENSAGEM_PROBLEMA, type QualidadeFoto } from '@/lib/documentos/qualidade-foto';
import {
  AVISO_LEITURA_FALHOU, AVISO_LEITURA_VAZIA, CAMPOS_VAZIOS, aplicarLeitura,
  type CamposDocumento, type DocumentoAtual, type ExtraCondutor, type RascunhoDocumento,
} from '@/lib/documentos/rascunho';
import type { DocumentoEscopo, DocumentoTipo } from '@/types/supabase';
import { AvisoSubstituicao, CamposConferencia, MensagemErro } from './ConferenciaDocumento';
import { PrazoValidade, SeloValidade } from './SeloValidade';
import { useSeletorArquivo } from './useSeletorArquivo';

const SELOS = {
  recomendado: { texto: 'Recomendado', cls: 'bg-teal-50 text-teal-700' },
  obrigatorio: { texto: 'Obrigatório', cls: 'bg-amber-50 text-amber-700' },
  opcional: { texto: 'Opcional', cls: 'bg-slate-100 text-slate-500' },
} as const;

type Props = {
  escopo: DocumentoEscopo;
  /** Tipos aceitos neste lugar (ex.: TIE, TIEM ou PRPM), o primeiro é o padrão. */
  tipos: DocumentoTipo[];
  titulo: string;
  descricao?: React.ReactNode;
  selo?: keyof typeof SELOS;
  icone?: LucideIcon;
  /** Documento ativo já salvo (edição): aparece resumido, com "Substituir"/"Renovar". */
  atual?: DocumentoAtual | null;
  valor: RascunhoDocumento | null;
  onChange: (r: RascunhoDocumento | null) => void;
  /** Nomes que ajudam a leitura (embarcações / pessoas do gestor). */
  embarcacoesConhecidas?: string[];
  pessoasConhecidas?: string[];
  /** Titular sugerido quando a leitura não o traz (a frente do TIE não tem o proprietário). */
  titularSugerido?: string;
  placeholderEmbarcacao?: string;
  /** Depois de cada leitura (ex.: completar nome e CPF do cadastro). */
  onLeitura?: (r: RascunhoDocumento) => void;
  /** Avisos do cadastro (nome/CPF diferentes…), logo abaixo dos campos. */
  avisos?: React.ReactNode;
  desabilitado?: boolean;
};

/**
 * Documento embutido num cadastro (SPEC §95.10) — embarcação (TIE/TIEM/PRPM e DPEM),
 * membro da equipe e pedido de acesso do gestor (CHA/CIR). Mesma experiência do menu
 * Documentos: foto pela câmera do painel ou arquivo, leitura automática no aparelho e
 * conferência dos campos. Controlado: o rascunho fica no estado do formulário e é
 * gravado junto com ele.
 */
export default function DocumentoEmbutido({
  escopo, tipos, titulo, descricao, selo, icone, atual, valor, onChange,
  embarcacoesConhecidas, pessoasConhecidas, titularSugerido, placeholderEmbarcacao, onLeitura, avisos, desabilitado = false,
}: Props) {
  const [tipoEscolhido, setTipoEscolhido] = useState<DocumentoTipo>(
    atual && tipos.includes(atual.tipo) ? atual.tipo : tipos[0],
  );
  const [substituindo, setSubstituindo] = useState(false);
  const [lendo, setLendo] = useState<ProgressoLeitura | null>(null);
  const [emLeitura, setEmLeitura] = useState<File | null>(null);
  const leituraIgnorada = useRef(false);
  /** Rascunho sem a leitura — usado em "Pular a leitura". */
  const baseDaLeitura = useRef<RascunhoDocumento | null>(null);

  const tipo = valor?.tipo ?? tipoEscolhido;
  const info = TIPOS_DOCUMENTO[tipo];
  const Icone = icone ?? (escopo === 'condutor' ? IdCard : FileCheck2);

  const seletor = useSeletorArquivo({
    formato: escopo === 'condutor' ? 'paisagem' : 'retrato',
    sigla: info.sigla,
    onArquivo: (file, q) => void receber(file, q),
  });

  const arquivoVisivel = emLeitura ?? valor?.arquivo ?? null;
  const previa = useMemo(
    () => (arquivoVisivel?.type.startsWith('image/') ? URL.createObjectURL(arquivoVisivel) : null),
    [arquivoVisivel],
  );
  useEffect(() => () => {
    if (previa) URL.revokeObjectURL(previa);
  }, [previa]);

  const lidos = useMemo(() => new Set(valor?.lidos ?? []), [valor?.lidos]);

  async function receber(file: File, qualidade: QualidadeFoto | null) {
    const tipoAtual = valor?.tipo ?? tipoEscolhido;
    const camposIniciais: CamposDocumento = valor?.campos ?? {
      ...CAMPOS_VAZIOS,
      titular: escopo === 'embarcacao' && titularSugerido ? titularSugerido : '',
    };
    const base: RascunhoDocumento = {
      id: valor?.id ?? crypto.randomUUID(),
      escopo,
      tipo: tipoAtual,
      arquivo: file,
      campos: camposIniciais,
      dados: valor?.dados ?? {},
      origem: 'manual',
      lidos: [],
      qualidade,
      avisoLeitura: null,
      tipoSugerido: null,
    };
    baseDaLeitura.current = base;
    leituraIgnorada.current = false;
    setEmLeitura(file);
    setLendo({ etapa: 'preparando', mensagem: 'Preparando…' });

    let final: RascunhoDocumento;
    try {
      const { lerDocumento } = await import('@/lib/documentos/ocr');
      const r = await lerDocumento(file, {
        embarcacoesConhecidas,
        pessoasConhecidas,
        anosValidade: TIPOS_DOCUMENTO[tipoAtual].validadeAnos,
        onProgresso: (p) => !leituraIgnorada.current && setLendo(p),
      });
      if (leituraIgnorada.current) return;
      const l = aplicarLeitura(r.campos, tipoAtual, escopo);
      final = {
        ...base,
        campos: { ...base.campos, ...l.campos },
        dados: l.dados,
        lidos: l.lidos,
        tipoSugerido: l.tipoSugerido,
        origem: l.lidos.length > 0 ? r.origem : 'manual',
        avisoLeitura: l.lidos.length > 0 ? null : AVISO_LEITURA_VAZIA,
      };
    } catch (e) {
      console.error('[documentos] leitura falhou:', e);
      if (leituraIgnorada.current) return;
      final = { ...base, avisoLeitura: AVISO_LEITURA_FALHOU };
    }
    setLendo(null);
    setEmLeitura(null);
    setSubstituindo(false);
    onChange(final);
    onLeitura?.(final);
  }

  function pularLeitura() {
    leituraIgnorada.current = true;
    setLendo(null);
    setEmLeitura(null);
    setSubstituindo(false);
    if (baseDaLeitura.current) onChange(baseDaLeitura.current);
  }

  function trocarTipo(t: DocumentoTipo) {
    setTipoEscolhido(t);
    if (valor) onChange({ ...valor, tipo: t, tipoSugerido: null });
  }

  function atualizarCampo(k: keyof CamposDocumento, v: string) {
    if (!valor) return;
    onChange({ ...valor, campos: { ...valor.campos, [k]: v }, lidos: valor.lidos.filter((x) => x !== k) });
  }

  function atualizarExtra(k: ExtraCondutor, v: string) {
    if (!valor) return;
    onChange({ ...valor, dados: { ...valor.dados, [k]: v }, lidos: valor.lidos.filter((x) => x !== k) });
  }

  const mostrarAtual = !!atual && !valor && !substituindo && !lendo;
  const situacaoAtual = atual ? situacaoValidade(atual.data_validade) : null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      {seletor.elementos}

      <header className="flex items-start gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B2447]/5 text-[#0B2447]">
          <Icone className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-[#0B2447]">{titulo}</h3>
            {selo && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${SELOS[selo].cls}`}>{SELOS[selo].texto}</span>}
          </div>
          {descricao && <div className="mt-0.5 text-xs text-slate-500">{descricao}</div>}
        </div>
        {valor && !lendo && (
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={desabilitado}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            title="Descartar este envio"
            aria-label="Descartar este envio"
          >
            <Trash2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Descartar</span>
          </button>
        )}
      </header>

      <fieldset disabled={desabilitado} className="min-w-0 space-y-4 p-4 sm:p-5">
        {mostrarAtual && atual ? (
          <div className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:flex-row sm:items-center">
            <span className="inline-flex h-10 min-w-[3.25rem] items-center justify-center self-start rounded-lg bg-white px-2 text-xs font-bold text-[#0B2447] shadow-sm sm:self-center">
              {atual.tipo === 'outro' ? 'DOC' : TIPOS_DOCUMENTO[atual.tipo].sigla}
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
                {atual.tipo === 'outro' ? nomeCurtoDocumento(atual.tipo, atual.titulo) : TIPOS_DOCUMENTO[atual.tipo].nome}
                {atual.numero && <span className="font-normal text-slate-500">nº {atual.numero}</span>}
                <SeloValidade validade={atual.data_validade} />
              </p>
              <PrazoValidade validade={atual.data_validade} />
              {(rotuloCategoria(atual.categoria) || atual.titular) && (
                <p className="truncate text-xs text-slate-400">{rotuloCategoria(atual.categoria) ?? atual.titular}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {atual.tem_arquivo && (
                <a
                  href={`/api/painel/documentos/${atual.id}/arquivo`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Ver arquivo
                </a>
              )}
              <button
                type="button"
                onClick={() => setSubstituindo(true)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${
                  situacaoAtual === 'vencido' || situacaoAtual === 'vence_em_breve'
                    ? 'bg-[#0B2447] text-white hover:bg-[#0B3D91]'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {situacaoAtual === 'vencido' || situacaoAtual === 'vence_em_breve' ? 'Renovar' : 'Substituir'}
              </button>
            </div>
          </div>
        ) : lendo ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-teal-100 bg-teal-50/40 p-4 text-center sm:flex-row sm:text-left">
            {previa ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previa} alt="" className="h-16 w-auto max-w-[6rem] rounded-lg border border-white object-contain shadow" />
            ) : (
              <FileText className="h-10 w-10 shrink-0 text-teal-400" />
            )}
            <div className="w-full min-w-0 flex-1 space-y-2">
              <p className="flex items-center justify-center gap-2 text-sm font-semibold text-teal-800 sm:justify-start">
                <ScanLine className="h-4 w-4 animate-pulse" /> {lendo.mensagem}
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-teal-100">
                <div
                  className={`h-full rounded-full bg-teal-500 transition-all ${lendo.progresso == null ? 'w-1/3 animate-pulse' : ''}`}
                  style={lendo.progresso != null ? { width: `${Math.max(5, Math.round(lendo.progresso * 100))}%` } : undefined}
                />
              </div>
              <p className="text-xs text-slate-500">A leitura acontece no seu aparelho — o texto do documento não sai dele.</p>
            </div>
            <button type="button" onClick={pularLeitura} className="shrink-0 text-xs font-semibold text-slate-500 underline hover:text-slate-700">
              Pular a leitura
            </button>
          </div>
        ) : (
          <>
            {tipos.length > 1 && (
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Qual documento">
                {tipos.map((t) => {
                  const marcado = tipo === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={marcado}
                      onClick={() => trocarTipo(t)}
                      title={TIPOS_DOCUMENTO[t].nome}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        marcado ? 'border-teal-400 bg-teal-50 font-semibold text-teal-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {TIPOS_DOCUMENTO[t].sigla}
                      <span className="ml-1 hidden font-normal text-slate-500 sm:inline">· {TIPOS_DOCUMENTO[t].nome}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {!valor ? (
              <>
                <div className="rounded-xl border-2 border-dashed border-slate-200 px-4 py-5 text-center">
                  <p className="text-sm font-semibold text-slate-700">Foto ou PDF do {info.sigla}</p>
                  <p className="mx-auto mt-0.5 max-w-md text-xs text-slate-500">
                    {tipos.length > 1 && `${info.descricao} `}Lemos o documento e preenchemos os dados para você conferir.
                  </p>
                  <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={seletor.abrirCamera}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B2447] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B3D91]"
                    >
                      <Camera className="h-4 w-4" /> Tirar foto
                    </button>
                    <button
                      type="button"
                      onClick={seletor.abrirArquivos}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <FileUp className="h-4 w-4" /> Escolher arquivo
                    </button>
                  </div>
                </div>
                {seletor.erro && <MensagemErro texto={seletor.erro} />}
                {atual && substituindo && (
                  <button type="button" onClick={() => setSubstituindo(false)} className="text-xs font-semibold text-slate-500 hover:underline">
                    Manter o {nomeCurtoDocumento(atual.tipo, atual.titulo)} atual
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5">
                  {previa ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previa} alt="Documento enviado" className="h-14 w-14 shrink-0 rounded-lg border border-white object-cover shadow-sm" />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                      <FileText className="h-7 w-7 text-slate-400" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700">{valor.arquivo.name}</p>
                    <p className="text-xs text-slate-400">{formatarTamanho(valor.arquivo.size)} · salvo junto com o cadastro</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                    <button
                      type="button"
                      onClick={seletor.abrirCamera}
                      aria-label="Tirar outra foto"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      <Camera className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Tirar outra</span>
                    </button>
                    <button
                      type="button"
                      onClick={seletor.abrirArquivos}
                      aria-label="Trocar arquivo"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Trocar arquivo</span>
                    </button>
                  </div>
                </div>
                {seletor.erro && <MensagemErro texto={seletor.erro} />}

                {valor.lidos.length > 0 && (
                  <p className="flex items-start gap-2 rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-2.5 text-sm text-teal-900">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
                    <span>
                      Preenchemos {valor.lidos.length} {valor.lidos.length === 1 ? 'campo' : 'campos'} a partir do{' '}
                      {valor.origem === 'pdf' ? 'PDF' : 'documento'}. <strong>Confira antes de salvar.</strong>
                    </span>
                  </p>
                )}
                {(valor.avisoLeitura || (valor.qualidade && !valor.qualidade.boa)) && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                    <p className="flex items-start gap-2">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        {valor.avisoLeitura ?? 'A foto pode ter atrapalhado a leitura — confira os campos com atenção.'}
                        {valor.qualidade && !valor.qualidade.boa && (
                          <span className="mt-1 block text-xs text-amber-800">
                            {valor.qualidade.problemas.map((p) => MENSAGEM_PROBLEMA[p].titulo).join(' · ')}
                          </span>
                        )}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={seletor.abrirCamera}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                    >
                      <Camera className="h-3.5 w-3.5" /> Tirar outra foto
                    </button>
                  </div>
                )}
                {valor.tipoSugerido && (
                  <p className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                    <Info className="h-4 w-4 shrink-0" /> Este arquivo parece ser um <strong>{TIPOS_DOCUMENTO[valor.tipoSugerido].sigla}</strong>.
                    <button type="button" onClick={() => trocarTipo(valor.tipoSugerido!)} className="font-semibold underline">
                      Trocar para {TIPOS_DOCUMENTO[valor.tipoSugerido].sigla}
                    </button>
                  </p>
                )}

                <CamposConferencia
                  tipo={valor.tipo}
                  escopo={escopo}
                  campos={valor.campos}
                  dados={valor.dados}
                  lidos={lidos}
                  onCampo={atualizarCampo}
                  onExtra={atualizarExtra}
                  placeholderEmbarcacao={placeholderEmbarcacao}
                />

                {avisos}
                {atual && atual.tipo === valor.tipo && <AvisoSubstituicao sigla={info.sigla} validade={atual.data_validade} />}
                {info.renovacao && (
                  <p className="flex items-start gap-2 text-xs text-slate-400">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {info.renovacao} Avisamos você 60, 30 e 7 dias antes e no dia do vencimento.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </fieldset>
    </section>
  );
}
