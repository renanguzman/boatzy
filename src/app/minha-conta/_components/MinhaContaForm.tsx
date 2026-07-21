'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  User,
  Mail,
  IdCard,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Info,
  MapPin,
  Bell,
  Calendar,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  atualizarPerfil,
  atualizarEndereco,
  atualizarNotifEmailConversas,
  getMunicipiosByEstado,
} from '@/lib/conta-actions';
import { isStrongPassword, isValidCPF, isValidBirthday, maskCPF, maskCEP } from '@/lib/validators';
import PhoneInput, { type PhoneValue } from '@/components/auth/PhoneInput';
import PasswordRequirements from '@/components/auth/PasswordRequirements';

type Estado = { id: number; uf: string; nome: string };
type Municipio = { id: number; nome: string };

type EnderecoData = {
  cep: string;
  estado_id: string;
  municipio_id: string;
  bairro: string;
  logradouro: string;
  numero: string;
  complemento: string;
};

type MinhaContaFormProps = {
  email: string;
  name: string;
  cpf: string | null; // dígitos
  phone: string | null; // E.164
  birthday: string | null; // 'yyyy-mm-dd'
  avatarUrl: string | null;
  createdAt: string;
  /** True quando a conta tem provedor de senha (criada por e-mail). */
  canChangePassword: boolean;
  /** Provedores de login vinculados (ex.: ['email'], ['google']). */
  providers: string[];
  notifEmailConversas: boolean;
  estados: Estado[];
  municipiosIniciais: Municipio[];
  endereco: EnderecoData;
};

const PROVIDER_LABEL: Record<string, string> = {
  email: 'E-mail e senha',
  google: 'Google',
  facebook: 'Facebook',
  apple: 'Apple',
};

