'use client';

import PhoneInput, { type PhoneValue } from '@/components/auth/PhoneInput';
import { telefoneMembroInternacional } from '@/lib/telefone-membro';
import { iniciarBarraNavegacao } from '@/components/ui/BarraProgressoNavegacao';
import { useState, useRef, useTransition, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  User, Upload, X, Loader2, AlertCircle, CheckCircle, Search, BadgeCheck, Ship,
} from 'lucide-react';
import { maskCPF, onlyDigits, applyPhoneMask, isValidCPF } from '@/lib/validators';
import { MAX_IMAGE_SIZE_BYTES, MAX_IMAGE_SIZE_ERROR } from '@/lib/upload';
import { normalizarDocumentoEstrangeiro, opcoesPaises } from '@/lib/pagamentos/estrangeiro';
import { ROTULO_TIPO_DOCUMENTO_EQUIPE, TIPOS_DOCUMENTO_EQUIPE, tipoDocumentoEquipeValido, type TipoDocumentoEquipe } from '@/lib/equipe-documento';
import { FUNCOES_EQUIPE } from '@/lib/documentos/tipos';
import { SIMILARIDADE_SUGESTAO, similaridadeNomes } from '@/lib/documentos/nomes';
import type { DocumentoAtual, RascunhoDocumento } from '@/lib/documentos/rascunho';
import DocumentoEmbutido from '@/components/painel/documentos/DocumentoEmbutido';
import type { EquipeFuncao } from '@/types/supabase';
import { enviarArquivosDosRascunhos, erroDosRascunhos, registrarRascunhos } from '../../documentos/_lib/rascunhos';
import {
  criarMembro,
  atualizarMembro,
  salvarFotoMembro,
  removerFotoMembro,
  buscarUsuarioParaVincular,
  type MembroFormPayload,
  type UsuarioVinculavel,
} from '../actions';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none';

export type MembroFormData = {
  id: string;
  nome_completo: string;
  cpf: string | null;
  tipo_documento_estrangeiro?: string | null;
  documento_estrangeiro?: string | null;
  pais_documento?: string | null;
  email: string | null;
  telefone: string | null;
  funcao: EquipeFuncao | null;
  foto_url: string | null;
  embarcacaoIds: string[];
  user_id: string | null;
  conta_nome: string | null;
};

type Props = {
  embarcacoes: { id: string; nome: string }[];
  membro?: MembroFormData;
  /** Habilitação ativa do membro (edição) — resumo com "Substituir"/"Renovar". */
  habilitacaoAtual?: DocumentoAtual | null;
};

function phoneMask(digits: string): string {
  const d = onlyDigits(digits).slice(0, 11);
  return applyPhoneMask(d, d.length > 10 ? '(##) #####-####' : '(##) ####-####');
}

