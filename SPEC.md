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
cpf_cnpj    text                                 -- CPF do cliente (só dígitos), coletado no cadastro por e-mail
phone       text                                 -- celular em E.164 (ex.: +5511912345678), coletado no cadastro por e-mail
birthday    date
avatar_url  text
endereco_cep          text                       -- endereço opcional (editado em "Minha conta")
endereco_estado_id    integer references estados(id)
endereco_municipio_id integer references municipios(id)
endereco_bairro       text
endereco_logradouro   text
endereco_numero       text
endereco_complemento  text
notif_email_conversas boolean not null default true  -- e-mail (agrupado) de novas conversas
created_at  timestamptz default now()
updated_at  timestamptz default now()
```

`users.id` referencia `auth.users(id) ON DELETE CASCADE`.  
RLS habilitado: usuário lê/atualiza apenas o próprio registro.

`cpf_cnpj` e `phone` são **NULLABLE**: só são preenchidos no cadastro por e-mail em `/entrar` (via `user_metadata` → `setup-cliente`). Contas criadas por SSO (Google/Facebook/Apple) não fornecem esses dados no cadastro e ficam `NULL` até serem completadas em "Minha conta".

Migration: `supabase/migrations/001_create_users_table.sql`  
Migration de migração Clerk→Supabase: `supabase/migrations/20260517_clerk_to_supabase_auth.sql`  
Migration da coluna `phone`: `supabase/migrations/20260719_users_phone.sql`  
Migration das colunas de endereço: `supabase/migrations/20260719b_users_endereco.sql` (todas NULLABLE — endereço é opcional)  
Migration da preferência de notificação: `supabase/migrations/20260719c_users_notif_conversas.sql` (`notif_email_conversas`, default `true`)

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

#### Campos do cadastro por e-mail (celular, CPF e senha forte)

O formulário de **criar conta** (modo `cadastro`) coleta, além de nome/e-mail/senha, o **celular** e o **CPF**. Esses campos **só aparecem no cadastro por e-mail** — o fluxo OAuth não os usa e permanece inalterado.

- **Celular** — componente `src/components/auth/PhoneInput.tsx` (`'use client'`): seletor de país (DDI + bandeira emoji, com busca) + campo de número nacional com máscara por país. A lista de países fica em `src/lib/countries.ts` (Brasil é o padrão, `+55`, máscara `(##) #####-####`). O componente emite `{ e164, valid }` via `onChange`; `valid` exige a quantidade de dígitos da máscara do país (fallback genérico: 8–15 dígitos). O valor final é montado em **E.164** (`dial + dígitos`, ex.: `+5511912345678`).
- **CPF** — `input` com máscara progressiva `000.000.000-00` (`maskCPF`) e validação de dígitos verificadores (`isValidCPF`), ambos em `src/lib/validators.ts`. Rejeita sequências repetidas. Persistido como **só dígitos** em `users.cpf_cnpj`.
- **Senha forte** — `src/lib/validators.ts` exporta `PASSWORD_RULES` (≥8 caracteres, 1 maiúscula, 1 minúscula, 1 número, 1 caractere especial) e `isStrongPassword`. O componente `src/components/auth/PasswordRequirements.tsx` mostra a lista de requisitos abaixo do campo e marca cada regra com um check (verde) em tempo real conforme o usuário digita.
- **Validação no submit:** `handleCadastro` bloqueia o envio (antes de chamar `signUp`) se CPF, celular ou senha forem inválidos, exibindo mensagens específicas; os erros de campo (CPF/celular) só destacam em vermelho após a primeira tentativa (`attemptedSubmit`).
- **Transporte até o banco:** os valores vão em `signUp({ options: { data: { full_name, cpf, phone } } })` → gravados no `user_metadata` do `auth.users` → lidos por `setup-cliente` (após a confirmação de e-mail) e persistidos em `public.users` (`cpf_cnpj`, `phone`) **apenas no insert** do registro.

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
  1. Mesmo fluxo de upsert. **No insert** (primeiro acesso), grava também `cpf_cnpj` e `phone` lidos do `user_metadata` (`user.user_metadata.cpf` / `.phone`) — presentes só no cadastro por e-mail; `NULL` no SSO. No **update** (logins seguintes) esses campos não são tocados, para não sobrescrever dados editados em "Minha conta".
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
| `tipo_embarcacao` | uuid | Filtro pelo tipo da embarcação (`embarcacao_tipo.id`) — na aba Embarcações filtra a própria embarcação; combinado com `p_tipo_id` |
| `tipo_nome` | string | Rótulo do tipo para chip/título (evita query extra) |
| `embarcacao_id` | uuid | Embarcação escolhida na lista da aba Embarcações — presente, a página mostra os roteiros dela em vez da lista |
| `embarcacao_nome` | string | Nome da embarcação escolhida, para o título (evita query extra) |

**Filtros aplicados (via RPC `buscar_roteiros` — migrations 018/019/020/024):**

> **Correção (migration 020):** `buscar_roteiros` e `buscar_embarcacoes` retornavam erro `42804` (`double precision` × `numeric` na coluna `distancia_km`), pois a expressão haversine (`acos/cos/sin/radians`) é `double precision` mas a coluna de retorno é `numeric`. A página engolia o erro e exibia "nenhum resultado". A 020 faz cast explícito da distância para `numeric` em ambas as funções. A página passou a logar `rpcError`.

Mesma mecânica de `buscar_embarcacoes` (ver §18.6), com **uma diferença no filtro de pessoas**: a capacidade considerada é a da **embarcação vinculada** ao roteiro (`roteiro.embarcacao_id → embarcacao.capacidade >= pessoas`), **não** o campo `roteiro.quantidade_pessoas` (este segue apenas para exibição no card). Roteiros **sem** embarcação vinculada (ou cuja embarcação não tem `capacidade`) **não aparecem** quando o filtro de pessoas está ativo.

- **Localização:** município exato OU ≤ 50 km do centro (haversine), usando `roteiro.latitude/longitude`.
- **Data:** disponibilidade via `roteiro.disponibilidade_dias_semana` + `roteiro_disponibilidade_bloqueio`; com `flex`, basta um dia livre na janela.
- **Tipo de embarcação (migration 024):** parâmetro `p_tipo_id uuid DEFAULT NULL` — quando informado, o roteiro só aparece se a **embarcação vinculada** tiver `embarcacao_tipo_id = p_tipo_id`. Roteiros sem embarcação vinculada não aparecem com o filtro ativo (mesma regra do filtro de pessoas). `NULL` = sem filtro (aba Roteiros intocada). A 024 dá `DROP` na assinatura de 9 parâmetros (020) antes do `CREATE` para evitar overload ambíguo no PostgREST.
- **Ordenação:** por distância quando há centro; senão `created_at` desc. A página chama a RPC (ids + total) e busca os detalhes com `.in('id', ids)` preservando a ordem.
- `GRANT EXECUTE` para `anon, authenticated, service_role`.

**Dois modos em `/buscar` (resolvidos pelos mesmos `searchParams`):**

- `abaEmbarcacao = tipo === 'embarcacao' || tipo_embarcacao != null'` → `modoListaEmbarcacoes = abaEmbarcacao` — chama a RPC `buscar_embarcacoes` (ver §18.6) com `p_tipo_id`; renderiza `EmbarcacaoCard` (`src/components/ui/EmbarcacaoCard.tsx`) em vez de `RoteiroCard`, com `href` apontando para `` `/embarcacoes/<id>/roteiros?voltar=<url atual de /buscar, encodeURIComponent>` `` (a prop `href` do card é opcional — sem ela, o card usado em "Mais Bem Avaliadas" continua indo para `/embarcacoes/[id]`). Avaliação/favorito via `getAvaliacoesResumoPorEmbarcacao` e `getFavoritosEmbarcacaoSet`. Título contextualizado ("Embarcações com \<tipo\> em …"), chip removível "Tipo: \<nome\>" e estado vazio com "Limpar filtro de tipo".
- Modo roteiro (default, `!abaEmbarcacao`): inalterado — RPC `buscar_roteiros` com `p_tipo_id` sempre `null`.
- A aba "Embarcações" do `SearchTypeToggle` (Hero e barra compacta) sempre navega para `/buscar?tipo=embarcacao[&tipo_embarcacao=&tipo_nome=]`, o que cai no modo "lista de embarcações". A rota `/embarcacoes` (sem id) também redireciona para lá.
- Clicar numa embarcação da lista **sai de `/buscar`**: vai para a página própria
  `/embarcacoes/[id]/roteiros` (ver §18.7-B), que mostra a embarcação em detalhe + um carrossel com
  os roteiros ativos dela. `/buscar` não tem mais um terceiro modo para isso.

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

### 18.6 Busca de Embarcações — RPC `buscar_embarcacoes` (consumida por `/buscar`)

**Arquivo consumidor:** `src/app/buscar/page.tsx`, modo `modoListaEmbarcacoes` (ver §18.3). A rota
`src/app/embarcacoes/page.tsx` (sem id) segue existindo só como **redirect** para
`/buscar?tipo=embarcacao`, preservando os params compatíveis (`municipio`, `local`, `lat`, `lng`,
`data`, `flex`, `pessoas`, `pagina`). O detalhe `/embarcacoes/[id]` (§18.7) e a reserva direta de
embarcação (§20.7) seguem ativos, acessíveis por link direto; a página de roteiros da embarcação
(§18.7-B) é o destino do card na busca. O componente antigo
`src/app/embarcacoes/_components/EmbarcacaoCard.tsx` continua sem uso (órfão); quem renderiza o card
na busca é `src/components/ui/EmbarcacaoCard.tsx` (o mesmo da seção "Mais Bem Avaliadas" da home —
ver §18.9), que ganhou uma prop `href?: string` opcional para apontar para
`/embarcacoes/[id]/roteiros` em vez do padrão `/embarcacoes/[id]`.

**Filtros da RPC `buscar_embarcacoes` (migration 017/020/`20260718_buscar_embarcacoes_tipo`):**

A página delega os filtros à função SQL `public.buscar_embarcacoes(...)`, que resolve tudo em uma chamada e retorna os **ids ordenados + total** (para paginação). A página então busca os detalhes (joins) com `.in('id', ids)`, **preservando a ordem** retornada.

```ts
const { data: rpcRows } = await supabaseAdmin.rpc('buscar_embarcacoes', {
  p_municipio_id, p_lat, p_lng, p_raio_km: 50,
  p_data, p_flex, p_pessoas, p_limit, p_offset, p_tipo_id,
});
// rpcRows: { id, distancia_km, total }[]  (já ordenado por distância → created_at)
```

Regras da função:
- **Roteiro ativo obrigatório (migration `20260718`):** só aparecem embarcações com `EXISTS (SELECT 1 FROM roteiro WHERE embarcacao_id = e.id AND ativo = true)` — sem isso, o clique no card levaria a uma lista vazia de roteiros.
- **Tipo (migration `20260718`):** parâmetro `p_tipo_id uuid DEFAULT NULL` — quando informado, só embarcações com `embarcacao_tipo_id = p_tipo_id`. Mesmo padrão de `DROP FUNCTION IF EXISTS` + `CREATE` de `buscar_roteiros`/migration 024, para evitar overload ambíguo no PostgREST.
- **Localização:** centro = `lat/lng` ("perto de mim") ou coordenadas do `municipio_id`. Aparece se `municipio_id` bater **exato** OU se a distância (haversine) ao centro for ≤ **50 km**. Sem centro = sem filtro de local.
- **Pessoas:** `capacidade >= pessoas`.
- **Data:** disponível se **algum** dia da janela `data ± flex` tiver o dia da semana em `disponibilidade_dias_semana` (ou ela for `NULL`) **e** não estiver em `embarcacao_disponibilidade_bloqueio`. Sem `data` = sem filtro de disponibilidade.
- **Ordenação:** por distância (mais próximas primeiro) quando há centro; senão por `created_at` desc. Embarcações sem coordenadas só aparecem pelo match exato de município (ordenadas por último, `NULLS LAST`).
- `GRANT EXECUTE` para `anon, authenticated, service_role` (busca anônima no hotsite).

> Preço exibido a partir de `preco_base` (paridade com a listagem de roteiros). Refinamento futuro: usar `get_precos_embarcacoes` para preço dependente da data.

### 18.7 Detalhe da Embarcação `/embarcacoes/[id]`

**Arquivo:** `src/app/embarcacoes/[id]/page.tsx` (Server Component).

Carrega a embarcação com tipo, categoria, município, comodidades e imagens. Reutiliza `GaleriaRoteiro` (com prop `voltarHref="/embarcacoes"`) e `LocalizacaoMap` de `roteiros/[id]/_components`.

Seções: `EmbarcacaoInfoSection` (badges tipo/categoria, título + localidade, descrição, grid de specs — capacidade, comprimento, cabines, suítes, banheiros, tripulação — e comodidades; ver §18.7-B), mapa + endereço, `AvaliacoesSection` (avaliações reais, agregadas de reservas de roteiros feitos na embarcação), e a sidebar de reserva `EmbarcacaoBookingCard` (data/pessoas obrigatórios, disponibilidade, preço/dia + taxa de serviço → `/reservas/novo?embarcacao=...`). Ver §20.7.

> A query lê `searchParams` (`data`/`flex`/`pessoas`) para pré-preencher o `EmbarcacaoBookingCard` quando o cliente chega pela busca, e inclui `disponibilidade_dias_semana` + `embarcacao_disponibilidade_bloqueio ( data )`.

> `GaleriaRoteiro` ganhou prop `voltarHref?: string` (padrão `/buscar`) para o botão "voltar".

### 18.7-B Roteiros da Embarcação `/embarcacoes/[id]/roteiros`

**Arquivo:** `src/app/embarcacoes/[id]/roteiros/page.tsx` (Server Component). Destino do card na
busca por embarcação (§18.3/§18.6) — v1, a ser refinada.

- 404 nas mesmas condições de `/embarcacoes/[id]` (`status != 'ativo'`).
- Query da embarcação: `id, nome, descricao, capacidade, comprimento, cabines, suites, banheiros,
  tripulacao, embarcacao_tipo(nome), embarcacao_categoria(nome), municipios(nome, estados(uf)),
  embarcacao_comodidades(comodidade(nome)), embarcacao_imagens(id, url_imagem, titulo, principal)`
  — mais enxuta que a de `/embarcacoes/[id]` (sem `preco_base`/disponibilidade/endereço, que só
  importam para a reserva direta).
- Query dos roteiros: `roteiro` filtrando `embarcacao_id = :id AND ativo = true`, ordenados por
  `created_at desc`, **sem paginação** (mostra todos no carrossel). Mesmo shape de `RoteiroCardData`
  (`src/app/buscar/_components/RoteiroCard.tsx`). Avaliação/favorito por roteiro via
  `getAvaliacoesResumoPorRoteiro` e a mesma query de `favorito` usada em `/buscar`.
- `searchParams.voltar` (URL codificada, opcional) vira o `voltarHref` da `GaleriaRoteiro` — link
  "voltar" para a busca com os filtros originais; sem o param, cai em `/buscar?tipo=embarcacao`.
- Layout: `GaleriaRoteiro` → `EmbarcacaoInfoSection` (mesmo componente do detalhe da embarcação,
  **sem** sidebar de reserva — o objetivo aqui é escolher um roteiro, não reservar a embarcação) →
  `RoteirosCarousel` com o título "Roteiros desta embarcação".
- Fora do escopo desta v1 (a pedido do usuário, que vai refinar depois): mapa de localização,
  avaliações e favoritar a embarcação nesta tela.

**`EmbarcacaoInfoSection`** (`src/app/embarcacoes/[id]/_components/EmbarcacaoInfoSection.tsx`) —
extraído de `/embarcacoes/[id]/page.tsx` para ser compartilhado pelas duas páginas: badges
(tipo/categoria/"Embarcação Verificada"), título + localidade, descrição, specs row e comodidades.
Props: só os campos que esse bloco usa (`nome`, `descricao`, `capacidade`, `comprimento`, `cabines`,
`suites`, `banheiros`, `tripulacao`, `embarcacao_tipo`, `embarcacao_categoria`, `municipios`,
`embarcacao_comodidades`).

**`RoteirosCarousel`** (`src/components/ui/RoteirosCarousel.tsx`, `'use client'`) — primeiro
carrossel horizontal do projeto (não existia nenhum antes). `overflow-x-auto snap-x snap-mandatory
scrollbar-hide` com `RoteiroCard`s em itens `shrink-0 snap-start` de largura fixa, e duas setas
(`ChevronLeft`/`ChevronRight`) que chamam `scrollerRef.current.scrollBy({ left: ±320,
behavior: 'smooth' })`. Recebe `items: { roteiro, initialFavorito, avaliacaoResumo }[]` já resolvidos
pela página (evita passar `Set`/`Map`, não serializáveis de Server → Client Component), `title?` e
`query?`. Sem setas desabilitadas nas pontas nem dots nesta v1.

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

## 18.9 Home — seções "Mais Bem Avaliados" (embarcações e roteiros)

Migrations: `supabase/migrations/20260709b_embarcacoes_top_avaliadas.sql` e
`supabase/migrations/20260709c_roteiros_top_avaliados.sql`.

As seções "Embarcações Mais Bem Avaliadas" (`TopRatedSection`, 4 cards) e "Roteiros Mais Bem
Avaliados" (`FeaturedChartersSection`, ex-"Featured Charters", 3 cards) da home deixaram de usar
mock e passaram a ser 100% dinâmicas (dados do banco), com a mesma mecânica.

### RPCs `embarcacoes_top_avaliadas` / `roteiros_top_avaliados`

```sql
embarcacoes_top_avaliadas(p_lat numeric, p_lng numeric, p_raio_km numeric = 100, p_limit int = 4)
roteiros_top_avaliados   (p_lat numeric, p_lng numeric, p_raio_km numeric = 100, p_limit int = 3)
  → TABLE (id uuid, media numeric, total bigint, score numeric)
```

- As avaliações são de **roteiros** (§22): `roteiros_top_avaliados` agrega por
  `avaliacao.roteiro_id` (só roteiros `ativo = true`); `embarcacoes_top_avaliadas` agrega pelo
  `embarcacao_id` copiado da reserva (só embarcações `status = 'ativo'`). Ambas consideram apenas
  avaliações `aprovada`.
- **Ranking** por média bayesiana (fórmula IMDb): `score = (v/(v+m))·R + (m/(v+m))·C`, com
  `R` = média do item, `v` = nº de avaliações, `C` = média global da plataforma e `m = 5`.
  Assim, "mais avaliações + maior nota" vence uma única nota 5. Desempate: `total`, depois `media`.
- Com `p_lat`/`p_lng`, considera apenas itens num raio de `p_raio_km` (haversine sobre as
  coordenadas da embarcação/do roteiro, mesmo cálculo das buscas 017/018); sem centro, plataforma
  inteira. `GRANT EXECUTE` para `anon/authenticated/service_role`.

### Server helper — `src/lib/embarcacoes-top.ts`

- `getEmbarcacoesTopAvaliadas({ lat?, lng?, limit = 4 })` → `EmbarcacaoTopCard[]` (`id`, `nome`,
  `preco_base`, `capacidade`, `tipo`, `localidade`, `imagem` principal, `media`, `total`). Chama a
  RPC e busca os detalhes (`embarcacao` + joins) preservando a ordem do ranking. **Fallback:** com
  localização e menos resultados que o limite na região (raio 100 km), completa com o topo global
  (sem duplicatas).
- `getFavoritosEmbarcacaoSet(userId, ids)` → `Set` com as embarcações já favoritadas (coração
  preenchido nos cards).

### Server helper — `src/lib/roteiros-top.ts`

Espelho do anterior para roteiros: `getRoteirosTopAvaliados({ lat?, lng?, limit = 3 })` →
`RoteiroTopCard[]` (`RoteiroCardData` do card da busca + `media`/`total`), com o mesmo fallback
regional→global; e `getFavoritosRoteiroSet(userId, ids)`.

### APIs — `GET /api/embarcacoes/top-avaliadas` e `GET /api/roteiros/top-avaliados` (`?lat=&lng=`)

`src/app/api/embarcacoes/top-avaliadas/route.ts` e `src/app/api/roteiros/top-avaliados/route.ts`:
validam `lat`/`lng` (400 se ausentes) e retornam `{ items: (…TopCard & { favorito: boolean })[] }`
(favorito resolvido pela sessão do cookie, `false` deslogado). Usadas pelos clients da home para
trocar a lista global pela localizada.

### Componentes

- **`TopRatedSection`** (`src/components/home/TopRatedSection.tsx`, Server Component `async`):
  busca o top 4 **global** de embarcações (SSR) + favoritos do usuário logado e renderiza o header
  da seção. Sem nenhuma embarcação avaliada na plataforma, a seção não é renderizada
  (`return null`). Link **"Ver Todas"** (desktop e CTA mobile) → `/buscar?tipo=embarcacao` (busca
  com a aba Embarcações selecionada).
- **`FeaturedChartersSection`** (`src/components/home/FeaturedChartersSection.tsx`, Server
  Component `async`): mesmo padrão para o top 3 **global** de roteiros. Textos: eyebrow "Roteiros
  Selecionados", título "Roteiros Mais Bem Avaliados". Link **"Ver Mais"** (desktop e CTA mobile)
  → `/buscar`. Sem roteiro avaliado, `return null`.
- **`TopRatedBoats`** / **`FeaturedRoteiros`** (`src/components/home/…`, `'use client'`): renderizam
  os grids. No mount, se a permissão de geolocalização **já estiver concedida**
  (`navigator.permissions.query({ name: 'geolocation' })` → `granted`), obtêm a posição e trocam a
  lista pela resposta da API correspondente. **Não disparam** o prompt de permissão na home; sem
  permissão, permanece a lista global (regra do PRD: com localização → mais bem avaliados perto do
  usuário; sem → plataforma inteira).
- **`EmbarcacaoCard`** (`src/components/ui/EmbarcacaoCard.tsx`, `'use client'`): card de embarcação
  (imagem principal, badge do tipo, nome, localidade, `★ média (total)` ou badge "Novo",
  `preco_base`/dia, "até N pessoas"), link para `/embarcacoes/[id]`, coração favoritável (ver
  §23.5). Os roteiros reutilizam o **`RoteiroCard`** da busca (favoritar já existente). O antigo
  `BoatCard` (mock) ficou órfão e foi removido.

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

**`/minha-conta`** (`src/app/minha-conta/page.tsx`, Server Component): gate de auth (sem sessão →
`/entrar?redirect_to=/minha-conta`). Carrega o registro de `public.users` (`name, email, cpf_cnpj,
phone, avatar_url, created_at`) via `supabaseAdmin` e deriva os **provedores de login** de
`user.identities[].provider` ∪ `user.app_metadata.providers` (fallback `['email']`).
`canChangePassword = providers.includes('email')`. Passa tudo para o client `MinhaContaForm`.

**`_components/MinhaContaForm.tsx`** (`'use client'`) — no topo, uma **barra de atalhos** (`<nav>`
sticky abaixo do `Header`, `top-16`) com "tabs-âncora" (Dados pessoais, Meu endereço, Notificações,
Segurança); clicar faz `scrollIntoView({behavior:'smooth'})` até a seção (cada seção tem `id` +
`scroll-mt-32` para não ficar sob o header/barra). Um `IntersectionObserver` (scroll-spy) destaca o
atalho da seção visível. Abaixo, os blocos:
1. **Cartão de identidade:** avatar (ou inicial do nome), nome, e-mail, "cliente desde"
   (`created_at` em pt-BR) e chips dos provedores vinculados (`E-mail e senha`, `Google`, …).
2. **Dados pessoais:** edita **nome**, **CPF** (`maskCPF` + `isValidCPF`) e **celular**
   (`PhoneInput` com `initialE164` pré-preenchido). E-mail é **somente leitura** (troca de e-mail
   exige reconfirmação no Auth — fora de escopo). Salva via server action **`atualizarPerfil`**
   (`src/lib/conta-actions.ts`, `'use server'`): valida sessão + nome + CPF, faz `update` em
   `public.users` (`name, cpf_cnpj` só dígitos, `phone` E.164 ou `null`, `updated_at`) com
   `supabaseAdmin`, e `revalidatePath('/minha-conta')`.
3. **Meu endereço (opcional):** CEP, estado (select de `estados`), município (select dependente,
   carregado por estado), bairro, logradouro, número e complemento — **todos opcionais**. Reusa a
   **mesma lógica do cadastro de roteiro**: ao digitar o CEP (8 dígitos) consulta o **ViaCEP**
   (`https://viacep.com.br/ws/{cep}/json/`), autopreenche logradouro/bairro, mapeia `uf` → estado,
   carrega os municípios daquele estado e casa o município por nome normalizado. Os municípios vêm
   da server action **`getMunicipiosByEstado`** (`conta-actions.ts`, consulta `municipios` por
   `estado_id`); a página já entrega `estados` e os `municipiosIniciais` do endereço salvo. Salva via
   **`atualizarEndereco`** (`conta-actions.ts`, `'use server'`): grava `endereco_*` em `public.users`
   (estado/município como id; campos vazios viram `NULL`) e `revalidatePath('/minha-conta')`.
4. **Notificações:** toggle **"Receber e-mail de notificação de novas conversas"**
   (`notif_email_conversas`, padrão **habilitado**). Salva **na hora** ao alternar (UI otimista com
   rollback em erro) via server action **`atualizarNotifEmailConversas(ativo)`** (`conta-actions.ts`).
   O toggle é um `<button role="switch">` acessível. O envio de e-mail em si é descrito em
   "§ Notificação de novas conversas por e-mail".
5. **Segurança:** só quando `canChangePassword`. Form de troca de senha (senha atual + nova senha
   forte com `PasswordRequirements` + confirmação). No submit: **reautentica** com
   `signInWithPassword({ email, senha atual })` (client SSR) — se falhar → "Senha atual incorreta" —
   e então `updateUser({ password })`. Contas somente-SSO não veem o form: mostram um aviso de que a
   senha é gerenciada pelo provedor. Reusa `isStrongPassword`/`PASSWORD_RULES` de
   `src/lib/validators.ts` — mesma política do cadastro.

`PhoneInput` ganhou a prop opcional `initialE164`: deduz país (DDI de maior comprimento que casa o
prefixo) + dígitos nacionais para pré-preencher o campo.

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

### 21.4c Notificação de novas conversas por e-mail (agrupada)

Avisa por e-mail quem tem mensagens de chat **não lidas**, sem enviar um e-mail por mensagem —
agrupa numa **janela anti-bombardeio**. Vale para os dois lados (gestor e cliente); respeita a
preferência `users.notif_email_conversas` (toggle em "Minha conta → Notificações", padrão `true`).

**Peças:**
- Migration `20260719d_chat_notificacao_email.sql`: coluna `mensagem.notificada_em timestamptz`
  (carimba mensagens já incluídas em algum e-mail; índice parcial `WHERE lida_em IS NULL AND
  notificada_em IS NULL`) + RPC **`chat_notificacoes_pendentes()`** (`security definer`, **só**
  `service_role`): retorna uma linha por **(destinatário, conversa)** — `recipient_id/email/name`,
  `recipient_is_gestor`, `conversa_id`, `remetente_nome`, `qtd`, `primeira_em`, `ultima_em`,
  `msg_ids[]` — considerando apenas mensagens `lida_em IS NULL AND notificada_em IS NULL` de
  destinatários com `notif_email_conversas = true`. Destinatário = o participante que **não** enviou.
- `src/lib/notificacoes-conversa.ts` (`server-only`) — `processarNotificacoesConversas()`: agrupa por
  destinatário e aplica a regra: **envia** se a mensagem mais recente já tem ≥ `NOTIF_QUIET_MINUTES`
  (rajada acalmou) **ou** a mais antiga já espera ≥ `NOTIF_MAX_WAIT_MINUTES` (teto); senão **adia**
  para a próxima rodada. Padrões: 5 e 30 min (via env). Monta **um** e-mail HTML por destinatário
  (lista remetentes + quantidades; CTA para `/minhas-conversas` ou `/painel` conforme
  `recipient_is_gestor`), envia e só então carimba `notificada_em` nos `msg_ids` — se o envio falhar,
  não carimba (reenvia na próxima rodada).
- `src/lib/email.ts` (`server-only`) — `sendEmail({to,subject,html})` via **Resend** (REST API por
  `fetch`, sem dependência nova). Usa `RESEND_API_KEY` + `EMAIL_FROM`; sem a chave, vira no-op logado.
- `src/app/api/cron/notificar-conversas/route.ts` — aciona `processarNotificacoesConversas`.
  Protegida por `CRON_SECRET` (checa `Authorization: Bearer <CRON_SECRET>`, que a Vercel envia
  automaticamente); sem o secret responde 401. `GET` (Vercel Cron) e `POST` (teste manual).
- `vercel.json` — `crons`: `/api/cron/notificar-conversas` a cada 5 min (`*/5 * * * *`).

**Envs** (`.env.example`): `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, `NOTIF_QUIET_MINUTES`,
`NOTIF_MAX_WAIT_MINUTES`. Mensagens que o destinatário ler antes da rodada saem naturalmente do
conjunto (`lida_em` deixa de ser nulo) e não geram e-mail.

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
status        avaliacao_status NOT NULL DEFAULT 'pendente'  -- 'pendente' | 'aprovada' (migration 20260708)
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
`supabaseAdmin`, `order created_at desc`, embed `cliente:users!avaliacao_cliente_id_fkey`). Ambas
filtram `status = 'aprovada'` — só avaliações moderadas pelo admin aparecem publicamente (ver 25.6).

### 22.5 Média no card da busca (`RoteiroCard`)

Helper `getAvaliacoesResumoPorRoteiro(roteiroIds)` (`src/lib/avaliacoes.ts`, `server-only`): uma
query em lote (`avaliacao.select('roteiro_id, nota').in(...)`) agregada em memória →
`Map<roteiroId, { media, total }>`. Usado por `/buscar` e `/favoritos`, que passam
`avaliacaoResumo` a cada `RoteiroCard`. No card (linha do preço): com avaliações, exibe
`★ 4,8 (12)` (estrela âmbar, média 1 decimal pt-BR, total no `title`) **no lugar** do badge
"Novo"; sem avaliações, mantém o badge "Novo".

---

## 23. Favoritos e Compartilhamento (roteiro e embarcação)

Migrations: `supabase/migrations/027_favoritos.sql` e
`supabase/migrations/20260709_favoritos_embarcacao.sql`.

### 23.1 Modelo de dados

#### Tabela `favorito`

```sql
id            uuid PK
user_id       uuid NOT NULL FK → users(id) ON DELETE CASCADE
roteiro_id    uuid FK → roteiro(id) ON DELETE CASCADE        -- nullable desde 20260709
embarcacao_id uuid FK → embarcacao(id) ON DELETE CASCADE     -- adicionada em 20260709
created_at    timestamptz
UNIQUE (user_id, roteiro_id)
UNIQUE parcial (user_id, embarcacao_id) WHERE embarcacao_id IS NOT NULL
CHECK num_nonnulls(roteiro_id, embarcacao_id) = 1            -- exatamente um alvo
```

Índices `(user_id, created_at DESC)` e parcial em `embarcacao_id`. **RLS:** `service_role_all`;
SELECT/INSERT/DELETE apenas do próprio usuário (`user_id = auth.uid()`). Tipos TS em
`src/types/supabase.ts`.

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
  embed do `roteiro` (campos do card + `ativo`) **e** da `embarcacao` (campos do card + `status`);
  filtra `roteiro.ativo = true` / `embarcacao.status = 'ativo'` em memória (item desativado some,
  favorito permanece no banco). Exibe duas grades — **Roteiros** (`RoteiroCard`) e **Embarcações**
  (`EmbarcacaoCard`) — com cabeçalhos apenas quando os dois tipos existem; cada card acompanha
  `_components/RemoverFavoritoButton.tsx` (`'use client'`: aceita `roteiroId` OU `embarcacaoId`,
  chama a action correspondente + `router.refresh()`). Estado vazio com CTA "Explorar roteiros".

### 23.5 Favoritar embarcação

- **Server action** `alternarFavoritoEmbarcacao(embarcacaoId)` (`src/lib/favoritos-actions.ts`):
  mesma semântica/retorno de `alternarFavorito`, gravando em `favorito.embarcacao_id`. Revalida
  `/favoritos`.
- **`EmbarcacaoCard`** (`src/components/ui/EmbarcacaoCard.tsx`): coração com toggle otimista;
  deslogado → `/entrar?redirect_to=<pathname+search com fav_emb=<id>>`.
- **Auto-favorito pós-login:** ao voltar do login, o card detecta `fav_emb=<seu id>` na URL,
  remove o parâmetro (`history.replaceState`) e conclui o favorito automaticamente — cumpre o
  fluxo "deslogado → login → favoritado" sem novo clique.
- Estado inicial resolvido no servidor (home §18.9 e `/favoritos`) via
  `getFavoritosEmbarcacaoSet`.

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
    avaliacoes/
      page.tsx                → gestão de avaliações (lista + moderação)
      actions.ts               → aprovarAvaliacao, editarAvaliacao, excluirAvaliacao
      _components/AvaliacoesGrid.tsx → tabela client (busca, ordenação, paginação, modais)
    embarcacoes/
      page.tsx                → gestão de todas as embarcações (lista + gestor)
      actions.ts              → alternarStatusEmbarcacaoAdmin
      _components/AdminEmbarcacoesGrid.tsx → tabela client (busca, ordenação, paginação, toggle)
      [id]/editar/page.tsx    → edição admin (reutiliza EditarEmbarcacaoForm do painel)
    roteiros/
      page.tsx                → gestão de todos os roteiros (lista + gestor)
      actions.ts              → alternarStatusRoteiroAdmin
      _components/AdminRoteirosGrid.tsx → tabela client (busca, ordenação, paginação, toggle)
      [id]/editar/page.tsx    → edição admin (reutiliza EditarRoteiroForm do painel)
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
  `roteiro`, `reserva` (total e `status = pendente`), `avaliacao` (`status = aprovada`, para bater
  com o rótulo "publicadas por clientes" do card).
- Taxa geral vigente: `taxa_plataforma.taxa_percent` (`singleton = true`).

Renderiza 6 stat cards + grid de cards de acesso rápido aos 6 módulos.

### 25.4 Menu (AdminSidebar)

| Rota | Item | Status |
|---|---|---|
| `/administrator` | Dashboard | ✅ implementado |
| `/administrator/avaliacoes` | Avaliações | ✅ implementado |
| `/administrator/embarcacoes` | Embarcações | ✅ implementado |
| `/administrator/roteiros` | Roteiros | ✅ implementado |
| `/administrator/publicidade` | Publicidade | 🔜 placeholder |
| `/administrator/taxas` | Taxas | 🔜 placeholder |
| `/administrator/categorias` | Categorias | 🔜 placeholder |
| `/administrator/configuracoes` | Configurações | 🔜 placeholder |

### 25.5 Tipos

- `taxa_plataforma` adicionada ao `Database` em `src/types/supabase.ts` (Row/Insert/Update),
  refletindo a migration 004.

### 25.6 Módulo — Avaliações (`/administrator/avaliacoes`)

Gestão de todas as avaliações da plataforma (ver também seção 22). Migration:
`supabase/migrations/20260708_avaliacao_status.sql`.

**Moderação (novo):** a tabela `avaliacao` ganhou a coluna `status avaliacao_status NOT NULL
DEFAULT 'pendente'` (enum `'pendente' | 'aprovada'`). Avaliações já existentes antes da migration
foram marcadas `'aprovada'` (não somem do site); toda avaliação nova nasce `'pendente'` e só passa
a aparecer nas páginas públicas depois que o admin aprova. A policy RLS `public_read` foi trocada
para `USING (status = 'aprovada')` — mas como as páginas públicas leem via `supabaseAdmin` (service
role, ignora RLS), o filtro `status = 'aprovada'` é replicado explicitamente nas queries:
`/roteiros/[id]`, `/embarcacoes/[id]` (seção de avaliações) e `getAvaliacoesResumoPorRoteiro`
(`src/lib/avaliacoes.ts`, usado pelos cards de `/buscar` e `/favoritos`). Em `/minhas-reservas`, o
cliente continua vendo a própria avaliação assim que envia (query via `supabaseAdmin`, sem filtro
de status) — `AvaliacaoReserva.tsx` exibe o selo "Aguardando aprovação" enquanto `status =
'pendente'`.

**`page.tsx`** (Server Component): **paginação, busca e ordenação server-side** com o mesmo
esquema de query string dos módulos Embarcações/Roteiros (25.7/25.8): `q`, `page`,
`per` ∈ {10, 25, 50} (padrão 10), `sort`, `dir`; `.range()` + `{ count: 'exact' }`; desempate por
`id`. Detalhes:
- Colunas ordenáveis: `data` → `created_at`, `nota`, `status` (colunas diretas da tabela;
  Cliente e Vínculo, que vêm de embeds, não são ordenáveis).
- Busca: `or(comentario.ilike, cliente_id.in.(...), roteiro_id.in.(...), embarcacao_id.in.(...))`
  — os ids são resolvidos antes por três queries paralelas (`users` por name/email ilike,
  `roteiro` e `embarcacao` por nome ilike, limit 100 cada). Termo sanitizado (remove `,()"`).
- Embeds da página atual: `cliente:users!avaliacao_cliente_id_fkey ( name, email )`,
  `roteiro ( id, nome )` e `embarcacao ( id, nome )`.

**`AvaliacoesGrid.tsx`** (Client Component): controlado por URL, como em 25.7 (busca com
debounce de 400ms, ordenação, página e tamanho de página via search params; `useTransition`
mostra spinner no campo de busca). Colunas: Data, Cliente (nome + e-mail), Vínculo
(badge "Roteiro: nome" ou "Embarcação: nome"), Nota (estrelas), Comentário (truncado, `title` com
o texto completo), Status (Pendente/Aprovada) e Ações:
- **Aprovar** (ícone check, só quando `status = 'pendente'`) → `aprovarAvaliacao`.
- **Editar** (ícone lápis, sempre visível) → abre modal com estrelas + textarea, salva via
  `editarAvaliacao`.
- **Excluir** (ícone lixeira, sempre visível) → modal de confirmação, remove via `excluirAvaliacao`.

Não há estado "reprovada": reprovar uma avaliação pendente é simplesmente excluí-la.

**`actions.ts`**: `aprovarAvaliacao(id)`, `editarAvaliacao(id, { nota, comentario })` (valida nota
inteira 1–5 e comentário ≤ 2000 chars) e `excluirAvaliacao(id)`. Todas exigem sessão + role `admin`
(`checkRoleInDb`) e operam via `supabaseAdmin`; revalidam `/administrator/avaliacoes`.

### 25.7 Módulo — Embarcações (`/administrator/embarcacoes`)

Gestão de todas as embarcações da plataforma, clonando o padrão da lista do
`/painel/embarcacoes` com a adição da coluna **Gestor**.

**`page.tsx`** (Server Component): **paginação, busca e ordenação server-side**, dirigidas por
query string (`q`, `page`, `per`, `sort`, `dir`) — apenas a página atual vem do banco, via
`.range()` + `{ count: 'exact' }`. Detalhes:
- `per` ∈ {10, 25, 50} (padrão 10); `page` ≥ 1; desempate por `id` no `order` para paginação
  estável quando a coluna ordenada repete valores.
- Colunas ordenáveis: apenas colunas diretas da tabela (`nome`, `status`, `capacidade`,
  `created_at`) — colunas de embeds (gestor, tipo, categoria, localização) não são ordenáveis.
- Busca: `or(nome.ilike.%q%, owner_id.in.(...))`, onde os `owner_ids` são resolvidos antes por
  uma query em `users` (`name`/`email` ilike, limit 100) — assim a busca cobre o gestor sem FK
  declarada no PostgREST. O termo é sanitizado (remove `,()"`) para não quebrar a sintaxe do
  `or()`.
- Embeds da página atual: `embarcacao_tipo`, `embarcacao_categoria`, `municipios ( estados )`,
  `embarcacao_imagens` e `roteiro`. Gestores resolvidos em segunda query apenas para os
  `owner_ids` da página e associados em memória (`gestor: { name, email } | null`).

**`AdminEmbarcacoesGrid.tsx`** (Client Component): controlado por URL — busca (debounce de
400ms), ordenação, página e tamanho de página (`10/25/50`) atualizam os search params via
`router.replace` (`useTransition` mostra spinner no campo de busca durante a navegação). Mantém
o toggle de status com modal de confirmação ao desativar (lista os roteiros vinculados). Ações:
apenas **Editar** → `/administrator/embarcacoes/[id]/editar`. Toggle chama
`alternarStatusEmbarcacaoAdmin`.

**`actions.ts`**: `alternarStatusEmbarcacaoAdmin(id, 'ativo' | 'inativo')` — exige sessão + role
`admin` (`checkRoleInDb`), atualiza `embarcacao.status` **sem checagem de posse** e replica o
cascade do painel (`roteiro.ativo` acompanha o status); revalida `/administrator/embarcacoes`.

**`[id]/editar/page.tsx`** (Server Component): mesma carga de dados da página de edição do painel
(embarcação sem filtro de `owner_id`, imagens, regras de preço, tipos, categorias, estados,
comodidades, bloqueios de disponibilidade), mais o gestor responsável (exibido no subtítulo).
Reutiliza `EditarEmbarcacaoForm` do painel via import direto, passando o novo prop opcional
`voltarHref="/administrator/embarcacoes"` (default `/painel/embarcacoes`), usado no botão
Cancelar e no redirect pós-salvamento.

**Autorização compartilhada (mudança nas actions do painel):** o admin edita qualquer embarcação
pelas mesmas server actions do gestor. Em
`painel/(gestao)/embarcacoes/[id]/editar/actions.ts` (`getAuthorizedUser`) e em
`painel/(gestao)/embarcacoes/novo/actions.ts` (`salvarImagem`), a checagem de posse
(`owner_id = user.id`) passa a ser aplicada **apenas quando o usuário não tem a role `admin`**;
gestores seguem restritos às próprias embarcações. As demais actions reutilizadas
(`atualizarEmbarcacao`, `atualizarComodidades`, `excluirImagem`, `excluirRegra`,
`definirPrincipal`, `salvarBloqueiosEmbarcacao`) já passam por `getAuthorizedUser`; `criarRegra`
exige apenas sessão (comportamento pré-existente).

### 25.8 Módulo — Roteiros (`/administrator/roteiros`)

Mesma arquitetura do módulo Embarcações (25.7), adaptada a roteiros. Novo item **ROTEIROS**
(ícone `MapPin`) no `AdminSidebar`, entre Embarcações e Publicidade.

**`page.tsx`** (Server Component): **paginação, busca e ordenação server-side** com o mesmo
esquema de query string de 25.7 (`q`, `page`, `per` ∈ {10, 25, 50}, `sort`, `dir`;
`.range()` + `{ count: 'exact' }`; desempate por `id`). Diferenças:
- Colunas ordenáveis: `nome`, `duracao`, `pessoas` → `quantidade_pessoas`, `status` → `ativo`,
  `created_at`.
- Busca: `or(nome.ilike, origem.ilike, destino.ilike, owner_id.in.(...))` — owner_ids do gestor
  resolvidos antes em `users`, como em 25.7.
- Embeds da página atual: `embarcacao ( nome )`, `municipios ( estados )` e `roteiro_imagens`.
  Gestores resolvidos em segunda query apenas para os `owner_ids` da página.

**`AdminRoteirosGrid.tsx`** (Client Component): controlado por URL, como em 25.7 (busca com
debounce de 400ms, ordenação, página e tamanho de página via search params). Toggle de status
direto, sem modal (roteiro é folha, sem cascata). Ações: apenas **Editar** →
`/administrator/roteiros/[id]/editar`. Toggle chama `alternarStatusRoteiroAdmin`.

**`actions.ts`**: `alternarStatusRoteiroAdmin(id, ativo)` — exige sessão + role `admin`
(`checkRoleInDb`), atualiza `roteiro.ativo` **sem checagem de posse**; revalida
`/administrator/roteiros`.

**`[id]/editar/page.tsx`** (Server Component): busca o roteiro primeiro (sem filtro de
`owner_id`) porque os selects de **embarcação** e **catálogo** do formulário devem listar os
itens do gestor dono do roteiro (`owner_id = roteiro.owner_id`), não do admin. Demais cargas
(imagens, regras de preço, estados, catálogo vinculado, bloqueios) iguais à página do painel,
mais o gestor responsável (exibido no subtítulo). Reutiliza `EditarRoteiroForm` do painel via
import direto, passando o novo prop opcional `voltarHref="/administrator/roteiros"` (default
`/painel/roteiros`).

**Autorização compartilhada (mudança nas actions do painel):** em
`painel/(gestao)/roteiros/[id]/editar/actions.ts` (`getAuthorizedUser`) e em
`painel/(gestao)/roteiros/novo/actions.ts` (`salvarImagemRoteiro`), a checagem de posse
(`owner_id = user.id`) passa a ser aplicada **apenas quando o usuário não tem a role `admin`**.
As demais actions reutilizadas (`atualizarRoteiro`, `atualizarCatalogoRoteiro`,
`excluirImagemRoteiro`, `definirPrincipalRoteiro`, `excluirRegraRoteiro`,
`salvarBloqueiosRoteiro`) já passam por `getAuthorizedUser`; `criarRegraRoteiro` exige apenas
sessão (comportamento pré-existente).

---

## 26. Cadastro rápido de item de catálogo no formulário de roteiro

### 26.1 UI — `CatalogoSelector`

`painel/(gestao)/roteiros/_components/CatalogoSelector.tsx` (usado por `NovoRoteiroForm` e
`EditarRoteiroForm`, incluindo a edição via `/administrator/roteiros/[id]/editar`) ganha um botão
**"Cadastrar novo item"** que abre um modal (`NovoItemModal`, no mesmo arquivo) com os campos
`descricao`, `tipo` (`produto` | `servico`) e `valor`.

O modal é renderizado **dentro** do `<form>` do roteiro, então não usa um `<form>` aninhado: o
submit é um `<button type="button">` com `onClick`, evitando disparar o submit do roteiro.

Novo prop obrigatório:

```ts
onCatalogoCriado: (item: CatalogoItem) => void;
```

### 26.2 Fluxo

1. O modal chama a server action existente `criarCatalogo` (`painel/(gestao)/catalogo/novo/actions.ts`),
   que persiste o item (`owner_id = user.id`) e retorna `{ ok: true, catalogoId }`.
2. O `CatalogoSelector` monta o `CatalogoItem` localmente (id retornado + valores do formulário),
   chama `onCatalogoCriado(item)` e **já marca o item como selecionado** no roteiro, com
   `valorCustomizado` igual ao valor padrão.
3. `NovoRoteiroForm` / `EditarRoteiroForm` mantêm o catálogo em estado
   (`const [catalogo, setCatalogo] = useState(catalogoInicial)`) e apenas fazem `[...c, item]`.

Não há `router.refresh()` nem navegação: o restante do formulário do roteiro (fotos, regras de
preço, disponibilidade, campos já preenchidos) permanece intacto. A persistência do vínculo
`roteiro_catalogo` continua acontecendo só no submit do roteiro
(`salvarCatalogoRoteiro` / `atualizarCatalogoRoteiro`).

### 26.3 Estado vazio

Quando o gestor ainda não tem itens de catálogo, o seletor deixa de mostrar apenas o link para
`/painel/catalogo` e passa a exibir o mesmo botão de cadastro rápido.

---

## 27. Capacidade do roteiro herdada da embarcação vinculada

Ao trocar o select **"Embarcação vinculada"** em `NovoRoteiroForm` e `EditarRoteiroForm`, o campo
**"Capacidade máxima"** (`quantidade_pessoas`) é preenchido com `embarcacao.capacidade`.

As três páginas que alimentam esses formulários passaram a incluir `capacidade` no select da
embarcação (`painel/(gestao)/roteiros/novo/page.tsx`,
`painel/(gestao)/roteiros/[id]/editar/page.tsx`,
`administrator/(admin)/roteiros/[id]/editar/page.tsx`), e o tipo local virou:

```ts
type Embarcacao = { id: string; nome: string; capacidade: number | null };
```

Regras do handler `setEmbarcacao(embarcacaoId)`:

- `capacidade` preenchida → sobrescreve `quantidade_pessoas`, inclusive se o campo já tinha valor.
- `capacidade` nula (coluna é `integer NULL`) ou opção **"Sem vínculo"** → mantém o valor atual do
  campo, em vez de limpá-lo.
- O disparo é **apenas no `onChange`** do select: abrir a edição de um roteiro existente não
  reescreve a capacidade já salva, e o gestor pode ajustar o número manualmente depois de escolher
  a embarcação.

---

## 28. Tutorial guiado do painel (`/painel`)

Onboarding em overlay que apresenta o dashboard, o menu lateral e induz o gestor a cadastrar uma
embarcação e depois criar um roteiro.

### 28.1 Arquivos

| Arquivo | Papel |
| --- | --- |
| `src/components/painel/TutorialPainel.tsx` | `TutorialProvider`, `useTutorial()`, `TutorialButton` e o overlay (`TutorialOverlay`) |
| `src/app/painel/(gestao)/layout.tsx` | Envolve o painel com `<TutorialProvider>`; `<main data-tour="dashboard-content">` |
| `src/components/painel/Sidebar.tsx` | `data-tour` em cada item do menu + no botão "Nova Embarcação" |
| `src/components/painel/Header.tsx` | Renderiza `<TutorialButton />` ao lado do `NotificacoesBell` |

### 28.2 Contrato dos componentes

```ts
export function TutorialProvider(props: { children: React.ReactNode }): JSX.Element;
export function useTutorial(): { abrir: () => void };
export function TutorialButton(): JSX.Element; // ícone GraduationCap + tooltip "Ver tutorial"

type Passo = {
  alvo: string | null;   // seletor CSS; null = card centralizado, sem spotlight
  titulo: string;
  descricao: string;
  acao?: { label: string; href: string }; // botão que fecha o tutorial e navega
};
```

### 28.3 Passos (12)

1. Boas-vindas (sem alvo) · 2. `dashboard-content` · 3–9. itens do menu (`nav-dashboard`,
`nav-agendamentos`, `nav-embarcacoes`, `nav-roteiros`, `nav-catalogo`, `nav-clientes`,
`nav-receitas`) · 10. `nova-embarcacao` (ação → `/painel/embarcacoes/novo`) ·
11. `nav-roteiros` (ação → `/painel/roteiros/novo`) · 12. `btn-tutorial`.

### 28.4 Marcadores `data-tour`

`dashboard-content`, `nav-dashboard`, `nav-agendamentos`, `nav-embarcacoes`, `nav-roteiros`,
`nav-catalogo`, `nav-clientes`, `nav-receitas`, `nova-embarcacao`, `btn-tutorial`.

### 28.5 Mecânica

- **Spotlight:** um `div` posicionado sobre o `getBoundingClientRect()` do alvo (padding 8px) com
  `box-shadow: 0 0 0 9999px rgba(11,36,71,.72)` — escurece todo o resto sem cobrir o alvo. Passo sem
  alvo usa overlay cheio (`bg-[#0B2447]/75`). Uma camada `inset-0` bloqueia interação com a página.
- **Medição:** `useLayoutEffect` + `requestAnimationFrame`, com listeners de `resize` e `scroll`
  (capture). O retângulo é guardado como `{ alvo, rect }` e só é usado se `alvo` for o do passo atual.
- **Posicionamento do card:** ao lado do alvo quando ele é estreito (`width < 50vw`, caso do menu),
  abaixo/acima quando é largo (conteúdo), sempre com clamp nas bordas do viewport.
- **Controles:** "Passo X de N" + barra de progresso, "Voltar", "Próximo"/"Concluir",
  "Pular tutorial", `X` de fechar; teclado `Esc`, `←`, `→`.
- **Persistência:** `localStorage['boatzy:tutorial-painel:v1'] = 'concluido'`. Abre sozinho (após
  600ms) apenas em `/painel` quando a chave não existe; qualquer forma de encerrar grava a chave.
  Acesso ao `localStorage` é protegido por `try/catch` (modo privado).

---

## 29. Módulo de Vendas de Embarcações (fundação de dados)

Migrations: `supabase/migrations/20260712_vendas.sql` (tabelas, RLS, favorito) e
`supabase/migrations/20260713_vendas_rpcs.sql` (RPCs). Plano completo do módulo:
`docs/planejamento-vendas.md`. **Status: Fases 1–5 implementadas** (dados §29.1–29.4 · painel
cadastro §29.5 · site busca §29.6 · site detalhe/interações §29.7 · funil no painel §29.8).
Resta a Fase 6 (testes manuais ponta a ponta em produção).

Cadeia de migrations validada de ponta a ponta em Postgres Supabase descartável (Docker,
`supabase/postgres:15.8.1.085`), incluindo smoke test de constraints, RPCs e RLS (anon, lead
autenticado e gestor).

### 29.1 Modelo de dados

#### Enums

```sql
anuncio_venda_status   ENUM ('ativo', 'pausado', 'vendido', 'cancelado')
anuncio_interacao_tipo ENUM ('visualizou', 'revelou_contato', 'favoritou', 'compartilhou', 'conversou')
```

#### Tabela `anuncio_venda`

```sql
id              uuid PK default gen_random_uuid()
embarcacao_id   uuid NOT NULL FK → embarcacao(id) ON DELETE CASCADE
owner_id        uuid NOT NULL FK → users(id) ON DELETE CASCADE  -- denormalizado p/ RLS e funil
fabricante      text NOT NULL
ano_modelo      integer NOT NULL CHECK (1900..2100)
ano_fabricacao  integer NOT NULL CHECK (1900..2100)
preco           numeric(12,2) NOT NULL CHECK (> 0)   -- preço vigente
descricao_venda text
status          anuncio_venda_status NOT NULL default 'ativo'
visualizacoes   bigint NOT NULL default 0            -- contador (anônimo + logado)
created_at / updated_at (trigger anuncio_venda_updated_at_trigger)
```

- **UNIQUE parcial** `(embarcacao_id) WHERE status IN ('ativo','pausado')` — um anúncio
  vigente por embarcação; `vendido` e `cancelado` encerram o ciclo e liberam novo anúncio
  (vendido = negócio concluído; cancelado = anúncio encerrado sem venda).
- Dados técnicos/fotos/categoria/localização vêm da `embarcacao` vinculada (fonte única, sem
  duplicação). Validações relacionais dos anos (modelo × fabricação) ficam na server action.
- **Sem DELETE** (nem policy): ciclo de vida é status, preservando histórico e leads.
- Índices: `owner_id`, `status`, `preco`, `ano_modelo`.
- **RLS:** `service_role_all`; público (anon+authenticated) SELECT só de anúncio `ativo` **com
  embarcação ativa** (regra §15-C); owner SELECT (qualquer status), INSERT (exige ser dono da
  embarcação) e UPDATE dos próprios.

#### Tabela `anuncio_venda_preco` (histórico, append-only)

```sql
id uuid PK · anuncio_id uuid NOT NULL FK → anuncio_venda ON DELETE CASCADE
preco numeric(12,2) NOT NULL CHECK (> 0) · created_at timestamptz
```

- Escrita na server action junto com INSERT/UPDATE do anúncio (sem trigger, decisão de escopo);
  o selo público "Preço reduzido" compara o vigente com o registro imediatamente anterior.
- Índice `(anuncio_id, created_at DESC)`. **RLS:** leitura pública apenas de anúncios
  publicamente visíveis (ou do próprio owner); INSERT só do owner; sem UPDATE/DELETE.

#### Tabela `anuncio_venda_interacao` (eventos do funil, append-only)

```sql
id uuid PK · anuncio_id FK → anuncio_venda · user_id FK → users
tipo anuncio_interacao_tipo NOT NULL · created_at timestamptz
UNIQUE (anuncio_id, user_id, tipo)   -- registro idempotente, 1 evento de cada tipo por lead
```

- Só usuário **logado** gera evento; visualização anônima conta apenas em
  `anuncio_venda.visualizacoes`. Desfavoritar não remove o evento (o funil mede interesse
  demonstrado). O **estágio do lead é derivado** dos eventos na RPC `vendas_funil` — nunca
  persistido.
- Índices: `(anuncio_id, tipo)` e `(user_id)`. **RLS:** INSERT do próprio `user_id` apenas em
  anúncio publicamente visível; SELECT do próprio usuário **ou** do dono do anúncio; sem
  UPDATE/DELETE.

#### `favorito` — novo alvo

Coluna `anuncio_venda_id uuid FK` (nullable); `favorito_um_alvo_check` recriada com
`num_nonnulls(roteiro_id, embarcacao_id, anuncio_venda_id) = 1`; UNIQUE parcial
`(user_id, anuncio_venda_id)` + índice parcial — mesmo padrão da `20260709_favoritos_embarcacao`.

### 29.2 RPCs (`20260713_vendas_rpcs.sql`)

- **`buscar_anuncios_venda(p_tipo_id, p_estado_id, p_municipio_id, p_ano_min, p_ano_max,
  p_preco_min, p_preco_max, p_limit=24, p_offset=0)`** → `(id, total)` — mesmo padrão de
  `buscar_roteiros` (ids + total; a página compõe detalhes via select/embed). Todos os filtros
  opcionais na RPC (a UI torna o tipo obrigatório); tipo/estado/município resolvidos
  via `embarcacao` → `municipios`; ano filtra `ano_modelo`; só anúncio ativo + embarcação ativa;
  ordena por `created_at DESC`. GRANT anon/authenticated/service_role.
- **`registrar_visualizacao_anuncio(p_anuncio)`** → void — incrementa `visualizacoes` (só anúncio
  publicamente visível). `SECURITY DEFINER` (anon/authenticated não têm UPDATE na tabela).
  GRANT anon/authenticated/service_role.
- **`vendas_locais()`** → `(estado_id, estado_nome, uf, municipio_id, municipio_nome, total)` —
  municípios (com estado) que possuem anúncio ativo, para os selects de localidade (só oferta o
  que existe, filosofia de `/api/buscar/locais`). O client agrupa por estado. GRANT
  anon/authenticated/service_role. Embarcação sem `municipio_id` não aparece aqui nem no filtro
  de localidade.
- **`vendas_funil(p_gestor DEFAULT auth.uid())`** → `(anuncio_id, embarcacao_nome, user_id,
  lead_nome, lead_avatar, eventos text[], estagio, ultima_interacao)` — um lead por par
  anúncio↔usuário; `estagio` = evento mais quente (1 visualizou · 2 revelou_contato ·
  3 favoritou · 4 compartilhou · 5 conversou; a "temperatura" mora só nesta função).
  `SECURITY DEFINER` (RLS de `users` impede o browser de ler nome/avatar de terceiros, mesmo
  motivo de `chat_conversas_nao_lidas`) com **guarda anti-spoof** `p_gestor = auth.uid() OR
  auth.uid() IS NULL` — endurecimento sobre o padrão das RPCs de chat: gestor autenticado não
  consulta funil alheio; service role (auth.uid() nulo) passa qualquer `p_gestor`. GRANT apenas
  authenticated/service_role.

### 29.3 Tipos TypeScript

`src/types/supabase.ts`: tipos `AnuncioVendaStatus` e `AnuncioInteracaoTipo`; tabelas
`anuncio_venda`, `anuncio_venda_preco`, `anuncio_venda_interacao` (Row/Insert/Update +
Relationships); `favorito` com `anuncio_venda_id`; as 4 RPCs em `Functions`; enums registrados
em `Enums`.

### 29.4 Convenção de nomes de migration

A migration de RPCs foi nomeada `20260713_…` (e não `20260712b_…`) porque o sufixo alfabético
gera **ordem ambígua** conforme o locale do sort (`_` × letras) — detectado ao validar a cadeia
completa em container. Ao criar migrations no mesmo dia, preferir avançar a data/prefixo
numérico a sufixar letras.

### 29.4-B Correção — busca por TIPO, não categoria (13/07/2026)

Migration `20260714_vendas_busca_por_tipo.sql`. A busca de Vendas é de **embarcação**, então o
filtro primário obrigatório é o **tipo** (`embarcacao_tipo`: Lancha, Iate, Jet Ski…), não a
**categoria** (`embarcacao_categoria`: Passeio, Pesca, Luxo…), que é orientada a passeio e fazia a
busca "parecer venda de passeio". A migration faz **DROP + CREATE** de `buscar_anuncios_venda`
(o Postgres não permite renomear parâmetro de entrada com `CREATE OR REPLACE`), trocando
`p_categoria_id`/`embarcacao_categoria_id` por `p_tipo_id`/`embarcacao_tipo_id`. Validada em
Postgres descartável (filtro por tipo, sem filtro, tipo+preço, `vendas_locais`).

Ajustes de código correspondentes (todos os "locais necessários"):
- **Picker:** `CategoriaVendaPicker` → `TipoVendaPicker` (rótulo "Tipo", ícone `Ship`).
- **Filtros:** `getFiltrosVenda()` retorna `{ tipos, locais }` (embed `embarcacao_tipo`);
  `build-url` usa o param `tipo` (era `categoria`).
- **Busca/UI:** `HeroSection` (prop `tiposVenda`), `VendasSearchBar` (prop `tipos`), página
  `/vendas` (param `tipo`, chip "Tipo: …", título, card badge de tipo), `AnuncioVendaCard.tipo`,
  `/favoritos` (embed `embarcacao_tipo`).
- **Cadastro:** `AnuncioForm`/`actions`/`novo`/`editar` exigem **tipo** quando a embarcação não
  tem (grava `embarcacao_tipo_id`); selects carregam `embarcacao_tipo`.
- **Detalhe `/vendas/[id]`:** removido o badge de categoria (mostra só o tipo), para consistência.
  A **categoria da embarcação permanece intacta** no banco e nos contextos de aluguel
  (roteiros/embarcações) — a mudança é escopada ao módulo de Vendas.

### 29.5 Painel do gestor — módulo Vendas (`/painel/vendas`) — Fase 2

Estrutura em `src/app/painel/(gestao)/vendas/` (protegida pelo layout `(gestao)`):

| Arquivo | Papel |
| --- | --- |
| `page.tsx` | Grid: anúncios do gestor (embed `embarcacao` + imagens) + leads por anúncio via RPC `vendas_funil` (`supabaseAdmin`, `p_gestor` explícito — service role passa a guarda) |
| `_components/VendasGrid.tsx` | `'use client'` — busca (nome/fabricante), ordenação por coluna, paginação (10/pág, padrão dos grids); toggle Ativo/Pausado; modal de confirmação para encerramento (vendido/cancelado) |
| `_components/AnuncioForm.tsx` | Form compartilhado novo/editar (`modo`), card-resumo da embarcação, categoria condicional, histórico de preço na edição |
| `_components/embarcacao-option.ts` | `EmbarcacaoRow`/`toOption`/`EMBARCACAO_OPTION_SELECT` — shape do select de embarcação |
| `novo/page.tsx` | Elegíveis = embarcações **ativas** do gestor **sem anúncio vigente** (`status IN (ativo,pausado)`); estado vazio com CTAs |
| `[id]/editar/page.tsx` | Posse via `owner_id`; anúncio encerrado redireciona ao grid; carrega histórico (`anuncio_venda_preco` desc) |
| `actions.ts` | Server actions (abaixo) |

**Server actions** (`actions.ts`, padrão `checkRoleInDb(['gestor','admin'])` + posse via `supabaseAdmin`):

- `criarAnuncio(payload)` — valida campos (fabricante, anos 1900..ano+1, preço > 0); exige
  embarcação própria **e ativa**; sem categoria → exige `categoriaId` e grava na embarcação;
  INSERT do anúncio + primeiro registro em `anuncio_venda_preco`; `23505` (UNIQUE parcial) vira
  erro amigável "já possui anúncio vigente".
- `atualizarAnuncio(anuncioId, payload)` — embarcação vinculada não muda; anúncio encerrado não
  edita; se o preço mudou, INSERT no histórico (é o que alimenta o selo "Preço reduzido").
- `alterarStatusAnuncio(anuncioId, novoStatus)` — ativo ↔ pausado (toggle direto no grid);
  vendido/cancelado são terminais (modal de confirmação na UI; não há reabertura nem DELETE).

**Sidebar/Tutorial:** item `VENDAS` (ícone `Tag`, `data-tour="nav-vendas"`) entre ROTEIROS e
CATÁLOGO; novo passo no tutorial guiado (§28 — a sequência passou de 12 para **13 passos**, com
o passo Vendas entre Roteiros e Catálogo; marcador `nav-vendas` adicionado à lista do §28.4).

Validação da fase: `tsc`, ESLint e `next build` (rotas `/painel/vendas`, `/novo`,
`/[id]/editar`). Validações relacionais entre anos (modelo × fabricação) ficaram para o
refinamento — o form/action valida apenas faixas.

### 29.6 Site — busca e resultados de Vendas (`/vendas`) — Fase 3

**Aba no toggle:** `SearchTypeToggle` ganhou `'venda'` (`SearchType = 'roteiro' | 'embarcacao' |
'venda'`, ícone `Tag`) — Hero e barras compactas.

**Pickers de venda** — `src/components/home/search/venda/` (mesmo padrão visual do
`TipoEmbarcacaoPicker`, opções carregadas no servidor):

| Componente | Valor | Observações |
| --- | --- | --- |
| `TipoVendaPicker` | `{ id, nome } \| null` | **Obrigatório** — buscar sem tipo abre o seletor em vez de navegar. Usa `embarcacao_tipo` (Lancha, Iate, Jet Ski…), **não** `embarcacao_categoria` (Passeio/Pesca/Luxo, orientada a passeio) — a venda é de embarcação |
| `LocalidadeVendaPicker` | `{ estadoId, estadoNome, uf, municipioId?, municipioNome? } \| null` | Dropdown em 2 etapas (estados → cidades do estado, com "Todo o estado" e contagens); cidade opcional |
| `AnoVendaPicker` | `{ min, max }` (strings) | Faixa de/até com rascunho local + "Aplicar"; normaliza faixa invertida |
| `ValorVendaPicker` | `{ min, max }` (strings) | Idem faixa/normalização |
| `labels.ts` | — | Helpers **puros** `anoVendaLabel()`/`valorVendaLabel()`/`valorCompacto()` ("R$ 450 mil", "R$ 1,2 mi") em módulo **neutro** (sem `'use client'`) — a página `/vendas` (Server Component) os chama no servidor; os pickers importam e re-exportam. Definir esses helpers no arquivo `'use client'` quebra em runtime ("Attempted to call … from the server but … is on the client"). |
| `build-url.ts` | — | `buildVendaSearchUrl(state)` → `/vendas?categoria=&estado=&cidade=&ano_min=&ano_max=&preco_min=&preco_max=` (compartilhado Hero/barra) |

**Fonte das opções** — `src/lib/vendas-filtros.ts` (`server-only`): `getFiltrosVenda()` retorna
`{ tipos, locais }` — tipos com anúncio **ativo** (embed `anuncio_venda → embarcacao →
embarcacao_tipo`, dedupe) e locais via RPC `vendas_locais`. **Decisão:** não foi criada a
rota `/api/vendas/locais` prevista no plano — as opções são passadas por props do Server
Component, como o `TipoEmbarcacaoPicker` já faz (não há autocomplete/fetch dinâmico que
justifique API).

**Integração:**
- `HeroSection` (novas props `categoriasVenda`/`locaisVenda`, injetadas por `src/app/page.tsx` via
  `getFiltrosVenda()`): na aba Vendas a barra troca os pickers (local/data/pessoas → categoria/
  localidade/ano/valor) e o submit navega para `/vendas`.
- `SearchBarCompact` (`/buscar`): selecionar a aba Vendas navega para `/vendas` (filtros de
  roteiro são descartados — domínios diferentes). No sentido inverso, `VendasSearchBar` navega
  para `/buscar` / `/buscar?tipo=embarcacao`.

**Página `/vendas`** (`src/app/vendas/page.tsx`, Server Component — mesmo esqueleto de `/buscar`):
- Query params: `categoria, estado, cidade, ano_min, ano_max, preco_min, preco_max, pagina`.
  Rótulos de chips/título resolvidos em memória a partir de `getFiltrosVenda()` (sem query extra).
- RPC `buscar_anuncios_venda` (ids + total, 24/página) → detalhes via select/embed preservando a
  ordem; **preço anterior** resolvido em lote: `anuncio_venda_preco` dos ids da página ordenado
  desc, tomando o 2º registro de cada anúncio.
- UI: barra compacta sticky (`VendasSearchBar`), chips removíveis por filtro, título contextual
  ("<Categoria> à venda em <Cidade, UF>"), grid 1→2→3→4, paginação server-side, estado vazio com
  "Limpar filtros".
- `_components/AnuncioVendaCard.tsx`: imagem principal, selo **"Preço reduzido ↓"** (só quando
  vigente < anterior; aumento nunca aparece), badge de categoria, nome, fabricante · ano
  modelo/fabricação, localidade, capacidade, comprimento, preço em destaque + anterior riscado.
  Link → `/vendas/[id]` (detalhe é a Fase 4; até lá o link resulta em 404). O coração de
  favoritar entra na Fase 4 junto com os eventos de lead.

### 29.7 Site — detalhe do anúncio (`/vendas/[id]`) — Fase 4

**Página** (`src/app/vendas/[id]/page.tsx`, Server Component):
- Carrega o anúncio com `status = 'ativo'` + embarcação embed; embarcação fora de `'ativo'` →
  `notFound()` (pausado/vendido/cancelado idem).
- **Contador:** chama `registrar_visualizacao_anuncio` a cada abertura (anônimo e logado).
- **Gate de login:** deslogado recebe o *teaser* — galeria (`GaleriaRoteiro` reutilizada), badges
  (selo de redução/categoria/tipo), nome, localidade e preço + CTA
  `/entrar?redirect_to=/vendas/[id]`. Nenhum dado sensível (vendedor, ficha completa) é enviado.
- **Logado:** registra `visualizou` (INSERT idempotente; `23505` ignorado; **dono não registra**),
  e renderiza ficha técnica (fabricante/anos do anúncio + specs da embarcação), "Sobre esta
  venda" (`descricao_venda`), descrição/comodidades da embarcação, mapa (`LocalizacaoMap`; só
  bairro/cidade no texto — logradouro não é exposto na venda), avaliações (`AvaliacoesSection`
  por `embarcacao_id`) e a sidebar.
