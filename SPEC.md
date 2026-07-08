# SPEC — Boatzy (MVP)

## 1. Overview

**Product:** Boatzy  
**Type:** Marketplace de aluguel de embarcações  
**Arquitetura:** Fullstack (Next.js)  
**Deploy:** Vercel  

---

## 2. Arquitetura do Sistema

### 2.1 Stack

- Frontend: React (Next.js - App Router)
- Backend: Next.js API Routes (Node.js)
- Database: Supabase (PostgreSQL)
- Auth: Supabase Auth (OAuth: Google, Facebook, Apple; email/senha)
- Storage: Supabase Storage
- Payments: Stripe Connect

---

### 2.2 Arquitetura Geral

Client (React / Next.js)
        ↓
Next.js API (Server)
        ↓
Supabase Auth (Sessions / OAuth)
        ↓
Supabase (DB + Storage)
        ↓
Stripe (Payments)

---

## 3. Modelos de Dados

### Users

id UUID PK  
clerk_id VARCHAR  
name VARCHAR  
email VARCHAR  
role VARCHAR (client | owner)  
created_at TIMESTAMP  

---

### Boats

id UUID PK  
owner_id UUID  
name VARCHAR  
type VARCHAR  
capacity INT  
location VARCHAR  
price_per_day INT  
description TEXT  
created_at TIMESTAMP  

---

### BoatImages

id UUID PK  
boat_id UUID  
url TEXT  

---

### Reservations

id UUID PK  
boat_id UUID  
user_id UUID  
start_date DATE  
end_date DATE  
status VARCHAR  
total_price INT  
created_at TIMESTAMP  

---

### Reviews

id UUID PK  
boat_id UUID  
user_id UUID  
rating INT (1-5)  
comment TEXT  
created_at TIMESTAMP  

---

## 4. API Endpoints

### Boats

GET /api/boats  
GET /api/boats/:id  
POST /api/boats  
PUT /api/boats/:id  
DELETE /api/boats/:id  

---

### Reservations

POST /api/reservations  
GET /api/reservations  
PATCH /api/reservations/:id  

---

### Payments

POST /api/payments/create-intent  

---

### Reviews

POST /api/reviews  
GET /api/reviews/:boat_id  

---

## 5. Regras de Negócio

- Apenas usuários autenticados podem reservar  
- Apenas owners podem criar embarcações  
- Usuário só pode avaliar após reserva concluída  
- Taxa da plataforma: dinâmica — ver seção 14  
- Sem conflito de datas  

---

## 6. Integração com Stripe

Split automático calculado em runtime:

- Owner: `100% - taxa_efetiva`
- Boatzy: `taxa_efetiva` (resolvida via `get_taxa_usuario`)  

---

## 7. Upload de Imagens

- Supabase Storage  
- URL pública salva no banco  

---

## 8. Segurança

- **Auth via Supabase Auth** (`@supabase/ssr`) com suporte a email/senha e OAuth (Google, Facebook, Apple).
- Sessões gerenciadas via cookies HTTP-only, renovadas automaticamente pelo middleware.
- Middleware (`src/proxy.ts`): cria client Supabase SSR, chama `getUser()` para renovar a sessão, redireciona rotas `/painel/**` não autenticadas para `/painel/login`.
- Rotas públicas do painel: `/painel/login`, `/painel/cadastro`, `/painel/auth/*`, `/api/painel/setup-role`.
- Gating por role: `src/app/painel/(gestao)/layout.tsx` consulta `user_roles` no Supabase para verificar se o usuário tem `gestor` ou `admin`. Usuários sem a role veem tela "Acesso Restrito" com botão "Tornar-me gestor".
- `SUPABASE_SERVICE_ROLE_KEY` nunca exposta ao browser — usada apenas em `src/lib/supabase/admin.ts` (`server-only`).
- Validação de inputs e open-redirect mitigation em todas as rotas de callback.  

---

## 9. Fluxos

Reserva de roteiro (implementado — ver §20):  
Cliente → Busca → Detalhe do roteiro (data/pessoas/adicionais) → Login → `/reservas/novo` (confirma) → Reserva **Pendente** → Gestor Confirma/Recusa no painel  

Cadastro:  
Owner → Cria barco → Upload → Publica  

Avaliação:  
Reserva concluída → Avaliação → Publicação  

---

## 10. Deploy

Variáveis:

SUPABASE_URL  
SUPABASE_KEY  
CLERK_API_KEY  
STRIPE_SECRET_KEY  

---

## 11. Modelagem de Dados — Supabase

### Tabela `users`

```sql
id          uuid primary key                     -- = auth.users.id (FK)
name        text not null
email       text not null unique
cpf_cnpj    text
birthday    date
avatar_url  text
created_at  timestamptz default now()
updated_at  timestamptz default now()
```

`users.id` referencia `auth.users(id) ON DELETE CASCADE`.  
RLS habilitado: usuário lê/atualiza apenas o próprio registro.

Migration: `supabase/migrations/001_create_users_table.sql`  
Migration de migração Clerk→Supabase: `supabase/migrations/20260517_clerk_to_supabase_auth.sql`

Clientes Supabase:
- `createClient()` de `@/lib/supabase/client` — browser, anon key, RLS ativo
- `createClient()` de `@/lib/supabase/server` — Server Components / Route Handlers, SSR com cookies
- `supabaseAdmin` de `@/lib/supabase/admin` — server-only, service role, bypassa RLS

---

## 12. Painel do Gestor (`/painel`)

Módulo independente do hotsite, acessível apenas por usuários cuja lista de roles inclua `'gestor'` ou `'admin'`.

### Estrutura de rotas

| Rota | Descrição | Auth |
|------|-----------|------|
| `/painel/login` | Login de gestores | Pública |
| `/painel/cadastro` | Cadastro de gestores | Pública |
| `/painel` | Dashboard com dados reais do gestor (ver "Dashboard" abaixo) | gestor/admin |
| `/painel/agendamentos` | Listagem/gestão de reservas (Confirmar/Recusar) — ver §20 | gestor/admin |
| `/painel/embarcacoes` | CRUD de embarcações | gestor/admin |
| `/painel/usuarios` | Cadastro e listagem de usuários | gestor/admin |

### Dashboard (`/painel`)

`src/app/painel/(gestao)/page.tsx` — Server Component (era template mock `'use client'`; reescrito
com dados reais). Valida sessão (`redirect /painel/login`), chama `concluirReservasVencidas()` e
carrega em paralelo (`Promise.all`, via `supabaseAdmin`, tudo filtrado por `owner_id = user.id`):
`embarcacao (id, status)`, `roteiro (id, ativo)` e `reserva` completa (com embed
`cliente:users!reserva_cliente_id_fkey ( name )`, `order solicitado_em desc`).

- **Cards** (grid 4, cada um é `<Link>` para a seção): Agendamentos pendentes (valor =
  `status='pendente'`; sub = total; alerta âmbar quando > 0), Embarcações (sub = ativas), Roteiros
  (sub = ativos), Clientes (`Set` de `cliente_id`).
- **Gráfico de barras** (HTML/CSS, sem lib): solicitações por mês nos últimos 6 meses — buckets
  montados a partir do mês corrente (`MESES_CURTOS` pt-BR), agregação em memória por
  `solicitado_em`; barra do maior mês em navy (`#0B2447`), demais em slate; contagem acima da barra.
- **Destaque do período:** agrupa reservas da janela por alvo (`tipo:roteiro_id|embarcacao_id`),
  exibe o mais solicitado (nome, % do total da janela, contagem, tipo) com link para
  `/painel/agendamentos`; fallback sem reservas → CTA "Gerenciar roteiros".
- **Últimas solicitações:** tabela com as 6 reservas mais recentes — item + badge de tipo
  (roteiro/embarcação), cliente, data do passeio, pessoas, total estimado (`formatCurrency`),
  status (mapa dos 5 status com cores), solicitada em, link "Detalhes" →
  `/painel/agendamentos/[id]`; header com "Ver todas". Estado vazio com borda tracejada.
- Ícone `Map` do lucide importado como `MapIcon` (evita sombrear o construtor global `Map`).

### Modelo multi-role

Um usuário pode ter mais de uma role com o mesmo e-mail (ex.: `['cliente', 'gestor']`). A fonte da verdade é a tabela Supabase `user_roles` (chave única `(user_id, role)`). Roles são lidas diretamente do banco pelos Server Components — não há cache em JWT (a menos que o Custom Access Token Hook seja habilitado no Supabase Dashboard).

Helpers em `src/lib/roles.ts` (`server-only`):
- `getRolesFromDb(userId)` — lê roles do Supabase via `user_id = auth.uid`.
- `addRole(userId, role)` — upsert idempotente em `user_roles`.
- `checkRoleInDb(userId, roles)` — verifica se o usuário tem pelo menos uma das roles (fonte da verdade).

### Provedores OAuth suportados

| Provedor | Supabase Provider ID | Status        | Origem da foto de perfil          |
|----------|----------------------|---------------|-----------------------------------|
| Google   | `google`             | ✅ Configurado | `*.googleusercontent.com`         |
| Facebook | `facebook`           | ✅ Configurado | `platform-lookaside.fbsbx.com`    |
| Apple    | `apple`              | ✅ Configurado | —                                 |

Configurados no Supabase Dashboard → Authentication → Providers.  
Redirect URI obrigatória: `https://SEU_PROJECT.supabase.co/auth/v1/callback`

**Domínio de retorno (produção):** o `redirectTo` dos três provedores é montado a partir de `NEXT_PUBLIC_APP_URL`, e **não** mais de `window.location.origin` — isso evita que o login social retorne ao domínio `*.vercel.app`. Para o domínio final `https://www.boatzy.app` funcionar, três pontos devem estar alinhados:
- **Vercel** → `NEXT_PUBLIC_APP_URL = https://www.boatzy.app`
- **Supabase** → Authentication → URL Configuration → **Site URL** = `https://www.boatzy.app`
- **Supabase** → **Redirect URLs** (allow list): `https://www.boatzy.app/auth/callback`, `https://www.boatzy.app/painel/auth/callback`, `https://www.boatzy.app/auth/confirm`, `https://www.boatzy.app/painel/auth/confirm`, `http://localhost:3000/auth/confirm` e `http://localhost:3000/painel/auth/confirm` (dev — recuperação de senha do site e do painel)

**Domínios de imagem (`next.config.ts`):** os avatares dos provedores são renderizados com `next/image`, portanto o host precisa estar em `images.remotePatterns`. Liberados: `*.googleusercontent.com`, `*.fbcdn.net` e `platform-lookaside.fbsbx.com` (Facebook entrega a foto de perfil por este último, não por `*.fbcdn.net`). Alterar `next.config.ts` exige reiniciar o servidor de dev.

**Configuração do Facebook (Meta for Developers):** app do tipo Empresa com produto *Login do Facebook*; em *Login do Facebook → Configurações*, a Redirect URI do Supabase deve constar em "URIs de redirecionamento do OAuth válidos"; App ID e App Secret (App settings → Basic) vão em Authentication → Providers → Facebook no Supabase. Em modo de desenvolvimento, só contas com papel no app conseguem logar; publicar exige URL de política de privacidade.

### Vínculo de identidades (mesmo e-mail, múltiplos provedores)

O Supabase Auth faz **vínculo automático de identidades** quando o e-mail é o mesmo **e verificado** pelo provedor: as identidades (`google`, `facebook`, …) apontam para o **mesmo `auth.users.id`**. O código reforça isso — `setup-cliente` e `setup-role` fazem upsert de `public.users` **pela chave `user.id`** (nunca por e-mail), de modo que um mesmo `auth.users.id` sempre mapeia para uma única linha em `public.users` → uma só conta no Boatzy.

Verificação (SQL Editor do Supabase): um único `user_id` com múltiplas linhas em `auth.identities` confirma o vínculo.
```sql
select u.id as user_id, u.email, i.provider
from auth.users u
join auth.identities i on i.user_id = u.id
where u.email = 'EMAIL'
order by i.provider;
```
> ⚠️ `public.users.email` é `NOT NULL UNIQUE`. Caso o vínculo automático não ocorra (ex.: e-mail não verificado pelo provedor), o Supabase criaria um segundo `auth.users` com o mesmo e-mail e o insert em `public.users` violaria a unicidade — hoje esse erro não é tratado em `setup-cliente`/`setup-role`. Confirmado em produção que Google + Facebook com e-mail verificado vinculam corretamente.

Os botões de login social são renderizados pelo componente compartilhado `SocialLoginButtons` (`src/components/auth/SocialLoginButtons.tsx`), usado em `/entrar`, `/painel/login` e `/painel/cadastro`. Ele recebe `onProvider(provider)` e gerencia o próprio estado de loading; cada tela monta o `redirectTo` apropriado (site → `/auth/callback`; painel → `/painel/auth/callback`). Todas as telas derivam a URL base de `NEXT_PUBLIC_APP_URL` (helper `baseUrl()` em `/entrar`; constante `APP_URL` no painel), com fallback para `window.location.origin` apenas se a env não estiver definida — assim os três provedores sempre retornam ao domínio de produção.

