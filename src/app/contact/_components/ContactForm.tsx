'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, Send } from 'lucide-react';
import { enviarContato, novoDesafioCaptcha } from '../actions';
import { ASSUNTOS_CONTATO } from '../constants';
import type { DesafioCaptcha } from '@/lib/contato-captcha';

const inputClass =
  'w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3D91]/20 focus:border-[#0B3D91] transition-all';

const labelClass = 'block text-xs font-bold text-[#0B2447] tracking-wider uppercase mb-2';

export default function ContactForm({ desafioInicial }: { desafioInicial: DesafioCaptcha }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [empresa, setEmpresa] = useState(''); // honeypot — deve ficar vazio
  const [captchaResposta, setCaptchaResposta] = useState('');
  const [desafio, setDesafio] = useState(desafioInicial);

  const [loading, setLoading] = useState(false);
  const [refreshingCaptcha, setRefreshingCaptcha] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function trocarDesafio() {
    setRefreshingCaptcha(true);
    try {
      const novo = await novoDesafioCaptcha();
      setDesafio(novo);
      setCaptchaResposta('');
    } finally {
      setRefreshingCaptcha(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await enviarContato({
      nome,
      email,
      assunto,
      mensagem,
      empresa,
      captchaA: desafio.a,
      captchaB: desafio.b,
      captchaToken: desafio.token,
      captchaResposta,
    });

    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      // Desafio pode ter expirado/errado — gera um novo para a próxima tentativa.
      await trocarDesafio();
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-[#0B2447] mb-2">Mensagem enviada!</h2>
        <p className="text-slate-500 text-sm">
          Obrigado por entrar em contato, {nome.split(' ')[0]}. Nossa equipe vai responder em breve
          no e-mail informado.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="text-lg font-bold text-[#0B2447]">Envie sua mensagem</h2>

      {/* Honeypot — invisível para humanos, campo-armadilha para bots */}
      <input
        type="text"
        name="empresa"
        value={empresa}
        onChange={(e) => setEmpresa(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="nome" className={labelClass}>Nome</label>
          <input
            id="nome"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>E-mail</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            required
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="assunto" className={labelClass}>Assunto</label>
        <select
          id="assunto"
          value={assunto}
          onChange={(e) => setAssunto(e.target.value)}
          required
          className={inputClass}
        >
          <option value="" disabled>
            Selecione um assunto
          </option>
          {ASSUNTOS_CONTATO.map((opcao) => (
            <option key={opcao} value={opcao}>
              {opcao}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="mensagem" className={labelClass}>Mensagem</label>
        <textarea
          id="mensagem"
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          placeholder="Conte com detalhes o que você precisa..."
          required
          minLength={10}
          rows={5}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Verificador humano: soma simples */}
      <div>
        <label htmlFor="captcha" className={labelClass}>
          Verificação: quanto é {desafio.a} + {desafio.b}?
        </label>
        <div className="flex items-center gap-2">
          <input
            id="captcha"
            type="number"
            inputMode="numeric"
            value={captchaResposta}
            onChange={(e) => setCaptchaResposta(e.target.value)}
            placeholder="Resposta"
            required
            className={`${inputClass} max-w-[140px]`}
          />
          <button
            type="button"
            onClick={trocarDesafio}
            disabled={refreshingCaptcha}
            aria-label="Gerar nova conta"
            className="h-11 w-11 flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-[#0B3D91] hover:border-[#0B3D91] transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshingCaptcha ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-[#0B3D91] hover:bg-[#092E6E] text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            Enviar mensagem
            <Send className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}
