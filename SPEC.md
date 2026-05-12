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

- Auth via Clerk  
- Middleware para rotas privadas (`src/middleware.ts` usando `clerkMiddleware`)
- Rotas `/painel/**` protegidas: exigem autenticação + `publicMetadata.role === 'gestor'`
- Rotas públicas do painel: `/painel/login`, `/painel/cadastro`, `/api/painel/setup-role`
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

Módulo independente do hotsite, acessível apenas por usuários com `role: gestor`.

### Estrutura de rotas

| Rota | Descrição | Auth |
|------|-----------|------|
| `/painel/login` | Login de gestores | Pública |
| `/painel/cadastro` | Cadastro de gestores | Pública |
| `/painel` | Dashboard | gestor |
| `/painel/agendamentos` | Listagem de reservas | gestor |
| `/painel/embarcacoes` | CRUD de embarcações | gestor |
| `/painel/usuarios` | Cadastro e listagem de usuários | gestor |

### Atribuição de role

Após sign-up via `/painel/cadastro`, o Clerk redireciona para `GET /api/painel/setup-role`, que:
1. Autentica o usuário
2. Chama `clerkClient().users.updateUserMetadata(userId, { publicMetadata: { role: 'gestor' } })`
3. Redireciona para `/painel`

### Verificação no middleware

```ts
const role = sessionClaims?.metadata?.role;
if (role !== 'gestor') redirect('/painel/login');
```

---

## 12. Futuro

- Chat  
- Notificações  
- App mobile  
- Antifraude  