### Login de Cliente no Site (`/entrar`)

`src/app/entrar/page.tsx` (`'use client'`) — login/cadastro do cliente com email/senha **e** OAuth (Google/Facebook/Apple).

- `redirect_to` (query param) preserva a página de origem.
- **Email/senha:** `signInWithPassword` / `signUp`, depois `window.location.href = /api/auth/setup-cliente?redirect_to=...`.
- **OAuth:** `signInWithOAuth({ provider, options: { redirectTo: `${baseUrl()}/auth/callback?next=/api/auth/setup-cliente?redirect_to=...` } })`, onde `baseUrl()` = `NEXT_PUBLIC_APP_URL ?? window.location.origin`.
- Em qualquer caminho a role resultante é `cliente`.

### Recuperação de senha (site e painel)

Duas superfícies, cada uma com seu próprio trio de rotas (todas públicas — ver `painelPublicRoutes` em `src/proxy.ts` para as do painel; as do site não são protegidas pelo proxy):

| | Site (cliente) | Painel (gestor) |
|---|---|---|
| Solicitar | `/recuperar-senha` | `/painel/recuperar-senha` |
| Confirmar token | `GET /auth/confirm` | `GET /painel/auth/confirm` |
| Definir nova senha | `/redefinir-senha` | `/painel/redefinir-senha` |

Mesmo padrão já usado no OAuth (`/auth/callback` vs `/painel/auth/callback`): **rotas de confirmação separadas por superfície, cada uma com destino fixo** (não um `next` dinâmico por query) — evita que a URL do `redirectTo` (comparada por inteiro contra a allow list do Supabase) varie e quebre a validação.

1. **`/recuperar-senha`** / **`/painel/recuperar-senha`** (`'use client'`) — form de e-mail que chama `resetPasswordForEmail` com `redirectTo` apontando para a rota de confirmação da própria superfície (sem query string). O card de sucesso é **genérico** ("Se existir uma conta para…") mesmo para e-mail inexistente — anti-enumeração de contas (o Supabase também não revela). A versão do site lê `?error=link-invalido` via `useSearchParams` (exige o wrapper `<Suspense>`, mesmo padrão de `/entrar`); a do painel idem. Não redireciona usuário já logado — pessoa logada pode legitimamente redefinir a senha.
2. **`GET /auth/confirm`** / **`GET /painel/auth/confirm`** (`src/app/auth/confirm/route.ts` e `src/app/painel/auth/confirm/route.ts`) — valida o token do e-mail via `verifyOtp({ type, token_hash })` (client SSR compartilhado de `@/lib/supabase/server`), grava a sessão nos cookies e redireciona para o destino fixo da sua superfície (`/redefinir-senha` ou `/painel/redefinir-senha`). Qualquer falha → volta para a tela de solicitação da mesma superfície com `?error=link-invalido`. A versão do site ainda aceita um `next` opcional por query (aceita **apenas caminhos relativos** — guarda anti-open-redirect), mas nada no app o utiliza hoje além do default.
3. **`/redefinir-senha`** / **`/painel/redefinir-senha`** (`'use client'`) — máquina de estados `checking | no-session | form | success`. No mount, `getUser()`: sem sessão → card "Link inválido ou expirado" com CTA para a tela de solicitação da mesma superfície. Com sessão → form nova senha + confirmação (`minLength=6`, validação local de igualdade) → `supabase.auth.updateUser({ password })` → card "Senha redefinida!". Erro de sessão no submit (`session_expired`/`session_not_found`) rebaixa para `no-session`. **Diferença entre as duas:** no site o botão de sucesso leva para `/`; no painel, o botão ("Entrar no Painel") aponta para `GET /api/painel/setup-role` — mesmo endpoint usado após login/cadastro do gestor — garantindo (upsert idempotente) que a conta tenha a role `gestor` antes de entrar em `/painel`, já que a recuperação de senha em si não atribui roles.

**Client dedicado com `flowType: 'implicit'` só para `resetPasswordForEmail`** (`src/lib/supabase/reset-password-client.ts`, usado pelas duas telas de solicitação). Os clients padrão (`@/lib/supabase/client` e `server`) usam `@supabase/ssr`, que força `flowType: 'pkce'` (não é configurável — `createBrowserClient.js`/`createServerClient.js` sobrescrevem qualquer `flowType` passado nas options). Se as telas de solicitação usassem esse client compartilhado, o `resetPasswordForEmail` enviaria um `code_challenge` ao Supabase e guardaria o `code_verifier` correspondente em cookie — o token do e-mail viria prefixado com `pkce_` e só poderia virar sessão **no mesmo navegador/perfil** que fez o pedido (via `exchangeCodeForSession`, que lê esse cookie). Isso quebra o caso comum de abrir o e-mail de recuperação em outro navegador, app de e-mail ou dispositivo.

O client dedicado usa `@supabase/supabase-js` puro (não `@supabase/ssr`) com `{ flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }` — sem tocar no client/sessão principal do app. Sem `code_challenge`, o Supabase gera um `token_hash` "puro", validável via `verifyOtp` independentemente de cookies locais, então o link funciona em qualquer navegador ou dispositivo.

Ambas as rotas de confirmação mantêm um fallback defensivo: se algum token chegar prefixado com `pkce_` (não deveria acontecer no fluxo atual), usam `exchangeCodeForSession(token_hash)` em vez de `verifyOtp` — mas nesse caso só funciona no mesmo navegador que originou o pedido.

**Template de e-mail "Reset Password"** (Dashboard → Authentication → Emails → Templates), único e global, com o href:
```html
{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery&next=/redefinir-senha
```
`{{ .RedirectTo }}` (e não `{{ .SiteURL }}`) resolve para a URL que a tela de solicitação passou em `redirectTo` — o mesmo template serve as duas superfícies sem alteração (o `&next=/redefinir-senha` fixo é ignorado por `/painel/auth/confirm`, que sempre redireciona para `/painel/redefinir-senha` independente da query). **A URL do `redirectTo` precisa estar na allow list** (ver "Domínio de retorno" acima, agora com 4 entradas de confirmação); caso contrário o Supabase a substitui silenciosamente pelo Site URL — verificado em teste (`generate_link` com uma URL fora da allow list devolveu o Site URL em vez do `redirect_to` enviado).

**Erros traduzidos** (helpers locais por página, via `error.code` com fallback em mensagem): `over_email_send_rate_limit`/`over_request_rate_limit`, `email_address_invalid`, `same_password`, `weak_password`, `otp_expired` (via redirect de erro das rotas de confirmação).

**Notas de comportamento:**
- A sessão criada pelo recovery é uma sessão completa — após redefinir, o usuário está logado.
- No site, o fluxo não passa por `/api/auth/setup-cliente`; irrelevante para quem já tem conta (role já existe). No painel, o botão de sucesso passa por `/api/painel/setup-role` de propósito, para cobrir o caso de a role `gestor` ainda não existir.
- Scanners de e-mail corporativos podem consumir o link via GET antes do usuário (limitação aceita do fluxo GET, adotado pela própria doc do Supabase; mitigação futura: página intermediária com botão de confirmação).
- `src/proxy.ts` inclui `/painel/recuperar-senha` e `/painel/redefinir-senha` em `painelPublicRoutes` (e `/painel/auth/**` já cobria `/painel/auth/confirm`) — sem isso, quem não está logado (o público-alvo da recuperação de senha) seria barrado antes mesmo de ver o formulário.

### Endpoints de atribuição

Ambos são **aditivos** (não substituem roles existentes):

- `GET /api/painel/setup-role`
  1. Lê sessão via `createClient()` SSR.
  2. Upsert do usuário em `users` com `id = auth.uid()`.
  3. `addRole(userId, 'gestor')`.
  4. Redireciona para `/painel`.

- `GET /api/auth/setup-cliente?redirect_to=/...`
  1. Mesmo fluxo de upsert.
  2. `addRole(userId, 'cliente')`.
  3. Redireciona para `redirect_to` (caminho relativo apenas).

### Callback OAuth

- `/painel/auth/callback` — para OAuth iniciado no painel; após trocar code por session, redireciona para `/api/painel/setup-role`.
- `/auth/callback?next=...` — para OAuth iniciado no site público; redireciona para `next` (geralmente `/api/auth/setup-cliente?redirect_to=...`).

### Verificação de acesso

Layout do painel (`src/app/painel/(gestao)/layout.tsx`) consulta `user_roles` no banco:
```ts
const { data: rows } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id);
const canAccess = roles.includes('gestor') || roles.includes('admin');
```

Usuário sem role adequada vê tela "Acesso Restrito" com botão **Tornar-me gestor** → chama `/api/painel/setup-role`.

---

## 13. Modelagem de Dados — Embarcações

Migration: `supabase/migrations/002_create_embarcacao_tables.sql`

### Tabela `estados`

```sql
id         integer primary key          -- código IBGE
uf         char(2) not null
nome       text not null
latitude   numeric
longitude  numeric
regiao     text
```

RLS: leitura pública, escrita apenas via service role.

---

### Tabela `municipios`

```sql
id           integer primary key          -- código IBGE
nome         text not null
latitude     numeric
longitude    numeric
capital      boolean default false
estado_id    integer FK → estados(id)
siafi_id     integer
ddd          integer
fuso_horario text
```

RLS: leitura pública, escrita apenas via service role.

---

### Tabela `embarcacao_tipo` (auxiliar)

```sql
id   uuid primary key default gen_random_uuid()
nome text not null unique
```

Seeds iniciais: Lancha, Iate, Jet Ski, Veleiro, Catamarã, Barco de Pesca, Escuna, Bote.

---

### Tabela `embarcacao_categoria` (auxiliar)

```sql
id   uuid primary key default gen_random_uuid()
nome text not null unique
```

Seeds iniciais: Passeio, Pesca, Esporte, Luxo, Familiar.

---

### Tabela `embarcacao`

```sql
id                      uuid primary key default gen_random_uuid()
owner_id                uuid not null FK → users(id)
nome                    text not null
descricao               text
capacidade              integer
comprimento             numeric(6,2)          -- metros
cabines                 integer
quartos                 integer
suites                  integer
tripulacao              integer
embarcacao_tipo_id      uuid FK → embarcacao_tipo(id)
embarcacao_categoria_id uuid FK → embarcacao_categoria(id)
municipio_id            integer FK → municipios(id)
latitude                numeric(10,7)         -- coordenada exata da atracação
longitude               numeric(10,7)
cep                     char(8)
bairro                  text
logradouro              text
logradouro_numero       text
complemento             text
created_at              timestamptz default now()
updated_at              timestamptz default now()
```

RLS:
- service role: acesso total.
- owner autenticado: SELECT / INSERT / UPDATE sobre seus próprios registros.
- público: SELECT (listagem no hotsite).

---

### Tabela `embarcacao_imagens`

Migration: `supabase/migrations/003_embarcacao_imagens.sql`

```sql
id             uuid primary key default gen_random_uuid()
embarcacao_id  uuid not null FK → embarcacao(id) ON DELETE CASCADE
url_imagem     text not null
titulo         text
principal      boolean not null default false
data_criacao   timestamptz not null default now()
```

RLS:
- service role: acesso total.
- público: SELECT.
- owner autenticado: INSERT / UPDATE / DELETE sobre imagens das suas embarcações.

> `data_criacao` foi adicionado também à tabela `embarcacao` (migration 003).

### Upload de imagens (embarcações e roteiros)

As imagens são enviadas ao Cloudflare R2 pelas rotas:
- `POST /api/painel/embarcacoes/upload` e `POST /api/painel/embarcacoes/presigned-url`
- `POST /api/painel/roteiros/upload`

**Limites de arquivo** centralizados em `src/lib/upload.ts` (módulo neutro, importado tanto pelas rotas de API quanto pelos formulários no client):
- `MAX_IMAGE_SIZE_MB = 20` / `MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024` — tamanho máximo por arquivo: **20 MB**.
- `MAX_IMAGE_SIZE_ERROR` — mensagem exibida ao usuário quando o arquivo excede o limite (`"O arquivo não pode ser maior que 20 MB."`).

Validação em duas camadas:
- **Client** (`addFiles` nos formulários de cadastro/edição de embarcação e roteiro): arquivos acima do limite são descartados antes do upload e a mensagem `MAX_IMAGE_SIZE_ERROR` é exibida no banner de feedback do formulário.
- **Servidor** (rotas acima): rejeitam com `400` e a mesma mensagem caso o `size`/`file.size` exceda `MAX_IMAGE_SIZE_BYTES`.

Tipos permitidos: `image/jpeg`, `image/png`, `image/webp` (a rota de presigned-url também aceita `image/gif`).

---

## 14. Taxas da Plataforma

Migration: `supabase/migrations/004_taxas_plataforma.sql`

### Tabela `taxa_plataforma` (singleton)

