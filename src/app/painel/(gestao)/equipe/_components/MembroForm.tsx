'use client';

import { useState, useRef, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  User, Upload, X, Loader2, AlertCircle, CheckCircle, Search, BadgeCheck, Ship,
} from 'lucide-react';
import { maskCPF, onlyDigits, applyPhoneMask } from '@/lib/validators';
import { MAX_IMAGE_SIZE_BYTES, MAX_IMAGE_SIZE_ERROR } from '@/lib/upload';
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
  email: string | null;
  telefone: string | null;
  foto_url: string | null;
  embarcacaoIds: string[];
  user_id: string | null;
  conta_nome: string | null;
};

type Props = {
  embarcacoes: { id: string; nome: string }[];
  membro?: MembroFormData;
};

function phoneMask(digits: string): string {
  const d = onlyDigits(digits).slice(0, 11);
  return applyPhoneMask(d, d.length > 10 ? '(##) #####-####' : '(##) ####-####');
}

export default function MembroForm({ embarcacoes, membro }: Props) {
  const router = useRouter();
  const editMode = !!membro;
  const fileRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState(membro?.nome_completo ?? '');
  const [cpf, setCpf] = useState(membro?.cpf ? maskCPF(membro.cpf) : '');
  const [email, setEmail] = useState(membro?.email ?? '');
  const [telefone, setTelefone] = useState(membro?.telefone ? phoneMask(membro.telefone) : '');
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

  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);

    const payload: MembroFormPayload = {
      nome_completo: nome,
      cpf,
      email,
      telefone,
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
        setFeedback({ type: 'success', msg: 'Membro atualizado.' });
        setSubmitting(false);
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
      setFeedback({ type: 'success', msg: `Membro "${nome.trim()}" cadastrado.` });
      setSubmitting(false);
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
        <div className="md:col-span-2 flex items-center gap-4">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
            {previewSrc ? (
              <Image src={previewSrc} alt="Foto do membro" width={80} height={80} className="w-full h-full object-cover" />
            ) : (
              <User className="w-8 h-8 text-slate-300" />
            )}
          </div>
          <div className="flex items-center gap-2">
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

        {/* CPF */}
        <div>
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
        </div>

        {/* Telefone */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Telefone <span className="text-red-500">*</span>
          </label>
          <input
            className={inputCls}
            value={telefone}
            onChange={(e) => setTelefone(phoneMask(e.target.value))}
            placeholder="(11) 91234-5678"
            inputMode="numeric"
            required
          />
        </div>

        {/* E-mail */}
        <div className="md:col-span-2">
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

      <div className="pt-2 flex justify-end gap-3">
        {editMode && (
          <button
            type="button"
            onClick={() => router.push('/painel/equipe')}
            className="rounded-lg px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {editMode ? 'Salvar alterações' : 'Cadastrar membro'}
        </button>
      </div>
    </form>
  );
}
