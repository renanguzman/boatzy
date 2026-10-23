'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { authorizeRealtime } from '@/lib/supabase/realtime';
import type { Notificacao } from '@/lib/notificacoes/apresentacao';

type Opcoes = {
  limite?: number;
  apenasNaoLidas?: boolean;
  /** Chamado quando chega uma notificação nova (ou uma conversa agrupada recebe mensagem nova). */
  onNova?: (n: Notificacao) => void;
};

/**
 * Notificações do usuário logado (tabela `notificacao`, RLS: só as próprias),
 * mantidas ao vivo via Realtime. Usado pelo sino do header e por /notificacoes.
 */
export function useNotificacoes(userId: string | null, { limite = 15, apenasNaoLidas = false, onNova }: Opcoes = {}) {
  const supabaseRef = useRef(createClient());
  const onNovaRef = useRef(onNova);
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    onNovaRef.current = onNova;
  }, [onNova]);

  const refetch = useCallback(async () => {
    if (!userId) return;
    const supabase = supabaseRef.current;
    let consulta = supabase
      .from('notificacao')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('criada_em', { ascending: false })
      .limit(limite);
    if (apenasNaoLidas) consulta = consulta.is('lida_em', null);
    const [lista, contagem] = await Promise.all([
      consulta,
      supabase
        .from('notificacao')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('lida_em', null),
    ]);
    if (!lista.error) {
      setItens((lista.data ?? []) as Notificacao[]);
      setTotal(lista.count ?? 0);
    }
    if (!contagem.error) setNaoLidas(contagem.count ?? 0);
    setCarregando(false);
  }, [userId, limite, apenasNaoLidas]);

  useEffect(() => {
    if (!userId) return;
    const supabase = supabaseRef.current;
    let channel: RealtimeChannel | undefined;
    let ativo = true;

    (async () => {
      await authorizeRealtime(supabase);
      if (!ativo) return;
      await refetch();
      channel = supabase
        .channel(`notificacoes:${userId}:${Math.random().toString(36).slice(2)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notificacao', filter: `user_id=eq.${userId}` },
          (payload) => {
            const nova = payload.new as Notificacao | undefined;
            // INSERT = evento novo; UPDATE recente e não lido = conversa agrupada recebeu mensagem.
            const recente = nova?.criada_em && Date.now() - new Date(nova.criada_em).getTime() < 15_000;
            if (nova && !nova.lida_em && (payload.eventType === 'INSERT' || (payload.eventType === 'UPDATE' && recente))) {
              onNovaRef.current?.(nova);
            }
            void refetch();
          },
        )
        .subscribe();
    })();

    return () => {
      ativo = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, refetch]);

  const marcarLida = useCallback(
    async (id: string) => {
      const agora = new Date().toISOString();
      setItens((lista) => lista.map((n) => (n.id === id && !n.lida_em ? { ...n, lida_em: agora } : n)));
      setNaoLidas((q) => Math.max(0, q - 1));
      await supabaseRef.current.from('notificacao').update({ lida_em: agora }).eq('id', id).is('lida_em', null);
      void refetch();
    },
    [refetch],
  );

  const marcarTodasLidas = useCallback(async () => {
    if (!userId) return;
    const agora = new Date().toISOString();
    setItens((lista) => lista.map((n) => (n.lida_em ? n : { ...n, lida_em: agora })));
    setNaoLidas(0);
    await supabaseRef.current.from('notificacao').update({ lida_em: agora }).eq('user_id', userId).is('lida_em', null);
    void refetch();
  }, [userId, refetch]);

  return { itens, naoLidas, total, carregando, marcarLida, marcarTodasLidas, refetch };
}