```sql
id           uuid primary key default gen_random_uuid()
taxa_percent numeric(5,2) not null check (taxa_percent between 0 and 100)
descricao    text
singleton    boolean not null default true unique check (singleton = true)  -- garante 1 linha
created_at   timestamptz not null default now()
updated_at   timestamptz not null default now()
```

Seed inicial: `10.00` (10%). Um único registro atualizado in-place pelos admins.

RLS:
- service role: acesso total.
- público: SELECT (necessário para exibir a taxa no checkout/hotsite).

---

### Tabela `usuario_taxa`

```sql
id             uuid primary key default gen_random_uuid()
user_id        uuid not null unique FK → users(id) ON DELETE CASCADE
taxa_percent   numeric(5,2) not null check (taxa_percent between 0 and 100)
ativo          boolean not null default true
data_validade  date                    -- null = sem expiração; preenchido = expira no final do dia
observacao     text
created_at     timestamptz not null default now()
updated_at     timestamptz not null default now()
```

RLS:
- service role: acesso total.
- usuário autenticado: SELECT sobre seu próprio registro.

---

### Função `get_taxa_usuario`

```sql
public.get_taxa_usuario(p_user_id uuid) → numeric(5,2)
```

Resolve a taxa efetiva de um usuário com a seguinte lógica:

```
SE existe usuario_taxa onde
     user_id = p_user_id
     AND ativo = true
     AND (data_validade IS NULL OR data_validade >= CURRENT_DATE)
ENTÃO retorna usuario_taxa.taxa_percent
SENÃO retorna taxa_plataforma.taxa_percent
```

> **OBRIGATÓRIO:** todo cálculo de reserva no backend e qualquer exibição de taxa no frontend **deve** consultar essa função. Nunca hardcode o valor da taxa.

**Exemplo de uso no backend (Supabase RPC):**

```ts
const { data } = await supabaseAdmin.rpc('get_taxa_usuario', {
  p_user_id: dbUserId,
});
const taxaPercent: number = data; // ex.: 8.50
```

**Exemplo de uso direto no SQL (ao criar reserva):**

```sql
SELECT public.get_taxa_usuario('uuid-do-usuario') AS taxa;
```

---

## 15. Precificação Dinâmica de Embarcações

Migration: `supabase/migrations/006_embarcacao_precificacao.sql`

### Coluna `preco_base` em `embarcacao`

```sql
preco_base  numeric(10,2)   -- valor padrão por dia; null = sem preço definido
```

Fallback quando nenhuma regra ativa se aplicar à data pesquisada.

---

### Tabela `embarcacao_preco_regra`

```sql
id                  uuid primary key
embarcacao_id       uuid not null FK → embarcacao(id) ON DELETE CASCADE
nome                text not null          -- ex: "Fim de Semana", "Verão 2025"
valor               numeric(10,2) not null
tipo                preco_regra_tipo       -- 'dia_semana' | 'periodo_anual' | 'data_fixa'
prioridade          integer default 0      -- desempate entre regras do mesmo tipo (maior vence)
ativo               boolean default true

-- tipo = 'dia_semana'
dias_semana         integer[]              -- 0=dom … 6=sab

-- tipo = 'periodo_anual'
periodo_mes_inicio  integer                -- 1–12
periodo_dia_inicio  integer                -- 1–31
periodo_mes_fim     integer
periodo_dia_fim     integer

-- tipo = 'data_fixa'
data_inicio         date
data_fim            date

created_at / updated_at
```

Constraints CHECK garantem que os campos corretos para cada `tipo` estejam preenchidos.

#### Camadas de prioridade (maior → menor)

| Camada | tipo | Exemplo |
|--------|------|---------|
| 1ª | `data_fixa` | Réveillon 29/12–02/01: R$ 3.000 |
| 2ª | `periodo_anual` | Verão (01/12–28/02): R$ 2.000 |
| 3ª | `dia_semana` | Sábado e domingo: R$ 1.500 |
| 4ª | — | `preco_base`: R$ 1.000 |

Dentro do mesmo tipo, `prioridade DESC` quebra empates.

#### Suporte a períodos que cruzam o ano

O tipo `periodo_anual` detecta automaticamente cruzamento de ano (ex: dezembro → março) comparando `inicio_mmdd` vs `fim_mmdd`. O campo `mmdd = mes * 100 + dia` é calculado na função, sem coluna extra.

RLS:
- service role: acesso total.
- owner autenticado: SELECT / INSERT / UPDATE / DELETE sobre regras das suas embarcações.
- público: SELECT (exibição de preço no hotsite).

---

### Função `get_preco_embarcacao`

```sql
public.get_preco_embarcacao(p_embarcacao_id uuid, p_data date) → numeric(10,2)
```

Resolve o preço efetivo de uma embarcação para uma data específica percorrendo as camadas em ordem de prioridade. Retorna `NULL` se `preco_base` também for nulo.

**OBRIGATÓRIO:** toda exibição de preço no frontend e todo cálculo de reserva no backend devem chamar essa função. Nunca leia `preco_base` diretamente para exibir ao usuário.

**Exemplo de uso no backend (Supabase RPC):**
```ts
const { data: preco } = await supabaseAdmin.rpc('get_preco_embarcacao', {
  p_embarcacao_id: embarcacaoId,
  p_data: '2025-12-31',         // date da reserva desejada
});
// preco: 3000.00 (regra data_fixa de Réveillon)
```

**Exemplo de uso na listagem (múltiplas embarcações):**
```ts
const { data: precos } = await supabaseAdmin.rpc('get_precos_embarcacoes', {
  p_embarcacao_ids: ids,         // uuid[]
  p_data: searchDate,
});
// precos: [{ embarcacao_id, preco_efetivo }, ...]
```

### Função `get_precos_embarcacoes`

```sql
public.get_precos_embarcacoes(p_embarcacao_ids uuid[], p_data date)
  → TABLE (embarcacao_id uuid, preco_efetivo numeric(10,2))
```

Batch da função anterior. Use na tela de busca do hotsite para resolver preços de todas as embarcações listadas em uma única chamada RPC.

---

## 15-B. Disponibilidade (Roteiro e Embarcação)

Migrations: `supabase/migrations/015_roteiro_disponibilidade.sql` (roteiro) e `supabase/migrations/016_embarcacao_disponibilidade.sql` (embarcação).

O mesmo modelo se aplica a **roteiro** e **embarcação** — as descrições abaixo usam `roteiro` como exemplo; para embarcação, troque `roteiro` por `embarcacao` e `roteiro_disponibilidade_bloqueio` por `embarcacao_disponibilidade_bloqueio` (coluna `embarcacao_id` no lugar de `roteiro_id`).

Modelo escolhido: **recorrência semanal + bloqueio de datas pontuais**, granularidade de **dia inteiro**, capacidade **exclusiva (1 reserva por dia)**.

### Coluna `disponibilidade_dias_semana` em `roteiro` / `embarcacao`

```sql
disponibilidade_dias_semana smallint[]   -- dias da semana que opera (0=Dom..6=Sáb)
```

- `NULL` ou vazio = **sem restrição de dia da semana** (disponível todos os dias, sujeito apenas aos bloqueios). Garante retrocompatibilidade com roteiros já cadastrados.
- Preenchido = o roteiro só fica disponível nos dias da semana listados.
- A action grava `null` quando o array vem vazio (não persiste `{}`).

### Tabela `roteiro_disponibilidade_bloqueio`

```sql
id          uuid PK
roteiro_id  uuid FK → roteiro ON DELETE CASCADE
data        date NOT NULL          -- data bloqueada (exceção)
motivo      text                   -- opcional (reservado para uso futuro)
created_at  timestamptz
UNIQUE (roteiro_id, data)
```

RLS: `service_role` total; `public_read` (SELECT liberado); owner pode INSERT/DELETE nos bloqueios dos seus roteiros/embarcações (via `EXISTS` em `roteiro`/`embarcacao` com `owner_id = auth.uid()`).

### Regra de disponibilidade efetiva (frontend)

Uma data está **indisponível** quando:
1. `disponibilidade_dias_semana` está definido **e** o dia da semana da data **não** está incluído; **ou**
2. a data consta em `roteiro_disponibilidade_bloqueio`.

> Capacidade exclusiva está modelada no schema, mas o bloqueio automático de datas já reservadas é um gancho futuro — depende da persistência de reservas, ainda não implementada.

### Painel (cadastro/edição)

- Componente compartilhado `src/components/painel/DisponibilidadePicker.tsx`: chips de dias da semana + mini-calendário para marcar/desmarcar bloqueios + lista de datas bloqueadas. Reutilizado por roteiros **e** embarcações (props genéricas: `diasSemana`, `bloqueios` e callbacks).
- Usado nos forms `NovoRoteiroForm`/`EditarRoteiroForm` e `NovaEmbarcacaoForm`/`EditarEmbarcacaoForm` (seção "Disponibilidade").
- Server actions:
  - Roteiro: `criarRoteiro`/`atualizarRoteiro` gravam `disponibilidade_dias_semana`; `salvarBloqueiosRoteiro(roteiroId, datas[])`.
  - Embarcação: `criarEmbarcacao`/`atualizarEmbarcacao` gravam `disponibilidade_dias_semana`; `salvarBloqueiosEmbarcacao(embarcacaoId, datas[])`.
  - Ambas substituem o conjunto de bloqueios (delete-all + insert). Datas trafegam como `'yyyy-mm-dd'`.

### Hotsite (calendário público)

- `DatePicker` (`src/components/home/search/DatePicker.tsx`) recebe prop opcional `isDateDisabled?: (date: Date) => boolean`; datas indisponíveis aparecem riscadas e não clicáveis (além das datas passadas).
- **Roteiro:** `BookingCard` recebe `diasOperacao` e `datasBloqueadas`, monta `isDateDisabled` e repassa ao `DatePicker`. A página `/roteiros/[id]` inclui `disponibilidade_dias_semana` e `roteiro_disponibilidade_bloqueio ( data )` na query.
- **Embarcação:** a disponibilidade é cadastrada no painel e persistida, mas **ainda não há reflexo público** — a página `/embarcacoes/[id]` não possui calendário de reserva (apenas botão "Solicitar reserva" → login). Gancho para quando essa página ganhar um seletor de data.

---

## 15-C. Status (ativação) de Embarcação e Roteiro

Migration: `supabase/migrations/019_roteiro_ativo.sql` (coluna `roteiro.ativo`). Embarcação já tinha `status` (`ativo` | `inativo` | `em_manutencao`, migration 005).

### Modelo

- `embarcacao.status` controla a visibilidade da embarcação no hotsite (`buscar_embarcacoes` filtra `status = 'ativo'`).
- `roteiro.ativo boolean NOT NULL DEFAULT true` controla a do roteiro (`buscar_roteiros` filtra `ativo = true`).

### Toggle no painel + cascade

- **Grid** `src/app/painel/(gestao)/embarcacoes/_components/EmbarcacoesGrid.tsx`: a coluna **Status** é um *switch* ativo/inativo. A listagem carrega os roteiros vinculados via embed `roteiro ( id, nome )`.
- **Server action** `alternarStatusEmbarcacao(embarcacaoId, 'ativo' | 'inativo')` (`src/app/painel/(gestao)/embarcacoes/actions.ts`):
  - Valida auth + role (`gestor`/`admin`) + posse.
  - Atualiza `embarcacao.status`.
  - **Cascade simétrico:** `UPDATE roteiro SET ativo = (novoStatus = 'ativo') WHERE embarcacao_id = :id`. Desativar a embarcação desativa os roteiros vinculados; reativar reativa.
  - `revalidatePath('/painel/embarcacoes')` e `/painel/roteiros`.
- **Confirmação:** desativar abre um modal listando os roteiros vinculados que ficarão inativos. Reativar é direto.

### Toggle no grid de roteiros

- **Grid** `src/app/painel/(gestao)/roteiros/_components/RoteirosGrid.tsx`: coluna **Status** com o mesmo *switch* ativo/inativo. Roteiro é "folha" (sem dependentes), então o toggle é **direto nos dois sentidos**, sem modal nem cascade.
- **Server action** `alternarStatusRoteiro(roteiroId, ativo)` (`src/app/painel/(gestao)/roteiros/actions.ts`): valida auth + role + posse, atualiza `roteiro.ativo` e `revalidatePath('/painel/roteiros')`.
- O status do roteiro pode divergir do cascade da embarcação (controle independente do gestor).

### Bloqueio de acesso direto

As páginas públicas de detalhe retornam **404** para itens inativos: `/embarcacoes/[id]` filtra `status = 'ativo'`; `/roteiros/[id]` filtra `ativo = true`.

---

## 16. Localização Geográfica (Google Maps)

Migration: `supabase/migrations/010_embarcacao_coordenadas.sql`

Colunas adicionadas em `embarcacao`: `latitude numeric(10,7)`, `longitude numeric(10,7)`.

### Integração no formulário

- Pacote: `@react-google-maps/api`
- Variável de ambiente: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- APIs Google habilitadas: Maps JavaScript API, Geocoding API, Places API
- Componente `MapaPicker` (`_components/MapaPicker.tsx`): renderiza mapa interativo com marcador arrastável.
- Fluxo: ao preencher o CEP, o endereço é geocodificado automaticamente e o marcador é posicionado. O usuário pode clicar ou arrastar o marcador para o ponto exato de atracação.

