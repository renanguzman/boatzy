'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, SwitchCamera, RotateCw, CheckCircle2, AlertTriangle, Camera, FileUp, RefreshCw, Loader2, VideoOff,
} from 'lucide-react';
import {
  avaliarQualidadeDe, MENSAGEM_PROBLEMA, type ProblemaFoto, type QualidadeFoto,
} from '@/lib/documentos/qualidade-foto';

/**
 * Câmera do painel para fotografar documentos (SPEC §95.8): câmera ao vivo
 * (traseira no celular) com moldura de enquadramento, captura recortada na
 * moldura e avaliação da qualidade na hora — o gestor decide "Tirar outra" ou
 * "Usar esta foto". Sem câmera disponível (permissão negada, http sem TLS,
 * aparelho sem câmera), oferece a câmera nativa do aparelho ou um arquivo.
 */

export type Formato = 'retrato' | 'paisagem';

type ErroCamera = 'negado' | 'indisponivel' | 'sem-camera' | 'ocupada' | 'outro';

type Estado =
  | { fase: 'iniciando' }
  | { fase: 'ao-vivo' }
  | { fase: 'revisao'; url: string; arquivo: File; qualidade: QualidadeFoto }
  | { fase: 'erro'; tipo: ErroCamera };

/** Proporção altura/largura da moldura: TIE em pé (~A6) e CHA deitada (cartão). */
const PROPORCAO: Record<Formato, number> = { retrato: 1.42, paisagem: 0.63 };
/** Folga em volta da moldura no recorte — documento um pouco torto não perde a borda. */
const MARGEM_RECORTE = 0.06;

const TEXTO_ERRO: Record<ErroCamera, { titulo: string; texto: string }> = {
  negado: {
    titulo: 'Acesso à câmera bloqueado',
    texto:
      'Libere a câmera para o Boatzy: toque no ícone de cadeado (ou de câmera) na barra de endereço e permita. No iPhone: Ajustes › Safari › Câmera › Permitir.',
  },
  indisponivel: {
    titulo: 'A câmera não abre por aqui',
    texto: 'Este navegador não permite usar a câmera nesta página. Use a câmera do aparelho ou envie um arquivo.',
  },
  'sem-camera': {
    titulo: 'Nenhuma câmera encontrada',
    texto: 'Não encontramos uma câmera neste aparelho. Envie uma foto ou o PDF do documento.',
  },
  ocupada: {
    titulo: 'A câmera está em uso',
    texto: 'Outro aplicativo (videochamada, por exemplo) está usando a câmera. Feche-o e tente de novo.',
  },
  outro: {
    titulo: 'Não foi possível abrir a câmera',
    texto: 'Tente de novo ou envie uma foto do documento.',
  },
};

const VERIFICACOES: { rotulo: string; problemas: ProblemaFoto[] }[] = [
  { rotulo: 'Nitidez', problemas: ['tremida'] },
  { rotulo: 'Iluminação', problemas: ['escura', 'clara'] },
  { rotulo: 'Sem reflexo', problemas: ['reflexo'] },
  { rotulo: 'Resolução', problemas: ['pequena'] },
];

