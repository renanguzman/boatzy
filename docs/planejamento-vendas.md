# Planejamento — Módulo de Vendas de Embarcações

> **Status:** em implementação — criado em 12/07/2026.
> ✅ **Fase 1 (fundação de dados) implementada em 12/07/2026** — migrations
> `20260712_vendas.sql` + `20260713_vendas_rpcs.sql`, tipos TS e validação em Postgres
> local (smoke test de constraints, RPCs e RLS). Detalhes técnicos: SPEC §29.
> ⚠️ A migration de RPCs foi renomeada de `20260712b_…` para `20260713_…` (sufixo
> alfabético gera ordem ambígua de aplicação conforme o locale — ver SPEC §29.4).
> Migrations aplicadas em produção em 12/07/2026.
> ✅ **Fase 2 (painel — cadastro de anúncios) implementada em 12/07/2026** — menu
> VENDAS, grid com visualizações/leads/status, novo/editar com aproveitamento da
> embarcação e histórico de preço. Detalhes: SPEC §29.5.
> ✅ **Fase 3 (site — busca e resultados) implementada em 12/07/2026** — aba Vendas
> no toggle, 4 pickers próprios, página `/vendas` com chips/cards/paginação e selo
> de preço reduzido. Decisão: sem rota `/api/vendas/locais` — opções via
> `getFiltrosVenda()` server-side (SPEC §29.6).
> ✅ **Fase 4 (site — detalhe e interações) implementada em 12/07/2026** — detalhe
> `/vendas/[id]` com gate de login/teaser, contador, revelar contato (nome
> mascarado), favoritar (card + detalhe + /favoritos), compartilhar e chat
> `/vendas/[id]/chat` com mensagem pré-preenchida; todos os 5 eventos do funil
> registrados (dono não gera evento). Detalhes: SPEC §29.7.
> ✅ **Fase 5 (painel — funil de vendas) implementada em 12/07/2026** — Kanban 5
> colunas em `/painel/vendas/funil` com filtro por anúncio, métricas (visualizações,
> leads, negociação, conversão), atalho de chat por lead; entradas pelo grid (ação
> Funil, inclusive em encerrados), header e card no dashboard. SPEC §29.8.
> 🔧 **Correção (13/07/2026):** o filtro primário da busca era **categoria**
> (`embarcacao_categoria`: Passeio/Pesca/Luxo — orientada a passeio) e passou a ser o
> **tipo** (`embarcacao_tipo`: Lancha/Iate/Jet Ski…), correto para venda de embarcação.
> Migration `20260714_vendas_busca_por_tipo.sql` (DROP+CREATE de `buscar_anuncios_venda`,
> `p_tipo_id`) + ajuste em busca, cadastro, cards e detalhe. **Aplicar essa migration em
> produção antes de usar a busca.** SPEC §29.4-B.
> 🔚 **Falta apenas a Fase 6 (encerramento):** testes manuais ponta a ponta em
> produção — deslogado→login→lead, redução de preço/selo, pausar/vender/cancelar,
> revelar contato, chat e funil refletindo os eventos. Nenhuma pendência de código;
> questões em aberto do §9 (telefone do vendedor, "Minhas conversas", home etc.)
> seguem como refinamentos futuros.

---

## 1. Visão Geral

Novo vertical do marketplace: além de **alugar** (roteiros/embarcações), o gestor poderá
**anunciar embarcações para venda**. O site ganha a busca por **Vendas**, páginas de
resultado e de detalhes próprias, e o painel do gestor ganha o cadastro de anúncios e um
**funil de vendas (CRM de leads)** alimentado pelas interações dos usuários no anúncio.

**Papéis:**
- **Gestor (vendedor):** cria anúncios a partir de embarcações já cadastradas, acompanha
  leads no funil, conversa com interessados.
- **Cliente (comprador/lead):** busca, visualiza detalhes (logado), revela contato do
  vendedor, favorita, compartilha e conversa — cada ação o esquenta no funil.
- **Admin:** (fase posterior) moderação/gestão global de anúncios.

---

## 2. Escopo desta primeira versão

**Dentro:**
1. Cadastro de anúncio no painel aproveitando embarcação existente + campos de venda
   (fabricante, ano do modelo, ano de fabricação, valor).