- **Selo de redução:** últimos 2 registros de `anuncio_venda_preco`; reduzido = vigente <
  anterior; a data exibida é a do registro vigente.

**Sidebar** (`_components/VendaSidebar.tsx`, `'use client'`):
- Preço (com "De X por Y · reduzido em DD/MM"), card do vendedor com **nome mascarado no
  servidor** (`mascararNome`: "R***** G*****") — o nome completo/e-mail nunca vão pré-renderizados.
- **Revelar contato** → `revelarContatoVendedor` (abaixo); **Conversar com o vendedor** →
  `/vendas/[id]/chat`; **Favoritar/Compartilhar** no padrão §23.3 (ícones de marca inline).
- `ehDono`: dono vê "Este é o seu anúncio" + atalho ao painel; sem revelar/chat/favorito.

**Server actions** (`src/lib/vendas-actions.ts`):
- Helper `registrarInteracao` — INSERT idempotente em `anuncio_venda_interacao`; **ignora o
  dono** (gestor não é lead de si mesmo). Usada por todas as actions.
- `revelarContatoVendedor(anuncioId)` → valida sessão + anúncio visível; registra
  `revelou_contato`; retorna `{ nome, email, avatar_url }`. (Telefone: questão em aberto §9 do
  plano — `users` não tem o campo.)
