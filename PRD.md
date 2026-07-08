# PRD — Boatzy (MVP)

## 1. Visão Geral

**Nome do Produto:** Boatzy  
**Tipo:** Marketplace (SaaS + App Web/Mobile)  
**Descrição:**  
Boatzy é uma plataforma que conecta proprietários de embarcações (lanchas, iates, jet skis) a usuários interessados em alugar experiências no mar de forma simples, segura e digital.

---

## 2. Objetivo do Produto

Validar um marketplace de aluguel de embarcações, garantindo:

- Oferta (barcos cadastrados)
- Demanda (usuários interessados)
- Transações reais (reservas pagas)

---

## 3. Público-Alvo

### Usuários (Locatários)
- Turistas
- Grupos de amigos
- Famílias
- Pessoas buscando experiências no mar

### Fornecedores (Owners)
- Donos de lanchas
- Donos de iates
- Operadores de passeios náuticos

---

## 4. Stack Tecnológica

- **Frontend:** React (Next.js)
- **Backend:** Node.js (Next.js API Routes)
- **Banco de Dados:** Supabase (PostgreSQL)
- **Autenticação:** Supabase Auth (OAuth: Google, Facebook, Apple; email/senha)
- **Hospedagem:** Vercel
- **Pagamentos:** Stripe Connect (Marketplace)

---

## 5. Escopo do MVP

### 5.1 Funcionalidades Core

#### Usuário (Cliente) (role: cliente)
- ✅ Cadastro/Login em `/entrar` (Supabase Auth — email/senha, Google, Facebook, Apple)
- ✅ Role `cliente` atribuída automaticamente via `/api/auth/setup-cliente` após login/cadastro
- Buscar embarcações
- Visualizar detalhes
- Solicitar reserva
- Realizar pagamento
- Avaliar embarcação

#### Dono da Embarcação (role: gestor)
- ✅ Cadastro/Login exclusivo em `/painel/cadastro` e `/painel/login` (Supabase Auth — email/senha, Google, Facebook, Apple)
- ✅ Role `gestor` atribuída automaticamente via API após cadastro
- ✅ Dashboard em `/painel` com visão geral (stats)
- ✅ Menu com Agendamentos e Embarcações
- ✅ Estrutura do banco de dados para embarcações (migration 002)
- ✅ Cadastro de embarcação com seleção de comodidades (tabelas `comodidade` e `embarcacao_comodidades`, migration 007)
- Upload de imagens (em desenvolvimento) — limite de **20 MB por arquivo** no cadastro/edição de embarcação e roteiro; arquivos acima do limite são bloqueados com a mensagem "O arquivo não pode ser maior que 20 MB." (validação no client e no servidor; ver SPEC § 13 → Upload de imagens).
- Definição de preço (em desenvolvimento)
- ✅ Gerenciamento de reservas de roteiro em `/painel/agendamentos` (Confirmar/Recusar com observação — ver 6.5)

---

## 6. Funcionalidades Detalhadas

### 6.1 Autenticação

- ✅ Login via Supabase Auth: email/senha e OAuth — disponível tanto no site público (`/entrar`, role `cliente`) quanto no painel (`/painel/login`, role `gestor`).
  - ✅ Google — configurado e em produção.
  - ✅ Facebook — configurado e em produção (foto de perfil servida por `platform-lookaside.fbsbx.com`, domínio liberado no `next.config.ts`).
  - ✅ Apple — configurado e em produção.