export default function CameraDocumento({
  aberta,
  formatoInicial,
  sigla,
  onFechar,
  onFoto,
  onCameraNativa,
  onEscolherArquivo,
}: {
  aberta: boolean;
  formatoInicial: Formato;
  /** Ex.: "TIE" — usado nas instruções. */
  sigla: string;
  onFechar: () => void;
  onFoto: (arquivo: File, qualidade: QualidadeFoto) => void;
  onCameraNativa: () => void;
  onEscolherArquivo: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [estado, setEstado] = useState<Estado>({ fase: 'iniciando' });
  const [formato, setFormato] = useState<Formato>(formatoInicial);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [flash, setFlash] = useState(false);
  const [capturando, setCapturando] = useState(false);

  // Formato acompanha o tipo do documento ao reabrir.
  useEffect(() => {
    if (aberta) setFormato(formatoInicial); // eslint-disable-line react-hooks/set-state-in-effect -- reinicia ao abrir
  }, [aberta, formatoInicial]);

  // Liga a câmera ao abrir (e ao trocar de câmera / tentar de novo); desliga ao fechar.
  useEffect(() => {
    if (!aberta) return;
    let cancelado = false;
    let stream: MediaStream | null = null;

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setEstado({ fase: 'erro', tipo: 'indisponivel' });
        return;
      }
      setEstado({ fase: 'iniciando' });
      try {
        const resolucao = { width: { ideal: 1920 }, height: { ideal: 1080 } };
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: deviceId ? { deviceId: { exact: deviceId }, ...resolucao } : { facingMode: { ideal: 'environment' }, ...resolucao },
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        // Os nomes das câmeras só aparecem depois da permissão.
        const dispositivos = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (!cancelado) {
          setCameras(dispositivos.filter((d) => d.kind === 'videoinput'));
          setEstado({ fase: 'ao-vivo' });
        }
      } catch (e) {
        if (cancelado) return;
        const nome = (e as { name?: string }).name;
        const tipo: ErroCamera =
          nome === 'NotAllowedError' || nome === 'SecurityError' ? 'negado'
            : nome === 'NotFoundError' || nome === 'OverconstrainedError' ? 'sem-camera'
            : nome === 'NotReadableError' || nome === 'AbortError' ? 'ocupada'
            : 'outro';
        setEstado({ fase: 'erro', tipo });
      }
    })();

    return () => {
      cancelado = true;
      stream?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [aberta, deviceId, tentativa]);

  // Tamanho da área do vídeo (para desenhar a moldura e mapear o recorte).
  useLayoutEffect(() => {
    if (!aberta) return;
    const el = areaRef.current;
    if (!el) return;
    const medir = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aberta]);

  // Trava a rolagem da página e fecha com Esc.
  useEffect(() => {
    if (!aberta) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener('keydown', onKey);
    };
  }, [aberta, onFechar]);

  // Libera a prévia da foto anterior.
  const urlRevisao = estado.fase === 'revisao' ? estado.url : null;
  useEffect(() => () => {
    if (urlRevisao) URL.revokeObjectURL(urlRevisao);
  }, [urlRevisao]);

  // Moldura: a maior que cabe em 88% da largura e 72% da altura, na proporção do documento.
  const proporcao = PROPORCAO[formato];
  let molduraW = area.w * 0.88;
  let molduraH = molduraW * proporcao;
  if (molduraH > area.h * 0.72) {
    molduraH = area.h * 0.72;
    molduraW = molduraH / proporcao;
  }

  const trocarCamera = useCallback(() => {
    if (cameras.length < 2) return;
    const atual = streamRef.current?.getVideoTracks()[0]?.getSettings().deviceId;
    const i = cameras.findIndex((c) => c.deviceId === atual);
    setDeviceId(cameras[(i + 1) % cameras.length].deviceId);
  }, [cameras]);

  async function capturar() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || capturando) return;
    setCapturando(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 150);

    // Mapeia a moldura (coordenadas da tela) para o quadro do vídeo (object-cover).
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const escala = Math.max(area.w / vw, area.h / vh);
    const dx = (area.w - vw * escala) / 2;
    const dy = (area.h - vh * escala) / 2;
    let w = (molduraW / escala) * (1 + 2 * MARGEM_RECORTE);
    let h = (molduraH / escala) * (1 + 2 * MARGEM_RECORTE);
    let x = ((area.w - molduraW) / 2 - dx) / escala - (molduraW / escala) * MARGEM_RECORTE;
    let y = ((area.h - molduraH) / 2 - dy) / escala - (molduraH / escala) * MARGEM_RECORTE;
    x = Math.max(0, x);
    y = Math.max(0, y);
    w = Math.min(vw - x, w);
    h = Math.min(vh - y, h);

    // Foto na resolução cheia do sensor quando o navegador permite (Chrome/Android:
    // ImageCapture, 12 MP+); senão, o quadro do vídeo (1080p — Safari/iPhone).
    let fonte: CanvasImageSource = video;
    let fator = 1;
    const track = streamRef.current?.getVideoTracks()[0];
    const ImageCaptureCtor = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto(): Promise<Blob> } }).ImageCapture;
    if (track && ImageCaptureCtor) {
      try {
        const foto = await createImageBitmap(await new ImageCaptureCtor(track).takePhoto());
        // Só usa se a foto tiver o mesmo enquadramento do vídeo (mesma proporção).
        if (Math.abs(foto.width / foto.height - vw / vh) < 0.02 && foto.width > vw) {
          fonte = foto;
          fator = foto.width / vw;
        } else {
          foto.close();
        }
      } catch {
        // sem suporte de fato: segue com o quadro do vídeo
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * fator);
    canvas.height = Math.round(h * fator);
    canvas.getContext('2d')!.drawImage(fonte, x * fator, y * fator, w * fator, h * fator, 0, 0, canvas.width, canvas.height);
    if (fonte instanceof ImageBitmap) fonte.close();

    const qualidade = avaliarQualidadeDe(canvas);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
    setCapturando(false);
    setFlash(false);
    if (!blob) return;
    const arquivo = new File([blob], `${sigla.toLowerCase()}-${Date.now()}.jpg`, { type: 'image/jpeg' });
    setEstado({ fase: 'revisao', url: URL.createObjectURL(blob), arquivo, qualidade });
  }

  if (!aberta || typeof document === 'undefined') return null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Fotografar ${sigla}`} className="fixed inset-0 z-[80] flex flex-col bg-black text-white">
      {/* Topo */}
      <div className="flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <button type="button" onClick={onFechar} aria-label="Fechar câmera" className="rounded-full bg-white/10 p-2.5 hover:bg-white/20">
          <X className="h-5 w-5" />
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold">
          {estado.fase === 'revisao' ? 'Confira a foto' : `Fotografe o ${sigla}`}
        </p>
        {estado.fase === 'ao-vivo' ? (
          <button
            type="button"
            onClick={() => setFormato((f) => (f === 'retrato' ? 'paisagem' : 'retrato'))}
            aria-label={formato === 'retrato' ? 'Moldura deitada' : 'Moldura em pé'}
            title={formato === 'retrato' ? 'Documento deitado' : 'Documento em pé'}
            className="rounded-full bg-white/10 p-2.5 hover:bg-white/20"
          >
            <RotateCw className="h-5 w-5" />
          </button>
        ) : (
          <span className="w-10" />
        )}
      </div>

      {/* Área do vídeo — fica montada para a câmera não religar ao revisar */}
      <div ref={areaRef} className="relative min-h-0 flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`absolute inset-0 h-full w-full object-cover ${estado.fase === 'ao-vivo' ? '' : 'invisible'}`}
        />

        {estado.fase === 'ao-vivo' && area.w > 0 && (
          <>
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-white/90"
              style={{ width: molduraW, height: molduraH, boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }}
            />
            <p className="pointer-events-none absolute inset-x-4 top-3 text-center text-xs text-white/90 drop-shadow">
              Encaixe o documento na moldura · boa luz · sem reflexo
            </p>
          </>
        )}

        {estado.fase === 'iniciando' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-white/80">
            <Loader2 className="h-8 w-8 animate-spin" />
            Abrindo a câmera… se o navegador perguntar, toque em <strong>Permitir</strong>.
          </div>
        )}

        {estado.fase === 'revisao' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={estado.url} alt="Foto do documento" className="absolute inset-0 h-full w-full object-contain p-3" />
        )}

        {estado.fase === 'erro' && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-sm text-center">
              <VideoOff className="mx-auto h-10 w-10 text-white/60" />
              <p className="mt-3 text-base font-semibold">{TEXTO_ERRO[estado.tipo].titulo}</p>
              <p className="mt-2 text-sm text-white/70">{TEXTO_ERRO[estado.tipo].texto}</p>
              <div className="mt-6 flex flex-col gap-2">
                {(estado.tipo === 'negado' || estado.tipo === 'ocupada' || estado.tipo === 'outro') && (
                  <button
                    type="button"
                    onClick={() => setTentativa((t) => t + 1)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#0B2447]"
                  >
                    <RefreshCw className="h-4 w-4" /> Tentar de novo
                  </button>
                )}
                {estado.tipo !== 'sem-camera' && (
                  <button
                    type="button"
                    onClick={onCameraNativa}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 px-4 py-3 text-sm font-semibold"
                  >
                    <Camera className="h-4 w-4" /> Usar a câmera do aparelho
                  </button>
                )}
                <button
                  type="button"
                  onClick={onEscolherArquivo}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 px-4 py-3 text-sm font-semibold"
                >
                  <FileUp className="h-4 w-4" /> Escolher arquivo
                </button>
              </div>
            </div>
          </div>
        )}

        {flash && <div className="pointer-events-none absolute inset-0 bg-white/80" />}
      </div>

      {/* Rodapé */}
      {estado.fase === 'ao-vivo' && (
        <div className="flex items-center justify-between px-8 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <span className="w-11" />
          <button
            type="button"
            onClick={capturar}
            disabled={capturando}
            aria-label="Tirar foto"
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white/70 disabled:opacity-60"
          >
            <span className="h-14 w-14 rounded-full bg-white transition-transform active:scale-90" />
          </button>
          {cameras.length > 1 ? (
            <button type="button" onClick={trocarCamera} aria-label="Trocar câmera" className="rounded-full bg-white/10 p-3 hover:bg-white/20">
              <SwitchCamera className="h-5 w-5" />
            </button>
          ) : (
            <span className="w-11" />
          )}
        </div>
      )}

      {estado.fase === 'revisao' && (
        <div className="rounded-t-3xl bg-white px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-slate-800 sm:px-6">
          <div className="mx-auto max-w-lg">
            {estado.qualidade.boa ? (
              <p className="flex items-center gap-2 text-base font-bold text-emerald-700">
                <CheckCircle2 className="h-5 w-5" /> Foto boa para leitura
              </p>
            ) : (
              <div>
                <p className="flex items-center gap-2 text-base font-bold text-amber-700">
                  <AlertTriangle className="h-5 w-5" /> A foto pode não ser lida bem
                </p>
                <ul className="mt-2 space-y-1">
                  {estado.qualidade.problemas.map((p) => (
                    <li key={p} className="text-sm text-slate-600">
                      <strong className="text-slate-800">{MENSAGEM_PROBLEMA[p].titulo}.</strong> {MENSAGEM_PROBLEMA[p].dica}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <ul className="mt-3 flex flex-wrap gap-2">
              {VERIFICACOES.map((v) => {
                const ok = !v.problemas.some((p) => estado.qualidade.problemas.includes(p));
                return (
                  <li
                    key={v.rotulo}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />} {v.rotulo}
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {estado.qualidade.boa ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEstado({ fase: 'ao-vivo' })}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Tirar outra
                  </button>
                  <button
                    type="button"
                    onClick={() => onFoto(estado.arquivo, estado.qualidade)}
                    className="rounded-xl bg-[#0B2447] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0B3D91]"
                  >
                    Usar esta foto
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onFoto(estado.arquivo, estado.qualidade)}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Usar mesmo assim
                  </button>
                  <button
                    type="button"
                    onClick={() => setEstado({ fase: 'ao-vivo' })}
                    className="rounded-xl bg-[#0B2447] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0B3D91]"
                  >
                    Tirar outra
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
