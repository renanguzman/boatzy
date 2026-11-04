'use client';

import { normalizarDocumentoEstrangeiro, opcoesPaises } from '@/lib/pagamentos/estrangeiro';
import { ROTULO_TIPO_DOCUMENTO_EQUIPE, TIPOS_DOCUMENTO_EQUIPE, validarDocumentoEquipe, type DocumentoEstrangeiroEquipe, type TipoDocumentoEquipe } from '@/lib/equipe-documento';
import IconeLink from '@/components/ui/IconeLink';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Ship, IdCard, Camera, FileUp, FileText, Check, ChevronLeft, Loader2, Sparkles, Info, UserCheck,
  UserPlus, RefreshCw, CheckCircle2, ScanLine, ArrowRight,
} from 'lucide-react';
import { maskCPF } from '@/lib/validators';
import {
  FUNCOES_EQUIPE, TIPOS_DOCUMENTO, TIPOS_POR_ESCOPO, rotuloFuncao, type DadosDocumento,
} from '@/lib/documentos/tipos';
import { isValidCPF } from '@/lib/validators';
import { normalizarNome, similaridadeNomes, nomeApresentavel } from '@/lib/documentos/nomes';
import { enviarArquivoDocumento, type ArquivoEnviado } from '@/lib/documentos/envio';
import type { ProgressoLeitura } from '@/lib/documentos/ocr';
import type { CamposLidos } from '@/lib/documentos/leitura';
import { MENSAGEM_PROBLEMA, type QualidadeFoto } from '@/lib/documentos/qualidade-foto';
import {
  AVISO_LEITURA_FALHOU, AVISO_LEITURA_VAZIA, CAMPOS_VAZIOS, aplicarLeitura, erroConferencia,
  type CampoLido, type CamposDocumento, type CondutorPayload, type DocumentoPayload, type ExtraCondutor,
} from '@/lib/documentos/rascunho';
import {
  AvisoSubstituicao, CamposConferencia, MensagemErro, inputDocumentoCls as inputCls,
} from '@/components/painel/documentos/ConferenciaDocumento';
import { useSeletorArquivo } from '@/components/painel/documentos/useSeletorArquivo';
import type { DocumentoItem, MembroCondutor, AnaliseCondutor } from '@/lib/documentos/server';
import type { DocumentoEscopo, DocumentoOrigem, DocumentoTipo, EquipeFuncao } from '@/types/supabase';
import { analisarCondutorDocumento, atualizarDocumento, criarDocumento } from '../actions';

export type DocumentoAtivoResumo = {
  id: string;
  tipo: DocumentoTipo;
  embarcacao_id: string | null;
  equipe_membro_id: string | null;
  data_validade: string | null;
};

type Props = {
  embarcacoes: { id: string; nome: string }[];
  condutores: MembroCondutor[];
  ativos: DocumentoAtivoResumo[];
  inicial?: { escopo?: DocumentoEscopo; tipo?: DocumentoTipo; embarcacaoId?: string; membroId?: string };
  /** Edição: só a conferência dos dados (tipo e alvo não mudam). */
  documento?: DocumentoItem;
};

type Campos = CamposDocumento;

const PASSOS = ['O que é', 'Arquivo', 'Conferir e salvar'];