- ✅ Botões de login social compartilhados via componente `SocialLoginButtons` (`src/components/auth/SocialLoginButtons.tsx`).
- ✅ Os três provedores retornam ao domínio final de produção (`https://www.boatzy.app`), não ao `*.vercel.app`. O redirect é derivado de `NEXT_PUBLIC_APP_URL`; requer alinhamento entre Vercel (env), Supabase Site URL e Redirect URLs. Detalhes no `SPEC.md`.
- ✅ Um mesmo e-mail pode acumular múltiplas roles (`cliente` + `gestor`), sem precisar criar conta nova.
- ✅ Login com provedores diferentes (Google/Facebook) usando o mesmo e-mail referencia **a mesma conta** — o Supabase faz vínculo automático de identidades por e-mail verificado (verificado em produção). Detalhes técnicos no `SPEC.md`.
- ✅ Roles são armazenadas em `user_roles` (Supabase, fonte da verdade). Lidas diretamente do banco nos Server Components.
- ✅ Cliente que tenta acessar `/painel` vê a opção "Tornar-me gestor", que adiciona a role sem destruir o vínculo de cliente.
- ✅ Recuperação de senha do cliente: `/recuperar-senha` (solicita e-mail) → e-mail com link → `/auth/confirm` (valida token e cria sessão) → `/redefinir-senha` (define nova senha). Mensagem de envio é genérica (anti-enumeração de contas) e o link funciona em qualquer navegador/dispositivo (client dedicado com `flowType: 'implicit'`, evitando a exigência de PKCE do client principal). Detalhes no `SPEC.md`.
- ✅ Recuperação de senha do gestor: mesmo fluxo, rotas espelhadas (`/painel/recuperar-senha` → `/painel/auth/confirm` → `/painel/redefinir-senha`). Ao concluir, passa por `/api/painel/setup-role` (garante a role `gestor`, idempotente) antes de entrar em `/painel` — a recuperação de senha em si não atribui roles. Detalhes no `SPEC.md`.
- Separação de perfis:
  - Cliente — acessa o hotsite (`/`), autenticado via social/email com role `cliente`
  - Gestor (Owner) — acessa o painel (`/painel`), com role `gestor`
  - Admin — acessa o painel (futuro)

---

### 6.2 Listagem de Embarcações

Campos:

- Nome
- Tipo (lancha, iate, jet ski)
- Capacidade
- Localização
- Preço por dia
- Descrição
- Fotos

---

### 6.3 Busca e Filtros

Filtros disponíveis:

- Localização
- Data
- Preço
- Capacidade
- Tipo de embarcação

Visualização:

- Lista
- Mapa (Google Maps)

#### ✅ Implementado — Alternância de Tipo de Busca (Roteiros / Embarcações)

- A busca do site é **orientada a roteiro**: as duas abas do toggle `SearchTypeToggle` (Hero Section e barra compacta de `/buscar`) retornam **roteiros** em `/buscar` — no fim, o usuário sempre seleciona um roteiro.
- **Roteiros** (padrão): permanece como sempre foi (local, data, pessoas).
- **Embarcações**: exibe o seletor adicional **Tipo de embarcação** (`TipoEmbarcacaoPicker`) — o usuário escolhe o tipo (Lancha, Iate, Jet Ski, …) dentre os que têm roteiro ativo vinculado, mais localização, data e pessoas; o resultado lista os **roteiros vinculados a embarcações daquele tipo**.
- Os filtros (local, data, pessoas) são preservados ao alternar entre as abas (o tipo de embarcação é descartado ao voltar para Roteiros).

#### ✅ Implementado — Barra de Busca Inteligente (Hero Section)

- `LocationPicker`: autocomplete de municípios com roteiros cadastrados, opção "Próximo de mim" via geolocalização do navegador, histórico de buscas recentes (localStorage).
- `DatePicker`: calendário de 2 meses, datas passadas bloqueadas, opções de flexibilidade (Data exata, ±1, ±2, ±3, ±7 dias), totalmente em pt-BR.
- `GuestPicker`: contador +/− com mínimo 0, dropdown.
- Navegação para `/buscar?municipio=&data=&flex=&pessoas=` ao submeter.

#### ✅ Implementado — Busca por tipo de embarcação (resultados em roteiros)

- A aba **Embarcações** deixou de listar embarcações: ela filtra **roteiros** pelo **tipo da embarcação vinculada**, via novo parâmetro `p_tipo_id` da RPC `buscar_roteiros` (migration 024). Roteiros sem embarcação vinculada não aparecem quando o filtro de tipo está ativo (mesma regra do filtro de pessoas).
- O seletor `TipoEmbarcacaoPicker` lista apenas tipos com pelo menos um roteiro ativo vinculado (mesma filosofia do autocomplete de locais).
- Em `/buscar`: chip removível "Tipo: \<nome\>", título contextualizado ("Roteiros com Lancha em …"), badge do tipo da embarcação no `RoteiroCard` e estado vazio com ação "Limpar filtro de tipo".
- A rota `/embarcacoes` (listagem) agora **redireciona** para `/buscar?tipo=embarcacao` preservando os filtros compatíveis. O detalhe `/embarcacoes/[id]` e o fluxo de reserva direta de embarcação **permanecem ativos** (acessíveis por link direto), apenas sem entrada pela busca.
- A RPC `buscar_embarcacoes` (migration 017/020) permanece no banco, mas não é mais consumida pela busca pública.