2. Histórico de preço com selo público de **redução de preço** (aumento não é exibido).
3. Busca no site com 3ª aba **Vendas** (Categoria obrigatória; Estado → Cidade, Ano e
   faixa de valor opcionais).
4. Página de resultados própria (`/vendas`) com filtros laterais/chips.
5. Página de detalhes própria (`/vendas/[id]`), **exigindo login**, sem carrinho/reserva.
6. Contador de visualizações do anúncio.
7. Dados do vendedor ocultos com botão **"Revelar contato"**.
8. Favoritar e compartilhar anúncio.
9. Chat comprador ↔ vendedor reutilizando a infraestrutura existente (§21 do SPEC).
10. **Funil de vendas** no painel do gestor com leads por estágio.

**Fora (fases futuras — ver §10):**
- Anunciar embarcação que **não** está cadastrada na plataforma (venda avulsa).
- Módulo de Vendas na área administrativa (moderação de anúncios).
- Propostas de compra formais, negociação de valor e pagamento pela plataforma.
- Notificações por e-mail/push de novos leads.
- Destaques/impulsionamento pago de anúncios.

---

## 3. Modelo de Dados (Supabase / PostgreSQL)

Migration proposta: `20260712_vendas.sql` (+ `20260712b_buscar_anuncios_venda.sql` para RPCs).

### 3.1 `anuncio_venda`

Um anúncio por embarcação (ativo). Snapshot próprio dos campos de venda; dados técnicos
(capacidade, comprimento, cabines, comodidades, fotos, localização) continuam vindo da
`embarcacao` vinculada — fonte única, sem duplicação.

```sql
id                 uuid PK default gen_random_uuid()
embarcacao_id      uuid NOT NULL FK → embarcacao(id) ON DELETE CASCADE
owner_id           uuid NOT NULL FK → users(id)          -- denormalizado p/ RLS e funil
fabricante         text NOT NULL
ano_modelo         integer NOT NULL CHECK (1900..ano corrente + 1)
ano_fabricacao     integer NOT NULL CHECK (1900..ano corrente + 1)
preco              numeric(12,2) NOT NULL CHECK (preco > 0)   -- preço vigente
descricao_venda    text                                   -- detalhes específicos da venda
status             anuncio_venda_status NOT NULL default 'ativo'
                   -- 'ativo' | 'pausado' | 'vendido' | 'cancelado'
visualizacoes      bigint NOT NULL default 0              -- contador de cliques/aberturas
created_at         timestamptz default now()
updated_at         timestamptz default now()
UNIQUE (embarcacao_id) WHERE status IN ('ativo','pausado') -- 1 anúncio vigente por barco
```

**RLS:** `service_role_all`; owner: SELECT/INSERT/UPDATE dos próprios; público: SELECT
apenas de `status = 'ativo'` **com embarcação ativa** (mesma regra da busca atual — barco
desativado some do site).

**Regras:**
- Embarcação desativada → anúncio some da busca e o detalhe retorna 404 (coerente com §15-C).
- `status = 'pausado'`: gestor tira do ar sem perder histórico/leads; `vendido` (negócio
  concluído) e `cancelado` (encerrado sem venda) encerram o ciclo e liberam a embarcação
  para um novo anúncio futuro.
- Localidade do anúncio = `embarcacao.municipio_id` → `municipios.estado_id` (nada novo a
  cadastrar; o filtro Estado/Cidade navega pelas tabelas IBGE já existentes).
- Categoria do anúncio = `embarcacao.embarcacao_categoria_id` (seeds atuais: Passeio,
  Pesca, Esporte, Luxo, Familiar). O form de anúncio exibirá a categoria herdada e, se a
  embarcação não tiver categoria, exigirá preenchê-la (update na própria embarcação),
  pois o filtro de busca por categoria é obrigatório.

### 3.2 `anuncio_venda_preco` (histórico de preço)

```sql
id           uuid PK
anuncio_id   uuid NOT NULL FK → anuncio_venda(id) ON DELETE CASCADE
preco        numeric(12,2) NOT NULL
created_at   timestamptz default now()
```

- A criação do anúncio insere o 1º registro; toda alteração de `preco` insere um novo
  (feito na server action, dentro da mesma operação — sem trigger nesta versão).
