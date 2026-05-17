---
name: Migração Auth Clerk → Supabase
description: Contexto e decisões da migração de autenticação do Clerk para o Supabase Auth
type: project
---

Migração concluída em 2026-05-17. O projeto Boatzy trocou o Clerk pelo Supabase Auth.

**Why:** Simplificar o stack (Supabase já era o DB), eliminar custo do Clerk, e habilitar login social via Google, Facebook e Apple.

**Providers OAuth configurados:** Google, Facebook, Apple (Instagram não é suportado pelo Supabase nativamente).

**Decisões chave:**
- `users.id` agora = `auth.users.id` (FK direta, sem `id_clerk`)
- Roles lidas diretamente do banco (`user_roles`) nos Server Components — sem cache em JWT (Custom Access Token Hook documentado no SQL mas não habilitado ainda)
- Clientes Supabase: `src/lib/supabase/client.ts` (browser), `src/lib/supabase/server.ts` (SSR), `src/lib/supabase/admin.ts` (service role)
- Middleware em `src/proxy.ts` usa `@supabase/ssr` para renovar sessão automaticamente
- Callbacks OAuth: `/auth/callback` (site público → role cliente) e `/painel/auth/callback` (painel → role gestor)
- Página `/painel/auth/atualizando` foi deletada (não necessária com Supabase)

**How to apply:** Ao implementar novas features que precisam de autenticação, usar `createClient()` de `@/lib/supabase/server` em Server Components e `createClient()` de `@/lib/supabase/client` em Client Components. Nunca expor `supabaseAdmin` ao browser.