#### ✅ Implementado — Página de Resultados `/buscar`

- Barra de busca compacta no topo (reutiliza os mesmos pickers com prop `compact`).
- Chips de filtros ativos com link de remoção individual.
- Grid de roteiros (4 colunas responsivo: 1 → 2 → 3 → 4).
- ✅ **Filtros inteligentes via RPC `buscar_roteiros`:**
  - **Localização:** município exato **ou** dentro de um raio de **50 km** do centro escolhido, por distância real (haversine).
  - **Data:** considera o calendário de disponibilidade do roteiro (dias de operação + bloqueios); com flexibilidade, basta um dia livre na janela.
  - **Pessoas:** verifica a capacidade da **embarcação vinculada** ao roteiro (`capacidade >= pessoas`). Roteiros sem embarcação vinculada não aparecem quando há filtro de pessoas.
  - **Ordenação:** mais próximos primeiro quando há localização; senão, mais recentes. Paginação server-side.
- `RoteiroCard`: imagem principal, badge de localidade, meta (pessoas/duração), nome, preço base.

---

### 6.4 Página da Embarcação / Roteiro

Exibir:

- Galeria de imagens
- Informações completas
- Avaliações
- Localização
- Botão "Reservar"

#### ✅ Implementado — Página de Detalhes `/roteiros/[id]`

- Galeria: imagem principal (2/3 largura) + 2 miniaturas laterais.
- Specs row: ícones com Localização, Duração, Pessoas, Preço — layout com `min-w-0` + `truncate` para evitar overflow.
- "Sobre a Embarcação": nome clicável que abre `EmbarcacaoFotosModal` com galeria completa e especificações da embarcação.
- "Comodidades a bordo": grid 3 colunas com ícones `CheckCircle2`.
- "O que está incluído": itens do catálogo vinculados ao roteiro (`roteiro_catalogo`).
- "Itinerário": timeline vertical com gradiente.
- Reviews: seção placeholder.
- Sidebar `BookingCard`: seleção de data e pessoas, breakdown de preço com taxa de serviço (12%), total estimado, botão "Solicitar Reserva" → `/reservas/novo`.
- ✅ O calendário de data do `BookingCard` respeita a **disponibilidade do roteiro**: datas fora dos dias de operação ou bloqueadas pelo gestor aparecem riscadas e não selecionáveis (ver 6.8 → Disponibilidade do roteiro).

#### ✅ Implementado — Modal de Fotos da Embarcação (`EmbarcacaoFotosModal`)

- Trigger: nome da embarcação como link estilizado (underline pontilhado + ícone câmera com contagem + ExternalLink no hover).
- Modal: backdrop escuro + blur, painel `max-w-4xl`, header gradiente navy.
- Navegação: setas ◀ ▶, teclado (ESC fecha, ← → navega), contador "N / total".
- Thumbnails: strip no rodapé com ring cyan no ativo.
- Footer de especificações: capacidade, comprimento, cabines, tripulação, modalidade do capitão.

---

### 6.5 Sistema de Reservas

Fluxo:

1. Selecionar data
2. Definir duração
3. Confirmar reserva
4. Pagamento

Status:

- Pendente
- Confirmada
- Cancelada

#### ✅ Implementado — Solicitação de reserva de **roteiro** (cliente → gestor)

Fluxo de **solicitação** (sem pagamento nesta etapa). Detalhes técnicos: SPEC §20.

- No detalhe do roteiro (`BookingCard`), **Data** e **Pessoas** são **obrigatórios**; se o cliente
  chegou pela busca, os campos vêm **pré-preenchidos** com os filtros (data/flex/pessoas).
