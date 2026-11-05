'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EstadoEtapas } from '@/components/painel/etapas/useEtapas';
import {
  apagarRascunho, gravarRascunho, lerRascunho, limparRascunhosVencidos, pedirArmazenamentoPersistente,
  VALIDADE_RASCUNHO_MS, type RegistroRascunho, type ResumoRascunho,
} from './armazenamento';

/**
 * Rascunho automático de um cadastro em etapas do painel (SPEC §107.2).
 *
 * O formulário entrega, a cada render, o estado serializável (`dados`), os arquivos
 * referenciados (`arquivos`: id → File) e a etapa. O hook:
 * - ao abrir, lê o rascunho deste aparelho e o devolve ao formulário (`aplicar`) — na
 *   edição, se os dados do servidor mudaram desde o rascunho, pergunta antes;
 * - grava 600 ms depois da última mudança (na hora, ao trocar de etapa) e na saída da
 *   tela (`visibilitychange`/`pagehide` — o que funciona no celular, inclusive quando o
 *   Android descarta a aba ao abrir a câmera);
 * - não grava nada enquanto o formulário estiver igual ao início (e apaga o rascunho se
 *   o gestor desfizer tudo);
 * - `limpar()` no envio bem-sucedido; `marcarCriado(id)` quando o registro novo já
 *   existe no servidor (envio interrompido depois disso não duplica o cadastro).
 */

const ATRASO_MS = 600;

export type StatusRascunho = 'carregando' | 'limpo' | 'salvando' | 'salvo' | 'sem-arquivos' | 'erro';

export type AvisoRascunho =
  /** Rascunho devolvido ao formulário; `perdidos` = arquivos que não estavam guardados. */
  | { tipo: 'restaurado'; em: number; perdidos: number }
  /** Edição: o cadastro mudou no servidor depois do rascunho — o gestor decide. */
  | { tipo: 'conflito'; em: number }
  /** Cadastro novo já criado no servidor por um envio que não terminou. */
  | { tipo: 'criado'; id: string; em: number };

type Opcoes<D> = {
  /** null desliga o rascunho (ex.: sem usuário). */
  chave: string | null;
  /** Versão do formato de `dados`; rascunho de outra versão é descartado. */
  versao: number;
  dados: D;
  arquivos: Record<string, File>;
  etapa: EstadoEtapas;
  resumo: ResumoRascunho;
  /**
   * Edição: confere se o cadastro mudou no servidor desde o rascunho. A referência é o
   * estado inicial do formulário (montado só com dados do servidor) — por isso a
   * serialização de `dados` não pode ter nada aleatório (ids locais etc.).
   */
  conferirServidor?: boolean;
  /**
   * Devolve um estado ao formulário (rascunho lido ou o estado inicial, no "Descartar").
   * `etapa` null = manter a etapa atual. Retorna quantos arquivos não puderam voltar.
   */
  aplicar: (dados: D, arquivos: Map<string, File>, etapa: EstadoEtapas | null) => number;
};

type Fase = 'carregando' | 'ativo' | 'pendente' | 'encerrado';