---

## 17. Comodidades de Embarcações

Migration: `supabase/migrations/007_comodidades.sql`

### Tabela `comodidade` (catálogo)

```sql
id    uuid primary key default gen_random_uuid()
nome  text not null unique
```

Seeds iniciais: Churrasqueira, TV com Satélite, Internet WiFi, Ar-Condicionado, Cozinha Completa, Som Ambiente, Jet Ski incluso, Prancha de Stand Up, Equipamento de Mergulho, Geladeira, Banheiro a bordo, Toldo/Cobertura, Âncora, GPS Náutico, Salva-vidas completo.

RLS: leitura pública; escrita apenas via service role.

---

### Tabela `embarcacao_comodidades` (ligação N:N)

```sql
id              uuid primary key default gen_random_uuid()
embarcacao_id   uuid not null FK → embarcacao(id) ON DELETE CASCADE
comodidade_id   uuid not null FK → comodidade(id) ON DELETE CASCADE
UNIQUE (embarcacao_id, comodidade_id)
```

RLS:
- service role: acesso total.
- público: SELECT.
- owner autenticado: INSERT / DELETE sobre comodidades das suas embarcações.

---

### Server Actions

- `getComodidades()` — lista todas as comodidades ordenadas por nome.
- `salvarComodidades(embarcacaoId, comodidadeIds[])` — insere os vínculos em `embarcacao_comodidades`.

### UI

Seção "Comodidades" no formulário de cadastro de embarcação: chips clicáveis (toggle). Comodidades selecionadas são salvas após a criação da embarcação e das regras de preço.

---

## 18. Hotsite — Busca e Roteiros

### 18.1 API de Localização

**`GET /api/buscar/locais`**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `q` | string | Texto para autocomplete de municípios |
| `lat` + `lng` | numeric | Coordenadas para busca "próximo de mim" |

Retorna `LocalResult[]`:
```ts
type LocalResult = {
  id: number;         // municipio_id (IBGE)
  nome: string;
  uf: string;
  estado: string;
  latitude: number | null;
  longitude: number | null;
};
```

Apenas municípios que possuem pelo menos um `roteiro` cadastrado são retornados. Para geolocalização, os resultados são ordenados por distância (Haversine via `Math.hypot`).

---

### 18.2 Componentes de Busca

Localizados em `src/components/home/search/`.

#### `LocationPicker`

```ts
type LocationValue =
  | { type: 'place'; id: number; nome: string; uf: string }
  | { type: 'geo'; lat: number; lng: number; label: string };

type Props = {
  value: LocationValue | null;
  onChange: (v: LocationValue) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  compact?: boolean;
};
```

- Dropdown com "Próximo de mim" (geolocation), histórico recente (localStorage key `boatzy_recent_locations`), e sugestões da API (debounce 300ms).
- `compact` reduz o trigger para tamanho menor (usado em `SearchBarCompact`).

#### `DatePicker`

```ts
type DateValue = { date: Date; flexibility: number };

type Props = {
  value: DateValue | null;
  onChange: (v: DateValue | null) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  compact?: boolean;
};
```

- Calendário de 2 meses, navegação por mês, datas passadas desabilitadas.
- Botões de flexibilidade: 0 (Data exata), 1, 2, 3, 7 (dias).
- Display: "15 de jun." ou "15 de jun. ±2 dias".
- Clicar em um dia aplica a seleção imediatamente (`onChange` no clique), preenche o campo e **fecha o dropdown** — não há botão "Confirmar". Para ajustar a flexibilidade depois, reabre-se o calendário: clicar num chip de flexibilidade aplica na hora (`onChange`) e mantém o dropdown aberto.

#### `GuestPicker`

```ts
type Props = {
  value: number;
  onChange: (v: number) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  compact?: boolean;
};
```

- Dropdown com contador Minus/Plus, mínimo 0.

---

### 18.3 Página de Busca `/buscar`

**Arquivo:** `src/app/buscar/page.tsx` (Server Component)

**Query params:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `municipio` | number | ID do município filtrado |
| `local` | string | Label exibido no chip de filtro |
| `lat` + `lng` | number | Centro para busca "perto de mim" (raio 50 km) |
| `data` | YYYY-MM-DD | Data da busca |
| `flex` | number | Flexibilidade em dias |
| `pessoas` | number | Tamanho do grupo |
| `pagina` | number | Página atual (padrão: 1) |
| `tipo` | `'embarcacao'` | Aba ativa da busca (exibe o seletor de tipo na barra compacta) |
| `tipo_embarcacao` | uuid | Filtro pelo tipo da **embarcação vinculada** ao roteiro (`embarcacao_tipo.id`) |
| `tipo_nome` | string | Rótulo do tipo para chip/título (evita query extra) |

**Filtros aplicados (via RPC `buscar_roteiros` — migrations 018/019/020/024):**

> **Correção (migration 020):** `buscar_roteiros` e `buscar_embarcacoes` retornavam erro `42804` (`double precision` × `numeric` na coluna `distancia_km`), pois a expressão haversine (`acos/cos/sin/radians`) é `double precision` mas a coluna de retorno é `numeric`. A página engolia o erro e exibia "nenhum resultado". A 020 faz cast explícito da distância para `numeric` em ambas as funções. A página passou a logar `rpcError`.

Mesma mecânica de `buscar_embarcacoes` (ver §18.6), com **uma diferença no filtro de pessoas**: a capacidade considerada é a da **embarcação vinculada** ao roteiro (`roteiro.embarcacao_id → embarcacao.capacidade >= pessoas`), **não** o campo `roteiro.quantidade_pessoas` (este segue apenas para exibição no card). Roteiros **sem** embarcação vinculada (ou cuja embarcação não tem `capacidade`) **não aparecem** quando o filtro de pessoas está ativo.

- **Localização:** município exato OU ≤ 50 km do centro (haversine), usando `roteiro.latitude/longitude`.
- **Data:** disponibilidade via `roteiro.disponibilidade_dias_semana` + `roteiro_disponibilidade_bloqueio`; com `flex`, basta um dia livre na janela.
- **Tipo de embarcação (migration 024):** parâmetro `p_tipo_id uuid DEFAULT NULL` — quando informado, o roteiro só aparece se a **embarcação vinculada** tiver `embarcacao_tipo_id = p_tipo_id`. Roteiros sem embarcação vinculada não aparecem com o filtro ativo (mesma regra do filtro de pessoas). `NULL` = sem filtro (aba Roteiros intocada). A 024 dá `DROP` na assinatura de 9 parâmetros (020) antes do `CREATE` para evitar overload ambíguo no PostgREST.
- **Ordenação:** por distância quando há centro; senão `created_at` desc. A página chama a RPC (ids + total) e busca os detalhes com `.in('id', ids)` preservando a ordem.
- `GRANT EXECUTE` para `anon, authenticated, service_role`.

**Busca orientada a roteiro (aba Embarcações):** a aba "Embarcações" do `SearchTypeToggle` não navega mais para `/embarcacoes` — ela adiciona `tipo=embarcacao` (+ `tipo_embarcacao`/`tipo_nome` quando um tipo é escolhido) e o destino é sempre `/buscar`. A página exibe chip removível "Tipo: \<nome\>" (a remoção preserva `tipo=embarcacao`), título contextualizado ("Roteiros com \<tipo\> em …") e, no estado vazio com filtro de tipo, o botão "Limpar filtro de tipo".

**Helper `getTiposEmbarcacaoComRoteiro()`** (`src/lib/tipos-embarcacao.ts`, `server-only`): retorna `{ id, nome }[]` dos tipos com pelo menos um roteiro **ativo** com embarcação vinculada daquele tipo (dedupe em memória, ordenado por nome). Usado pela home (`HeroSection`) e por `/buscar` (`SearchBarCompact`) via props.

**Componentes:**
- `src/app/buscar/_components/SearchBarCompact.tsx` — barra compacta (`'use client'`), reutiliza pickers com `compact` prop, navega via `router.push()`. Props: `tipo?: 'roteiro' | 'embarcacao'` (padrão `'roteiro'`), `tiposEmbarcacao?: TipoEmbarcacaoValue[]` e `initialTipoEmbarcacao?`. Renderiza o `SearchTypeToggle`; na aba Embarcações exibe o `TipoEmbarcacaoPicker` como primeiro campo. Alternar a aba preserva local/data/pessoas e navega sempre para `/buscar` (a aba Embarcações acrescenta `tipo=embarcacao`).
- `src/app/buscar/_components/RoteiroCard.tsx` — card de roteiro (`'use client'`), imagem, localidade, specs (inclui badge com o tipo da embarcação vinculada, ícone `Ship`), preço.

#### `SearchTypeToggle` (`src/components/home/search/SearchTypeToggle.tsx`)

```ts
type SearchType = 'roteiro' | 'embarcacao';
type Props = { value: SearchType; onChange: (v: SearchType) => void; variant?: 'dark' | 'light' };
```

Segmented control (Roteiros / Embarcações) usado na Hero Section (`variant="dark"`) e no `SearchBarCompact` (`variant="light"`). As duas abas resultam em **roteiros** em `/buscar`; a aba Embarcações apenas acrescenta o filtro por tipo da embarcação vinculada.

#### `TipoEmbarcacaoPicker` (`src/components/home/search/TipoEmbarcacaoPicker.tsx`)

```ts
type TipoEmbarcacaoValue = { id: string; nome: string };
type Props = {
  options: TipoEmbarcacaoValue[];   // tipos com roteiro ativo vinculado (carregados no servidor)
  value: TipoEmbarcacaoValue | null;
  onChange: (v: TipoEmbarcacaoValue | null) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  compact?: boolean;
};
```

Dropdown no padrão dos demais pickers (trigger com rótulo "Embarcação", lista com ícone `Ship`, clique seleciona/desmarca e fecha). Exibido na Hero e na barra compacta **apenas** quando a aba Embarcações está ativa; seleção opcional (sem tipo, a busca equivale à aba Roteiros). A `HeroSection` passou a receber `tiposEmbarcacao` por props (a home `src/app/page.tsx` virou async e chama `getTiposEmbarcacaoComRoteiro()`).

**Tipo `RoteiroCardData`:**
```ts
type RoteiroCardData = {
  id: string;
  nome: string;
  descricao: string;
  quantidade_pessoas: number | null;
  preco_base: number | null;
  duracao: string | null;
  municipios: { nome: string; estados: { uf: string } | null } | null;
  roteiro_imagens: { url_imagem: string; principal: boolean }[];
  embarcacao: { embarcacao_tipo: { nome: string } | null } | null;
};
```

---

### 18.4 Página de Detalhe `/roteiros/[id]`

**Arquivo:** `src/app/roteiros/[id]/page.tsx` (Server Component)

**Query Supabase (select completo):**
```ts
.select(`
  id, nome, descricao, origem, destino, duracao, quantidade_pessoas, preco_base,
  latitude, longitude,
  municipios ( nome, estados ( uf, nome ) ),
  roteiro_imagens ( id, url_imagem, titulo, principal ),
  embarcacao (
    nome, capacidade, comprimento, cabines, tripulacao, modalidade_capitao,
    embarcacao_tipo ( nome ),
    embarcacao_comodidades ( comodidade ( nome ) ),
    embarcacao_imagens ( id, url_imagem, titulo, principal )
  ),
  roteiro_catalogo ( id, valor_customizado, catalogo ( id, descricao, valor, tipo ) )
`)
```

**Componentes client:**
- `src/app/roteiros/[id]/_components/BookingCard.tsx` — gerencia estado de data/hóspedes, calcula taxa de serviço (12% hardcoded para exibição), navega para `/reservas/novo?roteiro=...&data=...&pessoas=...`.
- `src/app/roteiros/[id]/_components/EmbarcacaoFotosModal.tsx` — modal de fotos da embarcação (ver 18.5).

**Tipo `RoteiroDetalhe`:**
```ts
type RoteiroDetalhe = {
  id: string;
  nome: string;
  descricao: string | null;
  origem: string | null;
  destino: string | null;
  duracao: string | null;
  quantidade_pessoas: number | null;
  preco_base: number | null;
  latitude: number | null;
  longitude: number | null;
  municipios: { nome: string; estados: { uf: string; nome: string } | null } | null;
  roteiro_imagens: { id: string; url_imagem: string; titulo: string | null; principal: boolean }[];
  embarcacao: {
    nome: string;
    capacidade: number | null;
    comprimento: number | null;
    cabines: number | null;
    tripulacao: number | null;
    modalidade_capitao: string;
    embarcacao_tipo: { nome: string } | null;
    embarcacao_comodidades: { comodidade: { nome: string } | null }[];
    embarcacao_imagens: { id: string; url_imagem: string; titulo: string | null; principal: boolean }[];
  } | null;
  roteiro_catalogo: {
    id: string;
    valor_customizado: number | null;
    catalogo: { id: string; descricao: string; valor: number; tipo: string } | null;
  }[];
};
```

