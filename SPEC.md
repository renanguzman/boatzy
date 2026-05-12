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
- Auth: Clerk
- Storage: Supabase Storage
- Payments: Stripe Connect

---

### 2.2 Arquitetura Geral

Client (React / Next.js)
        ↓
Next.js API (Server)
        ↓
Supabase (DB + Storage)
        ↓
Stripe (Payments)
        ↓
Clerk (Auth)

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
- Comissão padrão: 20%  
- Sem conflito de datas  

---

## 6. Integração com Stripe

Split automático:

- Owner: 80%  
- Boatzy: 20%  

---

## 7. Upload de Imagens

- Supabase Storage  
- URL pública salva no banco  

---

## 8. Segurança

- Auth via Clerk com localização pt-BR (`@clerk/localizations` → `ptBR` passado ao `ClerkProvider` em `src/app/layout.tsx`). Cobre `<SignIn>`, `<SignUp>`, `<UserButton>`, `<SignInButton mode="modal">` e modais internos.
- Fluxos custom (form em `/painel/login`, server action `createUser`) usam `src/lib/clerk-errors.ts` (`translateClerkError`) para mapear `ClerkAPIError.code` em mensagens pt-BR (códigos: `form_identifier_not_found`, `form_password_incorrect`, `form_identifier_exists`, `too_many_attempts`, `captcha_invalid`, etc.). Quando o `code` é desconhecido, cai no `longMessage`/`message` original.

- Middleware para rotas privadas (`src/proxy.ts` usando `clerkMiddleware`) — apenas garante autenticação em `/painel/**`; o gating por role acontece no layout do painel.
- Rotas `/painel/**` protegidas: exigem autenticação. O acesso ao conteúdo do painel exige `publicMetadata.roles` contendo `'gestor'` ou `'admin'` (checado em `src/app/painel/(gestao)/layout.tsx`). Usuários autenticados sem a role veem uma tela com botão "Tornar-me gestor" que chama `/api/painel/setup-role`.
- Rotas públicas do painel: `/painel/login`, `/painel/cadastro`, `/painel/auth/*`, `/api/painel/setup-role`
- Validação de inputs  

---

## 9. Fluxos

Reserva:  
User → Busca → Seleciona → Paga → Confirma  

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
id          uuid primary key default gen_random_uuid()
id_clerk    text not null unique          -- ID do usuário no Clerk
name        text not null
email       text not null unique
cpf_cnpj    text
birthday    date
role        user_role ('admin','gestor','cliente') default 'cliente'
created_at  timestamptz default now()
```

Migration: `supabase/migrations/001_create_users_table.sql`

Clientes Supabase:
- `supabase` (anon key) — client-side / RLS ativo
- `supabaseAdmin` (service role) — server-only, sem RLS

---

## 12. Painel do Gestor (`/painel`)

Módulo independente do hotsite, acessível apenas por usuários cuja lista de roles inclua `'gestor'` ou `'admin'`.

### Estrutura de rotas

| Rota | Descrição | Auth |
|------|-----------|------|
| `/painel/login` | Login de gestores | Pública |
| `/painel/cadastro` | Cadastro de gestores | Pública |
| `/painel` | Dashboard | gestor/admin |
| `/painel/agendamentos` | Listagem de reservas | gestor/admin |
| `/painel/embarcacoes` | CRUD de embarcações | gestor/admin |
| `/painel/usuarios` | Cadastro e listagem de usuários | gestor/admin |

### Modelo multi-role

Um usuário pode ter mais de uma role com o mesmo e-mail (ex.: `['cliente', 'gestor']`). A fonte da verdade é a tabela Supabase `user_roles` (chave única `(user_id, role)`); o Clerk armazena um espelho em `publicMetadata.roles` (array) para que o middleware e Server Components leiam do JWT sem hit no banco.

Helpers em `src/lib/roles.ts`:
- `getRolesFromDb(clerkUserId)` — lê roles do Supabase.
- `syncRolesToClerk(clerkUserId)` — espelha roles do Supabase no `publicMetadata.roles` do Clerk.
- `addRole(dbUserId, role)` — upsert idempotente em `user_roles`.
- `hasRole(sessionClaims, role)` — leitura tipada do JWT.

### Endpoints de atribuição

Ambos são **aditivos** (não substituem roles existentes):

- `GET /api/painel/setup-role`
  1. Upsert do usuário em `users` (por e-mail; atualiza `id_clerk` se mudou).
  2. `addRole(dbUserId, 'gestor')`.
  3. `syncRolesToClerk(userId)` para atualizar `publicMetadata.roles`.
  4. Redireciona para `/painel/auth/atualizando` (força `session.reload()` no Clerk antes de entrar no painel).

- `GET /api/auth/setup-cliente?redirect_to=/...`
  1. Mesmo fluxo de upsert em `users`.
  2. `addRole(dbUserId, 'cliente')`.
  3. `syncRolesToClerk(userId)`.
  4. Redireciona para `redirect_to` (caminho relativo apenas, para evitar open redirect).

### Verificação de acesso

Middleware (`src/proxy.ts`): apenas garante `userId` em rotas `/painel/**` não públicas.

Layout do painel (`src/app/painel/(gestao)/layout.tsx`):
```ts
const roles = (user?.publicMetadata?.roles ?? []) as UserRole[];
const canAccess = roles.includes('gestor') || roles.includes('admin');
```

Usuário autenticado sem `gestor`/`admin` vê tela "Acesso Restrito" com botão **Tornar-me gestor** → chama `/api/painel/setup-role`, que adiciona a role sem perder o `'cliente'` existente.

### JWT staleness

Após mudar `publicMetadata`, o JWT em circulação ainda reflete o estado anterior. O fluxo de upgrade passa por `/painel/auth/atualizando`, que chama `session.reload()` no client e então navega para `/painel`.

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
tripulacao              integer
embarcacao_tipo_id      uuid FK → embarcacao_tipo(id)
embarcacao_categoria_id uuid FK → embarcacao_categoria(id)
municipio_id            integer FK → municipios(id)
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

---

## 14. Futuro

- Chat  
- Notificações  
- App mobile  
- Antifraude  
