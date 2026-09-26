'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FileText, ShieldCheck, X, ChevronDown, Loader2, AlertCircle, CheckCircle2, Lock,
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
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-900">Você leu e aceitou os termos</p>
            <p className="text-xs text-emerald-800/80 mt-0.5">
              {termo.titulo} · Versão {termo.versao} · Código {codigoVerificacao}
            </p>
          </div>
          <button
            type="button"
            onClick={abrir}
            disabled={disabled}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline underline-offset-2 shrink-0 disabled:opacity-50"
          >
            Ver termos
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#0B2447]/5 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-[#0B2447]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#0B2447]">{termo.titulo}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Leitura e aceite obrigatórios {finalidade}. Versão {termo.versao}, vigente desde {fmtData(termo.publicadoEm)}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={abrir}
            disabled={disabled}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl border-2 border-[#0B2447] text-[#0B2447] hover:bg-[#0B2447] hover:text-white font-semibold text-sm py-2.5 transition-colors disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            Ler e aceitar os termos
          </button>
        </div>
      )}

      {/* ── Modal do documento ───────────────────────────────────────── */}
      {aberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="termo-titulo">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !enviando && setAberto(false)} />

          <div className="relative flex flex-col bg-white w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
            {/* Cabeçalho formal */}
            <header className="bg-[#0B2447] text-white px-5 sm:px-8 pt-5 pb-4 shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200/90">
                    <ShieldCheck className="h-3.5 w-3.5" /> Boatzy · Documento para aceite
                  </p>
                  <h2 id="termo-titulo" className="mt-1.5 text-lg sm:text-xl font-bold leading-snug">{termo.titulo}</h2>
                  <p className="mt-1 text-[11px] text-slate-300">
                    Versão {termo.versao} · Vigente desde {fmtData(termo.publicadoEm)} · Código de verificação{' '}
                    <span className="font-mono">{codigoVerificacao}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  disabled={enviando}
                  aria-label="Fechar"
                  className="p-1.5 -mr-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition shrink-0"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            {/* Barra de progresso da leitura */}
            <div className="h-1 bg-slate-100 shrink-0" aria-hidden>
              <div
                className={`h-full transition-[width] duration-150 ${rolouAteFim ? 'bg-emerald-500' : 'bg-cyan-500'}`}
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

            {/* Rodapé de aceite */}
            <footer className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 sm:px-8 py-4 space-y-3">
              {!rolouAteFim ? (
                <button
                  type="button"
                  onClick={() => scrollRef.current?.scrollBy({ top: scrollRef.current.clientHeight * 0.85, behavior: 'smooth' })}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0B2447] py-1 transition"
                >
                  <ChevronDown className="h-4 w-4 animate-bounce" />
                  Leia o documento até o final para prosseguir ({Math.round(progresso * 100)}%)
                </button>
              ) : (
                <>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={concordo}
                      onChange={(e) => setConcordo(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0B2447] focus:ring-[#0B2447]/30 cursor-pointer"
                    />
                    <span className="text-sm text-slate-700">
                      Declaro que <strong>li integralmente</strong> e <strong>concordo</strong> com os termos acima.
                    </span>
                  </label>

                  {termo.confirmacao && (
                    <div>
                      <label htmlFor="termo-confirmacao" className="block text-xs font-medium text-slate-600 mb-1">
                        Para confirmar sua identidade, digite {termo.confirmacao.rotulo}:
                      </label>
                      <input
                        id="termo-confirmacao"
                        type="text"
                        autoComplete="off"
                        inputMode={termo.confirmacao.tipo === 'nome' ? 'text' : 'numeric'}
                        value={confirmacaoValor}
                        onChange={(e) => {
                          const tipo = termo.confirmacao!.tipo;
                          setConfirmacaoValor(tipo === 'nome' ? e.target.value : mascararDocumento(e.target.value, tipo));
                          setErro(null);
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); aceitar(); } }}
                        placeholder={
                          termo.confirmacao.tipo === 'cpf' ? '000.000.000-00'
                          : termo.confirmacao.tipo === 'cnpj' ? '00.000.000/0000-00'
                          : 'Nome completo'
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition"
                      />
                    </div>
                  )}
                </>
              )}

              {erro && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-red-600" role="alert">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {erro}
                </p>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 sm:justify-between">
                <p className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-400 sm:max-w-md">
                  <Lock className="h-3 w-3 shrink-0 mt-0.5" />
                  Como comprovante deste aceite eletrônico, registramos data, hora, IP, dispositivo e
                  localização, conforme nossa Política de Privacidade.
                </p>
                <button
                  type="button"
                  onClick={aceitar}
                  disabled={!podeAceitar || enviando}
                  className="shrink-0 flex items-center justify-center gap-2 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold px-6 py-2.5 transition shadow-md shadow-[#0B2447]/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Li e aceito
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
