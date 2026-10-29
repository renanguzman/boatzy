'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Ship, IdCard, Camera, FileUp, FileText, Check, ChevronLeft, Loader2, AlertCircle, Sparkles, Info, UserCheck,
  UserPlus, RefreshCw, CheckCircle2, ScanLine, ArrowRight,
} from 'lucide-react';
import { formatarData } from '@/lib/datas';
import { maskCPF, onlyDigits } from '@/lib/validators';
import {
  CATEGORIAS_CHA, FUNCOES_EQUIPE, TIPOS_DOCUMENTO, TIPOS_POR_ESCOPO, normalizarCategorias, rotuloFuncao,
  type DadosDocumento,
} from '@/lib/documentos/tipos';
import { diasParaVencer, situacaoValidade, textoPrazo } from '@/lib/documentos/validade';
import { isValidCPF } from '@/lib/validators';
import { normalizarNome, similaridadeNomes, nomeApresentavel } from '@/lib/documentos/nomes';
import { enviarArquivoDocumento, validarArquivoDocumento, type ArquivoEnviado } from '@/lib/documentos/envio';
import type { ProgressoLeitura } from '@/lib/documentos/ocr';
import { avaliarQualidadeDe, MENSAGEM_PROBLEMA, type QualidadeFoto } from '@/lib/documentos/qualidade-foto';
import CameraDocumento from './CameraDocumento';
import type { DocumentoItem, MembroCondutor, AnaliseCondutor } from '@/lib/documentos/server';
import type { DocumentoEscopo, DocumentoOrigem, DocumentoTipo, EquipeFuncao } from '@/types/supabase';
import {
  analisarCondutorDocumento, atualizarDocumento, criarDocumento, type CondutorPayload, type DocumentoPayload,
} from '../actions';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none';

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

type Campos = {
  titulo: string;
  numero: string;
  titular: string;
  /** CPF do titular da habilitação (com máscara). */
  cpf: string;
  embarcacaoNome: string;
  /** Categorias da habilitação separadas por vírgula ("mestre,motonauta"). */
  categoria: string;
  dataEmissao: string;
  dataValidade: string;
};

/** Extras da habilitação editáveis na conferência (gravados em `documento.dados`). */
type ExtraCondutor = 'limites_navegacao' | 'orgao_emissor';
type CampoLido = keyof Campos | ExtraCondutor;

const CAMPOS_VAZIOS: Campos = {
  titulo: '', numero: '', titular: '', cpf: '', embarcacaoNome: '', categoria: '', dataEmissao: '', dataValidade: '',
};

const PASSOS = ['O que é', 'Arquivo', 'Conferir e salvar'];

