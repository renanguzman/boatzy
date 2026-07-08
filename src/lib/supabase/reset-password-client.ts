import { createClient } from '@supabase/supabase-js';

// Client dedicado só para resetPasswordForEmail (site e painel), com flowType 'implicit'.
// Os clients padrão (./client e ./server) usam @supabase/ssr, que força flowType 'pkce'
// (não é configurável). Isso faria o Supabase gerar um token que só pode virar sessão no
// MESMO navegador/perfil que pediu o reset (o code_verifier fica em cookie local) —
// inviável para recuperação de senha, em que é comum abrir o e-mail em outro navegador
// ou dispositivo. Com flowType 'implicit', o token do e-mail é validado só pelo
// token_hash (verifyOtp em /auth/confirm), sem depender de nenhum cookie local.
export const resetPasswordClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);