- **Selo público "Preço reduzido":** exibido quando `preco` vigente `<` preço
  imediatamente anterior; mostra o anterior riscado + % de redução. Aumento não gera selo
  (o histórico completo fica visível só para o gestor).
- Índice `(anuncio_id, created_at DESC)`.
- RLS: leitura pública (necessária para o selo), escrita só owner/service role.

### 3.3 `anuncio_venda_interacao` (eventos do funil)

Tabela de eventos **por usuário logado** — é a fonte do funil. O contador anônimo de
visualizações fica na coluna `visualizacoes` (via RPC), não aqui.

```sql
id           uuid PK
anuncio_id   uuid NOT NULL FK → anuncio_venda(id) ON DELETE CASCADE
user_id      uuid NOT NULL FK → users(id) ON DELETE CASCADE
tipo         text NOT NULL CHECK (tipo IN
             ('visualizou','revelou_contato','favoritou','compartilhou','conversou'))
created_at   timestamptz default now()
UNIQUE (anuncio_id, user_id, tipo)    -- 1 evento de cada tipo por lead (idempotente)
```

- Índices: `(anuncio_id, tipo)` e `(user_id)`.
- RLS: `service_role_all`; INSERT do próprio `user_id`; SELECT: o próprio usuário **e** o
  dono do anúncio (subquery em `anuncio_venda.owner_id`) — é o que permite o funil.
- Desfavoritar **não** remove o evento `favoritou` (o funil mede interesse demonstrado,
  não estado atual). Refinável depois.

### 3.4 Estágios do funil (derivados, não persistidos)

O estágio do lead é **calculado** a partir dos eventos — sem coluna de estágio, sem
inconsistência possível:

| Estágio | Nome sugerido | Critério (evento mais "quente" do lead no anúncio) |
|---|---|---|
| 1 | Visitante | `visualizou` (abriu o detalhe logado) |
| 2 | Interessado | `revelou_contato` |
| 3 | Engajado | `favoritou` |
| 4 | Promotor | `compartilhou` |
| 5 | Em negociação | `conversou` (iniciou chat com o vendedor) |

> A ordem 2–4 é discutível (favoritar pode valer mais que revelar contato?). Como o
> estágio é derivado, reordenar depois é só trocar a função de score — sem migração.

### 3.5 Alterações em tabelas existentes

- **`favorito`:** nova coluna `anuncio_venda_id uuid FK` (nullable) + CHECK
  `num_nonnulls(roteiro_id, embarcacao_id, anuncio_venda_id) = 1` + UNIQUE parcial
  `(user_id, anuncio_venda_id)` — mesmo padrão da migration `20260709`.
- **`conversa`/`mensagem`:** **sem alteração.** A conversa continua única por par
  gestor↔cliente; o vínculo com o anúncio é registrado pelo evento `conversou` em
  `anuncio_venda_interacao`. A primeira mensagem enviada a partir do anúncio é
  pré-preenchida citando o barco ("Olá! Tenho interesse na *<nome>* anunciada por R$ X"),
  dando contexto ao vendedor sem mudar o modelo do chat.

### 3.6 RPCs

1. **`buscar_anuncios_venda(...)`** — espelho da filosofia de `buscar_roteiros`:
   ```
   p_categoria_id uuid          -- obrigatório na UI (a RPC aceita null p/ flexibilidade)
   p_estado_id    integer       -- opcional
   p_municipio_id integer       -- opcional (só faz sentido com estado)
   p_ano_min / p_ano_max int    -- opcional (aplica sobre ano_modelo)
   p_preco_min / p_preco_max numeric  -- opcional
   p_limit / p_offset           -- paginação server-side
   ```
   Retorna os campos do card (id, nome, imagem principal, fabricante, anos, preço,
   preço anterior — para o selo de redução —, categoria, município/UF, capacidade,
   comprimento) + `total_count`. Filtra `status='ativo'` + embarcação ativa. Ordenação:
   mais recentes primeiro (ordenações por preço/ano ficam para o refinamento).
2. **`registrar_visualizacao_anuncio(p_anuncio uuid)`** — `security definer`, incrementa
   `visualizacoes` (contador de cliques). Chamada no load do detalhe; conta logado e
   deslogado (o deslogado vê o "teaser" antes do gate — ver §6.1).