- `registrarCompartilhamentoAnuncio(anuncioId)` → registra `compartilhou` (deslogado não pontua;
  o share em si roda no client).
- `alternarFavoritoAnuncio(anuncioId)` (**`favoritos-actions.ts`**) — mesma semântica das demais;
  ao favoritar registra `favoritou` (desfavoritar não remove o evento).

**Chat** (`/vendas/[id]/chat/page.tsx` — espelho de `/minhas-reservas/[id]/chat`):
- Gate de auth; anúncio visível; **dono → redirect ao anúncio** (a CHECK de `conversa` bloqueia
  self-chat); upsert da conversa gestor↔cliente (única por par, §21 — sem alteração no modelo);
  registra `conversou`; zera não lidas; `ChatBox` com `voltarHref` ao anúncio.
- `ChatBox` ganhou a prop opcional **`rascunhoInicial`** — em conversa vazia, o campo vem
  pré-preenchido: `Olá! Tenho interesse na "<nome>" anunciada por R$ X. Podemos conversar?`.
- O comprador reencontra a conversa pelo próprio anúncio; a página "Minhas conversas" segue como
  questão em aberto (§9 do plano).

**Card e favoritos:**
- `AnuncioVendaCard` ganhou o coração (toggle otimista; deslogado → `/entrar` com `fav_anuncio=<id>`
  no retorno e **auto-favorito pós-login**, padrão §23.5); `/vendas` resolve o `Set` de favoritos
  do usuário em lote.