- Os **adicionais** (produtos/serviços do catálogo) selecionados são registrados na solicitação.
- "Solicitar Reserva" leva a `/reservas/novo`, que **exige login** e mostra um resumo; ao confirmar,
  cria a reserva como **Pendente** com `cliente_id`, data/hora da solicitação e **snapshot** dos
  valores e adicionais.
- No painel (`/painel/agendamentos`), o gestor vê as solicitações dos seus roteiros (Pendentes em
  destaque) e pode **Confirmar** ou **Recusar**, escrevendo uma **observação** retornada ao cliente.

**Status da reserva:** `pendente` → `confirmada` | `recusada` (gestor) | `cancelada` (cliente);
`confirmada` → `concluida` (automático, quando a data passa) | `cancelada` (cliente).

#### ✅ Implementado — Novos status: `cancelada` e `concluida` (migration 025)

- **`cancelada`** — cancelamento feito pelo **cliente** (botão "Cancelar reserva" em `/minhas-reservas`, com confirmação), permitido enquanto a reserva está `pendente` ou `confirmada`. Difere de `recusada`, que é a negativa do gestor. Grava `cancelada_em`.
- **`concluida`** — reserva `confirmada` cuja data já passou. Transição **automática (lazy)**: roda ao abrir `/minhas-reservas` e `/painel/agendamentos` (sem cron). É o gatilho para a avaliação do cliente (ver 6.7).
- Painel: calendário e detalhe exibem os 5 status (Pendente = laranja, Confirmada = verde, Recusada = vermelho, Cancelada pelo cliente = cinza, Concluída = azul), com legenda atualizada.
- Política formal de cancelamento (prazos/reembolso) fica para quando houver pagamento.

#### ✅ Implementado — Calendário de agendamentos no painel (gestor)

`/painel/agendamentos` exibe um **calendário** com todas as reservas das embarcações/roteiros do
gestor. Detalhes técnicos: SPEC §20.4–20.5.

- Visualização **Mês** (default) e **Semana**, com navegação anterior/hoje/próximo.
- Dias com reserva são sinalizados por **cores de status**: Pendente = laranja, Confirmada = verde,
  Cancelada = vermelho. **Diferenciação por tipo** (roteiro vs embarcação) com ícone próprio. Legenda.
- Clicar em uma reserva abre `/painel/agendamentos/[id]` com **todos os dados do cliente e do
  pedido**, valores e a opção de **Confirmar** ou **Cancelar**, com observação ao cliente.
- Coluna `reserva.tipo` (`roteiro`|`embarcacao`, migration 022) prepara o calendário para reservas
  de embarcação.

#### ✅ Implementado — Menu do cliente + "Minhas reservas"

- O avatar do cliente no `Header` abre um menu com **Minhas reservas**, **Minha conta** e **Sair**.
- `/minhas-reservas`: o cliente vê todas as reservas que solicitou com status, dados do pedido,
  adicionais, total e a **resposta do gestor** (observação + data). Detalhes: SPEC §20.6.
- `/minha-conta`: placeholder ("Em breve") — edição de dados fica para depois.

#### ✅ Implementado — Reserva de **embarcação** pelo site

- A página `/embarcacoes/[id]` ganhou a sidebar `EmbarcacaoBookingCard` (data/pessoas obrigatórios,
  disponibilidade, preço/dia + taxa) — mesmo fluxo do roteiro, **sem adicionais**.
- Confirmação compartilha `/reservas/novo` (agora `?roteiro=` ou `?embarcacao=`) e a action
  `criarReserva` (multi-tipo).
- ⚠️ Desde a busca orientada a roteiro (ver 6.3), a listagem `/embarcacoes` redireciona para
  `/buscar` — o detalhe da embarcação e este fluxo de reserva seguem ativos, mas acessíveis apenas
  por **link direto** (sem entrada pela busca).
- Reservas de embarcação aparecem no calendário do gestor, no detalhe `/painel/agendamentos/[id]` e
  em "Minhas reservas", com o ícone/diferenciação de tipo. Detalhes: SPEC §20.7.

**Próximos passos:** tela "Minha conta" (edição de dados); refinamentos do calendário (filtros por
tipo/status); pagamento (Stripe).

