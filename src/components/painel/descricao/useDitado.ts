'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

/**
 * Ditado por voz no navegador (SPEC §98) — Web Speech API, em pt-BR. Funciona no Chrome
 * (Android e computador), Edge e Safari (iPhone e Mac). Onde não existe (Firefox, alguns
 * navegadores dentro de apps), `suportado` é false e a tela sugere o microfone do teclado.
 *
 * Usa reconhecimento curto (não contínuo) e reinicia a cada pausa enquanto o dono estiver
 * falando: evita as frases repetidas do modo contínuo no Android.
 */

type ResultadoFala = { isFinal: boolean; 0: { transcript: string } };
type EventoFala = { resultIndex: number; results: ArrayLike<ResultadoFala> };
type Reconhecimento = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: EventoFala) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type ConstrutorReconhecimento = new () => Reconhecimento;

function construtor(): ConstrutorReconhecimento | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: ConstrutorReconhecimento; webkitSpeechRecognition?: ConstrutorReconhecimento };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const nada = () => () => {};

/** Tempo máximo de uma gravação contínua (o dono pode tocar de novo para continuar). */
const LIMITE_MS = 3 * 60 * 1000;

export function useDitado(aoReconhecer: (trecho: string) => void) {
  const suportado = useSyncExternalStore(nada, () => construtor() !== null, () => false);
  const [ouvindo, setOuvindo] = useState(false);
  const [parcial, setParcial] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const recRef = useRef<Reconhecimento | null>(null);
  const continuar = useRef(false);
  const inicio = useRef(0);
  const callback = useRef(aoReconhecer);
  useEffect(() => {
    callback.current = aoReconhecer;
  }, [aoReconhecer]);

  const parar = useCallback(() => {
    continuar.current = false;
    recRef.current?.stop();
    setOuvindo(false);
    setParcial('');
  }, []);

  const iniciar = useCallback(() => {
    const Construtor = construtor();
    if (!Construtor) return;
    const rec = new Construtor();
    rec.lang = 'pt-BR';
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let provisorio = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) callback.current(r[0].transcript);
        else provisorio += r[0].transcript;
      }
      setParcial(provisorio);
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      continuar.current = false;
      setErro(
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'O microfone está bloqueado. Toque no cadeado da barra de endereço e permita o microfone — ou use o microfone do teclado.'
          : e.error === 'network'
            ? 'Sem conexão para reconhecer a fala. Verifique a internet ou use o microfone do teclado.'
            : 'Não conseguimos ouvir. Tente de novo ou use o microfone do teclado.',
      );
    };
    rec.onend = () => {
      setParcial('');
      if (continuar.current && Date.now() - inicio.current < LIMITE_MS) {
        try {
          rec.start();
          return;
        } catch {
          /* reinício recusado: encerra */
        }
      }
      continuar.current = false;
      setOuvindo(false);
    };
    recRef.current?.abort();
    recRef.current = rec;
    continuar.current = true;
    inicio.current = Date.now();
    setErro(null);
    setOuvindo(true);
    try {
      rec.start();
    } catch {
      continuar.current = false;
      setOuvindo(false);
      setErro('Não conseguimos ligar o microfone. Tente de novo.');
    }
  }, []);

  useEffect(() => () => {
    continuar.current = false;
    recRef.current?.abort();
  }, []);

  return { suportado, ouvindo, parcial, erro, iniciar, parar };
}