function somarAnos(iso: string, anos: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const alvo = new Date(Date.UTC(a + anos, m - 1, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  return `${alvo.getUTCFullYear()}-${String(m).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`;
}

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
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [lendo, setLendo] = useState<ProgressoLeitura | null>(null);
  const leituraIgnorada = useRef(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [cameraAberta, setCameraAberta] = useState(false);
  /** Qualidade da foto (câmera do painel ou imagem escolhida) — aviso na conferência. */
  const [qualidadeFoto, setQualidadeFoto] = useState<QualidadeFoto | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

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

  function alternarCategoria(valor: string) {
    const atuais = new Set(campos.categoria.split(',').filter(Boolean));
    const cat = CATEGORIAS_CHA.find((c) => c.valor === valor);
    if (atuais.has(valor)) atuais.delete(valor);
    else {
      // Arrais, Mestre e Capitão-Amador são excludentes; Motonauta e Veleiro somam.
      if (cat?.amador) CATEGORIAS_CHA.filter((c) => c.amador).forEach((c) => atuais.delete(c.valor));
      atuais.add(valor);
    }
    atualizarCampo('categoria', normalizarCategorias([...atuais].join(',')) ?? '');
  }

  // ── Leitura do arquivo ──────────────────────────────────────────────────────

  const fecharCamera = useCallback(() => setCameraAberta(false), []);

  async function escolherArquivo(file: File | undefined, qualidade?: QualidadeFoto) {
    if (!file) return;
    const problema = validarArquivoDocumento(file);
    if (problema) {
      setErroArquivo(problema);
      return;
    }
    setErroArquivo(null);
    setArquivo(file);
    enviado.current = null;
    setPrevia(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);

    // Foto escolhida da galeria também passa pela avaliação (a da câmera já vem avaliada).
    let q: QualidadeFoto | null = qualidade ?? null;
    if (!q && file.type.startsWith('image/')) {
      try {
        const bitmap = await createImageBitmap(file);
        q = avaliarQualidadeDe(bitmap);
        bitmap.close();
      } catch {
        q = null;
      }
    }
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
      aplicarLeitura(r.campos, r.origem);
    } catch (e) {
      console.error('[documentos] leitura falhou:', e);
      if (leituraIgnorada.current) return;
      setOrigem('manual');
      setAvisoLeitura('Não conseguimos ler o documento automaticamente. Preencha os campos abaixo.');
      sugerirProprietario();
    } finally {
      if (!leituraIgnorada.current) {
        setLendo(null);
        setPasso(2);
      }
    }
  }

  function aplicarLeitura(c: import('@/lib/documentos/leitura').CamposLidos, origemLeitura: 'pdf' | 'ocr') {
    const novos: Partial<Campos> = {};
    if (c.numero) novos.numero = c.numero;
    if (c.dataValidade) novos.dataValidade = c.dataValidade;
    if (c.dataEmissao) novos.dataEmissao = c.dataEmissao;
    if (c.titular) novos.titular = info?.escopo === 'condutor' ? nomeApresentavel(c.titular) : c.titular;
    if (c.embarcacaoNome && escopo === 'embarcacao') novos.embarcacaoNome = c.embarcacaoNome;
    if (c.categoria && info?.temCategoria) novos.categoria = c.categoria;
    if (c.cpf && escopo === 'condutor') novos.cpf = maskCPF(c.cpf);

    const extrasLidos: ExtraCondutor[] = [];
    if (escopo === 'condutor') {
      setDados({ limites_navegacao: c.limitesNavegacao, orgao_emissor: c.orgaoEmissor });
      if (c.limitesNavegacao) extrasLidos.push('limites_navegacao');
      if (c.orgaoEmissor) extrasLidos.push('orgao_emissor');
    } else {
      setDados({ tipo_embarcacao: c.tipoEmbarcacao, area_navegacao: c.areaNavegacao, atividade: c.atividade });
    }

    setCampos((atual) => ({ ...atual, ...novos }));
    setLidos(new Set([...(Object.keys(novos) as CampoLido[]), ...extrasLidos]));
    if (!novos.titular) sugerirProprietario();
    setTipoSugerido(c.tipoDetectado && c.tipoDetectado !== tipo && TIPOS_POR_ESCOPO[escopo].includes(c.tipoDetectado) ? c.tipoDetectado : null);

    const n = Object.keys(novos).length + extrasLidos.length;
    setOrigem(n > 0 ? origemLeitura : 'manual');
    setAvisoLeitura(
      n > 0
        ? null
        : 'Não encontramos os dados no arquivo — a foto pode estar inclinada, escura ou com reflexo. Preencha os campos abaixo.',
    );
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
    if (escolhaCondutor === 'novo') return { modo: 'novo', nome: campos.titular, cpf: campos.cpf, funcao: funcaoNovo };
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
    if (!edicao && !arquivo) {
      setErro('Envie a foto ou o PDF do documento.');
      return;
    }
    if (info?.validadeAnos != null && !campos.dataValidade) {
      setErro(`Informe a validade do ${info.sigla} — é ela que gera os avisos de vencimento.`);
      return;
    }
    if (escopo === 'condutor' && onlyDigits(campos.cpf) && !isValidCPF(campos.cpf)) {
      setErro('CPF do condutor inválido — confira os números ou deixe em branco.');
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
            className="rounded-xl bg-[#0B2447] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B3D91]"
          >
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
      {/* Entradas de arquivo (sempre montadas: a câmera também recorre a elas) */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
        void escolherArquivo(e.target.files?.[0]);
        e.target.value = ''; // permite escolher o mesmo arquivo de novo
      }} />
      <input ref={arquivoRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => {
        void escolherArquivo(e.target.files?.[0]);
        e.target.value = ''; // permite escolher o mesmo arquivo de novo
      }} />
      <CameraDocumento
        aberta={cameraAberta}
        formatoInicial={info?.escopo === 'condutor' ? 'paisagem' : 'retrato'}
        sigla={info && tipo !== 'outro' ? info.sigla : 'documento'}
        onFechar={fecharCamera}
        onFoto={(file, q) => {
          setCameraAberta(false);
          void escolherArquivo(file, q);
        }}
        onCameraNativa={() => {
          setCameraAberta(false);
          cameraRef.current?.click();
        }}
        onEscolherArquivo={() => {
          setCameraAberta(false);
          arquivoRef.current?.click();
        }}
      />
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
                    onClick={() => setCameraAberta(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B2447] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B3D91]"
                  >
                    <Camera className="h-4 w-4" /> Tirar foto
                  </button>
                  <button
                    type="button"
                    onClick={() => arquivoRef.current?.click()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <FileUp className="h-4 w-4" /> Escolher arquivo
                  </button>
                </div>
              </div>
              {erroArquivo && <MensagemErro texto={erroArquivo} />}
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
                onClick={() => setCameraAberta(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Camera className="h-3.5 w-3.5" /> {arquivo ? 'Tirar outra' : 'Tirar foto'}
              </button>
              <button
                type="button"
                onClick={() => arquivoRef.current?.click()}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> {arquivo || documento?.tem_arquivo ? 'Trocar arquivo' : 'Enviar arquivo'}
              </button>
            </div>
            {erroArquivo && <MensagemErro texto={erroArquivo} />}
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
                  onClick={() => setCameraAberta(true)}
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

            <div className="grid gap-4 md:grid-cols-2">
              {info.temTitulo && (
                <Campo rotulo="Nome do documento" obrigatorio className="md:col-span-2">
                  <input className={inputCls} value={campos.titulo} onChange={(e) => atualizarCampo('titulo', e.target.value)} placeholder="Ex.: Vistoria anual" />
                </Campo>
              )}
              <Campo rotulo={info.rotuloNumero} lido={lidos.has('numero')}>
                <input className={inputCls} value={campos.numero} onChange={(e) => atualizarCampo('numero', e.target.value.toUpperCase())} />
              </Campo>
              <Campo rotulo={info.rotuloTitular} lido={lidos.has('titular')}>
                <input className={inputCls} value={campos.titular} onChange={(e) => atualizarCampo('titular', e.target.value)} />
              </Campo>
              {escopo === 'condutor' && (
                <Campo
                  rotulo="CPF do condutor"
                  lido={lidos.has('cpf')}
                  ajuda={onlyDigits(campos.cpf).length === 11 && !isValidCPF(campos.cpf) ? 'CPF inválido — confira os números.' : undefined}
                >
                  <input
                    className={inputCls}
                    value={campos.cpf}
                    onChange={(e) => atualizarCampo('cpf', maskCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                  />
                </Campo>
              )}
              {escopo === 'embarcacao' && (
                <Campo rotulo="Nome da embarcação no documento" lido={lidos.has('embarcacaoNome')}>
                  <input className={inputCls} value={campos.embarcacaoNome} onChange={(e) => atualizarCampo('embarcacaoNome', e.target.value)} placeholder={embarcacao?.nome} />
                </Campo>
              )}
              {info.temCategoria && (
                <Campo
                  rotulo="Categoria"
                  lido={lidos.has('categoria')}
                  className="md:col-span-2"
                  ajuda="Marque todas as da carteira — ex.: Mestre-Amador e Motonauta."
                >
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIAS_CHA.map((c) => {
                      const marcada = campos.categoria.split(',').includes(c.valor);
                      return (
                        <button
                          key={c.valor}
                          type="button"
                          aria-pressed={marcada}
                          onClick={() => alternarCategoria(c.valor)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                            marcada ? 'border-teal-400 bg-teal-50 font-semibold text-teal-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {marcada && <Check className="h-3.5 w-3.5" />} {c.rotulo}
                        </button>
                      );
                    })}
                  </div>
                </Campo>
              )}
              <Campo rotulo="Data de emissão" lido={lidos.has('dataEmissao')}>
                <input type="date" className={inputCls} value={campos.dataEmissao} onChange={(e) => atualizarCampo('dataEmissao', e.target.value)} />
              </Campo>
              <Campo
                rotulo="Validade"
                obrigatorio={info.validadeAnos != null}
                lido={lidos.has('dataValidade')}
                ajuda={info.validadeAnos ? `O ${info.sigla} costuma valer ${info.validadeAnos} ${info.validadeAnos === 1 ? 'ano' : 'anos'}.` : 'Opcional — sem validade, não geramos avisos.'}
              >
                <input type="date" className={inputCls} value={campos.dataValidade} onChange={(e) => atualizarCampo('dataValidade', e.target.value)} />
                <SituacaoDaValidade validade={campos.dataValidade} emissao={campos.dataEmissao} anos={info.validadeAnos} sigla={info.sigla} />
                {!campos.dataValidade && campos.dataEmissao && info.validadeAnos && (
                  <button
                    type="button"
                    onClick={() => atualizarCampo('dataValidade', somarAnos(campos.dataEmissao, info.validadeAnos!))}
                    className="mt-1 text-xs font-semibold text-teal-700 hover:underline"
                  >
                    Usar emissão + {info.validadeAnos} {info.validadeAnos === 1 ? 'ano' : 'anos'}
                  </button>
                )}
              </Campo>
            </div>

            {escopo === 'condutor' && (
              <div className="grid gap-4 md:grid-cols-2">
                <Campo rotulo="Limites da navegação" lido={lidos.has('limites_navegacao')} ajuda="Opcional — como está no verso da carteira.">
                  <input
                    className={inputCls}
                    value={dados.limites_navegacao ?? ''}
                    onChange={(e) => atualizarExtra('limites_navegacao', e.target.value)}
                    placeholder="Ex.: Costeira"
                    maxLength={120}
                  />
                </Campo>
                <Campo rotulo="Órgão emissor" lido={lidos.has('orgao_emissor')} ajuda="Opcional.">
                  <input
                    className={inputCls}
                    value={dados.orgao_emissor ?? ''}
                    onChange={(e) => atualizarExtra('orgao_emissor', e.target.value)}
                    placeholder="Ex.: Capitania dos Portos de Santa Catarina"
                    maxLength={80}
                  />
                </Campo>
              </div>
            )}

            {escopo === 'embarcacao' && (dados.tipo_embarcacao || dados.area_navegacao || dados.atividade) && (
              <p className="text-xs text-slate-500">
                Também lemos:{' '}
                <span className="font-medium text-slate-700">
                  {[dados.tipo_embarcacao, dados.area_navegacao, dados.atividade].filter(Boolean).join(' · ')}
                </span>
              </p>
            )}

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

function AvisoSubstituicao({ sigla, validade }: { sigla: string; validade: string | null }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5 text-sm text-sky-900">
      <RefreshCw className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Este envio substitui o {sigla} atual{validade ? ` (válido até ${formatarData(validade)})` : ''}. O anterior fica guardado no histórico.
      </span>
    </p>
  );
}

function Campo({
  rotulo, obrigatorio = false, lido = false, ajuda, className = '', children,
}: { rotulo: string; obrigatorio?: boolean; lido?: boolean; ajuda?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
        <span>
          {rotulo} {obrigatorio && <span className="text-red-500">*</span>}
        </span>
        {lido && (
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
            <Sparkles className="h-3 w-3" /> lido do documento
          </span>
        )}
      </label>
      {children}
      {ajuda && <p className="mt-1 text-xs text-slate-400">{ajuda}</p>}
    </div>
  );
}

/**
 * Situação da validade digitada/lida, com as mesmas regras do painel (SPEC §95.3): vencido,
 * vence em breve (≤ 60 dias) ou em dia. Confere também validade × emissão: além do prazo
 * usual do tipo, a data provavelmente foi mal lida.
 */
function SituacaoDaValidade({
  validade, emissao, anos, sigla,
}: { validade: string; emissao: string; anos: number | null; sigla: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validade)) return null;
  const situacao = situacaoValidade(validade);
  const prazo = textoPrazo(validade);
  const alemDoPrazo = !!anos && /^\d{4}-\d{2}-\d{2}$/.test(emissao) && validade > somarAnos(emissao, anos);

  return (
    <div className="mt-1.5 space-y-1.5">
      {situacao === 'vencido' ? (
        <p className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Vencido</strong> — {prazo}. Você pode salvar para acompanhar, mas ele aparecerá como vencido no painel até ser
            renovado.
            {sigla === 'CHA' && diasParaVencer(validade) < -5 * 365 && (
              <> Vencida há mais de 5 anos, a renovação exige refazer a prova na Capitania.</>
            )}
          </span>
        </p>
      ) : situacao === 'vence_em_breve' ? (
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Vence em breve</strong> — {prazo}. Já vale pedir a renovação.
          </span>
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Em dia — válido até {formatarData(validade)}.
        </p>
      )}
      {alemDoPrazo && (
        <p className="text-xs text-amber-700">
          Confira a data: o {sigla} costuma valer {anos} {anos === 1 ? 'ano' : 'anos'} a partir da emissão (até{' '}
          {formatarData(somarAnos(emissao, anos!))}).
        </p>
      )}
    </div>
  );
}

function MensagemErro({ texto }: { texto: string }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {texto}
    </p>
  );
}

function SecaoCondutor({
  membroFixo, condutores, analise, analisando, escolha, onEscolha, nome, funcao, onFuncao, onTrocarFixo,
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
}) {
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
            acima. O telefone fica pendente para você completar depois, na Equipe.
          </p>
          <div className="sm:max-w-xs">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Função</label>
            <select className={inputCls} value={funcao} onChange={(e) => onFuncao(e.target.value as EquipeFuncao)}>
              {FUNCOES_EQUIPE.map((f) => (
                <option key={f.valor} value={f.valor}>{f.rotulo}</option>
              ))}
            </select>
          </div>
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
