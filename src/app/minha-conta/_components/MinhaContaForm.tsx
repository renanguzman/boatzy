'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
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
import { hojeISO } from '@/lib/datas';
import { useFormatos } from '@/i18n/formatos';
import SecaoIdioma from './SecaoIdioma';

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

// Nomes de marca; "email" (conta por senha) vem das mensagens.
const PROVIDER_LABEL: Record<string, string> = {
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
  const t = useTranslations('MinhaConta');
  const tAuth = useTranslations('Auth');
  const tRedefinir = useTranslations('RedefinirSenha');
  const f = useFormatos();
  const tComum = useTranslations('Comum');
  const rotuloProvedor = (p: string) => (p === 'email' ? t('provedorEmail') : PROVIDER_LABEL[p] ?? p);

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
        setCepError(t('endereco.cepNaoEncontrado'));
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
      setCepError(t('endereco.cepErro'));
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
      setEndMsg({ type: 'ok', text: t('endereco.atualizado') });
    } else {
      setEndMsg({
        type: 'erro',
        text: res.error === 'nao_autenticado' ? t('dados.sessao') : t('dados.naoFoiPossivelSalvar'),
      });
    }
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);

    if (name.trim().length < 2) {
      setProfileMsg({ type: 'erro', text: t('dados.informeNome') });
      return;
    }
    if (cpf && !isValidCPF(cpf)) {
      setProfileMsg({ type: 'erro', text: tAuth('cpfInvalido') });
      return;
    }
    if (phone.e164 && !phone.valid) {
      setProfileMsg({ type: 'erro', text: t('dados.celularInvalido') });
      return;
    }
    if (birthday && !isValidBirthday(birthday)) {
      setProfileMsg({ type: 'erro', text: t('dados.nascimentoInvalido') });
      return;
    }

    setSavingProfile(true);
    const res = await atualizarPerfil({ name, cpf, phone: phone.e164, birthday });
    setSavingProfile(false);

    if (res.ok) {
      setProfileMsg({ type: 'ok', text: t('dados.atualizados') });
    } else {
      const map: Record<string, string> = {
        nao_autenticado: t('dados.sessao'),
        nome_invalido: t('dados.informeNome'),
        cpf_invalido: tAuth('cpfInvalido'),
        nascimento_invalido: t('dados.nascimentoInvalido'),
        erro: t('dados.naoFoiPossivelSalvar'),
      };
      setProfileMsg({ type: 'erro', text: map[res.error] ?? map.erro });
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);

    if (!isStrongPassword(novaSenha)) {
      setPwMsg({ type: 'erro', text: t('seguranca.requisitos') });
      return;
    }
    if (novaSenha !== confirm) {
      setPwMsg({ type: 'erro', text: tRedefinir('naoCoincidem') });
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
      setPwMsg({ type: 'erro', text: t('seguranca.atualIncorreta') });
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: novaSenha });
    setSavingPw(false);

    if (updateError) {
      if (updateError.message.includes('different from the old password')) {
        setPwMsg({ type: 'erro', text: tRedefinir('erros.diferente') });
      } else {
        setPwMsg({ type: 'erro', text: t('seguranca.falha') });
      }
      return;
    }

    setCurrent('');
    setNovaSenha('');
    setConfirm('');
    setPwMsg({ type: 'ok', text: t('seguranca.sucesso') });
  }

  const inputBase =
    'w-full py-3.5 rounded-xl border bg-slate-50/50 text-sm text-grafite placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-marinho/20 focus:border-marinho transition-all';
  const inputClass = `${inputBase} pl-11 pr-4`; // campos com ícone à esquerda
  const inputField = `${inputBase} px-4`; // campos sem ícone (endereço)

  // Atalhos (tabs-âncora) para as seções da página.
  const secoes = [
    { id: 'dados-pessoais', label: t('secoes.dadosPessoais') },
    { id: 'meu-endereco', label: t('secoes.endereco') },
    { id: 'notificacoes', label: t('secoes.notificacoes') },
    { id: 'idioma', label: t('secoes.idioma') },
    { id: 'seguranca', label: t('secoes.seguranca') },
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
        aria-label={t('secoes.rotulo')}
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
                ? 'bg-marinho text-white shadow-sm'
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
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-marinho text-xl font-bold text-white">
              {name.trim().charAt(0).toUpperCase() || 'B'}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-marinho">{name}</h2>
            <p className="truncate text-sm text-slate-500">{email}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {t('clienteDesde', { data: f.data(createdAt, { day: '2-digit', month: 'long', year: 'numeric' }) })}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <span className="text-xs font-medium text-slate-400">{t('loginVinculado')}</span>
          {providers.map((p) => (
            <span
              key={p}
              className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
            >
              {rotuloProvedor(p)}
            </span>
          ))}
        </div>
      </div>

      {/* Dados pessoais */}
      <form id="dados-pessoais" onSubmit={handleProfileSubmit} className="scroll-mt-32 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <h3 className="text-base font-bold text-marinho">{t('secoes.dadosPessoais')}</h3>
        <p className="mt-0.5 text-sm text-slate-500">{t('dados.subtitulo')}</p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="name" className="mb-2 block text-xs font-bold uppercase tracking-wider text-marinho">
              {tAuth('nome')}
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
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-marinho">
              {tAuth('email')}
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
            <p className="mt-1.5 text-xs text-slate-400">{t('dados.emailFixo')}</p>
          </div>

          <div>
            <label htmlFor="cpf" className="mb-2 block text-xs font-bold uppercase tracking-wider text-marinho">
              {tAuth('cpf')}
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
            {cpfInvalid && <p className="mt-1.5 text-xs text-red-500">{tAuth('cpfInvalido')}</p>}
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-marinho">
              {tAuth('celular')}
            </label>
            <PhoneInput onChange={setPhone} initialE164={initialPhone ?? undefined} disabled={savingProfile} />
          </div>

          <div>
            <label htmlFor="birthday" className="mb-2 block text-xs font-bold uppercase tracking-wider text-marinho">
              {t('dados.nascimento')} <span className="font-normal normal-case text-slate-400">{t('dados.opcional')}</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="birthday"
                type="date"
                value={birthday}
                max={hojeISO()}
                onChange={(e) => setBirthday(e.target.value)}
                className={`${inputClass} ${birthdayInvalid ? 'border-red-300' : 'border-slate-200'}`}
              />
            </div>
            {birthdayInvalid && <p className="mt-1.5 text-xs text-red-500">{t('dados.nascimentoInvalido')}</p>}
          </div>
        </div>

        {profileMsg && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
              profileMsg.type === 'ok'
                ? 'bg-turquesa/10 text-turquesa-escuro'
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
          className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-marinho px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-marinho/20 transition-all hover:bg-marinho-escuro disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingProfile ? <Loader2 className="h-5 w-5 animate-spin" /> : t('dados.salvar')}
        </button>
      </form>

      {/* Meu endereço (opcional) */}
      <form id="meu-endereco" onSubmit={handleEnderecoSubmit} className="scroll-mt-32 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-marinho" />
          <h3 className="text-base font-bold text-marinho">{t('secoes.endereco')}</h3>
        </div>
        <p className="mt-0.5 text-sm text-slate-500">
          {t('endereco.subtitulo')}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-6">
          {/* CEP */}
          <div className="sm:col-span-2">
            <label htmlFor="cep" className="mb-2 block text-xs font-bold uppercase tracking-wider text-marinho">
              {t('endereco.cep')}
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
            <label htmlFor="estado" className="mb-2 block text-xs font-bold uppercase tracking-wider text-marinho">
              {t('endereco.estado')}
            </label>
            <select
              id="estado"
              value={endereco.estado_id}
              onChange={(e) => handleEstadoChange(e.target.value)}
              className={`${inputField} border-slate-200`}
            >
              <option value="">{t('endereco.selecione')}</option>
              {estados.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome} ({e.uf})
                </option>
              ))}
            </select>
          </div>

          {/* Município */}
          <div className="sm:col-span-2">
            <label htmlFor="municipio" className="mb-2 block text-xs font-bold uppercase tracking-wider text-marinho">
              {t('endereco.municipio')}
            </label>
            <select
              id="municipio"
              value={endereco.municipio_id}
              onChange={(e) => setEnd('municipio_id', e.target.value)}
              disabled={!endereco.estado_id || loadingMunicipios}
              className={`${inputField} border-slate-200 disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <option value="">{loadingMunicipios ? tComum('carregando') : t('endereco.selecione')}</option>
              {municipios.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Bairro */}
          <div className="sm:col-span-3">
            <label htmlFor="bairro" className="mb-2 block text-xs font-bold uppercase tracking-wider text-marinho">
              {t('endereco.bairro')}
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
            <label htmlFor="logradouro" className="mb-2 block text-xs font-bold uppercase tracking-wider text-marinho">
              {t('endereco.logradouro')}
            </label>
            <input
              id="logradouro"
              type="text"
              value={endereco.logradouro}
              onChange={(e) => setEnd('logradouro', e.target.value)}
              placeholder={t('endereco.logradouroPlaceholder')}
              className={`${inputField} border-slate-200`}
            />
          </div>

          {/* Número */}
          <div className="sm:col-span-2">
            <label htmlFor="numero" className="mb-2 block text-xs font-bold uppercase tracking-wider text-marinho">
              {t('endereco.numero')}
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
            <label htmlFor="complemento" className="mb-2 block text-xs font-bold uppercase tracking-wider text-marinho">
              {t('endereco.complemento')}
            </label>
            <input
              id="complemento"
              type="text"
              value={endereco.complemento}
              onChange={(e) => setEnd('complemento', e.target.value)}
              placeholder={t('endereco.complementoPlaceholder')}
              className={`${inputField} border-slate-200`}
            />
          </div>
        </div>

        {endMsg && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
              endMsg.type === 'ok'
                ? 'bg-turquesa/10 text-turquesa-escuro'
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
          className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-marinho px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-marinho/20 transition-all hover:bg-marinho-escuro disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingEndereco ? <Loader2 className="h-5 w-5 animate-spin" /> : t('endereco.salvar')}
        </button>
      </form>

      {/* Notificações */}
      <div id="notificacoes" className="scroll-mt-32 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-marinho" />
          <h3 className="text-base font-bold text-marinho">{t('secoes.notificacoes')}</h3>
        </div>
        <p className="mt-0.5 text-sm text-slate-500">{t('notificacoes.subtitulo')}</p>

        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700">
              {t('notificacoes.conversas')}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {t('notificacoes.conversasAjuda')}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notifConversas}
            aria-label={t('notificacoes.conversas')}
            onClick={handleToggleNotifConversas}
            disabled={savingNotif}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
              notifConversas ? 'bg-marinho' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                notifConversas ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        <p className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
          {t.rich('notificacoes.sempre', {
            link: (texto) => <a href="/notificacoes" className="font-semibold text-marinho hover:underline">{texto}</a>,
          })}
        </p>
      </div>

      <SecaoIdioma />

      {/* Segurança / senha */}
      <div id="seguranca" className="scroll-mt-32 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-marinho" />
          <h3 className="text-base font-bold text-marinho">{t('secoes.seguranca')}</h3>
        </div>

        {canChangePassword ? (
          <>
            <p className="mt-0.5 text-sm text-slate-500">{t('seguranca.subtitulo')}</p>
            <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="current" className="mb-2 block text-xs font-bold uppercase tracking-wider text-marinho">
                  {t('seguranca.senhaAtual')}
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
                    aria-label={showPw ? tAuth('ocultarSenha') : tAuth('mostrarSenha')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="nova" className="mb-2 block text-xs font-bold uppercase tracking-wider text-marinho">
                  {tRedefinir('novaSenha')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id="nova"
                    type={showPw ? 'text' : 'password'}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder={tAuth('senhaPlaceholderCriar')}
                    minLength={8}
                    required
                    className={`${inputBase} pl-11 pr-12 border-slate-200`}
                  />
                </div>
                <PasswordRequirements password={novaSenha} />
              </div>

              <div>
                <label htmlFor="confirm" className="mb-2 block text-xs font-bold uppercase tracking-wider text-marinho">
                  {tRedefinir('confirmar')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id="confirm"
                    type={showPw ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder={tRedefinir('repita')}
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
                      ? 'bg-turquesa/10 text-turquesa-escuro'
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
                className="flex items-center justify-center gap-2 rounded-xl bg-marinho px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-marinho/20 transition-all hover:bg-marinho-escuro disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingPw ? <Loader2 className="h-5 w-5 animate-spin" /> : t('seguranca.alterar')}
              </button>
            </form>
          </>
        ) : (
          <div className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p className="text-sm text-slate-500">
              {t('seguranca.social', { provedores: providers.map(rotuloProvedor).join(', ') })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
