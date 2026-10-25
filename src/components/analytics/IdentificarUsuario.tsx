'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { identificarUsuario, type PerfilAnalytics } from '@/lib/analytics';

/**
 * Mantém o GA4 sabendo quem está navegando: User-ID (uuid) e o perfil
 * (admin > gestor > cliente; deslogado = visitante). Acompanha login/logout.
 */
export default function IdentificarUsuario() {
  useEffect(() => {
    const supabase = createClient();
    let ativo = true;

    async function aplicar(userId: string | null) {
      if (!userId) {
        identificarUsuario(null, 'visitante');
        return;
      }
      // RLS: o usuário lê só os próprios papéis (user_read_own_roles).
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId);
      if (!ativo) return;
      const papeis = new Set((data ?? []).map((r) => r.role));
      const perfil: PerfilAnalytics = papeis.has('admin') ? 'admin' : papeis.has('gestor') ? 'gestor' : 'cliente';
      identificarUsuario(userId, perfil);
    }

    supabase.auth.getUser().then(({ data }) => aplicar(data.user?.id ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento, session) => {
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT') void aplicar(session?.user?.id ?? null);
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
