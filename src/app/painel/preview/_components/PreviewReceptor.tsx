'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import EmbarcacaoDetalheView from '@/app/embarcacoes/[id]/_components/EmbarcacaoDetalheView';
import RoteiroDetalheView from '@/app/roteiros/[id]/_components/RoteiroDetalheView';
import { ModoPreviewProvider } from '@/components/preview/ModoPreview';
import {
  PREVIEW_DADOS, PREVIEW_PRONTO,
  type PreviewDados, type PreviewMensagem,
} from '@/components/preview/mensagens';

/**
 * Recebe do formulário (janela pai) os dados ainda não salvos e renderiza a
 * MESMA view da página pública — o layout da prévia é sempre o do site.
 * Links e ações (reservar, favoritar, compartilhar, chat) ficam desativados.
 */
export default function PreviewReceptor({ tipo }: { tipo: PreviewDados['tipo'] }) {
  const [dados, setDados] = useState<PreviewDados | null>(null);
  const [aviso, setAviso] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const avisar = useCallback(() => {
    setAviso(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAviso(false), 2500);
  }, []);

  // Handshake com o formulário.
  useEffect(() => {
    function onMessage(e: MessageEvent<PreviewMensagem>) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === PREVIEW_DADOS && e.data.dados.tipo === tipo) setDados(e.data.dados);
    }
    window.addEventListener('message', onMessage);
    if (window.parent !== window) {
      window.parent.postMessage({ type: PREVIEW_PRONTO } satisfies PreviewMensagem, window.location.origin);
    }
    return () => window.removeEventListener('message', onMessage);
  }, [tipo]);

  // Nenhum link sai da prévia (header, voltar, chat…).
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const link = (e.target as HTMLElement | null)?.closest('a[href]');
      if (!link) return;
      e.preventDefault();
      e.stopPropagation();
      avisar();
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [avisar]);

  return (
    <ModoPreviewProvider value={{ ativo: true, avisar }}>
      {!dados ? (
        <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando pré-visualização…
        </div>
      ) : dados.tipo === 'embarcacao' ? (
        <EmbarcacaoDetalheView
          embarcacao={dados.embarcacao}
          avaliacoes={[]}
          ehDono={false}
          datasBloqueadas={dados.datasBloqueadas}
        />
      ) : (
        <RoteiroDetalheView
          roteiro={dados.roteiro}
          avaliacoes={[]}
          ehDono={false}
          isFavorito={false}
          datasBloqueadas={dados.datasBloqueadas}
          vagasPessoaOcupadas={{}}
        />
      )}

      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-5 left-1/2 z-[500] -translate-x-1/2 flex items-center gap-2 rounded-full bg-slate-900/90 px-4 py-2.5
          text-xs font-medium text-white shadow-lg backdrop-blur transition-all duration-200
          ${aviso ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-2'}`}
      >
        <Eye className="h-3.5 w-3.5 text-cyan-300" />
        Pré-visualização — ações e links ficam desativados.
      </div>
    </ModoPreviewProvider>
  );
}