3. **`vendas_locais()`** — estados (e cidades por estado) que possuem anúncio ativo, para
   popular os selects de localidade (mesma filosofia do autocomplete atual: só ofertar o
   que existe).
4. **`vendas_funil(p_gestor uuid default auth.uid())`** — leads agregados por anúncio:
   `(anuncio_id, user_id, nome, avatar, eventos[], estagio, ultima_interacao)`.
   `security definer` (a RLS de `users` impede o browser de ler nome/avatar de terceiros
   — mesmo motivo da RPC `chat_conversas_nao_lidas`).

Tipos correspondentes adicionados à mão em `src/types/supabase.ts`, como nas demais.

---

## 4. Site — Busca (Hero + `/vendas`)

### 4.1 Terceira aba no `SearchTypeToggle`

`Roteiros | Embarcações | Vendas` (Hero Section e barra compacta). Ao selecionar
**Vendas**, a barra troca os pickers:

| Campo | Componente | Regra |
|---|---|---|
| Categoria | `CategoriaPicker` (novo) | **Obrigatória** — lista `embarcacao_categoria` com anúncio ativo |
| Localidade | `LocalidadeVendaPicker` (novo) | Estado opcional; escolhido o estado, carrega as cidades dele (cidade opcional) via `vendas_locais` |
| Ano | `AnoPicker` (novo) | Opcional — faixa (de/até) ou ano exato |
| Valor | `FaixaValorPicker` (novo) | Opcional — range min/max (slider + inputs) |

- Submissão → `/vendas?categoria=&estado=&cidade=&ano_min=&ano_max=&preco_min=&preco_max=`.
- Alternar para Roteiros/Embarcações descarta os filtros de venda (e vice-versa) — são
  domínios diferentes; preservar não faz sentido aqui.
- A aba **Vendas** navega para `/vendas` (página própria), **não** para `/buscar` — os
  filtros e cards são outros, e novos filtros virão (motorização, comprimento, etc.).

### 4.2 Página de resultados `/vendas`

Nova página inspirada em `/buscar` (mesma identidade visual), com:

- Barra compacta no topo (pickers de venda com prop `compact`).
- **Chips removíveis** por filtro ativo (padrão existente).
- Grid responsivo 1→2→3→4 de **`AnuncioVendaCard`** (novo, inspirado no
  `EmbarcacaoCard`): imagem principal, badge de categoria, nome, fabricante + ano
  modelo/fabricação, município/UF, **preço** em destaque, selo **"Preço reduzido ↓"**
  quando aplicável, coração de favorito (toggle otimista, padrão §23).
- Paginação server-side, título contextual ("Lanchas de Passeio em Santa Catarina"),
  estado vazio com ação de limpar filtros.
- Estrutura: `src/app/vendas/page.tsx` (Server Component) + `_components/`.

---

## 5. Site — Detalhe do anúncio `/vendas/[id]`

Inspirado em `/embarcacoes/[id]`, **sem** BookingCard/carrinho/adicionais.

### 5.1 Gate de login

- **Deslogado:** a página mostra apenas um teaser (galeria + nome + preço + categoria) com
  overlay/CTA **"Entre para ver os detalhes"** → `/entrar?redirect_to=/vendas/[id]`.
  A visualização anônima conta no contador (`registrar_visualizacao_anuncio`), mas não
  gera lead.
- **Logado:** conteúdo completo + registro idempotente do evento `visualizou` (estágio 1
  do funil).

### 5.2 Conteúdo (logado)

1. **Galeria** — mesma estrutura do detalhe atual (principal + miniaturas + modal com
   navegação por teclado).
2. **Ficha técnica completa** — tipo, categoria, capacidade, comprimento, cabines,
   quartos, suítes, tripulação, comodidades (tudo da `embarcacao`), **fabricante, ano do
   modelo, ano de fabricação** (do anúncio).
3. **Preço + histórico de redução** — preço vigente em destaque; se houve redução, preço
   anterior riscado, % e data ("De R$ 480.000 por R$ 450.000 · reduzido em 05/07").
   Aumentos nunca aparecem para o comprador.