---

### 18.6 Busca de Embarcações `/embarcacoes` — **substituída por redirect**

**Arquivo:** `src/app/embarcacoes/page.tsx` (Server Component).

> ⚠️ **Descontinuada como listagem** (busca orientada a roteiro — ver §18.3): a rota agora apenas
> **redireciona** (`redirect()`) para `/buscar?tipo=embarcacao`, preservando os params compatíveis
> (`municipio`, `local`, `lat`, `lng`, `data`, `flex`, `pessoas`, `pagina`). O componente
> `_components/EmbarcacaoCard.tsx` ficou sem uso (mantido no repositório). O detalhe
> `/embarcacoes/[id]` (§18.7) e a reserva direta de embarcação (§20.7) **seguem ativos**, acessíveis
> por link direto.

**Filtros da RPC `buscar_embarcacoes` (migration 017/020) — mantida no banco, sem consumidor público:**

A página delega os filtros à função SQL `public.buscar_embarcacoes(...)`, que resolve tudo em uma chamada e retorna os **ids ordenados + total** (para paginação). A página então busca os detalhes (joins) com `.in('id', ids)`, **preservando a ordem** retornada.

```ts
const { data: rpcRows } = await supabaseAdmin.rpc('buscar_embarcacoes', {
  p_municipio_id, p_lat, p_lng, p_raio_km: 50,
  p_data, p_flex, p_pessoas, p_limit, p_offset,
});
// rpcRows: { id, distancia_km, total }[]  (já ordenado por distância → created_at)
```

Regras da função:
- **Localização:** centro = `lat/lng` ("perto de mim") ou coordenadas do `municipio_id`. Aparece se `municipio_id` bater **exato** OU se a distância (haversine) ao centro for ≤ **50 km**. Sem centro = sem filtro de local.
- **Pessoas:** `capacidade >= pessoas`.
- **Data:** disponível se **algum** dia da janela `data ± flex` tiver o dia da semana em `disponibilidade_dias_semana` (ou ela for `NULL`) **e** não estiver em `embarcacao_disponibilidade_bloqueio`. Sem `data` = sem filtro de disponibilidade.
- **Ordenação:** por distância (mais próximas primeiro) quando há centro; senão por `created_at` desc. Embarcações sem coordenadas só aparecem pelo match exato de município (ordenadas por último, `NULLS LAST`).
- `GRANT EXECUTE` para `anon, authenticated, service_role` (busca anônima no hotsite).

**Componente `EmbarcacaoCard`** (`src/app/embarcacoes/_components/EmbarcacaoCard.tsx`, `'use client'`):
```ts
type EmbarcacaoCardData = {
  id: string;
  nome: string;
  descricao: string | null;
  capacidade: number | null;
  comprimento: number | null;
  preco_base: number | null;
  embarcacao_tipo: { nome: string } | null;
  municipios: { nome: string; estados: { uf: string } | null } | null;
  embarcacao_imagens: { url_imagem: string; principal: boolean }[];
};
```
Link para `/embarcacoes/[id]`.

> Preço exibido a partir de `preco_base` (paridade com a listagem de roteiros). Refinamento futuro: usar `get_precos_embarcacoes` para preço dependente da data.

### 18.7 Detalhe da Embarcação `/embarcacoes/[id]`

**Arquivo:** `src/app/embarcacoes/[id]/page.tsx` (Server Component).

Carrega a embarcação com tipo, categoria, município, comodidades e imagens. Reutiliza `GaleriaRoteiro` (com prop `voltarHref="/embarcacoes"`) e `LocalizacaoMap` de `roteiros/[id]/_components`.

Seções: badges (tipo/categoria), título + localidade, descrição, grid de specs (capacidade, comprimento, cabines, suítes, banheiros, tripulação), comodidades, mapa + endereço, placeholder de avaliações, e a sidebar de reserva `EmbarcacaoBookingCard` (data/pessoas obrigatórios, disponibilidade, preço/dia + taxa de serviço → `/reservas/novo?embarcacao=...`). Ver §20.7.

> A query lê `searchParams` (`data`/`flex`/`pessoas`) para pré-preencher o `EmbarcacaoBookingCard` quando o cliente chega pela busca, e inclui `disponibilidade_dias_semana` + `embarcacao_disponibilidade_bloqueio ( data )`.

> `GaleriaRoteiro` ganhou prop `voltarHref?: string` (padrão `/buscar`) para o botão "voltar".

### 18.5 Modal de Fotos da Embarcação

**Arquivo:** `src/app/roteiros/[id]/_components/EmbarcacaoFotosModal.tsx`

**Props:**
```ts
type Props = {
  embarcacao: {
    nome: string;
    capacidade: number | null;
    comprimento: number | null;
    cabines: number | null;
    tripulacao: number | null;
    modalidade_capitao: string;
    embarcacao_tipo: { nome: string } | null;
    embarcacao_imagens: { id: string; url_imagem: string; titulo: string | null; principal: boolean }[];
  };
};
```

- Imagem principal (`principal: true`) ordenada primeira.
- `z-index: 200` para sobrepor todos os demais elementos.
- `document.body.style.overflow = 'hidden'` enquanto aberto.
- Teclado: ESC fecha, ← / → navega entre fotos.

---

## 18.8 Páginas Institucionais / Legais

### Política de Privacidade `/privacy`

**Arquivo:** `src/app/privacy/page.tsx` (Server Component estático, sem props nem fetch).

- Renderiza `Header` + conteúdo + `Footer` (mesmo padrão das demais páginas do hotsite).
- Conteúdo HTML/JSX hardcoded a partir de `Boatzy_Politica_Privacidade.md` (raiz do projeto), com seções 1–12 da LGPD, tabela de finalidades/bases legais e aviso de status (minuta v1).
- `export const metadata` define `title`/`description` próprios da página.
- Acessada pelos links "Privacidade" do `Footer` (`src/components/layout/Footer.tsx`).
- Pré-requisito para publicar o login social do Facebook/Meta (URL de política de privacidade exigida ao sair do modo de desenvolvimento).

### Termos de Uso `/terms`

**Arquivo:** `src/app/terms/page.tsx` (Server Component estático, sem props nem fetch).

- Mesmo padrão da Política de Privacidade: `Header` + conteúdo + `Footer`, hero `#0B2447`, aviso de status (minuta v1) e `export const metadata`.
- Conteúdo HTML/JSX hardcoded a partir de `Boatzy_Termos_Uso.md` (raiz do projeto), com seções 1–14.
- Links internos para `/privacy` (seções 1 e 10) via `next/link`.
- Acessada pelos links "Termos de Uso" / "Termos" do `Footer` (`src/components/layout/Footer.tsx`).

---

## 19. Futuro

- Chat — **implementado nos dois lados** (gestor e cliente), em tempo real (ver §21)
- Notificações  
- App mobile  
- Antifraude
- Tela do cliente para acompanhar suas reservas (status + observação do gestor) — ver §20
- Reserva de **embarcação** pelo site (hoje só roteiro — ver §20)
- Pagamento na reserva (Stripe) — hoje a reserva é apenas solicitação sem cobrança
- Filtros adicionais na busca (tipo de embarcação, faixa de preço)
- Visualização em mapa no `/buscar`
- Avaliações reais em `/roteiros/[id]`

---

## 20. Reservas de Roteiro (solicitação do cliente → painel do gestor)

Migration: `supabase/migrations/021_reservas_roteiro.sql`

Fluxo de **solicitação** de reserva de roteiro feito pelo cliente no site. A reserva nasce
**`pendente`** e o gestor (owner do roteiro) a **confirma** ou **recusa** no painel, com uma
observação retornada ao cliente. **Sem etapa de pagamento** neste momento (solicitação apenas).

> Escopo: reserva de **roteiro** (§20.2–20.3) e de **embarcação** (§20.7). O fluxo, o resumo
> (`/reservas/novo`) e a action `criarReserva` são compartilhados pelos dois tipos.

### 20.1 Modelo de dados

Enum `reserva_status`: `'pendente' | 'confirmada' | 'recusada' | 'cancelada' | 'concluida'`
(os dois últimos: migration 025).

- `recusada` = negativa do **gestor**; `cancelada` = cancelamento do **cliente** (grava
  `reserva.cancelada_em timestamptz`, migration 025), permitido em `pendente`/`confirmada`.
- `concluida` = `confirmada` com `data_reserva` no passado. Transição **lazy** via
  `concluirReservasVencidas()` (`src/lib/reservas.ts`, `server-only`): `UPDATE` global
  (`status='confirmada' AND data_reserva < hoje` no fuso `America/Sao_Paulo`), chamado no início de
  `/minhas-reservas` e `/painel/agendamentos`. Sem cron. `concluida` habilita a avaliação (§22).
Enum `reserva_tipo` (migration 022): `'roteiro' | 'embarcacao'`. Constraint `reserva_tipo_alvo_chk`
garante coerência: tipo `roteiro` exige `roteiro_id`; tipo `embarcacao` exige `embarcacao_id`.
Em reservas de embarcação, `item_nome` guarda o **nome da embarcação** (título-snapshot) e não há
`reserva_adicional` (adicionais só existem para roteiro, via `roteiro_catalogo`).

#### Tabela `reserva`

```sql
id                 uuid PK
tipo               reserva_tipo NOT NULL DEFAULT 'roteiro'        -- 'roteiro' | 'embarcacao' (migration 022)
roteiro_id         uuid FK → roteiro(id) ON DELETE CASCADE        -- nullable (migration 022): null em reserva de embarcação
embarcacao_id      uuid FK → embarcacao(id) ON DELETE SET NULL   -- derivado do roteiro / alvo da reserva de embarcação
cliente_id         uuid FK → users(id) ON DELETE CASCADE          -- quem solicitou (logado)
owner_id           uuid FK → users(id) ON DELETE CASCADE          -- gestor (roteiro.owner_id)
-- solicitação
data_reserva       date NOT NULL
flexibilidade      smallint                                       -- dias (do filtro de busca)
quantidade_pessoas integer NOT NULL
-- snapshot de valores no momento da solicitação
item_nome          text NOT NULL                                  -- nome-snapshot do alvo (roteiro ou embarcação); renomeado de roteiro_nome na migration 023
preco_base         numeric(12,2)
total_adicionais   numeric(12,2) NOT NULL DEFAULT 0
taxa_servico       numeric(12,2)
total_estimado     numeric(12,2)
-- status / resposta do gestor
status             reserva_status NOT NULL DEFAULT 'pendente'
observacao_gestor  text
solicitado_em      timestamptz NOT NULL DEFAULT now()
respondido_em      timestamptz
created_at / updated_at  timestamptz (trigger update_reserva_updated_at)
```

#### Tabela `reserva_adicional` (snapshot dos itens do catálogo escolhidos)

```sql
id                  uuid PK
reserva_id          uuid FK → reserva(id) ON DELETE CASCADE
roteiro_catalogo_id uuid FK → roteiro_catalogo(id) ON DELETE SET NULL  -- referência
descricao           text NOT NULL          -- snapshot
valor               numeric(12,2) NOT NULL  -- snapshot
tipo                catalogo_tipo NOT NULL  -- snapshot ('produto'|'servico')
created_at          timestamptz
```

> **Snapshot:** `item_nome`, preços/totais e os itens em `reserva_adicional` são gravados no
> momento da solicitação. Mudanças posteriores no roteiro ou no catálogo **não** alteram reservas já
> registradas.

**RLS:**
- `reserva`: `service_role` total; cliente `SELECT`/`INSERT` onde `cliente_id = auth.uid()`; owner
  `SELECT`/`UPDATE` onde `owner_id = auth.uid()` (confirmar/recusar).
- `reserva_adicional`: `service_role` total; `SELECT` para cliente **ou** owner via `EXISTS` na
  `reserva` pai.
- As escritas reais rodam via `supabaseAdmin` nas server actions, validando posse no código.

Tipos TS adicionados em `src/types/supabase.ts`: tabelas `reserva`/`reserva_adicional` e
`export type ReservaStatus`.

### 20.2 Detalhe do roteiro — campos obrigatórios + pré-preenchimento

- `BookingCard` (`src/app/roteiros/[id]/_components/BookingCard.tsx`): **Data** e **Pessoas** são
  obrigatórios; clicar em "Solicitar Reserva" sem data exibe erro inline e não navega.
- Novas props `initialData` (`'yyyy-mm-dd'`), `initialFlex`, `initialPessoas` inicializam os campos.
- A página `/roteiros/[id]` lê `searchParams` (`data`/`flex`/`pessoas`) e repassa ao `BookingCard`.
- `RoteiroCard` (`src/app/buscar/_components/RoteiroCard.tsx`) recebe prop `query` e monta o href
  `/roteiros/[id]?data=...&flex=...&pessoas=...`; `/buscar` monta essa querystring a partir dos
  filtros ativos → o detalhe vem **pré-preenchido** quando o cliente chega pela busca.