---

### 6.6 Pagamentos

- Integração com Stripe Connect
- Split automático:
  - Comissão da plataforma
  - Repasse ao dono

---

### 6.7 Avaliações (Reviews)

#### ✅ Implementado — Avaliação pelo cliente (migration 026)

- Em `/minhas-reservas`, reservas **concluídas** exibem o botão "Avaliar experiência": nota de **1 a 5 estrelas** (obrigatória) + comentário opcional (máx. 2000 caracteres), enviados inline no card.
- **Uma avaliação por reserva** (única, sem edição); após enviar, o card mostra a avaliação feita.
- Regra do PRD §8 garantida em três camadas: UI (botão só em concluída), server action (`criarAvaliacao` valida posse + status) e RLS (INSERT exige reserva concluída do próprio cliente).

#### ✅ Implementado — Exibição pública

- `/roteiros/[id]` e `/embarcacoes/[id]`: seção "Avaliações" real (substituiu o placeholder) com **média** (estrelas + nota com 1 decimal), **contagem** e **lista de comentários** (avatar, nome, data, nota).
- A página da **embarcação** agrega também as avaliações de reservas de **roteiros** feitos naquela embarcação.
- **Card da busca** (`/buscar` e `/favoritos`): roteiros com avaliação exibem `★ média (total)` na linha do preço, no lugar do badge "Novo"; sem avaliação, nada é exibido (o badge "Novo" permanece).

---

### 6.8 Painel do Dono (Owner Dashboard)

- Listar embarcações
- Editar dados
- Ver reservas
- Acompanhar ganhos

#### ✅ Implementado — Dashboard com dados reais (`/painel`)

Todos os números são do **gestor logado** (`owner_id`):

- **Cards (clicáveis, linkam para a seção):** Agendamentos pendentes de validação (com total geral), Embarcações (com nº de ativas), Roteiros (com nº de ativos) e Clientes (distintos, com pelo menos 1 reserva).
- **Gráfico "Reservas solicitadas":** barras com a quantidade de solicitações recebidas por mês nos **últimos 6 meses** (mês com mais reservas em destaque).
- **Card "Destaque do período":** roteiro/embarcação com mais solicitações na janela de 6 meses (% do total e contagem); estado vazio com CTA quando não há reservas.
- **"Últimas solicitações de reserva":** as 6 mais recentes com item + tipo (badge), cliente, data do passeio, pessoas, total estimado, status (5 status com cores) e data da solicitação; ação "Detalhes" → `/painel/agendamentos/[id]` e "Ver todas" → calendário.
- A página roda a transição lazy `confirmada → concluída` antes de contar/exibir.

#### ✅ Implementado — Menu **Receitas** (`/painel/receitas`)

- Tela financeira do gestor: filtros por **período** (com atalhos: Este mês, Últimos 30 dias, Últimos 6 meses, Este ano), **embarcação**, **roteiro**, **cliente** e **status** (default: Confirmada + Concluída — é a base da receita, já que não há Stripe integrado; o gestor pode ampliar para ver pendentes/canceladas).
- **KPIs:** receita no período, variação % vs. período anterior (mesma duração, imediatamente anterior), ticket médio, nº de reservas confirmadas, valor pendente (informativo).
- **Gráficos:** receita por mês (tendência), receita por embarcação (top 8) e por roteiro (top 8), top clientes por receita.
- **Grid de reservas** do período filtrado: ordenável por qualquer coluna, paginado (10/página), com exportação para **Excel** e **PDF** (refletindo o filtro e a ordenação atuais).
- Todos os filtros, KPIs, gráficos e grid reagem em conjunto ao mesmo estado de filtro — nunca mostram números divergentes entre si.
- Detalhes técnicos em `SPEC.md` §24.

#### ✅ Implementado — Menu **Clientes** (`/painel/clientes`)