- `/favoritos` ganhou a seção **"À venda"** (`AnuncioVendaCard` + `RemoverFavoritoButton` com novo
  prop `anuncioVendaId`); anúncios pausados/encerrados ou de embarcação inativa não aparecem;
  cabeçalhos de seção exibidos quando há mais de um tipo.

### 29.8 Painel — funil de vendas (`/painel/vendas/funil`) — Fase 5

**Página** (`funil/page.tsx`, Server Component, protegida pelo layout `(gestao)`):
- Carrega os anúncios do gestor (id, status, `visualizacoes`, preço, nome da embarcação) e os
  leads via RPC `vendas_funil` (`supabaseAdmin` com `p_gestor` explícito — service role passa a
  guarda anti-spoof). Aceita `?anuncio=<id>` como filtro inicial (é o link da ação "Funil" do
  grid).

**Board** (`funil/_components/FunilBoard.tsx`, `'use client'`):
- **Filtro por anúncio** (select; "Todos os anúncios" default) — todo o board e as métricas
  reagem em memória (dados já carregados; sem nova query).
- **Métricas:** Visualizações (soma do contador dos anúncios filtrados), Leads no funil,
  Em negociação (estágio 5) e conversão Visualização→conversa (%).
- **Kanban 5 colunas** (accent color por coluna): 1 Visitante (slate) · 2 Interessado (sky) ·
  3 Engajado (amber) · 4 Promotor (violet) · 5 Em negociação (emerald). O lead entra na coluna
  do `estagio` (evento mais quente, derivado na RPC — sem drag-and-drop nesta versão).