- Ao confirmar, `BookingCard` navega para `/reservas/novo?roteiro=...&data=...&flex=...&pessoas=...&adicionais=id1,id2`.

### 20.3 Página `/reservas/novo` (confirmação + criação) — roteiro **ou** embarcação

**Arquivo:** `src/app/reservas/novo/page.tsx` (Server Component). Atende os dois tipos pelo
query param: `?roteiro=<id>` ou `?embarcacao=<id>` (presença de `embarcacao` define
`tipo = 'embarcacao'`).

- **Gate de auth:** `createClient()` SSR + `getUser()`; se não logado, redireciona para
  `/entrar?redirect_to=<url atual>`. Sem alvo → `/buscar` (roteiro) ou `/embarcacoes` (embarcação);
  faltando `data`/`pessoas` válidos → volta ao detalhe do alvo.
- Carrega o alvo (ativo). Para **roteiro**, reconstrói os adicionais a partir dos ids da query; para
  **embarcação**, não há adicionais. Exibe resumo (tipo, nome, localidade, data, pessoas, adicionais
  quando houver, diária + taxa de serviço 12% + total estimado).
- Componente client `_components/ConfirmarReserva.tsx` (props `tipo`, `roteiroId?`, `embarcacaoId?`,
  …): botão "Confirmar solicitação" → server action `criarReserva`; em sucesso mostra
  "Solicitação enviada! (Pendente)".

**Server action `criarReserva`** (`src/app/reservas/novo/actions.ts`):
```ts
criarReserva(input: {
  tipo: 'roteiro' | 'embarcacao',
  roteiroId?, embarcacaoId?, data, flex?, pessoas, adicionaisIds[]
}) → { ok: true, reservaId } | { ok: false, error }
```
Revalida auth e recarrega o alvo **no servidor** (não confia em valores do client). Para roteiro,
recarrega os adicionais; para embarcação, carrega `embarcacao` ativa (preço/owner). Recalcula
`preco_base`/`total_adicionais`/`taxa_servico`/`total_estimado`, insere `reserva` (status `pendente`,
`tipo`, `cliente_id = user.id`, `owner_id`, `roteiro_id`/`embarcacao_id` conforme o tipo) + (roteiro)
linhas em `reserva_adicional` (snapshot). Se o insert dos adicionais falhar, a reserva é revertida.

### 20.4 Painel — `/painel/agendamentos` (calendário)

**Arquivos:** `src/app/painel/(gestao)/agendamentos/page.tsx` +
`_components/AgendamentosCalendar.tsx` + `actions.ts`.

Visão em **calendário** de todas as reservas dos roteiros/embarcações do gestor (`owner_id`).

- A página (Server Component) carrega os eventos: `id, tipo, data_reserva, status, item_nome,
  quantidade_pessoas` + embed `cliente:users!reserva_cliente_id_fkey ( name )`, ordenados por
  `data_reserva`. Contador de pendentes no cabeçalho.
- `AgendamentosCalendar` (`'use client'`, tipo `ReservaEvento`):
  - **Views:** mês (default) e semana, via segmented control; navegação anterior/hoje/próximo.
  - **Cores por status:** Pendente = âmbar/laranja, Confirmada = verde, Recusada = vermelho,
    Cancelada pelo cliente = cinza, Concluída = azul (sky). **Ícone por tipo:** roteiro = `MapPin`,
    embarcação = `Ship`. Legenda no rodapé (derivada do mapa `STATUS`).
  - Cada reserva é um *chip* clicável agrupado por `data_reserva`; no mês mostra até 3 + "+N mais".
    O chip leva a `/painel/agendamentos/[id]`.
- **Painel lateral de pendentes** (`_components/PendentesList.tsx`): quando há reservas `pendente`, a
  página divide o espaço em **70% calendário / 30% lista** (`grid xl:grid-cols-10` → `col-span-7` +
  `col-span-3`), exibindo ao lado apenas as pendentes (cliente, tipo, roteiro, data, pessoas; link
  para o detalhe; sticky + scroll). Sem pendentes, o calendário ocupa a largura inteira.

### 20.5 Painel — detalhe da reserva `/painel/agendamentos/[id]`

**Arquivos:** `src/app/painel/(gestao)/agendamentos/[id]/page.tsx` +
`_components/ReservaAcoes.tsx`.

- Server Component: valida auth e **posse** (`owner_id = user.id`); 404 caso contrário. Carrega a
  reserva completa com `cliente:users!reserva_cliente_id_fkey ( name, email, cpf_cnpj, avatar_url )`,
  `roteiro ( nome, municipios … )`, `embarcacao ( nome )` e `reserva_adicional`.
- Exibe: tipo + status, dados do cliente, detalhes do pedido (data, pessoas, embarcação, solicitado
  em), adicionais, breakdown de valores e a observação já registrada.
- `ReservaAcoes` (`'use client'`): para reservas **pendentes**, botões **Confirmar** / **Cancelar
  reserva** abrem um textarea de observação; chamam as server actions e dão `router.refresh()`.
  Para reservas já resolvidas, mostra aviso de que não há ações pendentes.
- `AdicionarAoCalendario` (`'use client'`): botão **"Adicionar ao Google Calendar"** que abre o
  template `https://calendar.google.com/calendar/render?action=TEMPLATE&...` em nova aba, com o
  evento de **dia inteiro** já preenchido — `text` = `"<item> — <cliente>"`, `dates` = data da
  reserva (fim exclusivo no dia seguinte), `location` = localidade e `details` com cliente, pessoas,
  embarcação, adicionais e total. (A reserva é de granularidade diária — sem horário específico.)

**Server actions** (`actions.ts`, reutilizadas pelo detalhe):
- `confirmarReserva(reservaId, observacao?)` → `status = 'confirmada'`.
- `recusarReserva(reservaId, observacao?)` → `status = 'recusada'`.
- Ambas validam auth + role `gestor`/`admin` + posse (`owner_id`), gravam `observacao_gestor` e
  `respondido_em = now()`, e `revalidatePath('/painel/agendamentos')`.

### 20.5b Painel — Clientes `/painel/clientes`

**Arquivos:** `src/app/painel/(gestao)/clientes/page.tsx` +
`_components/ClientesGrid.tsx`.

- **Server Component:** valida auth (sem sessão → `/painel/login`). Via `supabaseAdmin`, consulta
  `reserva` filtrando `owner_id = user.id`, selecionando `solicitado_em` +
  `cliente:users!reserva_cliente_id_fkey ( id, name, email, cpf_cnpj, avatar_url, created_at )`.
- **Agregação em memória:** as linhas de reserva são agrupadas por `cliente.id` num `Map`, de modo
  que cada cliente aparece **uma única vez**, acumulando `total_reservas` (contagem) e
  `ultima_reserva` (maior `solicitado_em`). `cliente_desde` = `users.created_at`. Resultado tipado
  como `ClienteListItem[]`.
- `ClientesGrid` (`'use client'`): **lista somente leitura, sem ações**. Colunas: Cliente
  (avatar + nome + "cliente desde"), E-mail, CPF/CNPJ, Reservas, Última reserva. Suporta **busca**
  (nome, e-mail ou CPF/CNPJ), **ordenação por coluna** (`nome`, `email`, `cpf`, `total_reservas`,
  `ultima_reserva`) e **paginação** client-side (`PAGE_SIZE = 10`). Ordenação inicial:
  `ultima_reserva desc`. Mesmo padrão visual de `EmbarcacoesGrid`. Avatares dependem dos
  `images.remotePatterns` já liberados (Google/Facebook) em `next.config.ts` (ver §13).

### 20.6 Cliente — menu do usuário + `/minhas-reservas`

**Menu do usuário (`src/components/layout/UserMenu.tsx`):** o avatar no `Header` vira um *dropdown*
(click-outside/ESC fecham) com cabeçalho (nome/email) e itens **Minhas reservas**
(`/minhas-reservas`), **Minha conta** (`/minha-conta`) e **Sair**. No mobile, os mesmos links
aparecem no menu sanfonado para usuários logados.

**`/minhas-reservas`** (`src/app/minhas-reservas/page.tsx`, Server Component):
- Gate de auth: sem sessão → `/entrar?redirect_to=/minhas-reservas`.
- Lista as reservas onde `cliente_id = user.id` (via `supabaseAdmin`), ordenadas por
  `solicitado_em desc`, com `roteiro ( nome, municipios …, roteiro_imagens )`, `embarcacao ( nome )`
  e `reserva_adicional`.
- A página chama `concluirReservasVencidas()` antes de listar (transição lazy → `concluida`).
- Cada card mostra tipo, status (rótulos do cliente: Pendente = "Aguardando confirmação",
  Confirmada, Recusada, Cancelada, Concluída), data, pessoas, adicionais, total estimado, **a
  resposta do gestor** (`observacao_gestor` + `respondido_em`) ou uma nota de estado quando ainda
  não respondida, e link "Ver roteiro".
- **Cancelar reserva** (`_components/CancelarReservaButton.tsx`, `'use client'`): visível em
  `pendente`/`confirmada`; confirmação inline ("Cancelar esta reserva?" → Sim/Voltar) e chama a
  server action `cancelarReserva(reservaId)` (`src/app/minhas-reservas/actions.ts`): valida sessão +
  posse (`cliente_id`) + status permitido, grava `status='cancelada'` + `cancelada_em=now()`,
  revalida `/minhas-reservas` e `/painel/agendamentos`.
- **Avaliar** (reserva `concluida`): ver §22.

**`/minha-conta`** (`src/app/minha-conta/page.tsx`): placeholder ("Em breve") com gate de auth —
edição dos dados da conta fica para um passo futuro.

### 20.7 Reserva de embarcação (cliente)

Espelha o fluxo de roteiro (§20.2–20.3), **sem adicionais** (não existe `embarcacao_catalogo`).

- **`EmbarcacaoBookingCard`** (`src/app/embarcacoes/[id]/_components/EmbarcacaoBookingCard.tsx`,
  `'use client'`): sidebar da página `/embarcacoes/[id]` com **Data** e **Pessoas** obrigatórios,
  calendário respeitando `disponibilidade_dias_semana` + `embarcacao_disponibilidade_bloqueio`, e
  breakdown (diária + taxa de serviço 12% + total). Aceita `initialData`/`initialFlex`/`initialPessoas`
  (pré-preenchimento). Ao confirmar, navega para
  `/reservas/novo?embarcacao=...&data=...&flex=...&pessoas=...`.
- **`EmbarcacaoCard`** (`src/app/embarcacoes/_components/EmbarcacaoCard.tsx`) recebe prop `query` e
  monta o href `/embarcacoes/[id]?data=...&flex=...&pessoas=...`; `/embarcacoes` monta essa
  querystring a partir dos filtros ativos → o detalhe vem **pré-preenchido** ao chegar pela busca.
- O restante (confirmação em `/reservas/novo`, criação via `criarReserva`, calendário do painel,
  detalhe `/painel/agendamentos/[id]`, "Minhas reservas") já trata `tipo = 'embarcacao'`.

---

## 21. Chat em tempo real (Gestor ↔ Cliente)

Migrations: `supabase/migrations/20260627_chat.sql` (núcleo + RPCs do gestor) e
`20260628_chat_cliente.sql` (RPCs do cliente). **Os dois lados estão implementados** — painel do
gestor (§21.3–21.4) e site do cliente (§21.5). A conversa é simétrica (mesmas tabelas).

### 21.1 Modelo de dados

**`conversa`** — uma por par gestor↔cliente:
```sql
id          uuid pk default gen_random_uuid()
gestor_id   uuid not null FK → users(id) ON DELETE CASCADE
cliente_id  uuid not null FK → users(id) ON DELETE CASCADE
created_at  timestamptz default now()
updated_at  timestamptz default now()
UNIQUE (gestor_id, cliente_id)
CHECK (gestor_id <> cliente_id)  -- migration 20260707_conversa_bloqueia_self_chat.sql
```

> ⚠️ **Conversa consigo mesmo:** como uma mesma conta pode acumular as roles `cliente` e
> `gestor` (§6.1), é possível — sem a guarda abaixo — abrir uma conversa em que
> `gestor_id = cliente_id`. Isso já aconteceu em produção: o sino de notificações
> (§21.4) contava normalmente as mensagens não lidas, mas o link sempre caía em 404,
> pois `abrirConversa` (`src/app/painel/(gestao)/clientes/actions.ts`) recusa reabrir
> conversa consigo mesmo. A migration `20260707_conversa_bloqueia_self_chat.sql` limpou
> a conversa órfã existente, adicionou a CHECK constraint acima e reforçou as três RPCs
> de contagem (`chat_nao_lidas_por_cliente`, `chat_total_nao_lidas`,
> `chat_conversas_nao_lidas`) com `gestor_id <> cliente_id`, como defesa em profundidade.