- Lista todos os clientes que **já efetuaram pelo menos uma reserva** (de embarcação ou roteiro) com o gestor logado. Cada cliente aparece **uma única vez**.
- Exibe os dados do cliente: avatar + nome, "cliente desde" (data de cadastro), e-mail, CPF/CNPJ, total de reservas e data da última reserva.
- Apenas **busca** (nome, e-mail ou CPF/CNPJ), **ordenação por coluna** e **paginação** (10 por página), seguindo o padrão visual do grid de embarcações; a única ação por linha é abrir o **chat** (abaixo).
- Os clientes surgem automaticamente conforme fazem reservas; não há cadastro manual.

#### ✅ Implementado — Chat em tempo real Gestor ↔ Cliente (dois lados)

- **Chat em tempo real** estilo WhatsApp, só por dentro do site, usando **Supabase Realtime**. **Somente texto**, com status lida/não lida (as não lidas zeram ao abrir a conversa). A conversa é simétrica e única por par gestor↔cliente.
- **Lado gestor (painel):** a partir da lista de Clientes, o gestor abre o chat (`/painel/clientes/[id]/chat`). Cada linha tem ícone de chat com **badge de não lidas**; há um **badge com o total geral** no item `CLIENTES` da sidebar, ao vivo.
- ✅ **Sino de notificações (topbar do painel):** exibe badge com o total de mensagens não lidas dos clientes, ao vivo. Ao clicar, abre um dropdown com a lista de conversas (avatar, nome, prévia da última mensagem, tempo relativo, contagem por conversa) e atalho direto para cada chat; footer leva a Clientes. Estado vazio quando não há não lidas. **Futuramente o sino agregará outros tipos de notificação** (ex.: novas solicitações de reserva). Detalhes: SPEC §21.4b.
- **Lado cliente (site):** em **Minhas reservas**, cada reserva tem o botão **"Conversar com o gestor"** (`/minhas-reservas/[id]/chat`) com **badge de não lidas** por reserva. O **menu do usuário (dropdown)** exibe um **badge de aviso** quando há qualquer conversa não lida (no avatar e ao lado de "Minhas reservas"), atualizado ao vivo.
- Detalhes técnicos em `SPEC.md` §21.

#### ✅ Implementado — Precificação dinâmica (UI) — roteiros e embarcações

- Seção "Preço" nos forms de cadastro/edição (roteiro **e** embarcação) com preço base + regras (Dias da Semana, Período Anual, Data Específica).
- ✅ Melhoria de UX no bloco "Como funciona": a explicação da ordem de prioridade foi unificada em **uma única lista numerada (1→4)**, ordenada de cima para baixo pela prioridade real, eliminando a inconsistência anterior (chips e caixas em ordens opostas). Inclui exemplo de desempate.
- ✅ As abas de "Nova regra" seguem a mesma ordem de prioridade (Data Específica → Período Anual → Dias da Semana).

#### ✅ Implementado — Ativar/Desativar embarcação no grid (com cascade para roteiros)

- A coluna **Status** no grid de embarcações (`/painel/embarcacoes`) virou um **toggle ativo/inativo**, acionável direto na listagem.
- Ao **desativar**, uma confirmação mostra quais **roteiros vinculados** ficarão inativos e some da busca; o gestor confirma.
- **Cascade:** desativar a embarcação desativa os roteiros vinculados; **reativar** a embarcação reativa os roteiros vinculados (comportamento simétrico).
- Itens inativos **não aparecem na busca** do cliente e retornam **404** se acessados por link direto (`/embarcacoes/[id]`, `/roteiros/[id]`).
- O grid de **roteiros** (`/painel/roteiros`) também tem o **toggle ativo/inativo** (direto, sem cascade — roteiro não tem dependentes), permitindo controle independente.
- Tecnicamente: `roteiro` ganhou a coluna `ativo`; `buscar_roteiros` passou a filtrar `ativo = true`. Detalhes em `SPEC.md` §15-C.

#### ✅ Implementado — Disponibilidade (roteiros e embarcações)

- Nova seção "Disponibilidade" nos forms de cadastro/edição (roteiro **e** embarcação): o gestor define os **dias da semana** de operação e **bloqueia datas específicas** (exceções) num mini-calendário, via componente compartilhado `DisponibilidadePicker`.
- Modelo: recorrência semanal + bloqueios; dia inteiro; capacidade exclusiva (1 reserva/dia). Sem dias selecionados = disponível todos os dias (sujeito a bloqueios).
- **Roteiro:** a disponibilidade é refletida no calendário público de reserva (`BookingCard`).
- **Embarcação:** disponibilidade cadastrada e persistida; o reflexo público fica como gancho (a página `/embarcacoes/[id]` ainda não tem calendário de reserva). Detalhes técnicos em `SPEC.md` §15-B.