4. **Descrição da venda** (`descricao_venda`) + descrição da embarcação.
5. **Localização** — cidade/UF + mapa (coordenadas já existentes na embarcação).
6. **Card do vendedor (dados ocultos)** — sidebar: avatar/nome parcialmente mascarados
   ("R***** G*****") e botão **"Revelar contato do vendedor"**. Ao clicar: server action
   valida sessão, registra `revelou_contato` (estágio 2) e retorna nome completo,
   e-mail e telefone (se cadastrado). Os dados **nunca** vão pré-renderizados no HTML —
   só saem do servidor após o clique autenticado.
7. **Ações:** **Favoritar** (padrão §23 + evento `favoritou`), **Compartilhar** (dropdown
   WhatsApp/Facebook/Instagram/Copiar link, padrão §23.3 + evento `compartilhou` no
   primeiro uso), **"Conversar com o vendedor"** (abre a conversa gestor↔cliente
   existente/nova com mensagem pré-preenchida citando o anúncio + evento `conversou`).
8. **Avaliações da embarcação** (média/comentários já públicos) — reforça confiança.

- Anúncio pausado/vendido ou embarcação inativa → 404 (link direto).
- Lado do comprador: chat acessível também por uma entrada em **Minhas conversas**
  (detalhe no refinamento — hoje o cliente acessa chat via reserva; ver §9 Questões).

---

## 6. Painel do Gestor

### 6.1 Novo menu **Vendas** (`/painel/vendas`)

Grid no padrão de `/painel/embarcacoes`:

- Colunas: foto + nome da embarcação, fabricante, ano modelo/fabricação, **preço
  vigente**, status (toggle Ativo/Pausado + ação "Marcar como vendido"), **métricas
  rápidas** (👁 visualizações, 👥 leads), criado em.
- Ações: Editar, **Funil** (leads do anúncio), Ver no site.
- Incluir o novo item no **tutorial guiado** do painel (passo do menu lateral).

### 6.2 Cadastro/edição (`/painel/vendas/novo`, `/painel/vendas/[id]/editar`)

Formulário curto — o pulo do gato é **aproveitar a embarcação existente**:

1. **Seletor de embarcação** (obrigatório): dropdown das embarcações ativas do gestor
   **sem anúncio vigente**. Ao selecionar, um card resume os dados herdados (fotos, tipo,
   categoria, capacidade, localização) com link "Editar embarcação" caso algo esteja
   desatualizado.
2. **Campos da venda:** Fabricante*, Ano do modelo*, Ano de fabricação* (validação:
   fabricação ≤ modelo + 1, padrão náutico/automotivo), **Valor do anúncio*** ,
   Descrição da venda (opcional).
3. Se a embarcação não tem categoria: campo de categoria obrigatório inline (grava na
   embarcação).
4. **Edição:** alterar o valor grava novo registro no histórico; um bloco "Histórico de
   preço" lista todas as alterações (data, valor, variação) — visível só ao gestor.

Server actions em `/painel/vendas/actions.ts` seguindo o padrão de posse existente
(`owner_id = user.id`, com exceção para `admin`, preparando o módulo administrativo).

### 6.3 Funil de vendas (`/painel/vendas/funil`)

Visão CRM dos leads de **todos** os anúncios do gestor (com filtro por anúncio):

- **Layout Kanban** (5 colunas = estágios da §3.4): card do lead com avatar, nome,
  anúncio de interesse, badges das interações, tempo da última interação e atalho para o
  **chat** (`/painel/clientes/[id]/chat`).
- O lead aparece na coluna do seu estágio mais avançado (derivado — sem drag-and-drop
  nesta versão; movimentação manual é refinamento futuro).
- **Cabeçalho com métricas** por anúncio: visualizações totais (contador), leads por
  estágio, taxa de conversão visualização→conversa.
- Dados via RPC `vendas_funil` (server-side; sem realtime nesta versão — refresh ao
  navegar; realtime é refinamento natural depois, mesmo padrão do sino).
- Entrada também pelo **Dashboard** (`/painel`): novo card "Anúncios de venda" (nº de
  anúncios ativos + leads no funil) linkando para a seção.

---

## 7. Rotas e Artefatos (mapa de implementação)