- **Card do lead:** avatar (ou inicial), nome, tempo relativo da última interação, nome do
  anúncio (no modo "Todos"), badges com ícone por evento (tooltip) e atalho de **chat** →
  `/painel/clientes/[user_id]/chat` (o lead é um cliente; a conversa é a mesma do §21).
- Estado vazio orientando como os leads surgem. Colunas com placeholder tracejado quando vazias.

**Entradas:**
- Grid `/painel/vendas`: ação **Funil** (ícone `Filter`) por linha — vigentes e **encerrados**
  (leads são preservados; anúncio encerrado tem só essa ação) — e botão "Funil de vendas" no
  header da página.
- Dashboard `/painel`: 5º card **"Anúncios de venda"** (nº ativos + "N leads no funil", dot verde
  quando há leads) → `/painel/vendas/funil`; grid de stats passou de `xl:grid-cols-4` para
  `xl:grid-cols-5`; consultas do dashboard ganharam `anuncio_venda` + `vendas_funil` no
  `Promise.all`.

**Refinamentos futuros (fora desta versão):** realtime no board (padrão do sino §21.4b),
drag-and-drop/movimentação manual de estágio, notificação de novos leads no sino.

### 29.9 "Minhas conversas" — hub de chat do cliente (correção pós-Fase 4)

