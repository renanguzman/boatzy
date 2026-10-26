'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, User, ArrowRight, Loader2, Info, MailCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import SocialLoginButtons, { type OAuthProvider } from '@/components/auth/SocialLoginButtons';
import { COOKIE_DESTINO_PAINEL, destinoPainelSeguro } from '@/lib/painel-destino';
import { rastrear } from '@/lib/analytics';
import { aoAbrirAcesso, lembrarQueJaEntrou, type AbaAcesso } from '../_lib/acesso';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

const inputClass =
  'w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/60 text-sm text-grafite placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-marinho/15 focus:border-marinho focus:bg-white transition-all';
const labelClass = 'block text-xs font-bold text-marinho tracking-wider uppercase';

const TEXTOS: Record<AbaAcesso, { titulo: string; subtitulo: string; botao: string }> = {
  cadastro: {
    titulo: 'Anuncie sua lancha',
    subtitulo: 'Crie sua conta grátis em menos de um minuto.',
    botao: 'Criar conta grátis',
  },
  entrar: {
    titulo: 'Bem-vindo de volta',
    subtitulo: 'Acesse o painel da sua lancha.',
    botao: 'Entrar no painel',
  },
};

/** Guarda (10 min) a página pedida antes do login, para o setup-role voltar a ela. */
function lembrarDestino() {
  const destino = destinoPainelSeguro(new URLSearchParams(window.location.search).get('redirect_to'));
  document.cookie = destino
    ? `${COOKIE_DESTINO_PAINEL}=${encodeURIComponent(destino)}; path=/; max-age=600; samesite=lax`
    : `${COOKIE_DESTINO_PAINEL}=; path=/; max-age=0`;
}

type Props = {
  abaInicial: AbaAcesso;
  /** Sessão já aberta (cliente do site ou gestor aguardando aprovação): mostra "Continuar". */
  usuario: { nome: string; email: string } | null;
};