export default function MinhaContaForm({
  email,
  name: initialName,
  cpf: initialCpf,
  phone: initialPhone,
  birthday: initialBirthday,
  avatarUrl,
  createdAt,
  canChangePassword,
  providers,
  notifEmailConversas,
  estados,
  municipiosIniciais,
  endereco: initialEndereco,
}: MinhaContaFormProps) {
  const supabase = createClient();

  // ─── Dados pessoais ───
  const [name, setName] = useState(initialName);
  const [cpf, setCpf] = useState(initialCpf ? maskCPF(initialCpf) : '');
  const [phone, setPhone] = useState<PhoneValue>({
    e164: initialPhone ?? '',
    valid: true, // valor persistido já é considerado válido até o usuário editar
  });
  const [birthday, setBirthday] = useState(initialBirthday ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'erro'; text: string } | null>(null);

  // ─── Senha ───
  const [current, setCurrent] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'erro'; text: string } | null>(null);

  // ─── Endereço (opcional) ───
  const [endereco, setEndereco] = useState<EnderecoData>(initialEndereco);
  const [municipios, setMunicipios] = useState<Municipio[]>(municipiosIniciais);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [savingEndereco, setSavingEndereco] = useState(false);
  const [endMsg, setEndMsg] = useState<{ type: 'ok' | 'erro'; text: string } | null>(null);

  // ─── Notificações ───
  const [notifConversas, setNotifConversas] = useState(notifEmailConversas);
  const [savingNotif, setSavingNotif] = useState(false);

  const cpfInvalid = cpf.length > 0 && !isValidCPF(cpf);
  const birthdayInvalid = birthday.length > 0 && !isValidBirthday(birthday);

  async function handleToggleNotifConversas() {
    const novo = !notifConversas;
    setNotifConversas(novo); // otimista
    setSavingNotif(true);
    const res = await atualizarNotifEmailConversas(novo);
    setSavingNotif(false);
    if (!res.ok) setNotifConversas(!novo); // rollback em caso de erro
  }

  function setEnd<K extends keyof EnderecoData>(key: K, value: EnderecoData[K]) {
    setEndereco((prev) => ({ ...prev, [key]: value }));
  }

  async function carregarMunicipios(estadoId: number): Promise<Municipio[]> {
    setLoadingMunicipios(true);
    const data = await getMunicipiosByEstado(estadoId);
    setMunicipios(data);
    setLoadingMunicipios(false);
    return data;
  }

  function handleEstadoChange(estadoId: string) {
    setEndereco((prev) => ({ ...prev, estado_id: estadoId, municipio_id: '' }));
    setMunicipios([]);
    if (estadoId) carregarMunicipios(parseInt(estadoId, 10));
  }

  async function handleCepChange(raw: string) {
    const masked = maskCEP(raw);
    const digits = masked.replace(/\D/g, '');
    setEnd('cep', masked);
    setCepError(null);

    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as Record<string, string>;
      if (data.erro) {
        setCepError('CEP não encontrado. Verifique o número ou preencha manualmente.');
        return;
      }
      setEndereco((prev) => ({
        ...prev,
        logradouro: data.logradouro || prev.logradouro,
        bairro: data.bairro || prev.bairro,
      }));
      const estado = estados.find((e) => e.uf === data.uf);
      if (!estado) return;
      const muns = await carregarMunicipios(estado.id);
      const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const mun = muns.find((m) => norm(m.nome) === norm(data.localidade ?? ''));
      setEndereco((prev) => ({
        ...prev,
        estado_id: String(estado.id),
        municipio_id: mun ? String(mun.id) : '',
      }));
    } catch {
      setCepError('Erro ao consultar o CEP. Preencha manualmente.');
    } finally {
      setCepLoading(false);
    }
  }

  async function handleEnderecoSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEndMsg(null);
    setSavingEndereco(true);
    const res = await atualizarEndereco(endereco);
    setSavingEndereco(false);
    if (res.ok) {
      setEndMsg({ type: 'ok', text: 'Endereço atualizado com sucesso.' });
    } else {
      setEndMsg({
        type: 'erro',
        text:
          res.error === 'nao_autenticado'
            ? 'Sua sessão expirou. Entre novamente.'
            : 'Não foi possível salvar. Tente novamente.',
      });
    }
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);

    if (name.trim().length < 2) {
      setProfileMsg({ type: 'erro', text: 'Informe seu nome completo.' });
      return;
    }
    if (cpf && !isValidCPF(cpf)) {
      setProfileMsg({ type: 'erro', text: 'CPF inválido.' });
      return;
    }
    if (phone.e164 && !phone.valid) {
      setProfileMsg({ type: 'erro', text: 'Número de celular inválido.' });
      return;
    }
    if (birthday && !isValidBirthday(birthday)) {
      setProfileMsg({ type: 'erro', text: 'Data de nascimento inválida.' });
      return;
    }

    setSavingProfile(true);
    const res = await atualizarPerfil({ name, cpf, phone: phone.e164, birthday });
    setSavingProfile(false);

    if (res.ok) {
      setProfileMsg({ type: 'ok', text: 'Dados atualizados com sucesso.' });
    } else {
      const map: Record<string, string> = {
        nao_autenticado: 'Sua sessão expirou. Entre novamente.',
        nome_invalido: 'Informe seu nome completo.',
        cpf_invalido: 'CPF inválido.',
        nascimento_invalido: 'Data de nascimento inválida.',
        erro: 'Não foi possível salvar. Tente novamente.',
      };
      setProfileMsg({ type: 'erro', text: map[res.error] ?? map.erro });
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);

    if (!isStrongPassword(novaSenha)) {
      setPwMsg({ type: 'erro', text: 'A nova senha não atende a todos os requisitos.' });
      return;
    }
    if (novaSenha !== confirm) {
      setPwMsg({ type: 'erro', text: 'As senhas não coincidem.' });
      return;
    }

    setSavingPw(true);

    // Reautentica com a senha atual antes de trocar (proteção da conta).
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (signInError) {
      setSavingPw(false);
      setPwMsg({ type: 'erro', text: 'Senha atual incorreta.' });
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: novaSenha });
    setSavingPw(false);

    if (updateError) {
      if (updateError.message.includes('different from the old password')) {
        setPwMsg({ type: 'erro', text: 'A nova senha deve ser diferente da atual.' });
      } else {
        setPwMsg({ type: 'erro', text: 'Não foi possível alterar a senha. Tente novamente.' });
      }
      return;
    }

    setCurrent('');
    setNovaSenha('');
    setConfirm('');
    setPwMsg({ type: 'ok', text: 'Senha alterada com sucesso.' });
  }

  const inputBase =
    'w-full py-3.5 rounded-xl border bg-slate-50/50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3D91]/20 focus:border-[#0B3D91] transition-all';
  const inputClass = `${inputBase} pl-11 pr-4`; // campos com ícone à esquerda
  const inputField = `${inputBase} px-4`; // campos sem ícone (endereço)

  // Atalhos (tabs-âncora) para as seções da página.
  const secoes = [
    { id: 'dados-pessoais', label: 'Dados pessoais' },
    { id: 'meu-endereco', label: 'Meu endereço' },
    { id: 'notificacoes', label: 'Notificações' },
    { id: 'seguranca', label: 'Segurança' },
  ];
  const [secaoAtiva, setSecaoAtiva] = useState(secoes[0].id);

  // Scroll-spy: destaca o atalho da seção visível.
  useEffect(() => {
    const alvos = secoes
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (alvos.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visivel = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visivel) setSecaoAtiva(visivel.target.id);
      },
      { rootMargin: '-96px 0px -55% 0px', threshold: 0 },
    );
    alvos.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function irParaSecao(id: string) {
    setSecaoAtiva(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Atalhos das seções (tabs-âncora) */}
      <nav
        aria-label="Seções da conta"
        className="sticky top-16 z-10 -mx-1 flex gap-1 overflow-x-auto rounded-2xl border border-slate-100 bg-white/90 p-1.5 shadow-sm backdrop-blur"
      >
        {secoes.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => irParaSecao(s.id)}
            aria-current={secaoAtiva === s.id ? 'true' : undefined}
            className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
              secaoAtiva === s.id
                ? 'bg-[#0B2447] text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* Cartão de identidade */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={name}
              width={64}
              height={64}
              className="h-16 w-16 rounded-2xl object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0B2447] text-xl font-bold text-white">
              {name.trim().charAt(0).toUpperCase() || 'B'}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-[#0B2447]">{name}</h2>
            <p className="truncate text-sm text-slate-500">{email}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Cliente desde{' '}
              {new Date(createdAt).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <span className="text-xs font-medium text-slate-400">Login vinculado:</span>
          {providers.map((p) => (
            <span
              key={p}
              className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
            >
              {PROVIDER_LABEL[p] ?? p}
            </span>
          ))}
        </div>
      </div>

      {/* Dados pessoais */}
      <form id="dados-pessoais" onSubmit={handleProfileSubmit} className="scroll-mt-32 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <h3 className="text-base font-bold text-[#0B2447]">Dados pessoais</h3>
        <p className="mt-0.5 text-sm text-slate-500">Atualize suas informações de contato.</p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="name" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#0B2447]">
              Nome completo
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={`${inputClass} border-slate-200`}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#0B2447]">
              E-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="email"
                value={email}
                disabled
                className={`${inputClass} cursor-not-allowed border-slate-200 text-slate-500`}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-400">O e-mail não pode ser alterado.</p>
          </div>

          <div>
            <label htmlFor="cpf" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#0B2447]">
              CPF
            </label>
            <div className="relative">
              <IdCard className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="cpf"
                type="text"
                inputMode="numeric"
                value={cpf}
                onChange={(e) => setCpf(maskCPF(e.target.value))}
                placeholder="000.000.000-00"
                className={`${inputClass} ${cpfInvalid ? 'border-red-300' : 'border-slate-200'}`}
              />
            </div>
            {cpfInvalid && <p className="mt-1.5 text-xs text-red-500">CPF inválido.</p>}
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#0B2447]">
              Celular
            </label>
            <PhoneInput onChange={setPhone} initialE164={initialPhone ?? undefined} disabled={savingProfile} />
          </div>

          <div>
            <label htmlFor="birthday" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#0B2447]">
              Data de nascimento <span className="font-normal normal-case text-slate-400">(opcional)</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="birthday"
                type="date"
                value={birthday}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setBirthday(e.target.value)}
                className={`${inputClass} ${birthdayInvalid ? 'border-red-300' : 'border-slate-200'}`}
              />
            </div>
            {birthdayInvalid && <p className="mt-1.5 text-xs text-red-500">Data de nascimento inválida.</p>}
          </div>
        </div>

        {profileMsg && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
              profileMsg.type === 'ok'
                ? 'bg-green-50 text-green-700'
                : 'border border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {profileMsg.type === 'ok' && <CheckCircle2 className="h-4 w-4" />}
            {profileMsg.text}
          </div>
        )}

        <button
          type="submit"
          disabled={savingProfile}
          className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-[#0B2447] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#0B2447]/20 transition-all hover:bg-[#0B3D91] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingProfile ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Salvar alterações'}
        </button>
      </form>

      {/* Meu endereço (opcional) */}
      <form id="meu-endereco" onSubmit={handleEnderecoSubmit} className="scroll-mt-32 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-[#0B3D91]" />
          <h3 className="text-base font-bold text-[#0B2447]">Meu endereço</h3>
        </div>
        <p className="mt-0.5 text-sm text-slate-500">
          Opcional. Informe o CEP para preencher automaticamente.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-6">
          {/* CEP */}
          <div className="sm:col-span-2">
            <label htmlFor="cep" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#0B2447]">
              CEP
            </label>
            <div className="relative">
              <input
                id="cep"
                type="text"
                inputMode="numeric"
                value={endereco.cep}
                onChange={(e) => handleCepChange(e.target.value)}
                placeholder="00000-000"
                className={`${inputBase} pl-4 border-slate-200 ${cepLoading ? "pr-10" : "pr-4"}`}
              />
              {cepLoading && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
              )}
            </div>
            {cepError && <p className="mt-1.5 text-xs text-amber-600">{cepError}</p>}
          </div>

          {/* Estado */}
          <div className="sm:col-span-2">
            <label htmlFor="estado" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#0B2447]">
              Estado
            </label>
            <select
              id="estado"
              value={endereco.estado_id}
              onChange={(e) => handleEstadoChange(e.target.value)}
              className={`${inputField} border-slate-200`}
            >
              <option value="">Selecione</option>
              {estados.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome} ({e.uf})
                </option>
              ))}
            </select>
          </div>

          {/* Município */}
          <div className="sm:col-span-2">
            <label htmlFor="municipio" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#0B2447]">
              Município
            </label>
            <select
              id="municipio"
              value={endereco.municipio_id}
              onChange={(e) => setEnd('municipio_id', e.target.value)}
              disabled={!endereco.estado_id || loadingMunicipios}
              className={`${inputField} border-slate-200 disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <option value="">{loadingMunicipios ? 'Carregando…' : 'Selecione'}</option>
              {municipios.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Bairro */}
          <div className="sm:col-span-3">
            <label htmlFor="bairro" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#0B2447]">
              Bairro
            </label>
            <input
              id="bairro"
              type="text"
              value={endereco.bairro}
              onChange={(e) => setEnd('bairro', e.target.value)}
              className={`${inputField} border-slate-200`}
            />
          </div>

          {/* Logradouro */}
          <div className="sm:col-span-3">
            <label htmlFor="logradouro" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#0B2447]">
              Logradouro
            </label>
            <input
              id="logradouro"
              type="text"
              value={endereco.logradouro}
              onChange={(e) => setEnd('logradouro', e.target.value)}
              placeholder="Rua, avenida…"
              className={`${inputField} border-slate-200`}
            />
          </div>

          {/* Número */}
          <div className="sm:col-span-2">
            <label htmlFor="numero" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#0B2447]">
              Número
            </label>
            <input
              id="numero"
              type="text"
              value={endereco.numero}
              onChange={(e) => setEnd('numero', e.target.value)}
              className={`${inputField} border-slate-200`}
            />
          </div>

          {/* Complemento */}
          <div className="sm:col-span-4">
            <label htmlFor="complemento" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#0B2447]">
              Complemento
            </label>
            <input
              id="complemento"
              type="text"
              value={endereco.complemento}
              onChange={(e) => setEnd('complemento', e.target.value)}
              placeholder="Apto, bloco, referência…"
              className={`${inputField} border-slate-200`}
            />
          </div>
        </div>

        {endMsg && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
              endMsg.type === 'ok'
                ? 'bg-green-50 text-green-700'
                : 'border border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {endMsg.type === 'ok' && <CheckCircle2 className="h-4 w-4" />}
            {endMsg.text}
          </div>
        )}

        <button
          type="submit"
          disabled={savingEndereco}
          className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-[#0B2447] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#0B2447]/20 transition-all hover:bg-[#0B3D91] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingEndereco ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Salvar endereço'}
        </button>
      </form>

      {/* Notificações */}
      <div id="notificacoes" className="scroll-mt-32 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-[#0B3D91]" />
          <h3 className="text-base font-bold text-[#0B2447]">Notificações</h3>
        </div>
        <p className="mt-0.5 text-sm text-slate-500">Escolha o que deseja receber por e-mail.</p>

        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700">
              Receber e-mail de notificação de novas conversas
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Avisamos por e-mail quando você tiver novas mensagens não lidas no chat.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notifConversas}
            aria-label="Receber e-mail de notificação de novas conversas"
            onClick={handleToggleNotifConversas}
            disabled={savingNotif}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
              notifConversas ? 'bg-[#0B3D91]' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                notifConversas ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Segurança / senha */}
      <div id="seguranca" className="scroll-mt-32 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#0B3D91]" />
          <h3 className="text-base font-bold text-[#0B2447]">Segurança</h3>
        </div>

        {canChangePassword ? (
          <>
            <p className="mt-0.5 text-sm text-slate-500">Altere a senha da sua conta.</p>
            <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="current" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#0B2447]">
                  Senha atual
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id="current"
                    type={showPw ? 'text' : 'password'}
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    required
                    className={`${inputBase} pl-11 pr-12 border-slate-200`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="nova" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#0B2447]">
                  Nova senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id="nova"
                    type={showPw ? 'text' : 'password'}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Crie uma senha segura"
                    minLength={8}
                    required
                    className={`${inputBase} pl-11 pr-12 border-slate-200`}
                  />
                </div>
                <PasswordRequirements password={novaSenha} />
              </div>

              <div>
                <label htmlFor="confirm" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#0B2447]">
                  Confirmar nova senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id="confirm"
                    type={showPw ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repita a nova senha"
                    minLength={8}
                    required
                    className={`${inputClass} border-slate-200`}
                  />
                </div>
              </div>

              {pwMsg && (
                <div
                  className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                    pwMsg.type === 'ok'
                      ? 'bg-green-50 text-green-700'
                      : 'border border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  {pwMsg.type === 'ok' && <CheckCircle2 className="h-4 w-4" />}
                  {pwMsg.text}
                </div>
              )}

              <button
                type="submit"
                disabled={savingPw}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#0B2447] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#0B2447]/20 transition-all hover:bg-[#0B3D91] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingPw ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Alterar senha'}
              </button>
            </form>
          </>
        ) : (
          <div className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p className="text-sm text-slate-500">
              Sua conta usa login social ({providers.map((p) => PROVIDER_LABEL[p] ?? p).join(', ')}), então
              não há senha para alterar aqui. Gerencie o acesso diretamente no seu provedor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