| Camada | Artefato | Base de inspiração |
|---|---|---|
| Migration | `20260712_vendas.sql` (tabelas, RLS, favorito, seeds) | `027_favoritos.sql`, `20260627_chat.sql` |
| Migration | `20260713_vendas_rpcs.sql` (4 RPCs) | `018_buscar_roteiros.sql`, `028_…` |
| Tipos | `src/types/supabase.ts` (tabelas + RPCs) | padrão atual |
| Site | `src/app/vendas/page.tsx` + `_components/` (resultados) | `src/app/buscar/` |
| Site | `src/app/vendas/[id]/page.tsx` + `_components/` (detalhe, gate, revelar, ações) | `src/app/embarcacoes/[id]/` |
| Site | `src/components/home/search/` — toggle 3 abas + 4 pickers novos | pickers atuais |
| Site | `src/components/ui/AnuncioVendaCard.tsx` | `EmbarcacaoCard.tsx` |
| API | `GET /api/vendas/locais` (estados/cidades com anúncio) | `/api/buscar/locais` |
| Ações | `src/lib/vendas-actions.ts` (revelar contato, eventos, conversar) | `favoritos-actions.ts`, `chat-actions.ts` |
| Ações | `src/lib/favoritos-actions.ts` — `alternarFavoritoAnuncio` | §23.5 |
| Painel | `src/app/painel/(gestao)/vendas/` (grid, novo, editar, funil, actions) | `(gestao)/embarcacoes/` |
| Painel | Sidebar + tutorial + card no dashboard | padrões atuais |
| Favoritos | `/favoritos` ganha a seção "À venda" | §23.4 |
| Docs | PRD.md §6.12 + SPEC.md §29 (novos) | — |

---

## 8. Fases de Entrega (incremental, cada fase deployável)

1. **Fundação (dados):** migrations, RLS, RPCs, tipos TS. *(sem UI — validável via SQL)*
2. **Painel — CRUD do anúncio:** menu Vendas, grid, novo/editar, histórico de preço,
   status. *(gestor já cadastra; nada público ainda)*
3. **Site — busca e resultados:** aba Vendas, pickers, `/vendas`, card, `/api/vendas/locais`.
4. **Site — detalhe completo:** `/vendas/[id]`, gate de login, contador, revelar
   contato, favoritar (+ `/favoritos`), compartilhar, chat com mensagem contextual.
5. **Painel — funil:** RPC `vendas_funil`, Kanban, métricas, card no dashboard, tutorial.
6. **Encerramento:** atualização final de PRD/SPEC, revisão de RLS ponta a ponta, testes
   dos fluxos (deslogado→login→lead; redução de preço; pausar/vender).

Dependências: 2→1, 3→(1,2), 4→3, 5→(1,4). As fases 3 e 5 podem andar em paralelo após a 2/4.

---

## 9. Questões em aberto (para o refinamento)

1. **Telefone do vendedor:** `users` hoje não tem telefone estruturado para exibir no
   "revelar contato". Revelamos nome + e-mail e adicionamos campo de telefone/WhatsApp
   no cadastro do anúncio (recomendado) ou no perfil do gestor?
2. **Ordem dos estágios 2–4** do funil (revelou → favoritou → compartilhou): confirmar a
   "temperatura" de cada ação. Como é derivado, mudar depois é barato.
3. ~~**Chat do comprador:** onde o cliente reencontra a conversa de venda no site?~~
   ✅ **Resolvido (13/07/2026):** criada a página **"Minhas conversas"** (`/minhas-conversas`),
   hub central que lista todas as conversas do cliente com gestores (via RPC
   `chat_conversas_cliente`, migration `20260715`), com item no menu do usuário e o badge de não
   lidas. Cobre venda (sem reserva) e aluguel. Detalhes: SPEC §29.9. **Aplicar a migration
   `20260715_chat_conversas_cliente.sql` em produção.**
4. **Filtro de ano:** ano exato, faixa (de/até) ou lista de faixas prontas ("2020+",
   "2015–2019")? Planejei faixa de/até.
5. **Selo de redução:** comparar com o preço imediatamente anterior (planejado) ou com o
   máximo histórico? E há prazo de exibição (ex.: selo some após 30 dias)?
6. **Card na home:** teremos uma seção "Embarcações à venda" na home nesta versão ou só
   a entrada pela busca?
7. **Compartilhar deslogado:** compartilhar exige login (gera lead) ou funciona deslogado
   (só não pontua)? Planejei: funciona no teaser deslogado, pontua só logado.