export default function DocumentoWizard({ embarcacoes, condutores, ativos, inicial, documento }: Props) {
  const router = useRouter();
  const edicao = !!documento;
  const idRef = useRef<string>(documento?.id ?? crypto.randomUUID());

  // ── Passo 1: o que é ──
  const [escopo, setEscopo] = useState<DocumentoEscopo>(documento?.escopo ?? inicial?.escopo ?? 'embarcacao');
  const [tipo, setTipo] = useState<DocumentoTipo | null>(documento?.tipo ?? inicial?.tipo ?? null);
  const [embarcacaoId, setEmbarcacaoId] = useState<string | null>(
    documento?.embarcacao_id ?? inicial?.embarcacaoId ?? (embarcacoes.length === 1 ? embarcacoes[0].id : null),
  );
  const [membroFixoId, setMembroFixoId] = useState<string | null>(documento?.equipe_membro_id ?? inicial?.membroId ?? null);
  const [embarcacoesDoCondutor, setEmbarcacoesDoCondutor] = useState<string[]>(
    embarcacoes.length === 1 ? [embarcacoes[0].id] : [],
  );

  const alvoDefinido = escopo === 'embarcacao' ? !!embarcacaoId : true;
  const [passo, setPasso] = useState(edicao ? 2 : tipo && alvoDefinido && inicial?.tipo ? 1 : 0);

  // ── Passo 2: arquivo e leitura ──
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [lendo, setLendo] = useState<ProgressoLeitura | null>(null);
  const leituraIgnorada = useRef(false);
  /** Qualidade da foto (câmera do painel ou imagem escolhida) — aviso na conferência. */
  const [qualidadeFoto, setQualidadeFoto] = useState<QualidadeFoto | null>(null);

  // ── Passo 3: campos ──
  const [campos, setCampos] = useState<Campos>(() =>
    documento
      ? {
          titulo: documento.titulo ?? '',
          numero: documento.numero ?? '',
          titular: documento.titular ?? '',
          cpf: documento.titular_cpf ? maskCPF(documento.titular_cpf) : '',
          embarcacaoNome: documento.embarcacao_nome ?? '',
          categoria: documento.categoria ?? '',
          dataEmissao: documento.data_emissao ?? '',
          dataValidade: documento.data_validade ?? '',
        }
      : CAMPOS_VAZIOS,
  );
  const [dados, setDados] = useState<DadosDocumento>(documento?.dados ?? {});
  const [lidos, setLidos] = useState<Set<CampoLido>>(new Set());
  const [origem, setOrigem] = useState<DocumentoOrigem>(documento?.origem ?? 'manual');
  const [avisoLeitura, setAvisoLeitura] = useState<string | null>(null);
  const [tipoSugerido, setTipoSugerido] = useState<DocumentoTipo | null>(null);

  // Condutor
  const [analise, setAnalise] = useState<AnaliseCondutor | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [escolhaCondutor, setEscolhaCondutor] = useState<string | 'novo' | null>(null);
  const [funcaoNovo, setFuncaoNovo] = useState<EquipeFuncao>('marinheiro');
  // Condutor novo estrangeiro, sem CPF (SPEC §104).
  const [estrangeiroNovo, setEstrangeiroNovo] = useState(false);
  const [docEstrangeiro, setDocEstrangeiro] = useState<DocumentoEstrangeiroEquipe>({ tipo: '', pais: '', documento: '' });

  // Salvar
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const enviado = useRef<{ file: File; arquivo: ArquivoEnviado } | null>(null);
  const [concluido, setConcluido] = useState<{ membroCriado: { id: string; nome: string } | null } | null>(null);

  const info = tipo ? TIPOS_DOCUMENTO[tipo] : null;
  const nomeGestor = condutores.find((m) => m.is_gestor)?.nome_completo ?? '';

  /** A frente do TIE não traz o proprietário: sugere o nome do gestor (editável, sem selo de "lido"). */
  function sugerirProprietario() {
    if (escopo !== 'embarcacao' || !nomeGestor) return;
    setCampos((c) => (c.titular ? c : { ...c, titular: nomeGestor }));
  }
  const embarcacao = embarcacoes.find((e) => e.id === embarcacaoId) ?? null;
  const membroFixo = condutores.find((m) => m.id === membroFixoId) ?? null;

  // Documento ativo que este envio vai substituir (renovação).
  const substitui = useMemo(() => {
    if (edicao || !tipo || tipo === 'outro') return null;
    return (
      ativos.find((a) =>
        a.tipo === tipo && (escopo === 'embarcacao' ? a.embarcacao_id === embarcacaoId : !!membroFixoId && a.equipe_membro_id === membroFixoId),
      ) ?? null
    );
  }, [edicao, tipo, escopo, embarcacaoId, membroFixoId, ativos]);

  useEffect(() => {
    return () => {
      if (previa) URL.revokeObjectURL(previa);
    };
  }, [previa]);

  function esquecerLido(k: CampoLido) {
    setLidos((s) => {
      if (!s.has(k)) return s;
      const n = new Set(s);
      n.delete(k);
      return n;
    });
  }

  function atualizarCampo<K extends keyof Campos>(k: K, v: Campos[K]) {
    setCampos((c) => ({ ...c, [k]: v }));
    esquecerLido(k);
  }

  function atualizarExtra(k: ExtraCondutor, v: string) {
    setDados((d) => ({ ...d, [k]: v }));
    esquecerLido(k);
  }

  // ── Leitura do arquivo ──────────────────────────────────────────────────────

  // Câmera, entradas de arquivo e avaliação da foto (a da galeria também é avaliada).
  const seletor = useSeletorArquivo({
    formato: escopo === 'condutor' ? 'paisagem' : 'retrato',
    sigla: info && tipo !== 'outro' ? info.sigla : 'documento',
    onArquivo: (file, q) => void escolherArquivo(file, q),
  });

  async function escolherArquivo(file: File, q: QualidadeFoto | null) {
    setArquivo(file);
    enviado.current = null;
    setPrevia(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
    setQualidadeFoto(q);

    if (edicao) return; // na edição o arquivo só é trocado, sem reler os campos

    leituraIgnorada.current = false;
    setLendo({ etapa: 'preparando', mensagem: 'Preparando…' });
    try {
      const { lerDocumento } = await import('@/lib/documentos/ocr');
      const r = await lerDocumento(file, {
        embarcacoesConhecidas: embarcacoes.map((e) => e.nome),
        pessoasConhecidas: condutores.map((m) => m.nome_completo),
        anosValidade: info?.validadeAnos,
        onProgresso: (p) => !leituraIgnorada.current && setLendo(p),
      });
      if (leituraIgnorada.current) return;
      aplicarLeituraNoForm(r.campos, r.origem);
    } catch (e) {
      console.error('[documentos] leitura falhou:', e);
      if (leituraIgnorada.current) return;
      setOrigem('manual');
      setAvisoLeitura(AVISO_LEITURA_FALHOU);
      sugerirProprietario();
    } finally {
      if (!leituraIgnorada.current) {
        setLendo(null);
        setPasso(2);
      }
    }
  }

  function aplicarLeituraNoForm(c: CamposLidos, origemLeitura: 'pdf' | 'ocr') {
    if (!tipo) return;
    const r = aplicarLeitura(c, tipo, escopo);
    setDados(r.dados);
    setCampos((atual) => ({ ...atual, ...r.campos }));
    setLidos(new Set(r.lidos));
    if (!r.campos.titular) sugerirProprietario();
    setTipoSugerido(r.tipoSugerido);
    setOrigem(r.lidos.length > 0 ? origemLeitura : 'manual');
    setAvisoLeitura(r.lidos.length > 0 ? null : AVISO_LEITURA_VAZIA);
  }

  function preencherManualmente() {
    leituraIgnorada.current = true;
    setLendo(null);
    setOrigem('manual');
    sugerirProprietario();
    setPasso(2);
  }

  // ── Condutor: quem da equipe é a pessoa da habilitação ──────────────────────

  const nomeParaAnalise = campos.titular.trim();
  // Só CPF completo e válido entra na busca (evita consultar a cada dígito digitado).
  const cpfParaAnalise = isValidCPF(campos.cpf) ? campos.cpf : '';
  useEffect(() => {
    if (edicao || escopo !== 'condutor' || passo !== 2 || membroFixoId) return;
    if (nomeParaAnalise.length < 3 && !cpfParaAnalise) {
      setAnalise(null);
      return;
    }
    let cancelado = false;
    const t = setTimeout(async () => {
      setAnalisando(true);
      const r = await analisarCondutorDocumento(nomeParaAnalise, cpfParaAnalise);
      if (cancelado) return;
      setAnalise(r);
      setAnalisando(false);
      setEscolhaCondutor(r.resultado === 'exato' ? r.membro.id : r.resultado === 'novo' ? 'novo' : null);
    }, 600);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [edicao, escopo, passo, membroFixoId, nomeParaAnalise, cpfParaAnalise]);

  // ── Avisos da conferência ───────────────────────────────────────────────────

  const outraEmbarcacao = useMemo(() => {
    if (escopo !== 'embarcacao' || !campos.embarcacaoNome || !lidos.has('embarcacaoNome')) return null;
    const lido = normalizarNome(campos.embarcacaoNome);
    if (embarcacao && normalizarNome(embarcacao.nome) === lido) return null;
    return embarcacoes.find((e) => e.id !== embarcacaoId && normalizarNome(e.nome) === lido) ?? null;
  }, [escopo, campos.embarcacaoNome, lidos, embarcacao, embarcacoes, embarcacaoId]);

  // ── Salvar ──────────────────────────────────────────────────────────────────

  function condutorPayload(): CondutorPayload | null {
    if (escopo !== 'condutor') return null;
    if (membroFixoId) return { modo: 'existente', membroId: membroFixoId };
    if (escolhaCondutor && escolhaCondutor !== 'novo') return { modo: 'existente', membroId: escolhaCondutor };
    if (escolhaCondutor === 'novo') return { modo: 'novo', nome: campos.titular, cpf: estrangeiroNovo ? '' : campos.cpf, funcao: funcaoNovo, estrangeiro: estrangeiroNovo ? docEstrangeiro : null };
    return null;
  }

  async function salvar() {
    if (!tipo || salvando) return;
    setErro(null);

    const condutor = condutorPayload();
    if (!edicao && escopo === 'condutor' && !condutor) {
      setErro('Confirme quem é o condutor desta habilitação.');
      return;
    }
    if (condutor?.modo === 'novo' && condutor.estrangeiro) {
      const v = validarDocumentoEquipe(condutor.estrangeiro);
      if (!v.ok) {
        setErro(v.erro);
        return;
      }
    }
    if (!edicao && !arquivo) {
      setErro('Envie a foto ou o PDF do documento.');
      return;
    }
    const problema = erroConferencia(tipo, escopo, campos);
    if (problema) {
      setErro(problema);
      return;
    }

    let arquivoEnviado: ArquivoEnviado | null = null;
    if (arquivo) {
      if (enviado.current?.file === arquivo) {
        arquivoEnviado = enviado.current.arquivo;
      } else {
        setSalvando('Enviando o arquivo… 0%');
        const r = await enviarArquivoDocumento(arquivo, idRef.current, (pct) => setSalvando(`Enviando o arquivo… ${pct}%`));
        if (!r.ok) {
          setErro(r.erro);
          setSalvando(null);
          return;
        }
        enviado.current = { file: arquivo, arquivo: r.arquivo };
        arquivoEnviado = r.arquivo;
      }
    }

    setSalvando('Salvando…');
    const payload: DocumentoPayload = {
      id: idRef.current,
      escopo,
      tipo,
      embarcacaoId: escopo === 'embarcacao' ? embarcacaoId : null,
      condutor,
      embarcacoesDoCondutorIds: escopo === 'condutor' ? embarcacoesDoCondutor : [],
      ...campos,
      dados,
      origem,
      arquivo: arquivoEnviado,
    };
    const r = edicao ? await atualizarDocumento(payload) : await criarDocumento(payload);
    setSalvando(null);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    if (r.membroCriado) {
      setConcluido({ membroCriado: r.membroCriado });
      return;
    }
    router.push(`/painel/documentos${escopo === 'condutor' ? '?aba=condutores' : ''}`);
    router.refresh();
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (concluido?.membroCriado) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <CheckCircle2 className="mx-auto h-12 w-12 text-teal-500" />
        <h2 className="mt-3 text-lg font-bold text-[#0B2447]">Documento salvo!</h2>
        <p className="mt-2 text-sm text-slate-600">
          <strong>{concluido.membroCriado.nome}</strong> foi adicionado à sua equipe como{' '}
          <strong>{rotuloFuncao(funcaoNovo)?.toLowerCase()}</strong>. Falta só o telefone para o cadastro ficar completo.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link
            href={`/painel/equipe/${concluido.membroCriado.id}/editar`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B2447] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B3D91]"
          >
            <IconeLink />
            Completar cadastro
          </Link>
          <Link
            href="/painel/documentos?aba=condutores"
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Ver documentos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Entradas de arquivo e câmera (sempre montadas: a câmera também recorre às entradas) */}
      {seletor.elementos}
      {!edicao && <IndicadorPassos atual={passo} onVoltar={(i) => !lendo && setPasso(i)} />}

      {/* ── Passo 1 ── */}
      {passo === 0 && (
        <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-700">De quem é o documento?</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                { id: 'embarcacao', icone: Ship, titulo: 'Da embarcação', texto: 'TIE, TIEM, seguro DPEM…' },
                { id: 'condutor', icone: IdCard, titulo: 'Habilitação de condutor', texto: 'CHA (Arrais, Mestre…) ou CIR' },
              ] as const).map((o) => {
                const marcado = escopo === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setEscopo(o.id);
                      setTipo(o.id === 'condutor' ? 'cha' : 'tie');
                    }}
                    className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
                      marcado ? 'border-teal-500 bg-teal-50/50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${marcado ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <o.icone className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">{o.titulo}</span>
                      <span className="block text-xs text-slate-500">{o.texto}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Qual documento?</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {TIPOS_POR_ESCOPO[escopo].map((t) => {
                const ti = TIPOS_DOCUMENTO[t];
                const marcado = tipo === t;
                return (
                  <label
                    key={t}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                      marcado ? 'border-teal-400 bg-teal-50/50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input type="radio" name="tipo" className="mt-1 accent-teal-600" checked={marcado} onChange={() => setTipo(t)} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-800">
                        {t === 'outro' ? ti.nome : `${ti.sigla} · ${ti.nome}`}
                      </span>
                      <span className="block text-xs text-slate-500">{ti.descricao}</span>
                      {ti.validadeAnos && (
                        <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                          Vale {ti.validadeAnos} {ti.validadeAnos === 1 ? 'ano' : 'anos'}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {escopo === 'embarcacao' ? (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-slate-700">De qual embarcação?</h2>
              {embarcacoes.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Você ainda não tem embarcações. <Link href="/painel/embarcacoes/novo" className="font-semibold text-teal-700 underline">Cadastre uma</Link> primeiro.
                </p>
              ) : (
                <EscolhaEmbarcacao embarcacoes={embarcacoes} valor={embarcacaoId} onChange={setEmbarcacaoId} />
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {membroFixo && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm text-slate-600">
                    Condutor: <strong className="text-slate-800">{membroFixo.is_gestor ? `${membroFixo.nome_completo} (você)` : membroFixo.nome_completo}</strong>
                  </p>
                  <button type="button" onClick={() => setMembroFixoId(null)} className="text-xs font-semibold text-teal-700 hover:underline">
                    Outra pessoa
                  </button>
                </div>
              )}
              {embarcacoes.length > 0 && !membroFixo?.is_gestor && (
                <div>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-slate-700">Em quais embarcações essa pessoa trabalha?</h2>
                    {embarcacoes.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setEmbarcacoesDoCondutor(embarcacoesDoCondutor.length === embarcacoes.length ? [] : embarcacoes.map((e) => e.id))
                        }
                        className="shrink-0 text-xs font-semibold text-teal-700 hover:underline"
                      >
                        {embarcacoesDoCondutor.length === embarcacoes.length ? 'Desmarcar todas' : 'Marcar todas'}
                      </button>
                    )}
                  </div>
                  <p className="mb-3 text-xs text-slate-400">
                    Marque uma ou mais. A pessoa passa a ser indicada como atendente nelas, na Equipe — as que ela já atende continuam.
                  </p>
                  <EscolhaEmbarcacoes embarcacoes={embarcacoes} valores={embarcacoesDoCondutor} onChange={setEmbarcacoesDoCondutor} />
                </div>
              )}
            </div>
          )}

          {substitui && info && <AvisoSubstituicao sigla={info.sigla} validade={substitui.data_validade} />}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!tipo || !alvoDefinido}
              onClick={() => setPasso(1)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B2447] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B3D91] disabled:opacity-40 sm:w-auto sm:py-2.5"
            >
              Continuar <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* ── Passo 2 ── */}
      {passo === 1 && info && (
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <ResumoEscolha
            sigla={info.sigla}
            nome={info.nome}
            alvo={escopo === 'embarcacao' ? embarcacao?.nome ?? '' : membroFixo?.nome_completo ?? 'condutor'}
            onAlterar={() => setPasso(0)}
          />
          {substitui && <AvisoSubstituicao sigla={info.sigla} validade={substitui.data_validade} />}

          {lendo ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-teal-100 bg-teal-50/40 px-4 py-10 text-center">
              {previa ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previa} alt="" className="h-28 w-auto rounded-lg border border-white object-contain shadow" />
              ) : (
                <FileText className="h-12 w-12 text-teal-400" />
              )}
              <div className="flex items-center gap-2 text-sm font-semibold text-teal-800">
                <ScanLine className="h-4 w-4 animate-pulse" /> {lendo.mensagem}
              </div>
              <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-teal-100">
                <div
                  className={`h-full rounded-full bg-teal-500 transition-all ${lendo.progresso == null ? 'w-1/3 animate-pulse' : ''}`}
                  style={lendo.progresso != null ? { width: `${Math.max(5, Math.round(lendo.progresso * 100))}%` } : undefined}
                />
              </div>
              <p className="text-xs text-slate-500">A leitura acontece no seu aparelho — o texto do documento não sai dele.</p>
              <button type="button" onClick={preencherManualmente} className="text-xs font-semibold text-slate-500 underline hover:text-slate-700">
                Pular a leitura e preencher à mão
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border-2 border-dashed border-slate-200 px-4 py-8 text-center">
                <ScanLine className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-700">Envie a foto ou o PDF do {info.sigla}</p>
                <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
                  Nós lemos o documento e já preenchemos os principais dados para você conferir.
                </p>
                <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={seletor.abrirCamera}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B2447] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B3D91]"
                  >
                    <Camera className="h-4 w-4" /> Tirar foto
                  </button>
                  <button
                    type="button"
                    onClick={seletor.abrirArquivos}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <FileUp className="h-4 w-4" /> Escolher arquivo
                  </button>
                </div>
              </div>
              {seletor.erro && <MensagemErro texto={seletor.erro} />}
              <ul className="grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                <li className="flex gap-2 rounded-xl bg-slate-50 p-3"><Check className="h-4 w-4 shrink-0 text-teal-500" /> Um documento por foto, de frente e preenchendo a tela.</li>
                <li className="flex gap-2 rounded-xl bg-slate-50 p-3"><Check className="h-4 w-4 shrink-0 text-teal-500" /> Boa luz e sem reflexo do plástico.</li>
                <li className="flex gap-2 rounded-xl bg-slate-50 p-3"><Check className="h-4 w-4 shrink-0 text-teal-500" /> Tem o PDF digital? Ele é lido com mais precisão.</li>
              </ul>
              <div className="flex justify-between">
                <button type="button" onClick={() => setPasso(0)} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700">
                  <ChevronLeft className="h-4 w-4" /> Voltar
                </button>
                <button type="button" onClick={preencherManualmente} className="text-sm font-medium text-slate-500 underline hover:text-slate-700">
                  Preencher sem arquivo agora
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* ── Passo 3 ── */}
      {passo === 2 && info && tipo && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_1fr]">
          {/* Prévia do arquivo */}
          <aside className="h-fit space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Arquivo</p>
            {arquivo ? (
              previa ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previa} alt="Documento enviado" className="max-h-80 w-full rounded-lg border border-slate-100 object-contain" />
              ) : (
                <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  <FileText className="h-8 w-8 text-slate-400" />
                  <span className="truncate">{arquivo.name}</span>
                </div>
              )
            ) : edicao && documento?.tem_arquivo ? (
              <a
                href={`/api/painel/documentos/${documento.id}/arquivo`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm font-medium text-teal-700 hover:bg-slate-100"
              >
                <FileText className="h-8 w-8 text-slate-400" /> Ver arquivo atual
              </a>
            ) : (
              <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Nenhum arquivo ainda — ele é obrigatório para salvar.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={seletor.abrirCamera}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Camera className="h-3.5 w-3.5" /> {arquivo ? 'Tirar outra' : 'Tirar foto'}
              </button>
              <button
                type="button"
                onClick={seletor.abrirArquivos}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> {arquivo || documento?.tem_arquivo ? 'Trocar arquivo' : 'Enviar arquivo'}
              </button>
            </div>
            {seletor.erro && <MensagemErro texto={seletor.erro} />}
            {lendo && (
              <p className="flex items-center gap-2 text-xs text-teal-700">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {lendo.mensagem}
              </p>
            )}
          </aside>

          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <ResumoEscolha
              sigla={info.sigla}
              nome={info.nome}
              alvo={escopo === 'embarcacao' ? embarcacao?.nome ?? '' : membroFixo?.nome_completo ?? campos.titular ?? ''}
              onAlterar={edicao ? undefined : () => setPasso(0)}
            />

            {lidos.size > 0 && (
              <p className="flex items-start gap-2 rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-2.5 text-sm text-teal-900">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
                <span>
                  Preenchemos {lidos.size} {lidos.size === 1 ? 'campo' : 'campos'} a partir do {origem === 'pdf' ? 'PDF' : 'documento'}.{' '}
                  <strong>Confira cada um antes de salvar.</strong>
                </span>
              </p>
            )}
            {(avisoLeitura || (qualidadeFoto && !qualidadeFoto.boa)) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                <p className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {avisoLeitura ?? 'A foto pode ter atrapalhado a leitura — confira os campos com atenção.'}
                    {qualidadeFoto && !qualidadeFoto.boa && (
                      <span className="mt-1 block text-xs text-amber-800">
                        {qualidadeFoto.problemas.map((p) => MENSAGEM_PROBLEMA[p].titulo).join(' · ')}
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
            {tipoSugerido && (
              <p className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                <Info className="h-4 w-4 shrink-0" /> Este arquivo parece ser um <strong>{TIPOS_DOCUMENTO[tipoSugerido].sigla}</strong>.
                <button
                  type="button"
                  onClick={() => {
                    setTipo(tipoSugerido);
                    setTipoSugerido(null);
                  }}
                  className="font-semibold underline"
                >
                  Trocar para {TIPOS_DOCUMENTO[tipoSugerido].sigla}
                </button>
              </p>
            )}
            {outraEmbarcacao && (
              <p className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                <Info className="h-4 w-4 shrink-0" /> O documento parece ser da embarcação <strong>{outraEmbarcacao.nome}</strong>.
                <button type="button" onClick={() => setEmbarcacaoId(outraEmbarcacao.id)} className="font-semibold underline">
                  Salvar nela
                </button>
              </p>
            )}

            <CamposConferencia
              tipo={tipo}
              escopo={escopo}
              campos={campos}
              dados={dados}
              lidos={lidos}
              onCampo={atualizarCampo}
              onExtra={atualizarExtra}
              placeholderEmbarcacao={embarcacao?.nome}
            />

            {escopo === 'condutor' && !edicao && (
              <SecaoCondutor
                membroFixo={membroFixo}
                condutores={condutores}
                analise={analise}
                analisando={analisando}
                escolha={escolhaCondutor}
                onEscolha={setEscolhaCondutor}
                nome={campos.titular}
                funcao={funcaoNovo}
                onFuncao={setFuncaoNovo}
                estrangeiro={estrangeiroNovo}
                onEstrangeiro={setEstrangeiroNovo}
                documento={docEstrangeiro}
                onDocumento={setDocEstrangeiro}
                onTrocarFixo={() => setMembroFixoId(null)}
              />
            )}

            {info.renovacao && (
              <p className="flex items-start gap-2 text-xs text-slate-400">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {info.renovacao} Avisamos você 60, 30 e 7 dias antes e no dia do vencimento.
              </p>
            )}

            {erro && <MensagemErro texto={erro} />}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              {edicao ? (
                <Link href="/painel/documentos" className="text-center text-sm font-medium text-slate-500 hover:text-slate-700">
                  Cancelar
                </Link>
              ) : (
                <button type="button" onClick={() => setPasso(1)} className="inline-flex items-center justify-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700">
                  <ChevronLeft className="h-4 w-4" /> Voltar
                </button>
              )}
              <button
                type="button"
                onClick={salvar}
                disabled={!!salvando || !!lendo}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B2447] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B3D91] disabled:opacity-60 sm:py-2.5"
              >
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {salvando ?? (edicao ? 'Salvar alterações' : 'Salvar documento')}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function IndicadorPassos({ atual, onVoltar }: { atual: number; onVoltar: (i: number) => void }) {
  return (
    <ol className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
      {PASSOS.map((p, i) => {
        const feito = i < atual;
        const corrente = i === atual;
        return (
          <li key={p} className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              disabled={!feito}
              onClick={() => onVoltar(i)}
              className="flex min-w-0 items-center gap-2 disabled:cursor-default"
              aria-current={corrente ? 'step' : undefined}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  feito ? 'bg-[#0B2447] text-white' : corrente ? 'border-2 border-[#0B2447] text-[#0B2447]' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {feito ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className={`truncate text-xs font-semibold sm:text-sm ${corrente ? 'text-[#0B2447]' : 'text-slate-400'} ${corrente ? '' : 'hidden sm:inline'}`}>
                {p}
              </span>
            </button>
            {i < PASSOS.length - 1 && <span className={`h-px flex-1 ${feito ? 'bg-[#0B2447]' : 'bg-slate-200'}`} />}
          </li>
        );
      })}
    </ol>
  );
}

function EscolhaEmbarcacao({
  embarcacoes, valor, onChange,
}: { embarcacoes: { id: string; nome: string }[]; valor: string | null; onChange: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {embarcacoes.map((e) => {
        const marcado = valor === e.id;
        return (
          <label
            key={e.id}
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
              marcado ? 'border-teal-400 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <input type="radio" className="accent-teal-600" checked={marcado} onChange={() => onChange(e.id)} />
            <Ship className="h-4 w-4 shrink-0 opacity-60" />
            <span className="truncate">{e.nome}</span>
          </label>
        );
      })}
    </div>
  );
}

function EscolhaEmbarcacoes({
  embarcacoes, valores, onChange,
}: { embarcacoes: { id: string; nome: string }[]; valores: string[]; onChange: (ids: string[]) => void }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {embarcacoes.map((e) => {
        const marcado = valores.includes(e.id);
        return (
          <label
            key={e.id}
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
              marcado ? 'border-teal-400 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <input
              type="checkbox"
              className="accent-teal-600"
              checked={marcado}
              onChange={() => onChange(marcado ? valores.filter((id) => id !== e.id) : [...valores, e.id])}
            />
            <Ship className="h-4 w-4 shrink-0 opacity-60" />
            <span className="truncate">{e.nome}</span>
          </label>
        );
      })}
    </div>
  );
}

function ResumoEscolha({ sigla, nome, alvo, onAlterar }: { sigla: string; nome: string; alvo: string; onAlterar?: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex h-10 min-w-[3.25rem] items-center justify-center rounded-lg bg-[#0B2447]/5 px-2 text-xs font-bold text-[#0B2447]">
        {sigla === 'Outro' ? 'DOC' : sigla}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800">{nome}</p>
        {alvo && <p className="truncate text-xs text-slate-500">{alvo}</p>}
      </div>
      {onAlterar && (
        <button type="button" onClick={onAlterar} className="text-xs font-semibold text-teal-700 hover:underline">
          Alterar
        </button>
      )}
    </div>
  );
}

function SecaoCondutor({
  membroFixo, condutores, analise, analisando, escolha, onEscolha, nome, funcao, onFuncao, onTrocarFixo,
  estrangeiro, onEstrangeiro, documento, onDocumento,
}: {
  membroFixo: MembroCondutor | null;
  condutores: MembroCondutor[];
  analise: AnaliseCondutor | null;
  analisando: boolean;
  escolha: string | 'novo' | null;
  onEscolha: (v: string | 'novo') => void;
  nome: string;
  funcao: EquipeFuncao;
  onFuncao: (f: EquipeFuncao) => void;
  onTrocarFixo: () => void;
  estrangeiro: boolean;
  onEstrangeiro: (v: boolean) => void;
  documento: DocumentoEstrangeiroEquipe;
  onDocumento: (d: DocumentoEstrangeiroEquipe) => void;
}) {
  const paises = useMemo(() => opcoesPaises('pt-BR'), []);
  const nomeMembro = (m: MembroCondutor) => (m.is_gestor ? `${m.nome_completo} (você)` : m.nome_completo);

  if (membroFixo) {
    const divergente = nome.trim().length >= 3 && similaridadeNomes(nome, membroFixo.nome_completo) < 0.6;
    return (
      <div className="space-y-2 rounded-xl border border-slate-200 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <UserCheck className="h-4 w-4 text-teal-600" /> Condutor: {nomeMembro(membroFixo)}
        </p>
        {divergente && (
          <p className="text-xs text-amber-700">
            O nome no documento ({nome}) é diferente.{' '}
            <button type="button" onClick={onTrocarFixo} className="font-semibold underline">É outra pessoa</button>
          </p>
        )}
      </div>
    );
  }

  const candidatos = analise?.resultado === 'similar' ? analise.candidatos : [];
  const outros = condutores.filter((m) => m.ativo && !candidatos.some((c) => c.id === m.id));

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-4">
      <p className="text-sm font-semibold text-slate-700">Quem é o condutor?</p>

      {analisando && (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Procurando na sua equipe…
        </p>
      )}
      {!analisando && !analise && <p className="text-xs text-slate-500">Preencha o nome do condutor para procurarmos na sua equipe.</p>}

      {!analisando && analise?.resultado === 'exato' && escolha === analise.membro.id && (
        <p className="flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">
          <UserCheck className="h-4 w-4 shrink-0" />
          Encontramos na sua equipe: <strong>{nomeMembro(analise.membro)}</strong>
          {analise.motivo === 'cpf' ? ' (mesmo CPF)' : ''}.
        </p>
      )}
      {!analisando && analise?.resultado === 'similar' && (
        <p className="text-xs text-slate-500">Encontramos alguém parecido na sua equipe. É a mesma pessoa?</p>
      )}

      {!analisando && analise && (
        <div className="space-y-2">
          {candidatos.map((m) => (
            <OpcaoCondutor key={m.id} marcado={escolha === m.id} onClick={() => onEscolha(m.id)} titulo={`Sim, é ${nomeMembro(m)}`} />
          ))}
          <OpcaoCondutor
            marcado={escolha === 'novo'}
            onClick={() => onEscolha('novo')}
            titulo={candidatos.length > 0 ? 'Não, é outra pessoa — cadastrar na equipe' : 'Cadastrar na equipe'}
            icone={<UserPlus className="h-4 w-4" />}
          />
          {outros.length > 0 && (
            <select
              className={inputCls}
              value={escolha && escolha !== 'novo' && !candidatos.some((c) => c.id === escolha) ? escolha : ''}
              onChange={(e) => e.target.value && onEscolha(e.target.value)}
            >
              <option value="">Ou escolha alguém da equipe…</option>
              {outros.map((m) => (
                <option key={m.id} value={m.id}>{nomeMembro(m)}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {escolha === 'novo' && (
        <div className="space-y-3 rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-600">
            <strong>{nome.trim() ? nomeApresentavel(nome) : 'O condutor'}</strong> será adicionado à sua equipe com o nome e o CPF
            acima (ou o documento de estrangeiro, se marcar abaixo). O telefone fica pendente para você completar depois, na Equipe.
          </p>
          <div className="sm:max-w-xs">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Função</label>
            <select className={inputCls} value={funcao} onChange={(e) => onFuncao(e.target.value as EquipeFuncao)}>
              {FUNCOES_EQUIPE.map((f) => (
                <option key={f.valor} value={f.valor}>{f.rotulo}</option>
              ))}
            </select>
          </div>
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={estrangeiro}
              onChange={(e) => onEstrangeiro(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            Estrangeiro — não tem CPF
          </label>
          {estrangeiro && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Tipo de documento</label>
                <select className={inputCls} value={documento.tipo} onChange={(e) => onDocumento({ ...documento, tipo: e.target.value as TipoDocumentoEquipe | '' })}>
                  <option value="">Selecione…</option>
                  {TIPOS_DOCUMENTO_EQUIPE.map((t) => (
                    <option key={t} value={t}>{ROTULO_TIPO_DOCUMENTO_EQUIPE[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">País emissor</label>
                <select className={inputCls} value={documento.pais} onChange={(e) => onDocumento({ ...documento, pais: e.target.value })}>
                  <option value="">Selecione…</option>
                  {paises.map((p) => (
                    <option key={p.codigo} value={p.codigo}>{p.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Número</label>
                <input
                  className={inputCls}
                  value={documento.documento}
                  onChange={(e) => onDocumento({ ...documento, documento: normalizarDocumentoEstrangeiro(e.target.value) })}
                  placeholder="AB123456"
                  maxLength={20}
                  autoCapitalize="characters"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OpcaoCondutor({
  marcado, onClick, titulo, icone,
}: { marcado: boolean; onClick: () => void; titulo: string; icone?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
        marcado ? 'border-teal-400 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${marcado ? 'border-teal-600 bg-teal-600' : 'border-slate-300'}`}>
        {marcado && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
      {icone}
      {titulo}
    </button>
  );
}