export default function MembroForm({ embarcacoes, membro, habilitacaoAtual = null }: Props) {
  const router = useRouter();
  const editMode = !!membro;
  const fileRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState(membro?.nome_completo ?? '');
  const [cpf, setCpf] = useState(membro?.cpf ? maskCPF(membro.cpf) : '');
  // Estrangeiro sem CPF: passaporte ou registro de identificação + país emissor (SPEC §104).
  const [semCpf, setSemCpf] = useState(!!membro?.documento_estrangeiro);
  const [tipoDoc, setTipoDoc] = useState<TipoDocumentoEquipe | ''>(
    tipoDocumentoEquipeValido(membro?.tipo_documento_estrangeiro) ? membro.tipo_documento_estrangeiro : '',
  );
  const [paisDoc, setPaisDoc] = useState(membro?.pais_documento ?? '');
  const [numeroDoc, setNumeroDoc] = useState(membro?.documento_estrangeiro ?? '');
  const paises = useMemo(() => opcoesPaises('pt-BR'), []);
  const [email, setEmail] = useState(membro?.email ?? '');
  // Telefone brasileiro (máscara com DDD) ou, para estrangeiro, internacional em E.164 (SPEC §104).
  const [telefone, setTelefone] = useState(
    membro?.telefone && !telefoneMembroInternacional(membro.telefone) ? phoneMask(membro.telefone) : '',
  );
  const [telIntl, setTelIntl] = useState<PhoneValue | null>(null);
  const [funcao, setFuncao] = useState<EquipeFuncao | ''>(membro?.funcao ?? '');
  const [selEmb, setSelEmb] = useState<string[]>(membro?.embarcacaoIds ?? []);

  // Foto
  const [fotoUrl, setFotoUrl] = useState<string | null>(membro?.foto_url ?? null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  // Vínculo com conta
  const [vinculoId, setVinculoId] = useState<string | null>(membro?.user_id ?? null);
  const [vinculoNome, setVinculoNome] = useState<string | null>(membro?.conta_nome ?? null);
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<UsuarioVinculavel[]>([]);
  const [buscando, startBusca] = useTransition();

  // Habilitação náutica (CHA/CIR) — gravada junto com o membro (SPEC §95.10)
  const [habilitacao, setHabilitacao] = useState<RascunhoDocumento | null>(null);

  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** A carteira lida completa nome e CPF ainda em branco (nunca sobrescreve o digitado). */
  function completarComHabilitacao(r: RascunhoDocumento) {
    const titular = r.campos.titular.trim();
    if (titular) setNome((n) => (n.trim() ? n : titular));
    if (!semCpf && isValidCPF(r.campos.cpf)) setCpf((c) => (onlyDigits(c) ? c : r.campos.cpf));
  }

  /** Ponto de partida do campo internacional: o telefone já salvo (E.164) ou o brasileiro digitado (+55). */
  const telefoneInicialIntl = telefoneMembroInternacional(membro?.telefone)
    ? (membro?.telefone as string)
    : onlyDigits(telefone) ? `+55${onlyDigits(telefone)}` : '';

  const nomeNaCarteira = habilitacao?.campos.titular.trim() ?? '';
  const cpfNaCarteira = habilitacao?.campos.cpf ?? '';
  const nomeDiverge =
    nomeNaCarteira.length >= 3 && nome.trim().length >= 3 && similaridadeNomes(nomeNaCarteira, nome) < SIMILARIDADE_SUGESTAO;
  const cpfDiverge = !semCpf && isValidCPF(cpfNaCarteira) && isValidCPF(cpf) && onlyDigits(cpfNaCarteira) !== onlyDigits(cpf);

  function toggleEmb(id: string) {
    setSelEmb((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function onPickFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setFeedback({ type: 'error', msg: MAX_IMAGE_SIZE_ERROR });
      return;
    }
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  }

  function limparFoto() {
    setFotoFile(null);
    setFotoPreview(null);
    setFotoUrl(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function onBuscaChange(v: string) {
    setBusca(v);
    if (v.trim().length < 3) {
      setResultados([]);
      return;
    }
    startBusca(async () => {
      setResultados(await buscarUsuarioParaVincular(v));
    });
  }

  function escolherVinculo(u: UsuarioVinculavel) {
    setVinculoId(u.id);
    setVinculoNome(`${u.name} (${u.email})`);
    setBusca('');
    setResultados([]);
  }

  async function uploadFoto(membroId: string): Promise<string | null> {
    if (!fotoFile) return null;
    const body = new FormData();
    body.append('file', fotoFile);
    body.append('membroId', membroId);
    const res = await fetch('/api/painel/equipe/upload', { method: 'POST', body });
    if (!res.ok) return null;
    const { publicUrl } = await res.json();
    return publicUrl as string;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFeedback(null);
    const erroHabilitacao = erroDosRascunhos([habilitacao]);
    if (erroHabilitacao) {
      setFeedback({ type: 'error', msg: erroHabilitacao });
      return;
    }
    if (semCpf && telIntl && !telIntl.valid) {
      setFeedback({ type: 'error', msg: 'Telefone inválido — confira o país e o número.' });
      return;
    }
    setSubmitting(true);

    // O arquivo da habilitação sobe antes (bucket privado): se falhar, nada é salvo.
    const falhaArquivo = await enviarArquivosDosRascunhos([habilitacao]);
    if (falhaArquivo) {
      setFeedback({ type: 'error', msg: falhaArquivo });
      setSubmitting(false);
      return;
    }

    const payload: MembroFormPayload = {
      nome_completo: nome,
      cpf: semCpf ? '' : cpf,
      estrangeiro: semCpf ? { tipo: tipoDoc, pais: paisDoc, documento: numeroDoc } : null,
      email,
      telefone: semCpf ? (telIntl ? telIntl.e164 : telefoneInicialIntl) : telefone,
      funcao,
      embarcacaoIds: selEmb,
      vincularUserId: vinculoId,
    };

    try {
      if (editMode && membro) {
        const res = await atualizarMembro(membro.id, payload);
        if (!res.ok) {
          setFeedback({ type: 'error', msg: res.error ?? 'Erro ao salvar.' });
          setSubmitting(false);
          return;
        }
        // Foto: nova imagem, ou remoção de uma existente.
        if (fotoFile) {
          const url = await uploadFoto(membro.id);
          if (url) await salvarFotoMembro(membro.id, url);
        } else if (!fotoUrl && membro.foto_url) {
          await removerFotoMembro(membro.id);
        }
        const docs = await registrarRascunhos([habilitacao], { membroId: membro.id });
        if (docs.falhas.length > 0) {
          setFeedback({ type: 'error', msg: `Os dados foram salvos, mas a habilitação não (${docs.falhas.join('; ')}). Confira e salve de novo.` });
          setSubmitting(false);
          return;
        }
        setFeedback({ type: 'success', msg: 'Membro atualizado.' });
        setTimeout(() => router.push('/painel/equipe'), 900);
        return;
      }

      const res = await criarMembro(payload);
      if (!res.ok) {
        setFeedback({ type: 'error', msg: res.error });
        setSubmitting(false);
        return;
      }
      if (fotoFile) {
        const url = await uploadFoto(res.membroId);
        if (url) await salvarFotoMembro(res.membroId, url);
      }
      const docs = await registrarRascunhos([habilitacao], { membroId: res.membroId });
      if (docs.falhas.length > 0) {
        // O membro já existe: segue para a edição dele, onde a habilitação pode ser enviada de novo.
        setFeedback({ type: 'error', msg: `Membro cadastrado, mas a habilitação não foi salva (${docs.falhas.join('; ')}). Abrindo o cadastro para você enviar de novo…` });
        setTimeout(() => router.push(`/painel/equipe/${res.membroId}/editar`), 3500);
        return;
      }
      setFeedback({ type: 'success', msg: `Membro "${nome.trim()}" cadastrado.` });
      setTimeout(() => {
        router.push('/painel/equipe');
        router.refresh();
      }, 900);
    } catch {
      setFeedback({ type: 'error', msg: 'Erro inesperado ao salvar.' });
      setSubmitting(false);
    }
  }

  const previewSrc = fotoPreview ?? fotoUrl;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {feedback?.type === 'success' && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {feedback.msg}
        </div>
      )}
      {feedback?.type === 'error' && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {feedback.msg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Foto */}
        <div className="md:col-span-2 flex items-center gap-3 sm:gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
            {previewSrc ? (
              <Image src={previewSrc} alt="Foto do membro" width={80} height={80} className="w-full h-full object-cover" />
            ) : (
              <User className="w-8 h-8 text-slate-300" />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <Upload className="w-3.5 h-3.5" />
              {previewSrc ? 'Trocar foto' : 'Enviar foto'}
            </button>
            {previewSrc && (
              <button
                type="button"
                onClick={limparFoto}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                <X className="w-3.5 h-3.5" />
                Remover
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0])}
            />
          </div>
        </div>

        {/* Nome */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Nome completo <span className="text-red-500">*</span>
          </label>
          <input
            className={inputCls}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="João da Silva"
            required
          />
        </div>

        {/* CPF — ou, para estrangeiro, passaporte / registro de identificação */}
        <div className={semCpf ? 'md:col-span-2' : ''}>
          {!semCpf && (
            <>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                CPF <span className="text-red-500">*</span>
              </label>
              <input
                className={inputCls}
                value={cpf}
                onChange={(e) => setCpf(maskCPF(e.target.value))}
                placeholder="000.000.000-00"
                inputMode="numeric"
                required
              />
            </>
          )}
          <label className={`flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none ${semCpf ? '' : 'mt-2'}`}>
            <input
              type="checkbox"
              checked={semCpf}
              onChange={(e) => setSemCpf(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            Estrangeiro — não tenho CPF
          </label>
          {semCpf && (
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Tipo de documento <span className="text-red-500">*</span>
                </label>
                <select className={inputCls} value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value as TipoDocumentoEquipe | '')} required>
                  <option value="">Selecione…</option>
                  {TIPOS_DOCUMENTO_EQUIPE.map((t) => (
                    <option key={t} value={t}>{ROTULO_TIPO_DOCUMENTO_EQUIPE[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  País emissor <span className="text-red-500">*</span>
                </label>
                <select className={inputCls} value={paisDoc} onChange={(e) => setPaisDoc(e.target.value)} required>
                  <option value="">Selecione…</option>
                  {paises.map((p) => (
                    <option key={p.codigo} value={p.codigo}>{p.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Número do documento <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputCls}
                  value={numeroDoc}
                  onChange={(e) => setNumeroDoc(normalizarDocumentoEstrangeiro(e.target.value))}
                  placeholder="AB123456"
                  maxLength={20}
                  autoCapitalize="characters"
                  required
                />
              </div>
            </div>
          )}
        </div>

        {/* Telefone — estrangeiro pode informar número internacional */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Telefone <span className="text-red-500">*</span>
          </label>
          {semCpf ? (
            <PhoneInput key="intl" initialE164={telIntl?.e164 || telefoneInicialIntl} onChange={setTelIntl} />
          ) : (
            <input
              className={inputCls}
              value={telefone}
              onChange={(e) => setTelefone(phoneMask(e.target.value))}
              placeholder="(11) 91234-5678"
              inputMode="numeric"
              required
            />
          )}
        </div>

        {/* Função */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Função</label>
          <select className={inputCls} value={funcao} onChange={(e) => setFuncao(e.target.value as EquipeFuncao | '')}>
            <option value="">Não informada</option>
            {FUNCOES_EQUIPE.map((f) => (
              <option key={f.valor} value={f.valor}>{f.rotulo}</option>
            ))}
          </select>
        </div>

        {/* E-mail */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail</label>
          <input
            className={inputCls}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="joao@exemplo.com (opcional)"
          />
        </div>
      </div>

      {/* Habilitação náutica (CHA/CIR) */}
      <DocumentoEmbutido
        escopo="condutor"
        tipos={['cha', 'cir']}
        titulo="Habilitação náutica"
        descricao="CHA (Arrais, Mestre, Capitão-Amador…) ou CIR de quem conduz. Lemos a carteira e, se nome e CPF estiverem em branco, preenchemos para você. Avisamos antes de vencer."
        selo={funcao === 'auxiliar' ? 'opcional' : 'recomendado'}
        atual={habilitacaoAtual}
        valor={habilitacao}
        onChange={setHabilitacao}
        pessoasConhecidas={nome.trim() ? [nome.trim()] : []}
        onLeitura={completarComHabilitacao}
        desabilitado={submitting}
        avisos={(nomeDiverge || cpfDiverge) && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {nomeDiverge && cpfDiverge
                ? 'O nome e o CPF da carteira são diferentes dos informados acima.'
                : nomeDiverge
                  ? `O nome na carteira (${nomeNaCarteira}) é diferente do informado acima.`
                  : `O CPF da carteira (${cpfNaCarteira}) é diferente do informado acima.`}{' '}
              Confira se a habilitação é desta pessoa.
            </span>
          </p>
        )}
      />

      {/* Embarcações */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Embarcações que este membro atende <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {embarcacoes.map((e) => {
            const checked = selEmb.includes(e.id);
            return (
              <label
                key={e.id}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                  checked
                    ? 'border-teal-400 bg-teal-50 text-teal-800'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  className="accent-teal-600"
                  checked={checked}
                  onChange={() => toggleEmb(e.id)}
                />
                <Ship className="w-4 h-4 shrink-0 opacity-60" />
                <span className="truncate">{e.nome}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Vínculo com conta */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Vincular a uma conta da plataforma
        </label>
        <p className="text-xs text-slate-400 mb-2">
          Opcional. Use quando esta pessoa já tem conta na Boatzy ou vier a se tornar um gestor de
          embarcação — cria o vínculo de identidade.
        </p>

        {vinculoId ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm text-teal-800 min-w-0">
              <BadgeCheck className="w-4 h-4 shrink-0" />
              <span className="truncate">{vinculoNome ?? 'Conta vinculada'}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setVinculoId(null);
                setVinculoNome(null);
              }}
              className="text-xs font-medium text-red-600 hover:underline shrink-0"
            >
              Desvincular
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              className={`${inputCls} pl-9`}
              value={busca}
              onChange={(e) => onBuscaChange(e.target.value)}
              placeholder="Buscar por nome, e-mail ou CPF…"
            />
            {(buscando || resultados.length > 0) && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
                {buscando && (
                  <div className="px-3 py-2.5 text-xs text-slate-400 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando…
                  </div>
                )}
                {!buscando &&
                  resultados.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => escolherVinculo(u)}
                      className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <span className="text-sm text-slate-700">{u.name}</span>
                      <span className="text-xs text-slate-400">
                        {u.email}
                        {u.cpf_cnpj ? ` · ${u.cpf_cnpj}` : ''}
                      </span>
                    </button>
                  ))}
                {!buscando && resultados.length === 0 && busca.trim().length >= 3 && (
                  <div className="px-3 py-2.5 text-xs text-slate-400">Nenhuma conta encontrada.</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
        {editMode && (
          <button
            type="button"
            onClick={() => { iniciarBarraNavegacao(); router.push('/painel/equipe'); }}
            className="rounded-lg px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium px-6 py-3 sm:py-2.5 rounded-lg transition-colors"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {editMode ? 'Salvar alterações' : 'Cadastrar membro'}
        </button>
      </div>
    </form>
  );
}
