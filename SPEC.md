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
| `/painel` | Dashboard | gestor/admin |
| `/painel/agendamentos` | Listagem de reservas | gestor/admin |
| `/painel/embarcacoes` | CRUD de embarcações | gestor/admin |
| `/painel/usuarios` | Cadastro e listagem de usuários | gestor/admin |

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
- **Supabase** → **Redirect URLs** (allow list): `https://www.boatzy.app/auth/callback` e `https://www.boatzy.app/painel/auth/callback`

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
- Clicar em um dia aplica a seleção imediatamente (`onChange` no clique), preenchendo o campo; o botão "Confirmar" apenas fecha o dropdown.

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

**Filtros aplicados (via RPC `buscar_roteiros` — migration 018):**

Mesma mecânica de `buscar_embarcacoes` (ver §18.6), com **uma diferença no filtro de pessoas**: a capacidade considerada é a da **embarcação vinculada** ao roteiro (`roteiro.embarcacao_id → embarcacao.capacidade >= pessoas`), **não** o campo `roteiro.quantidade_pessoas` (este segue apenas para exibição no card). Roteiros **sem** embarcação vinculada (ou cuja embarcação não tem `capacidade`) **não aparecem** quando o filtro de pessoas está ativo.

- **Localização:** município exato OU ≤ 50 km do centro (haversine), usando `roteiro.latitude/longitude`.
- **Data:** disponibilidade via `roteiro.disponibilidade_dias_semana` + `roteiro_disponibilidade_bloqueio`; com `flex`, basta um dia livre na janela.
- **Ordenação:** por distância quando há centro; senão `created_at` desc. A página chama a RPC (ids + total) e busca os detalhes com `.in('id', ids)` preservando a ordem.
- `GRANT EXECUTE` para `anon, authenticated, service_role`.

**Componentes:**
- `src/app/buscar/_components/SearchBarCompact.tsx` — barra compacta (`'use client'`), reutiliza pickers com `compact` prop, navega via `router.push()`. Aceita prop `tipo?: 'roteiro' | 'embarcacao'` (padrão `'roteiro'`) e renderiza o `SearchTypeToggle`; alternar a aba preserva os filtros e navega para `/buscar` ou `/embarcacoes`.
- `src/app/buscar/_components/RoteiroCard.tsx` — card de roteiro (`'use client'`), imagem, localidade, specs, preço.

#### `SearchTypeToggle` (`src/components/home/search/SearchTypeToggle.tsx`)

```ts
type SearchType = 'roteiro' | 'embarcacao';
type Props = { value: SearchType; onChange: (v: SearchType) => void; variant?: 'dark' | 'light' };
```

Segmented control (Roteiros / Embarcações) usado na Hero Section (`variant="dark"`) e no `SearchBarCompact` (`variant="light"`). A Hero monta o destino em `handleSearch` (`/buscar` ou `/embarcacoes`).

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

### 18.6 Busca de Embarcações `/embarcacoes`

**Arquivo:** `src/app/embarcacoes/page.tsx` (Server Component) — espelha `/buscar`.

Query params idênticos a `/buscar` (`municipio`, `local`, `lat`, `lng`, `data`, `flex`, `pessoas`, `pagina`).

**Filtros aplicados (via RPC `buscar_embarcacoes` — migration 017):**

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

Seções: badges (tipo/categoria), título + localidade, descrição, grid de specs (capacidade, comprimento, cabines, suítes, banheiros, tripulação), comodidades, mapa + endereço, placeholder de avaliações, sidebar com preço/dia + CTA "Solicitar reserva" (link para `/entrar?redirect_to=/embarcacoes/[id]`).

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

- Chat  
- Notificações  
- App mobile  
- Antifraude
- Página `/reservas/novo` (fluxo de reserva do cliente)
- Filtros adicionais na busca (tipo de embarcação, faixa de preço)
- Visualização em mapa no `/buscar`
- Avaliações reais em `/roteiros/[id]`
