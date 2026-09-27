'use client';

import { useEffect, useRef, useState } from 'react';
import { Eye, Loader2, Monitor, Smartphone, X } from 'lucide-react';
import {
  PREVIEW_DADOS, PREVIEW_PRONTO,
  type PreviewDados, type PreviewMensagem,
} from './mensagens';

type Dispositivo = 'computador' | 'celular';

type Props = {
  aberto: boolean;
  onFechar: () => void;
  tipo: PreviewDados['tipo'];
  /** Dados atuais do formulário; null enquanto ainda estão sendo montados. */
  dados: PreviewDados | null;
};

/**
 * Pré-visualização da publicação no painel. Abre `/painel/preview/<tipo>`
 * num iframe (mesma origem) e entrega os dados do formulário por
 * `postMessage`. O iframe tem a largura do dispositivo simulado, então os
 * breakpoints do site valem de verdade (o layout de celular é o real).
 */
export default function PreviewPublicacaoModal({ aberto, onFechar, tipo, dados }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [pronto, setPronto] = useState(false);
  const [dispositivo, setDispositivo] = useState<Dispositivo>(() =>
    typeof window !== 'undefined' && window.innerWidth < 1024 ? 'celular' : 'computador',
  );

  // O iframe avisa quando está pronto para receber os dados.
  useEffect(() => {
    if (!aberto) return;
    function onMessage(e: MessageEvent<PreviewMensagem>) {
      if (e.origin !== window.location.origin) return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === PREVIEW_PRONTO) setPronto(true);
    }
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      setPronto(false);
    };
  }, [aberto]);

  // Envia (ou reenvia) os dados sempre que o iframe estiver pronto.
  useEffect(() => {
    if (!aberto || !pronto || !dados) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: PREVIEW_DADOS, dados } satisfies PreviewMensagem,
      window.location.origin,
    );
  }, [aberto, pronto, dados]);

  // Esc fecha; página de trás não rola.
  useEffect(() => {
    if (!aberto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar();
    }
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [aberto, onFechar]);

  if (!aberto) return null;

  const carregando = !dados || !pronto;
  const urlFicticia = tipo === 'embarcacao' ? 'boatzy.app/embarcacoes/…' : 'boatzy.app/roteiros/…';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pré-visualização da publicação"
      className="fixed inset-0 z-[400] flex flex-col bg-slate-900/85 backdrop-blur-sm"
    >
      {/* Barra superior */}
      <div className="flex items-center gap-3 border-b border-white/10 bg-[#0B2447] px-4 py-3 text-white sm:px-6">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
          <Eye className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">Pré-visualização</p>
          <p className="hidden truncate text-xs text-white/60 sm:block">
            É assim que os clientes verão sua publicação — as alterações ainda não foram salvas.
          </p>
        </div>

        <div className="hidden rounded-xl bg-white/10 p-1 md:flex" role="radiogroup" aria-label="Dispositivo">
          {([
            { v: 'computador', label: 'Computador', Icon: Monitor },
            { v: 'celular', label: 'Celular', Icon: Smartphone },
          ] as const).map(({ v, label, Icon }) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={dispositivo === v}
              onClick={() => setDispositivo(v)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                dispositivo === v ? 'bg-white text-[#0B2447] shadow-sm' : 'text-white/70 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onFechar}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20 transition"
        >
          <X className="h-4 w-4" />
          <span className="hidden sm:inline">Voltar à edição</span>
        </button>
      </div>

      {/* Palco */}
      <div className="flex min-h-0 flex-1 justify-center overflow-hidden p-0 md:p-6">
        <div
          className={`relative flex min-h-0 flex-col overflow-hidden bg-white shadow-2xl transition-[width] duration-300 ${
            dispositivo === 'celular'
              ? 'h-full w-full md:max-h-[860px] md:w-[392px] md:rounded-[2.25rem] md:border-[10px] md:border-slate-800'
              : 'h-full w-full max-w-[1440px] md:rounded-xl'
          }`}
        >
          {/* Barra de navegador fictícia (só no modo computador) */}
          {dispositivo === 'computador' && (
            <div className="hidden shrink-0 items-center gap-3 border-b border-slate-200 bg-slate-100 px-4 py-2 md:flex">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
              </div>
              <div className="flex-1 truncate rounded-md bg-white px-3 py-1 text-xs text-slate-400">{urlFicticia}</div>
            </div>
          )}

          <iframe
            ref={iframeRef}
            src={`/painel/preview/${tipo}`}
            title="Pré-visualização da publicação"
            className="min-h-0 w-full flex-1 border-0 bg-white"
          />

          {carregando && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-white text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Montando a pré-visualização…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
