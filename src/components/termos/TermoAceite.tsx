'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FileText, ShieldCheck, X, ChevronDown, Loader2, AlertCircle, CheckCircle2, Lock, Check, Fingerprint,
} from 'lucide-react';
import TermoMarkdown from './TermoMarkdown';
import { conferirConfirmacaoDigitada } from '@/lib/termos/actions';
import { coletarAmbienteNavegador, solicitarGeolocalizacao } from '@/lib/termos/evidencias-cliente';
import type { AceiteTermoCliente, GeoGps, TermoParaAceite } from '@/lib/termos/tipos';

type Props = {
  termo: TermoParaAceite;
  /** Aceite atual (null = ainda não aceito). Controlado pelo componente pai. */
  aceite: AceiteTermoCliente | null;
  onAceitar: (aceite: AceiteTermoCliente) => void;
  /** Frase curta de contexto no bloco, ex.: "para enviar sua solicitação de reserva". */
  finalidade: string;
  disabled?: boolean;
};

function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo',
  });
}

/** Máscara de exibição para CPF/CNPJ enquanto o usuário digita. */
function mascararDocumento(v: string, tipo: 'cpf' | 'cnpj'): string {
  const d = v.replace(/\D/g, '').slice(0, tipo === 'cpf' ? 11 : 14);
  if (tipo === 'cpf') {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/** Valor digitado já tem o tamanho esperado (o conteúdo é conferido no servidor). */
function confirmacaoCompleta(valor: string, tipo: 'cpf' | 'cnpj' | 'nome'): boolean {
  if (tipo === 'nome') return valor.trim().split(/\s+/).length >= 2;
  return valor.replace(/\D/g, '').length === (tipo === 'cpf' ? 11 : 14);
}

/**
 * Bloco de aceite de um termo de uso: resumo + modal com o documento completo.
 * O modal exige (conforme o termo) leitura até o fim e confirmação digitada,
 * e coleta as evidências de navegador. O registro definitivo é feito no
 * servidor, junto com a ação (ver validarAceite/gravarAceite).
 *
 * Use com `key={termo.id}`: uma nova versão do termo remonta o componente e zera a leitura.
 */
export default function TermoAceite({ termo, aceite, onAceitar, finalidade, disabled }: Props) {
  const [aberto, setAberto] = useState(false);

  // Evidências de leitura — preservadas entre aberturas do modal.
  const abertoEmRef = useRef<string | null>(null);
  const geoRef = useRef<Promise<GeoGps> | null>(null);
  const [rolouAteFim, setRolouAteFim] = useState(!termo.exigeRolagemCompleta);
  const [progresso, setProgresso] = useState(0);

  const [concordo, setConcordo] = useState(false);
  const [confirmacaoValor, setConfirmacaoValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const medirLeitura = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const rolavel = el.scrollHeight - el.clientHeight;
    const p = rolavel <= 4 ? 1 : Math.min(1, el.scrollTop / rolavel);
    setProgresso((atual) => Math.max(atual, p));
    if (p >= 0.98) setRolouAteFim(true);
  }, []);

  function abrir() {
    if (disabled) return;
    abertoEmRef.current ??= new Date().toISOString();
    // Localização pedida em segundo plano ao abrir — pronta (ou recusada) até o aceite.
    geoRef.current ??= solicitarGeolocalizacao();
    setErro(null);
    setAberto(true);
  }

  // Trava a rolagem da página, fecha com ESC e mede a leitura ao abrir/redimensionar.
  useEffect(() => {
    if (!aberto) return;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !enviando) setAberto(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', medirLeitura);
    const t = setTimeout(medirLeitura, 50);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', medirLeitura);
      clearTimeout(t);
    };
  }, [aberto, enviando, medirLeitura]);

  const exigeConfirmacao = !!termo.confirmacao;
  const podeAceitar = rolouAteFim && concordo && (!exigeConfirmacao || confirmacaoValor.trim().length > 0);

  async function aceitar() {
    if (!podeAceitar || enviando) return;
    setErro(null);
    setEnviando(true);

    if (exigeConfirmacao) {
      const conferido = await conferirConfirmacaoDigitada(confirmacaoValor);
      if (!conferido.ok) {
        setErro(conferido.error ?? 'A confirmação não confere.');
        setEnviando(false);
        return;
      }
    }

    const geo = await (geoRef.current ?? Promise.resolve<GeoGps>({ status: 'nao_solicitada' }));
    onAceitar({
      termoId: termo.id,
      evidencias: {
        ...coletarAmbienteNavegador(),
        geo,
        confirmacaoValor: exigeConfirmacao ? confirmacaoValor : null,
        termoAbertoEm: abertoEmRef.current,
        rolouAteFim,
      },
    });
    setEnviando(false);
    setAberto(false);
  }

  const codigoVerificacao = termo.conteudoHash.slice(0, 12).toUpperCase();

  return (
    <>
      {/* ── Bloco resumo ─────────────────────────────────────────────── */}
      {aceite ? (
        <div className="rounded-2xl border border-turquesa/40 bg-turquesa/10 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-turquesa-escuro shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-marinho">Você leu e aceitou os termos</p>
            <p className="text-xs text-marinho/80 mt-0.5">
              {termo.titulo} · Versão {termo.versao} · Código {codigoVerificacao}
            </p>
          </div>
          <button
            type="button"
            onClick={abrir}
            disabled={disabled}
            className="text-xs font-semibold text-turquesa-escuro hover:text-marinho underline underline-offset-2 shrink-0 disabled:opacity-50"
          >
            Ver termos
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-marinho/5 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-marinho" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-marinho">{termo.titulo}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Leitura e aceite obrigatórios {finalidade}. Versão {termo.versao}, vigente desde {fmtData(termo.publicadoEm)}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={abrir}
            disabled={disabled}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl border-2 border-marinho text-marinho hover:bg-marinho hover:text-white font-semibold text-sm py-2.5 transition-colors disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            Ler e aceitar os termos
          </button>
        </div>
      )}

      {/* ── Modal do documento ───────────────────────────────────────── */}
      {aberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="termo-titulo">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !enviando && setAberto(false)} />

          <div className="relative flex flex-col bg-white w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
            {/* Cabeçalho claro: título em destaque e metadados em pílulas */}
            <header className="shrink-0 border-b border-slate-100 px-5 sm:px-8 pt-5 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-turquesa-escuro">
                    <ShieldCheck className="h-3.5 w-3.5" /> Documento para aceite
                  </p>
                  <h2 id="termo-titulo" className="mt-1 text-lg sm:text-xl font-bold leading-snug text-marinho">{termo.titulo}</h2>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5">Versão {termo.versao}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5">Vigente desde {fmtData(termo.publicadoEm)}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5">Código <span className="font-mono">{codigoVerificacao}</span></span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  disabled={enviando}
                  aria-label="Fechar"
                  className="p-2 -mr-2 rounded-full text-slate-400 hover:text-marinho hover:bg-slate-100 transition shrink-0"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            {/* Barra de progresso da leitura */}
            <div className="h-1 bg-slate-100 shrink-0" aria-hidden>
              <div
                className={`h-full transition-[width] duration-150 ${rolouAteFim ? 'bg-turquesa-escuro' : 'bg-turquesa'}`}
                style={{ width: `${Math.round((rolouAteFim ? 1 : progresso) * 100)}%` }}
              />
            </div>

            {/* Texto */}
            <div
              ref={scrollRef}
              onScroll={medirLeitura}
              className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-10 py-6 sm:py-8 bg-white"
            >
              <TermoMarkdown conteudo={termo.conteudo} />
              <p className="mt-8 pt-4 border-t border-slate-200 text-center text-[11px] text-slate-400">
                — Fim do documento · Versão {termo.versao} · {codigoVerificacao} —
              </p>
            </div>

            {/* Rodapé de aceite: passos numerados, cada um com o próprio estado */}
            <footer className="shrink-0 border-t border-slate-100 bg-white px-5 sm:px-8 pt-4 pb-5 shadow-[0_-12px_24px_-20px_rgb(14_47_79/0.35)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-marinho">Para concluir o aceite</p>

              {/* ① Leitura */}
              <div className="mt-2.5 flex items-center gap-2.5">
                <Passo numero={1} feito={rolouAteFim} />
                {rolouAteFim ? (
                  <p className="text-sm text-slate-600">Documento lido até o final.</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => scrollRef.current?.scrollBy({ top: scrollRef.current.clientHeight * 0.85, behavior: 'smooth' })}
                    className="flex items-center gap-1.5 text-sm font-semibold text-marinho hover:text-turquesa-escuro transition"
                  >
                    Leia o documento até o final ({Math.round(progresso * 100)}%)
                    <ChevronDown className="h-4 w-4 animate-bounce" />
                  </button>
                )}
              </div>

              {/* Celular: enquanto lê, só o passo 1 (sobra espaço para o texto) e um aviso do que vem depois */}
              {!rolouAteFim && (
                <p className="mt-1.5 pl-[34px] text-xs text-slate-500 sm:hidden">
                  Depois: declarar que concorda{termo.confirmacao ? ` e confirmar ${termo.confirmacao.rotulo}` : ''}.
                </p>
              )}

              <div className={`mt-3 gap-3 ${termo.confirmacao ? 'sm:grid-cols-2' : ''} ${rolouAteFim ? 'grid' : 'hidden sm:grid opacity-50 pointer-events-none select-none'}`}
                aria-disabled={!rolouAteFim}>
                {/* ② Declaração — o cartão inteiro é clicável */}
                <label className={`flex items-start gap-3 rounded-2xl border-2 p-3.5 cursor-pointer transition-colors ${
                  concordo ? 'border-turquesa bg-turquesa/[0.06]' : 'border-slate-200 hover:border-marinho/30'
                }`}>
                  <Passo numero={2} feito={concordo} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-marinho">Declare que leu e concorda</span>
                    <span className="mt-1 flex items-start gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={concordo}
                        disabled={!rolouAteFim}
                        onChange={(e) => setConcordo(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-marinho focus:ring-marinho/30 cursor-pointer"
                      />
                      <span>Li <strong>integralmente</strong> e <strong>concordo</strong> com os termos acima.</span>
                    </span>
                  </span>
                </label>

                {/* ③ Identidade — instrução em destaque, valor completo a digitar (do cadastro) e estado de completo */}
                {termo.confirmacao && (() => {
                  const tipo = termo.confirmacao.tipo;
                  const completo = confirmacaoCompleta(confirmacaoValor, tipo);
                  return (
                    <div className={`rounded-2xl border-2 p-3.5 transition-colors ${
                      completo ? 'border-turquesa bg-turquesa/[0.06]' : 'border-marinho/25 bg-marinho/[0.02]'
                    }`}>
                      <div className="flex items-start gap-3">
                        <Passo numero={3} feito={completo} />
                        <div className="min-w-0 flex-1">
                          <label htmlFor="termo-confirmacao" className="block text-sm font-semibold text-marinho">
                            {tipo === 'cpf' ? 'Digite seu CPF completo' : tipo === 'cnpj' ? 'Digite o CNPJ completo' : 'Digite seu nome completo'}
                          </label>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Para confirmar que é você, digite{tipo === 'nome' ? ' como está no cadastro' : ''}:{' '}
                            <span className={`inline-block rounded-md bg-destaque/30 px-1.5 py-px font-semibold text-marinho ${tipo === 'nome' ? '' : 'font-mono'}`}>
                              {termo.confirmacao.dica}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="relative mt-2.5">
                        <Fingerprint className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          id="termo-confirmacao"
                          type="text"
                          autoComplete="off"
                          disabled={!rolouAteFim}
                          inputMode={tipo === 'nome' ? 'text' : 'numeric'}
                          value={confirmacaoValor}
                          onChange={(e) => {
                            setConfirmacaoValor(tipo === 'nome' ? e.target.value : mascararDocumento(e.target.value, tipo));
                            setErro(null);
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); aceitar(); } }}
                          placeholder={tipo === 'cpf' ? '000.000.000-00' : tipo === 'cnpj' ? '00.000.000/0000-00' : 'Nome completo'}
                          className={`w-full rounded-xl border bg-white pl-10 pr-10 py-3 text-base font-medium tracking-wide text-grafite placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-300 focus:outline-none focus:ring-2 transition ${
                            erro ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-marinho/20 focus:border-marinho/50'
                          }`}
                        />
                        {completo && (
                          <CheckCircle2 className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-turquesa-escuro" />
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {erro && (
                <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-red-600" role="alert">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {erro}
                </p>
              )}

              <div className="mt-4 flex flex-col-reverse sm:flex-row sm:items-center gap-3 sm:justify-between">
                <p className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-400 sm:max-w-sm">
                  <Lock className="h-3 w-3 shrink-0 mt-0.5" />
                  Como comprovante deste aceite eletrônico, registramos data, hora, IP, dispositivo e
                  localização, conforme nossa Política de Privacidade.
                </p>
                {/* O botão diz o que falta enquanto não dá para aceitar */}
                <button
                  type="button"
                  onClick={aceitar}
                  disabled={!podeAceitar || enviando}
                  className="shrink-0 flex items-center justify-center gap-2 rounded-xl bg-marinho hover:bg-marinho-escuro text-white text-sm font-semibold px-6 py-3 transition shadow-md shadow-marinho/15 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {enviando ? 'Confirmando…'
                    : !rolouAteFim ? 'Leia até o fim'
                    : !concordo ? 'Marque a declaração'
                    : termo.confirmacao && !confirmacaoValor.trim() ? `Digite ${termo.confirmacao.rotulo}`
                    : 'Li e aceito'}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

/** Número do passo no rodapé do aceite; vira um check quando concluído. */
function Passo({ numero, feito }: { numero: number; feito: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
        feito ? 'bg-turquesa-escuro text-white' : 'bg-marinho/10 text-marinho'
      }`}
    >
      {feito ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : numero}
    </span>
  );
}
