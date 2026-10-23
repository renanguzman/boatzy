'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { identificarUsuario, type PerfilAnalytics } from '@/lib/analytics';
import { EVENTO_CONSENTIMENTO, lerConsentimento } from '@/lib/consentimento';

/**
 * Mantém o GA4 sabendo quem está navegando: User-ID (uuid) e o perfil
 * (admin > gestor > cliente; deslogado = visitante). Acompanha login/logout.
 * O User-ID só vai com a Medição aceita (LGPD, SPEC §66); sem ela, só o perfil.
 */
export default function IdentificarUsuario() {
  useEffect(() => {
    const supabase = createClient();
    let ativo = true;
    let ultimoUserId: string | null = null;

    async function aplicar(userId: string | null) {
      ultimoUserId = userId;
      if (!userId) {
        identificarUsuario(null, 'visitante');
        return;
      }
      // RLS: o usuário lê só os próprios papéis (user_read_own_roles).
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId);
      if (!ativo) return;
      const papeis = new Set((data ?? []).map((r) => r.role));
      const perfil: PerfilAnalytics = papeis.has('admin') ? 'admin' : papeis.has('gestor') ? 'gestor' : 'cliente';
      identificarUsuario(lerConsentimento()?.medicao ? userId : null, perfil);
    }

    // Aceitou/revogou a Medição: reaplica (liga ou desliga o User-ID).
    const aoMudarConsentimento = () => void aplicar(ultimoUserId);
    window.addEventListener(EVENTO_CONSENTIMENTO, aoMudarConsentimento);

    supabase.auth.getUser().then(({ data }) => aplicar(data.user?.id ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento, session) => {
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT') void aplicar(session?.user?.id ?? null);
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
      window.removeEventListener(EVENTO_CONSENTIMENTO, aoMudarConsentimento);
    };
  }, []);

  return null;
}