Migration `20260715_chat_conversas_cliente.sql`. **Problema:** a conversa gestor↔cliente é única
por par (§21); o comprador que conversava sobre uma **venda sem ter reserva** não tinha por onde
reabrir a conversa — o único acesso do cliente ao chat era `/minhas-reservas/[id]/chat` (indexado
por reserva). O badge de não lidas aparecia, mas sem destino para a conversa de venda.

**RPC** `chat_conversas_cliente(p_cliente DEFAULT auth.uid())` → `(conversa_id, gestor_id,
gestor_nome, gestor_avatar, ultima_mensagem, ultima_em, nao_lidas)` — espelho do lado cliente de
`chat_conversas_nao_lidas` (§21.4b), mas lista **todas** as conversas do cliente **com pelo menos
uma mensagem** (não só as com não lidas). `security definer` (RLS de `users` esconde nome/avatar
do gestor) + guarda `p_cliente = auth.uid() OR auth.uid() IS NULL`.

**Páginas:**
- `/minhas-conversas` (`page.tsx`, Server Component): lista via RPC (`supabaseAdmin`,
  `p_cliente` explícito) com avatar/nome do gestor, preview da última mensagem, tempo relativo e
  badge de não lidas; item → `/minhas-conversas/[conversa_id]/chat`. Estado vazio com CTA.
- `/minhas-conversas/[id]/chat` (`[id]/chat/page.tsx`): chat indexado pela **própria conversa**
  (não por reserva/anúncio) — cobre qualquer conversa gestor↔cliente, inclusive venda. Autoriza
  por `conversa.cliente_id = user.id`, zera não lidas, `ChatBox` com `voltarHref="/minhas-conversas"`.

**Menu:** novo item **"Minhas conversas"** (ícone `MessageCircle`) no `UserMenu` (dropdown) e no
menu mobile do `Header`, acima de "Minhas reservas". O **badge de não lidas do cliente
(`chat_total_nao_lidas_cliente`, ao vivo) migrou para este item** — é agora o hub canônico de
chat; "Minhas reservas" deixou de exibir o badge (evita duplicidade). O acesso contextual por
reserva (`/minhas-reservas/[id]/chat`) e por anúncio (`/vendas/[id]/chat`) permanece.

> Resolve a questão em aberto §9 do plano ("onde o cliente reencontra a conversa de venda").
