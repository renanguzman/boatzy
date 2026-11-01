'use client';

import { useCallback, useRef, useState } from 'react';
import { validarArquivoDocumento } from '@/lib/documentos/envio';
import { avaliarQualidadeDe, type QualidadeFoto } from '@/lib/documentos/qualidade-foto';
import CameraDocumento, { type Formato } from './CameraDocumento';

/**
 * Escolha do arquivo de um documento (SPEC §95.8): câmera do painel (com plano B
 * para a câmera nativa e para o arquivo), validação do formato/tamanho e avaliação
 * da foto escolhida da galeria (a da câmera já chega avaliada).
 *
 * `elementos` (entradas ocultas + câmera em portal) precisa ser renderizado por
 * quem usa o hook — sempre montado, pois a câmera recorre às entradas.
 */
export function useSeletorArquivo({
  formato, sigla, onArquivo,
}: {
  formato: Formato;
  /** Ex.: "TIE" — usado nas instruções da câmera. */
  sigla: string;
  onArquivo: (file: File, qualidade: QualidadeFoto | null) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [cameraAberta, setCameraAberta] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fecharCamera = useCallback(() => setCameraAberta(false), []);

  async function receber(file: File | undefined, qualidade?: QualidadeFoto) {
    if (!file) return;
    const problema = validarArquivoDocumento(file);
    if (problema) {
      setErro(problema);
      return;
    }
    setErro(null);
    let q: QualidadeFoto | null = qualidade ?? null;
    if (!q && file.type.startsWith('image/')) {
      try {
        const bitmap = await createImageBitmap(file);
        q = avaliarQualidadeDe(bitmap);
        bitmap.close();
      } catch {
        q = null;
      }
    }
    onArquivo(file, q);
  }

  const elementos = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
        void receber(e.target.files?.[0]);
        e.target.value = ''; // permite escolher o mesmo arquivo de novo
      }} />
      <input ref={arquivoRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => {
        void receber(e.target.files?.[0]);
        e.target.value = ''; // permite escolher o mesmo arquivo de novo
      }} />
      <CameraDocumento
        aberta={cameraAberta}
        formatoInicial={formato}
        sigla={sigla}
        onFechar={fecharCamera}
        onFoto={(file, q) => {
          setCameraAberta(false);
          void receber(file, q);
        }}
        onCameraNativa={() => {
          setCameraAberta(false);
          cameraRef.current?.click();
        }}
        onEscolherArquivo={() => {
          setCameraAberta(false);
          arquivoRef.current?.click();
        }}
      />
    </>
  );

  return {
    abrirCamera: () => setCameraAberta(true),
    abrirArquivos: () => arquivoRef.current?.click(),
    erro,
    elementos,
  };
}