---

### 6.9 Perfil do Usuário

- Dados pessoais
- Histórico de reservas
- Avaliações feitas

#### ✅ Implementado — Favoritos (migration 027)

- No detalhe do roteiro (`/roteiros/[id]`), o botão **Favoritar** salva/remove o roteiro dos favoritos do usuário logado (estado visual: coração preenchido + "Favoritado"). Deslogado, o clique leva a `/entrar` com retorno à página.
- O **coração no card** dos resultados da busca (`/buscar`) também favorita/desfavorita, com o mesmo comportamento (toggle otimista; deslogado → `/entrar` com retorno à busca com filtros). O estado inicial vem preenchido para roteiros já favoritados.
- **Menu do usuário** (dropdown do avatar e menu mobile) ganhou o item **Favoritos** → `/favoritos`: grade com os roteiros salvos (mesmo card da busca) e botão "Remover dos favoritos". Roteiros desativados depois de favoritados não aparecem (mesma regra da busca).
- Um favorito por par usuário↔roteiro. Detalhes técnicos: SPEC §23.

#### ✅ Implementado — Compartilhar roteiro

- O botão **Compartilhar** no detalhe do roteiro abre um menu com **WhatsApp**, **Facebook**, **Instagram** e **Copiar link**.
- WhatsApp e Facebook usam os endpoints web oficiais de compartilhamento (`wa.me` e `facebook.com/sharer`). O Instagram **não possui** endpoint web de compartilhamento por URL: a opção copia o link (para colar no story/direct) e abre o Instagram.

### 6.10 Páginas Institucionais / Legais

#### ✅ Implementado — Política de Privacidade `/privacy`

- Página estática institucional acessível pelo item "Privacidade" no rodapé.
- Conteúdo em conformidade com a LGPD (Lei nº 13.709/2018) e o Marco Civil da Internet, exigido também para publicar o login social do Facebook/Meta.
- Versão atual é uma minuta provisória (v1) com aviso de status; revisão jurídica pendente para o lançamento oficial.
- Fonte do texto: `Boatzy_Politica_Privacidade.md` (raiz do projeto).

#### ✅ Implementado — Termos de Uso `/terms`

- Página estática institucional acessível pelos itens "Termos de Uso" / "Termos" no rodapé.
- Define o Boatzy como plataforma de intermediação (não é parte do contrato de locação), responsabilidades de Anunciantes e Locatários, condutas proibidas e isenção/limitação de responsabilidade.
- Pagamentos descritos como funcionalidade futura; regido pelas leis brasileiras (CDC).
- Versão atual é uma minuta provisória (v1) com aviso de status; revisão jurídica pendente para o lançamento oficial.
- Fonte do texto: `Boatzy_Termos_Uso.md` (raiz do projeto).

### 6.11 Área Administrativa (`/administrator`)

Área de gestão geral da plataforma Boatzy, exclusiva para usuários com a role `admin`.

**Segurança (regra central):**
- A role `admin` **só pode ser concedida via SQL direto no banco** (tabela `user_roles`). Nenhum fluxo da aplicação (endpoint, server action, tela) atribui essa role — por decisão de segurança.
- Acesso validado em duas camadas: middleware (autenticação) + layout Server Component (role no banco, fonte da verdade).
- Login próprio em `/administrator/login` com e-mail + senha, **sem** login social, cadastro ou recuperação de senha.

#### ✅ Implementado — Estrutura, login, guard e dashboard