/** Assinatura curta e estável de um valor (FNV-1a 32 bits do JSON). */
export function assinatura(valor: unknown): string {
  const s = JSON.stringify(valor) ?? '';
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(36)}-${s.length.toString(36)}`;
}

const etapaChave = (e: EstadoEtapas) => `${e.atual}|${e.visitadas.map(Number).join('')}`;

export function useRascunhoCadastro<D>(op: Opcoes<D>) {
  const { chave, versao } = op;
  const json = JSON.stringify(op.dados);
  const etapaJson = etapaChave(op.etapa);

  // Estado do formulário ao abrir (antes de qualquer rascunho): referência do "sem mudanças".
  const [inicial] = useState(() => ({
    json, dados: op.dados, etapa: op.etapa, arquivos: op.arquivos,
    base: op.conferirServidor ? assinatura(json) : null,
  }));
  const [fase, setFaseEstado] = useState<Fase>(chave ? 'carregando' : 'encerrado');
  const [status, setStatusEstado] = useState<StatusRascunho>(chave ? 'carregando' : 'limpo');
  const [salvoEm, setSalvoEm] = useState<number | null>(null);
  const [aviso, setAviso] = useState<AvisoRascunho | null>(null);

  const ultimo = useRef(op);
  useEffect(() => { ultimo.current = op; });

  const faseRef = useRef<Fase>(fase);
  const statusRef = useRef<StatusRascunho>(status);
  const setFase = useCallback((f: Fase) => { faseRef.current = f; setFaseEstado(f); }, []);
  const setStatus = useCallback((s: StatusRascunho) => { statusRef.current = s; setStatusEstado(s); }, []);

  /** Arquivos já guardados no aparelho (não sobem de novo para o IndexedDB). */
  const gravadosRef = useRef<Set<string>>(new Set());
  /** Arquivos que não couberam (quota): não tenta de novo a cada gravação. */
  const falhosRef = useRef<Set<string>>(new Set());
  /** Já existe rascunho gravado para esta chave. */
  const existeRef = useRef(false);
  const ultimaAssinaturaRef = useRef<string | null>(null);
  const criadoIdRef = useRef<string | undefined>(undefined);
  const filaRef = useRef<Promise<void>>(Promise.resolve());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendenteRef = useRef<{ registro: RegistroRascunho<D>; arquivos: Map<string, File> } | null>(null);

  // ── Gravação ──────────────────────────────────────────────────────────────

  const executar = useCallback(async () => {
    const o = ultimo.current;
    if (faseRef.current !== 'ativo' || !o.chave) return;
    const atualJson = JSON.stringify(o.dados);

    // Igual ao início: nada a proteger (e o rascunho antigo, se houver, sai).
    if (atualJson === inicial.json && !criadoIdRef.current) {
      if (existeRef.current) {
        await apagarRascunho(o.chave);
        existeRef.current = false;
        gravadosRef.current = new Set();
      }
      ultimaAssinaturaRef.current = null;
      setStatus('limpo');
      return;
    }

    const marca = `${atualJson}§${etapaChave(o.etapa)}§${criadoIdRef.current ?? ''}`;
    if (marca === ultimaAssinaturaRef.current) return;

    const ids = Object.keys(o.arquivos);
    const novos = ids
      .filter(id => !gravadosRef.current.has(id) && !falhosRef.current.has(id))
      .map(id => ({ id, file: o.arquivos[id] }));
    const remover = [...gravadosRef.current].filter(id => !(id in o.arquivos));
    const registro: RegistroRascunho<D> = {
      chave: o.chave, versao: o.versao, dados: o.dados, etapa: o.etapa, base: inicial.base,
      arquivos: ids, atualizadoEm: Date.now(), criadoId: criadoIdRef.current, resumo: o.resumo,
    };

    setStatus('salvando');
    const r = await gravarRascunho(registro as RegistroRascunho, novos, remover);
    // `limpar()` chegou durante a gravação: o rascunho não deve sobreviver.
    if ((faseRef.current as Fase) === 'encerrado') {
      await apagarRascunho(o.chave);
      return;
    }
    if (r === 'erro') {
      ultimaAssinaturaRef.current = null;
      setStatus('erro');
      return;
    }
    existeRef.current = true;
    remover.forEach(id => gravadosRef.current.delete(id));
    if (r === 'ok') {
      novos.forEach(n => gravadosRef.current.add(n.id));
      if (novos.length > 0) pedirArmazenamentoPersistente();
    } else {
      novos.forEach(n => falhosRef.current.add(n.id));
    }
    ultimaAssinaturaRef.current = marca;
    setSalvoEm(registro.atualizadoEm);
    setStatus(ids.some(id => falhosRef.current.has(id)) ? 'sem-arquivos' : 'salvo');
  }, [inicial.json, inicial.base, setStatus]);

  /** Enfileira uma gravação (nunca duas ao mesmo tempo). */
  const gravarAgora = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    filaRef.current = filaRef.current.then(executar).catch(() => setStatus('erro'));
    return filaRef.current;
  }, [executar, setStatus]);

  // ── Leitura ao abrir ──────────────────────────────────────────────────────

  const aplicarRegistro = useCallback((lido: { registro: RegistroRascunho<D>; arquivos: Map<string, File> }) => {
    const { registro, arquivos } = lido;
    existeRef.current = true;
    gravadosRef.current = new Set(arquivos.keys());
    const perdidos = ultimo.current.aplicar(registro.dados, arquivos, registro.etapa);
    ultimaAssinaturaRef.current = null; // regrava na próxima mudança, já com os arquivos de agora
    setAviso({ tipo: 'restaurado', em: registro.atualizadoEm, perdidos });
    setSalvoEm(registro.atualizadoEm);
    setStatus(perdidos > 0 ? 'sem-arquivos' : 'salvo');
    setFase('ativo');
  }, [setFase, setStatus]);

  useEffect(() => {
    if (!chave) return;
    let cancelado = false;
    void limparRascunhosVencidos();
    lerRascunho<D>(chave).then(lido => {
      if (cancelado) return;
      const registro = lido?.registro;
      if (!lido || !registro) {
        setStatus('limpo');
        setFase('ativo');
        return;
      }
      if (registro.versao !== versao || Date.now() - registro.atualizadoEm > VALIDADE_RASCUNHO_MS) {
        void apagarRascunho(chave);
        setStatus('limpo');
        setFase('ativo');
        return;
      }
      if (registro.criadoId) {
        void apagarRascunho(chave);
        setAviso({ tipo: 'criado', id: registro.criadoId, em: registro.atualizadoEm });
        setStatus('limpo');
        setFase('ativo');
        return;
      }
      if (inicial.base && registro.base && registro.base !== inicial.base) {
        pendenteRef.current = lido;
        existeRef.current = true;
        setAviso({ tipo: 'conflito', em: registro.atualizadoEm });
        setStatus('limpo');
        setFase('pendente');
        return;
      }
      aplicarRegistro(lido);
    }).catch(() => {
      if (cancelado) return;
      setStatus('limpo');
      setFase('ativo');
    });
    return () => { cancelado = true; };
  }, [chave, versao, inicial.base, aplicarRegistro, setFase, setStatus]);

  // ── Agendamento: 600 ms após a última mudança; na hora ao trocar de etapa ──

  const etapaAnteriorRef = useRef(etapaJson);
  useEffect(() => {
    if (fase !== 'ativo') return;
    const mudouEtapa = etapaAnteriorRef.current !== etapaJson;
    etapaAnteriorRef.current = etapaJson;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void gravarAgora();
    }, mudouEtapa ? 0 : ATRASO_MS);
  }, [json, etapaJson, fase, gravarAgora]);

  // Saída da tela: grava na hora. beforeunload só segura a saída quando algo NÃO ficou guardado.
  useEffect(() => {
    if (!chave) return;
    const aoOcultar = () => { if (document.visibilityState === 'hidden') void gravarAgora(); };
    const aoSair = () => { void gravarAgora(); };
    const antesDeSair = (e: BeforeUnloadEvent) => {
      void gravarAgora();
      if (statusRef.current === 'erro' || statusRef.current === 'sem-arquivos') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    document.addEventListener('visibilitychange', aoOcultar);
    window.addEventListener('pagehide', aoSair);
    window.addEventListener('beforeunload', antesDeSair);
    return () => {
      document.removeEventListener('visibilitychange', aoOcultar);
      window.removeEventListener('pagehide', aoSair);
      window.removeEventListener('beforeunload', antesDeSair);
      // Saiu do cadastro por um link do painel: grava o que estava esperando o atraso.
      if (timerRef.current) void gravarAgora();
    };
  }, [chave, gravarAgora]);

  // ── Ações ─────────────────────────────────────────────────────────────────

  /** "Descartar": apaga o rascunho; após uma restauração, volta o formulário ao início. */
  const descartar = useCallback(() => {
    const k = ultimo.current.chave;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (faseRef.current === 'ativo') {
      ultimo.current.aplicar(inicial.dados, new Map(Object.entries(inicial.arquivos)), null);
    }
    pendenteRef.current = null;
    existeRef.current = false;
    gravadosRef.current = new Set();
    falhosRef.current = new Set();
    ultimaAssinaturaRef.current = null;
    setAviso(null);
    setStatus('limpo');
    setFase('ativo');
    if (k) filaRef.current = filaRef.current.then(() => apagarRascunho(k));
  }, [inicial, setFase, setStatus]);

  /** Conflito na edição: usa o rascunho mesmo assim. */
  const usarRascunho = useCallback(() => {
    const lido = pendenteRef.current;
    pendenteRef.current = null;
    if (lido) aplicarRegistro(lido);
  }, [aplicarRegistro]);

  const fecharAviso = useCallback(() => setAviso(null), []);

  /** Envio concluído: apaga o rascunho e para de gravar. */
  const limpar = useCallback(() => {
    const k = ultimo.current.chave;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setFase('encerrado');
    setStatus('limpo');
    setAviso(null);
    if (k) filaRef.current = filaRef.current.then(() => apagarRascunho(k));
    return filaRef.current;
  }, [setFase, setStatus]);

  /** Cadastro novo: o registro já existe no servidor (os passos seguintes ainda podem falhar). */
  const marcarCriado = useCallback((id: string) => {
    criadoIdRef.current = id;
    return gravarAgora();
  }, [gravarAgora]);

  return {
    status, salvoEm, aviso,
    /** Lendo o rascunho deste aparelho (o formulário já está visível). */
    carregando: fase === 'carregando',
    descartar, usarRascunho, fecharAviso, limpar, marcarCriado,
  };
}

export type Rascunho = ReturnType<typeof useRascunhoCadastro>;