export default function AcessoGestorForm({ abaInicial, usuario }: Props) {
  const supabase = createClient();

  const [aba, setAba] = useState<AbaAcesso>(abaInicial);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState(false);

  // Os CTAs da página ("Criar minha conta", "Já tenho conta") trocam a aba daqui.
  useEffect(() => aoAbrirAcesso((nova) => {
    setAba(nova);
    setError('');
    setEmailEnviado(false);
  }), []);

  function trocarAba(nova: AbaAcesso) {
    setAba(nova);
    setError('');
    setEmailEnviado(false);
  }

  async function handleEntrar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(traduzirErroLogin(authError.message));
      setLoading(false);
      return;
    }

    rastrear('login', { method: 'email', perfil: 'gestor' });
    lembrarQueJaEntrou();
    // setup-role garante o registro no DB (o papel gestor vem da aprovação do admin).
    lembrarDestino();
    window.location.href = '/api/painel/setup-role';
  }

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        // Após confirmação do e-mail, redireciona para setup-role.
        emailRedirectTo: `${APP_URL}/painel/auth/callback`,
      },
    });

    if (authError) {
      setError(traduzirErroCadastro(authError.message));
      setLoading(false);
      return;
    }

    rastrear('sign_up', { method: 'email', perfil: 'gestor' });
    lembrarQueJaEntrou();
    setEmailEnviado(true);
    setLoading(false);
  }

  async function handleSocial(provider: OAuthProvider) {
    setError('');
    rastrear(aba === 'cadastro' ? 'sign_up' : 'login', { method: provider, perfil: 'gestor' });
    lembrarQueJaEntrou();
    lembrarDestino();

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${APP_URL}/painel/auth/callback` },
    });

    if (authError) {
      setError(aba === 'cadastro' ? traduzirErroCadastro(authError.message) : traduzirErroLogin(authError.message));
      throw authError; // sinaliza falha ao SocialLoginButtons para limpar o loading
    }
  }

  async function trocarDeConta() {
    await supabase.auth.signOut();
    window.location.assign('/painel/login?aba=entrar');
  }

  if (usuario) {
    const inicial = (usuario.nome || usuario.email).charAt(0).toUpperCase();
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-marinho to-turquesa text-xl font-bold text-white">
          {inicial}
        </div>
        <h2 className="text-xl font-bold text-marinho">Que bom te ver, {usuario.nome.split(' ')[0] || 'navegante'}</h2>
        <p className="mt-1 text-sm text-slate-500">
          Você está conectado como <strong className="text-grafite">{usuario.email}</strong>.
        </p>
        <a
          href="/painel"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-marinho py-3.5 text-sm font-semibold text-white shadow-lg shadow-marinho/20 transition-all hover:bg-marinho-escuro"
        >
          Continuar para o painel
          <ArrowRight className="h-4 w-4" />
        </a>
        <p className="mt-3 text-xs text-slate-500">
          No painel você conta sobre a sua lancha e a equipe Boatzy libera seu acesso.
        </p>
        <button type="button" onClick={trocarDeConta} className="mt-5 text-sm font-medium text-marinho hover:underline">
          Não é você? Entrar com outra conta
        </button>
      </div>
    );
  }

  if (emailEnviado) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-turquesa/10">
          <MailCheck className="h-8 w-8 text-turquesa-escuro" />
        </div>
        <h2 className="text-xl font-bold text-marinho">Confirme seu e-mail</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Enviamos um link para <strong className="text-grafite">{email}</strong>. Clique nele para ativar sua conta.
        </p>
        <ol className="mt-5 space-y-2 rounded-2xl bg-areia p-4 text-left text-sm text-grafite">
          <li><span className="font-semibold text-marinho">1.</span> Abra o link que enviamos</li>
          <li><span className="font-semibold text-marinho">2.</span> No painel, conte sobre você e sua lancha</li>
          <li><span className="font-semibold text-marinho">3.</span> A equipe Boatzy libera seu acesso</li>
        </ol>
        <button
          type="button"
          onClick={() => trocarAba('entrar')}
          className="mt-5 text-sm font-medium text-marinho hover:underline"
        >
          Já confirmei, quero entrar
        </button>
      </div>
    );
  }

  const textos = TEXTOS[aba];

  return (
    <div>
      {/* Abas */}
      <div role="tablist" aria-label="Acesso ao painel" className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
        {(['cadastro', 'entrar'] as const).map((opcao) => (
          <button
            key={opcao}
            type="button"
            role="tab"
            aria-selected={aba === opcao}
            onClick={() => trocarAba(opcao)}
            className={`rounded-lg py-2 text-sm font-semibold transition-all ${
              aba === opcao ? 'bg-white text-marinho shadow-sm' : 'text-slate-500 hover:text-marinho'
            }`}
          >
            {opcao === 'cadastro' ? 'Criar conta' : 'Já tenho conta'}
          </button>
        ))}
      </div>

      <h2 className="text-2xl font-bold text-marinho">{textos.titulo}</h2>
      <p className="mt-1 mb-5 text-sm text-slate-500">{textos.subtitulo}</p>

      <SocialLoginButtons onProvider={handleSocial} disabled={loading} compacto />

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium text-slate-400">ou com e-mail</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={aba === 'cadastro' ? handleCadastro : handleEntrar} className="space-y-4">
        {aba === 'cadastro' && (
          <div>
            <label htmlFor="acesso-nome" className={`${labelClass} mb-1.5`}>Nome completo</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="acesso-nome"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="João Silva"
                required
                className={inputClass}
              />
            </div>
          </div>
        )}

        <div>
          <label htmlFor="acesso-email" className={`${labelClass} mb-1.5`}>E-mail</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="acesso-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              required
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="acesso-senha" className={labelClass}>Senha</label>
            {aba === 'entrar' && (
              <Link href="/painel/recuperar-senha" className="text-xs font-medium text-turquesa-escuro hover:text-marinho transition-colors">
                Esqueceu a senha?
              </Link>
            )}
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="acesso-senha"
              type={showPassword ? 'text' : 'password'}
              autoComplete={aba === 'cadastro' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={aba === 'cadastro' ? 'Mínimo 6 caracteres' : '••••••••'}
              minLength={aba === 'cadastro' ? 6 : undefined}
              required
              className={`${inputClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-marinho py-3.5 text-sm font-semibold text-white shadow-lg shadow-marinho/20 transition-all duration-200 hover:bg-marinho-escuro hover:shadow-marinho/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <>
              {textos.botao}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      {aba === 'cadastro' && (
        <p className="mt-4 flex gap-2 text-xs leading-relaxed text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-turquesa-escuro" />
          Depois de criar a conta, você conta sobre a sua lancha e a equipe Boatzy libera seu painel.
        </p>
      )}
    </div>
  );
}

function traduzirErroLogin(message: string): string {
  if (message.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (message.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (message.includes('Too many requests')) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (message.includes('User not found')) return 'Usuário não encontrado.';
  return 'Erro ao autenticar. Tente novamente.';
}

function traduzirErroCadastro(message: string): string {
  if (message.includes('User already registered')) return 'Este e-mail já possui uma conta. Use a aba "Já tenho conta".';
  if (message.includes('Password should be at least')) return 'A senha deve ter pelo menos 6 caracteres.';
  if (message.includes('Unable to validate email')) return 'E-mail inválido.';
  if (message.includes('Too many requests')) return 'Muitas tentativas. Aguarde alguns minutos.';
  return 'Erro ao criar conta. Tente novamente.';
}