**`mensagem`**:
```sql
id           uuid pk
conversa_id  uuid not null FK → conversa(id) ON DELETE CASCADE
remetente_id uuid not null FK → users(id) ON DELETE CASCADE
conteudo     text not null CHECK (char_length 1..4000)
lida_em      timestamptz        -- null = não lida; preenchida quando o destinatário lê
created_at   timestamptz default now()
```
Trigger `mensagem_bump_conversa` (AFTER INSERT) atualiza `conversa.updated_at`. Índices:
`mensagem (conversa_id, created_at)` e parcial `(conversa_id) WHERE lida_em IS NULL`.

**RLS** (`users.id == auth.uid()`): em ambas as tabelas, `service_role_all`. `conversa`:
SELECT/INSERT para participantes (`gestor_id = auth.uid() OR cliente_id = auth.uid()`). `mensagem`:
SELECT/INSERT/UPDATE só para participantes da conversa (subquery); INSERT exige
`remetente_id = auth.uid()`.

**Realtime:** `mensagem` tem `REPLICA IDENTITY FULL` e está em `supabase_realtime`. A entrega ao
browser é filtrada pela RLS de SELECT (cada usuário só recebe as conversas das quais participa).

> ⚠️ **Autorização do Realtime no browser:** como a sessão vem por cookie (`@supabase/ssr`), o socket
> do Realtime conecta como `anon` por padrão e a RLS descarta todos os eventos. Antes de qualquer
> `.subscribe()` é obrigatório chamar `authorizeRealtime(supabase)` (`src/lib/supabase/realtime.ts`),
> que faz `supabase.realtime.setAuth(session.access_token)`. Usado por `ChatBox`, `Sidebar`
> (gestor) e `Header` (cliente).

**RPCs** (`security definer`, `p_gestor uuid DEFAULT auth.uid()`):
- `chat_nao_lidas_por_cliente(p_gestor)` → `(cliente_id, total)`: mensagens do cliente ainda não
  lidas, por cliente.
- `chat_total_nao_lidas(p_gestor)` → `bigint`: total geral (badge da sidebar).

Tipos correspondentes adicionados à mão em `src/types/supabase.ts` (`conversa`, `mensagem` e as
duas funções).

### 21.2 Server actions — `src/app/painel/(gestao)/clientes/actions.ts`

- `abrirConversa(clienteId)` (em `clientes/actions.ts`): valida sessão + role `gestor`/`admin`;
  `upsert` em `conversa` por `(gestor_id, cliente_id)`; retorna `conversaId` (idempotente).

**Actions genéricas compartilhadas** — `src/lib/chat-actions.ts` (`'use server'`, usadas pelos dois
lados):
- `enviarMensagem(conversaId, conteudo)`: valida participação; insere `mensagem` com
  `remetente_id = user.id`; revalida `/painel/clientes` e `/minhas-reservas`.
- `marcarConversaComoLida(conversaId)`: `lida_em = now()` nas mensagens da **outra** parte ainda não
  lidas. (Usada pelo ChatBox no client; nas páginas de chat o "marcar lida" é feito inline via
  `supabaseAdmin` para não revalidar durante o render do Server Component.)

### 21.3 Página de chat do gestor — `/painel/clientes/[id]/chat`

`page.tsx` (Server Component, protegido pelo layout `(gestao)`): carrega o cliente, garante a
conversa (`abrirConversa`), marca as recebidas como lidas (inline) e carrega as mensagens em ordem
cronológica. Renderiza `ChatBox`.

**`src/components/chat/ChatBox.tsx`** (`'use client'`, **compartilhado** gestor/cliente): estilo
WhatsApp (bolhas à direita = minhas, à esquerda = interlocutor, separadores por dia, auto-scroll).
Props: `conversaId`, `meId`, `interlocutor {name,email,avatar_url}`, `voltarHref`, `voltarLabel`,
`mensagensIniciais`. Assina Realtime `channel('conversa:'+id).on('postgres_changes',
{ event:'INSERT', table:'mensagem', filter:'conversa_id=eq.'+id })` com **dedupe por `id`**; ao
receber mensagem da outra parte chama `marcarConversaComoLida`. Envio via `enviarMensagem` (a bolha
aparece pelo eco do Realtime). Enter envia, Shift+Enter quebra linha.

### 21.4 Badges de não lidas

- **Lista de Clientes** (`clientes/page.tsx` + `_components/ClientesGrid.tsx`): a página chama
  `chat_nao_lidas_por_cliente` e injeta `nao_lidas` em cada `ClienteListItem`; o grid ganhou a coluna
  **Chat** com `MessageCircle` linkando para `/painel/clientes/[id]/chat` e badge vermelho quando
  `nao_lidas > 0`.
- **Sidebar** (`src/components/painel/Sidebar.tsx`): recebe `naoLidas` inicial do layout
  (`chat_total_nao_lidas`) e mantém o total **ao vivo** — assina `postgres_changes` em `mensagem`
  (qualquer evento; a RLS limita às conversas do gestor) e rechama `chat_total_nao_lidas()` a cada
  evento, exibindo badge no item `CLIENTES`.

### 21.4b Sino de notificações do painel (`NotificacoesBell`)

Migration `028_chat_conversas_nao_lidas.sql` — RPC `chat_conversas_nao_lidas(p_gestor DEFAULT
auth.uid())` (`security definer`, `GRANT` a `authenticated`/`service_role`, mesmo padrão das demais
RPCs de chat): retorna, por conversa com mensagens do **cliente** ainda não lidas —
`(conversa_id, cliente_id, cliente_nome, cliente_avatar, total, ultima_mensagem, ultima_em)`,
ordenado pela mensagem mais recente. Necessária porque a RLS de `users` impede o browser de ler
nome/avatar de terceiros.

`src/components/painel/NotificacoesBell.tsx` (`'use client'`), renderizado pelo `Header` do painel
(substituiu o sino estático do template):

- **Badge:** contagem total de não lidas sobre o sino (99+), some quando zero.
- **Dados ao vivo:** `authorizeRealtime` + fetch inicial da RPC + assinatura `postgres_changes` em
  `mensagem` com refetch a cada evento (mesmo padrão da `Sidebar`).
- **Dropdown** (click-outside/ESC fecham): lista de conversas com avatar (fallback inicial), nome,
  preview da última mensagem, tempo relativo ("há 5 min"/"há 2 h"/data) e badge por conversa; item
  → `/painel/clientes/[id]/chat`. Estado vazio ("Nenhuma notificação nova") e footer "Ver todos os
  clientes" → `/painel/clientes`.
- Escopo atual: apenas chat. O componente é o ponto de agregação para **futuras notificações**
  (novas solicitações de reserva etc.).

### 21.5 Lado do cliente (site público)

Migration `20260628_chat_cliente.sql` — RPCs espelhadas na direção do cliente (contam mensagens
enviadas pelo **gestor**, `remetente_id = conversa.gestor_id`, não lidas):
- `chat_nao_lidas_por_gestor(p_cliente)` → `(gestor_id, total)`.
- `chat_total_nao_lidas_cliente(p_cliente)` → `bigint`.

**Página de chat** — `/minhas-reservas/[id]/chat` (`src/app/minhas-reservas/[id]/chat/page.tsx`,
Server Component): gate de auth (`/entrar?redirect_to=…`); carrega a `reserva` por `[id]` **exigindo
`cliente_id = user.id`** (autorização), obtém o gestor (`owner_id` → `users`), garante a conversa
(`upsert` inline), marca as recebidas como lidas (inline) e carrega as mensagens. Renderiza o
`ChatBox` compartilhado com `interlocutor` = gestor e `voltarHref="/minhas-reservas"`, dentro de um
shell `h-screen` (Header + área de chat com scroll interno).

**Lista "Minhas reservas"** (`src/app/minhas-reservas/page.tsx`): o `select` passou a incluir
`owner_id`; a página chama `chat_nao_lidas_por_gestor` e, no rodapé de cada reserva, adiciona o link
**"Conversar com o gestor"** (`MessageCircle` → `/minhas-reservas/[id]/chat`) com badge vermelho
quando há não lidas daquele gestor.

**Header / UserMenu** (`src/components/layout/Header.tsx` + `UserMenu.tsx`): para usuários logados, o
`Header` busca `chat_total_nao_lidas_cliente()` e mantém o total **ao vivo** (assina `postgres_changes`
em `mensagem`, refetch a cada evento). Passa `naoLidas` ao `UserMenu`, que exibe um badge no gatilho
do dropdown (sobre o avatar) e ao lado de **"Minhas reservas"** (também no menu mobile do Header).

---

## 22. Avaliações (cliente → roteiro/embarcação)

Migration: `supabase/migrations/026_avaliacoes.sql`. Regra (PRD §6.7/§8): apenas o cliente de uma
reserva **`concluida`** avalia — nota 1–5 obrigatória + comentário opcional; **uma avaliação por
reserva**, sem edição.

### 22.1 Modelo de dados

#### Tabela `avaliacao`

```sql
id            uuid PK
reserva_id    uuid NOT NULL UNIQUE FK → reserva(id) ON DELETE CASCADE   -- 1 avaliação por reserva
cliente_id    uuid NOT NULL FK → users(id) ON DELETE CASCADE
roteiro_id    uuid FK → roteiro(id) ON DELETE CASCADE       -- copiado da reserva no insert
embarcacao_id uuid FK → embarcacao(id) ON DELETE SET NULL  -- copiado da reserva no insert
nota          smallint NOT NULL CHECK (nota BETWEEN 1 AND 5)
comentario    text CHECK (<= 2000 chars)
created_at    timestamptz
```

Índices parciais por `roteiro_id` e `embarcacao_id`. `roteiro_id`/`embarcacao_id` são **snapshot da
reserva** para consulta direta nas páginas públicas: o roteiro lista por `roteiro_id`; a embarcação
por `embarcacao_id` — o que inclui avaliações de **roteiros feitos naquela embarcação** (a reserva de
roteiro carrega `embarcacao_id` derivado).

**RLS:** `service_role_all`; `public_read` (SELECT liberado — média/lista no hotsite);
`cliente_insert` (INSERT `authenticated` exige `cliente_id = auth.uid()` **e** `EXISTS` reserva do
próprio cliente com `status = 'concluida'`). As escritas reais rodam via `supabaseAdmin` na server
action, que revalida tudo.

Tipos TS: tabela `avaliacao` adicionada em `src/types/supabase.ts`; `ReservaStatus` ampliado.

### 22.2 Server action — `criarAvaliacao`

`src/app/minhas-reservas/actions.ts`:

```ts
criarAvaliacao(reservaId, nota, comentario) → { ok: true } | { ok: false, error }
```

Valida sessão; `nota` inteira 1–5; `comentario.trim()` ≤ 2000 (vazio → `null`); recarrega a reserva
no servidor e exige `cliente_id = user.id` e `status = 'concluida'`; insere copiando
`roteiro_id`/`embarcacao_id` da reserva. Violação do UNIQUE (`23505`) → "Você já avaliou esta
reserva.". Revalida `/minhas-reservas`, `/roteiros/[id]` e `/embarcacoes/[id]`.

### 22.3 UI — cliente (`/minhas-reservas`)

`_components/AvaliacaoReserva.tsx` (`'use client'`), renderizado apenas em reservas `concluida`
(o select da página embeda `avaliacao ( nota, comentario, created_at )`; o embed 1:1 pode vir como
objeto ou array — a página normaliza):

- **Sem avaliação:** botão "Avaliar experiência" → form inline com 5 estrelas (hover + clique),
  textarea opcional (maxLength 2000) e "Enviar avaliação" / "Agora não".
- **Com avaliação:** bloco somente leitura ("Sua avaliação" + estrelas + comentário + data).

### 22.4 UI — exibição pública

`src/components/avaliacoes/AvaliacoesSection.tsx` (Server Component compartilhado): recebe
`avaliacoes: AvaliacaoPublica[]` + `emptyLabel`. Header com média (estrelas + nota 1 decimal
pt-BR) e contagem; lista com avatar (fallback inicial do nome), nome, data, estrelas e comentário;
estado vazio com borda tracejada. Não há formulário nas páginas públicas — avaliação só via reserva
concluída.

Consumo: `/roteiros/[id]` busca por `roteiro_id`; `/embarcacoes/[id]` por `embarcacao_id` (ambas via
`supabaseAdmin`, `order created_at desc`, embed `cliente:users!avaliacao_cliente_id_fkey`).

### 22.5 Média no card da busca (`RoteiroCard`)

Helper `getAvaliacoesResumoPorRoteiro(roteiroIds)` (`src/lib/avaliacoes.ts`, `server-only`): uma
query em lote (`avaliacao.select('roteiro_id, nota').in(...)`) agregada em memória →
`Map<roteiroId, { media, total }>`. Usado por `/buscar` e `/favoritos`, que passam
`avaliacaoResumo` a cada `RoteiroCard`. No card (linha do preço): com avaliações, exibe
`★ 4,8 (12)` (estrela âmbar, média 1 decimal pt-BR, total no `title`) **no lugar** do badge
"Novo"; sem avaliações, mantém o badge "Novo".

---

## 23. Favoritos e Compartilhamento (roteiro)

Migration: `supabase/migrations/027_favoritos.sql`.

### 23.1 Modelo de dados