- Layout inspirado no `/painel` (sidebar + header), com dashboard de métricas globais do sistema (usuários, gestores, embarcações, roteiros, reservas, avaliações e taxa vigente) e cards de acesso rápido aos módulos.
- Menu com os módulos previstos (páginas placeholder, a implementar individualmente):
  - **Avaliações** — gestão de todas as avaliações do sistema (com exclusão)
  - **Embarcações** — gestão de todas as embarcações da plataforma
  - **Publicidade** — gestão de espaços de publicidade
  - **Taxas** — taxas gerais do sistema (percentual da plataforma × repasse ao gestor)
  - **Categorias** — cadastro de categorias
  - **Configurações** — parâmetros gerais da plataforma

#### 🔜 A implementar

- Conteúdo de cada módulo listado acima (cada página será implementada em separado).

---

## 7. Modelagem de Dados (Simplificada)

### users

```
id
name
email
role (admin | gestor | cliente)
created_at
```

---

### boats

```
id
owner_id
name
type
capacity
location
price_per_day
description
created_at
```

---

### boat_images

```
id
boat_id
url
```

---

### reservations

```
id
boat_id
user_id
start_date
end_date
status
total_price
created_at
```

---

### reviews

```
id
boat_id
user_id
rating (1-5)
comment
created_at
```

---

## 8. Regras de Negócio

- Apenas usuários com reserva concluída podem avaliar
- Cancelamentos devem respeitar política definida
- Um usuário pode ter múltiplas reservas
- Um barco pode ter múltiplas avaliações

### Taxa de cobrança da plataforma

A taxa cobrada pela Boatzy em cima de cada aluguel segue a seguinte prioridade:

1. **Taxa específica do usuário** (`usuario_taxa`) — se existir, estiver ativa (`ativo = true`) e dentro da validade (`data_validade IS NULL` ou `data_validade >= hoje`), essa taxa prevalece.
2. **Taxa geral da plataforma** (`taxa_plataforma`) — aplicada quando não há taxa específica vigente para o usuário.

A taxa padrão configurada inicialmente é **10%**. Admins podem alterá-la a qualquer momento.

> **Implementação:** ao calcular o valor de uma reserva, backend e frontend **devem** chamar a função PostgreSQL `public.get_taxa_usuario(user_id uuid)`, que já encapsula toda essa lógica de fallback e validade. Nunca hardcode a taxa — sempre consulte via essa função.

---

## 9. Fluxos Principais

### Fluxo de Reserva

1. Usuário busca embarcação  
2. Seleciona datas  
3. Visualiza preço  
4. Confirma pagamento  
5. Reserva é criada  

---

### Fluxo de Cadastro de Barco

1. Owner acessa dashboard  
2. Preenche dados  
3. Faz upload de imagens  
4. Publica embarcação  

---

### Fluxo de Avaliação

1. Reserva finalizada  
2. Usuário recebe prompt  
3. Avalia embarcação  
4. Review é publicada  

---

## 10. Métricas de Sucesso (MVP)

- Nº de embarcações cadastradas
- Nº de reservas realizadas
- Taxa de conversão
- Ticket médio
- Nº de avaliações

---

## 11. Não Incluído no MVP

- Chat em tempo real
- Seguro integrado
- Sistema de assinatura
- App mobile nativo
- Inteligência de recomendação

---

## 12. Roadmap Pós-MVP

- Multi-idioma no site (pt-BR principal, en-US, es) — planejado em 03/07/2026, em backlog: next-intl com cookie (sem prefixo de URL), seletor no Header, UI traduzida + dicionário de catálogos fixos; conteúdo do gestor, páginas legais e painel fora do escopo. Detalhes no board do ClickUp (módulo "13 - Internacionalização").
- Chat entre usuário e dono
- Sistema de favoritos
- Experiências personalizadas
- Seguro para locação
- App mobile (React Native)
- Sistema de reputação avançado

---

## 13. Riscos

- Baixa oferta inicial (marketplace vazio)
- Complexidade regulatória
- Dependência de gateways de pagamento
- Sazonalidade do mercado

---

## 14. Hipóteses a Validar

- Usuários querem alugar embarcações via app
- Donos querem monetizar seus barcos
- Modelo de comissão é sustentável
- Existe recorrência de uso

---

## 15. Definição de MVP Validado

O MVP será considerado validado quando:

- ≥ 50 embarcações cadastradas  
- ≥ 100 reservas realizadas  
- ≥ 10 avaliações reais  
- Receita recorrente iniciada  
