<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Feature Development Protocol

Before implementing any new feature or functionality:
1. Read `PRD.md` to understand product requirements and priorities.
2. Read `SPEC.md` to understand technical specifications and contracts.

After implementing each feature:
1. Update `SPEC.md` to reflect any new or changed technical details (endpoints, data models, component interfaces, etc.).
2. Update `PRD.md` to mark the feature as implemented and note any scope changes or decisions made during implementation.

Keep both files as the source of truth — they should always reflect the current state of the product.

# Supabase migrations — GRANTs obrigatórios

Desde 30/10/2026 o Supabase não concede mais acesso automático da Data API a tabelas novas do schema `public`. Toda migration que cria uma tabela (`CREATE TABLE public.x`) deve, na mesma migration e logo após habilitar RLS, incluir os GRANTs:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.x TO anon, authenticated, service_role;
-- se houver coluna identity/serial:
GRANT USAGE, SELECT ON SEQUENCE public.x_id_seq TO anon, authenticated, service_role;
```

Sem isso, o supabase-js retorna `permission denied`, inclusive no `supabaseAdmin` (service role ignora RLS, mas não ignora GRANT). O controle de acesso continua nas policies de RLS. Referência: `supabase/migrations/20260927_grants_data_api.sql`.

# Datas e fuso horário

O servidor (Vercel) e o Postgres do Supabase rodam em UTC; o Boatzy exibe e decide tudo no horário de Brasília. Nunca formate data sem fuso nem calcule "hoje" com `toISOString()`:

- Exibição: `formatarData`, `formatarDataHora`, `formatarHora` de `src/lib/datas.ts` (ou `timeZone: FUSO_HORARIO` em qualquer `toLocale*String`/`Intl.DateTimeFormat`).
- "Hoje" / dia de um instante: `hojeISO()` / `dataISONoFuso(date)`; agrupamento por mês: `partesNoFuso(date)`.
- Campos só de data (`data_reserva`, `data_validade`…): nunca `new Date('AAAA-MM-DD')` puro (vira meia-noite UTC e mostra o dia anterior) — use `formatarData`/`paraData`.
- Funções SQL que usem `CURRENT_DATE`/`now()::date`: `ALTER FUNCTION … SET timezone = 'America/Sao_Paulo'` na mesma migration. Referência: `supabase/migrations/20261001_funcoes_fuso_brasilia.sql`.