#### Tabela `favorito`

```sql
id         uuid PK
user_id    uuid NOT NULL FK → users(id) ON DELETE CASCADE
roteiro_id uuid NOT NULL FK → roteiro(id) ON DELETE CASCADE
created_at timestamptz
UNIQUE (user_id, roteiro_id)
```

Índice `(user_id, created_at DESC)`. **RLS:** `service_role_all`; SELECT/INSERT/DELETE apenas do
próprio usuário (`user_id = auth.uid()`). Tipos TS em `src/types/supabase.ts`.

### 23.2 Server action — `alternarFavorito`

`src/lib/favoritos-actions.ts` (`'use server'`, compartilhada):

```ts
alternarFavorito(roteiroId) → { ok: true, favorito: boolean } | { ok: false, error: 'nao_autenticado' | 'erro' }
```

Toggle idempotente (insere se não existe, remove se existe; corrida `23505` tratada como já
favoritado). `'nao_autenticado'` sinaliza ao client o redirect para `/entrar`. Revalida `/favoritos`
e `/roteiros/[id]`.

### 23.3 UI — detalhe do roteiro (`RoteiroAcoes`)

`src/app/roteiros/[id]/_components/RoteiroAcoes.tsx` (`'use client'`), renderizado pelo
`BookingCard` (novas props `roteiroNome` e `initialFavorito`; a página resolve o estado inicial via
sessão SSR + `favorito.maybeSingle()`):

- **Favoritar:** toggle otimista (alterna na hora, reverte se a action falhar); deslogado →
  `router.push('/entrar?redirect_to=<pathname>')`. Estado ativo: coração preenchido + "Favoritado".
- **Compartilhar:** dropdown (click-outside fecha) com:
  - **WhatsApp** — `https://wa.me/?text=<texto + url>`;
  - **Facebook** — `https://www.facebook.com/sharer/sharer.php?u=<url>` (popup);
  - **Instagram** — não há endpoint web de share por URL: copia o link (`navigator.clipboard`) e
    abre `instagram.com` (hint "copia o link para o story/direct");
  - **Copiar link** — clipboard com feedback "Link copiado!" (2,5s).
  - URL = `window.location.href`; texto = `Confira o roteiro "<nome>" no Boatzy!`. Ícones de marca
    (Facebook/Instagram) são SVGs inline — a `lucide-react` atual não exporta brand icons.

### 23.3b Coração no card da busca (`RoteiroCard`)

`RoteiroCard` ganhou a prop `initialFavorito?: boolean` e o coração do card virou toggle funcional:
`preventDefault/stopPropagation` (o botão fica dentro do `<Link>` do card), toggle otimista via
`alternarFavorito`, e deslogado → `/entrar?redirect_to=<pathname+search>` (preserva os filtros da
busca no retorno). Estado ativo: coração vermelho preenchido. A página `/buscar` resolve o estado
inicial em lote: sessão SSR + `favorito.select('roteiro_id').in('roteiro_id', ids)` → `Set` passado
aos cards. Em `/favoritos`, os cards recebem `initialFavorito` fixo (`true`).

### 23.4 Página `/favoritos` + menu

- **Menu:** item **Favoritos** (ícone `Heart`) no `UserMenu` (dropdown) e no menu mobile do
  `Header`, entre "Minhas reservas" e "Minha conta".
- **`/favoritos`** (`src/app/favoritos/page.tsx`, Server Component): gate de auth
  (`/entrar?redirect_to=/favoritos`); consulta `favorito` do usuário (`order created_at desc`) com
  embed do `roteiro` (campos do card + `ativo`); filtra `roteiro.ativo = true` em memória (roteiro
  desativado some, favorito permanece no banco). Grid reutiliza `RoteiroCard` +
  `_components/RemoverFavoritoButton.tsx` (`'use client'`: chama `alternarFavorito` +
  `router.refresh()`). Estado vazio com CTA "Explorar roteiros".

## 24. Receitas do gestor (`/painel/receitas`)

Tela financeira do painel — filtros por período/embarcação/roteiro/cliente/status, KPIs, gráficos
e um grid exportável (Excel/PDF). Não há Stripe integrado (ver `PRD.md` §5.1); todo o dado
financeiro vem do snapshot já existente em `reserva.total_estimado`.

**Definição de receita:** soma de `total_estimado` das reservas com `status IN ('confirmada',
'concluida')` — é o default do filtro de Status na tela, mas o gestor pode ampliar (ex.: incluir
`pendente`) e, nesse caso, os KPIs/gráficos refletem literalmente o que estiver selecionado (um
único filtro unificado alimenta KPIs, gráficos e grid — sem lógica dupla "receita real vs. exibida").

### 24.1 Arquitetura

Segue o padrão já usado em `clientes/page.tsx` + `ClientesGrid.tsx`: Server Component busca **todas**
as reservas do gestor (sem filtro de servidor) via `supabaseAdmin`, Client Component filtra/agrega/
pagina tudo em memória (`useMemo`). Sem RPC de agregação — volume de um único gestor não justifica.

- **`src/app/painel/(gestao)/receitas/page.tsx`** — chama `concluirReservasVencidas()` (mesma
  transição lazy do dashboard/agendamentos) e busca:
  ```ts
  supabaseAdmin.from('reserva').select(`
    id, tipo, data_reserva, item_nome, quantidade_pessoas,
    preco_base, total_adicionais, taxa_servico, total_estimado, status, solicitado_em,
    cliente:users!reserva_cliente_id_fkey ( id, name ),
    roteiro ( id, nome ), embarcacao ( id, nome )
  `).eq('owner_id', user.id)
  ```
- **`_lib/types.ts`** — `ReservaReceita` (shape da query acima) e `Filtros` (`de`, `ate`,
  `embarcacaoId`, `roteiroId`, `clienteId`, `status: ReservaStatus[]`).
- **`_lib/constants.ts`** — `STATUS_LABEL`/`STATUS_BADGE`/`TIPO_LABEL` (mapas de exibição) e
  `STATUS_RECEITA = ['confirmada', 'concluida']` (default do filtro de status).
- **`_lib/periodo.ts`** — presets de período (`presetEsteMes`, `presetUltimos30Dias`,
  `presetUltimos6Meses`, `presetEsteAno`) e `periodoAnterior(de, ate)` (janela imediatamente
  anterior, mesma duração — usada na comparação % dos KPIs) via `Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo' })`, mesmo padrão de `hojeBrasil()` em `src/lib/reservas.ts`.
- **`_lib/export.ts`** — `exportReceitasExcel` (lib `xlsx`, instalada a partir do CDN oficial da
  SheetJS — `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` — porque a versão publicada no
  registro público do npm, 0.18.5, tem vulnerabilidades altas sem correção disponível ali) e
  `exportReceitasPdf` (`jspdf` + `jspdf-autotable`), ambas operando sobre o array filtrado+ordenado
  (não paginado) do grid.
- **`_components/ReceitasView.tsx`** — orquestrador: guarda o estado de `Filtros` (default:
  período = mês atual, status = `STATUS_RECEITA`), deriva as opções dos selects (embarcação/
  roteiro/cliente únicos presentes nas reservas do gestor, não uma query separada), aplica o
  filtro unificado, e calcula via `useMemo`: KPIs, tendência mensal (preenche todos os meses do
  período, mesmo com valor zero, para o gráfico não ter buracos), ranking por embarcação/roteiro
  (top 8) e top clientes (top 8).
- **`_components/FiltrosReceitas.tsx`** — período (`<input type="date">` + atalhos de preset),
  `<select>` nativo para embarcação/roteiro/cliente, pills toggle para status.
- **`_components/ReceitasInsights.tsx`** — KPI tiles (receita, variação % vs. período anterior,
  ticket médio, reservas confirmadas, valor pendente informativo) + gráficos `recharts` (ver §24.2).
- **`_components/ReceitasGrid.tsx`** — clone do padrão `ClientesGrid` (`ThSortable`, `PAGE_SIZE=10`,
  paginação idêntica), com os botões Exportar Excel/PDF no header.

### 24.2 Gráficos (`recharts`)

Desenhados com o skill `dataviz` do projeto. Cor de marca única para todas as barras: `#1857C4`
— o navy/azul originais do app (`#0B2447`/`#0B3D91`) são bons para texto mas escuros/pouco
saturados demais como cor de mark de gráfico (falham lightness band e chroma floor no validador
do skill); `#1857C4` é uma variação mais clara da mesma família que passa em todos os checks
contra fundo branco. Ink dos textos permanece `#0B2447`.

- **Receita por mês** — barra vertical, uma série (sem legenda — regra do skill: série única não
  precisa de legend box).
- **Receita por embarcação / por roteiro** — barra horizontal, top 8. Nomes de embarcação/roteiro
  costumam ser títulos longos; o tick do eixo Y usa um renderer customizado (`TickTruncado`) que
  trunca para ~16 caracteres com reticências — o nome completo continua no tooltip (hover).
- Status da variação % (KPI) usa a paleta de status fixa do skill (`#0ca30c` bom / `#d03b3b`
  crítico), sempre com ícone (`TrendingUp`/`TrendingDown`) + texto — nunca cor isolada.

---

## 25. Área Administrativa (`/administrator`)

Área de gestão geral da plataforma, acessível somente a usuários com a role `admin`.

### 25.1 Segurança e controle de acesso

- **Role `admin`**: existe no enum `user_role` e na tabela `user_roles` desde a migration 001.
  **Nenhum código da aplicação concede essa role** — não há endpoint, server action ou tela de
  auto-atribuição (diferente do `gestor`, que tem o `/api/painel/setup-role`). A concessão é feita
  exclusivamente via SQL direto no banco:

  ```sql
  INSERT INTO public.user_roles (user_id, role) VALUES ('<auth.users.id>', 'admin');
  ```

- **Camada 1 — middleware (`src/proxy.ts`)**: toda rota `/administrator/*` exige usuário
  autenticado; não autenticado → redirect `/administrator/login` (única rota pública da área).
- **Camada 2 — layout do grupo `(admin)`** (`src/app/administrator/(admin)/layout.tsx`, Server
  Component): consulta a role no banco via `checkRoleInDb(user.id, ['admin'])` (`src/lib/roles.ts`,
  usa `supabaseAdmin` — fonte da verdade). Sem a role → tela "Acesso Restrito" (sem botão de
  auto-atribuição), apenas com "Voltar ao Site" e sign out.
- **Login** (`/administrator/login`, Client Component): apenas `signInWithPassword` (e-mail +
  senha). Sem login social, sem cadastro, sem recuperação de senha. O login **não** atribui role
  nem faz upsert de usuário — só autentica; a validação da role acontece no layout.

### 25.2 Estrutura de arquivos

```
src/app/administrator/
  layout.tsx                  → passthrough (isola a árvore do root layout do site)
  login/page.tsx              → login e-mail/senha (estático)
  (admin)/
    layout.tsx                → guard admin + AdminSidebar + AdminHeader
    page.tsx                  → dashboard (métricas globais)
    avaliacoes/page.tsx       → placeholder (ModuloEmConstrucao)
    embarcacoes/page.tsx      → placeholder
    publicidade/page.tsx      → placeholder
    taxas/page.tsx            → placeholder
    categorias/page.tsx       → placeholder
    configuracoes/page.tsx    → placeholder
src/components/administrator/
  AdminSidebar.tsx            → menu (Client Component), sign out → /administrator/login
  AdminHeader.tsx             → header com badge "Admin", nome e avatar do usuário
  ModuloEmConstrucao.tsx      → placeholder padrão dos módulos ainda não implementados
```

Layout visual clonado do padrão do `/painel` (sidebar 260px branca, header 16, fundo `#F8F9FB`,
navy `#0B2447`/`#0B3D91`).

### 25.3 Dashboard (`/administrator`)

Server Component; carrega em paralelo (`Promise.all`, via `supabaseAdmin`, **sem filtro de dono**
— visão global):

- Contagens (`count: exact, head: true`): `users`, `user_roles` (role `gestor`), `embarcacao`,
  `roteiro`, `reserva` (total e `status = pendente`), `avaliacao`.
- Taxa geral vigente: `taxa_plataforma.taxa_percent` (`singleton = true`).

Renderiza 6 stat cards + grid de cards de acesso rápido aos 6 módulos.

### 25.4 Menu (AdminSidebar)

| Rota | Item | Status |
|---|---|---|
| `/administrator` | Dashboard | ✅ implementado |
| `/administrator/avaliacoes` | Avaliações | 🔜 placeholder |
| `/administrator/embarcacoes` | Embarcações | 🔜 placeholder |
| `/administrator/publicidade` | Publicidade | 🔜 placeholder |
| `/administrator/taxas` | Taxas | 🔜 placeholder |
| `/administrator/categorias` | Categorias | 🔜 placeholder |
| `/administrator/configuracoes` | Configurações | 🔜 placeholder |

### 25.5 Tipos

- `taxa_plataforma` adicionada ao `Database` em `src/types/supabase.ts` (Row/Insert/Update),
  refletindo a migration 004.
