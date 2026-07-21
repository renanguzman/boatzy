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
- ✅ Cadastro por e-mail coleta **celular** (seletor de país com DDI + bandeira e máscara por país; padrão Brasil +55), **CPF** (máscara `000.000.000-00` + validação de dígitos verificadores) e exige **senha forte** com checklist de requisitos que marca cada regra em tempo real (≥8 caracteres, maiúscula, minúscula, número, caractere especial). Esses campos aparecem apenas no cadastro por e-mail — o fluxo SSO permanece inalterado; celular/CPF ficam `NULL` para contas SSO até serem completados em "Minha conta". Detalhes técnicos no `SPEC.md`.
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

#### ✅ Implementado — Busca por embarcação em duas etapas (lista de embarcações → roteiros da embarcação)

- A aba **Embarcações** volta a listar **embarcações** (com foto) como primeiro resultado — não roteiros. O usuário escolhe local, data, pessoas e opcionalmente o **tipo** de embarcação (`TipoEmbarcacaoPicker`); a busca (RPC `buscar_embarcacoes`, migration `20260718`, parâmetro `p_tipo_id`) retorna as embarcações que atendem o critério **e que têm ao menos um roteiro ativo vinculado** (senão o clique não teria roteiro para mostrar).
- **Só ao clicar em uma embarcação** da lista é que o cliente vai para a página própria
  `/embarcacoes/[id]/roteiros` (ver 6.4), que mostra a embarcação em detalhe e, abaixo, **todos os
  roteiros ativos que ela realiza** — sem reaplicar local/data/pessoas (esses já serviram para achar
  a embarcação certa) e sem paginação (mostra todos, num carrossel).
- O seletor `TipoEmbarcacaoPicker` lista apenas tipos com pelo menos um roteiro ativo vinculado (mesma filosofia do autocomplete de locais).
- Em `/buscar`: chip removível "Tipo: \<nome\>", título contextualizado ("Embarcações com Lancha em …"), grid com `EmbarcacaoCard` (foto, tipo, localidade, capacidade, avaliação/favorito) — o card leva para `/embarcacoes/[id]/roteiros`, preservando os filtros atuais para o botão "voltar" daquela página.
- A rota `/embarcacoes` (listagem) **redireciona** para `/buscar?tipo=embarcacao` preservando os filtros compatíveis, caindo na etapa "lista de embarcações". O detalhe `/embarcacoes/[id]` (reserva direta da embarcação) **permanece ativo** (acessível por link direto), apenas sem entrada pela busca.
- A aba **Roteiros** (padrão) não muda: continua retornando roteiros diretamente via `buscar_roteiros`.

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
- ✅ Botão **"Converse com o dono"** na sidebar (oculto para o próprio dono vendo seu roteiro) → `/roteiros/[id]/chat`, que abre o chat da plataforma com o gestor do roteiro (ver 6.8 → Chat).

#### ✅ Implementado — Modal de Fotos da Embarcação (`EmbarcacaoFotosModal`)

- Trigger: nome da embarcação como link estilizado (underline pontilhado + ícone câmera com contagem + ExternalLink no hover).
- Modal: backdrop escuro + blur, painel `max-w-4xl`, header gradiente navy.
- Navegação: setas ◀ ▶, teclado (ESC fecha, ← → navega), contador "N / total".
- Thumbnails: strip no rodapé com ring cyan no ativo.
- Footer de especificações: capacidade, comprimento, cabines, tripulação, modalidade do capitão.

#### ✅ Implementado (v1) — Página `/embarcacoes/[id]/roteiros`

- Destino do card da embarcação na busca (aba Embarcações, ver 6.3): mostra a embarcação em
  detalhe — galeria de fotos, badges (tipo/categoria), descrição, especificações técnicas
  (capacidade, comprimento, cabines, suítes, banheiros, tripulação) e comodidades a bordo — no mesmo
  visual da página de detalhe da embarcação (`/embarcacoes/[id]`).
- Abaixo, um **carrossel** com todos os **roteiros ativos** que aquela embarcação realiza (setas de
  navegação; roteiros inativos nunca aparecem). Clicar num roteiro do carrossel leva ao detalhe
  normal (`/roteiros/[id]`).
- Botão "voltar" (na galeria) retorna à busca com os filtros originais (local/data/pessoas/tipo).
- Primeira versão — mapa de localização, avaliações e favoritar a embarcação nesta tela ficam para
  uma refinada seguinte, a pedido do usuário.

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
- `/minha-conta`: o cliente vê seus dados (avatar, nome, e-mail, "cliente desde", provedores de login vinculados) e **edita** nome, CPF (máscara + validação), celular (seletor de país + máscara) e **data de nascimento** (campo opcional, tipo data, sem restrição de idade — só valida que a data existe e não é futura). Tem também a seção **"Meu endereço"** (totalmente opcional): CEP, estado, município, bairro, logradouro, número e complemento — ao preencher o CEP os demais campos são autopreenchidos via ViaCEP (mesma lógica do cadastro de roteiro). Tem também a seção **"Notificações"** com o toggle **"Receber e-mail de notificação de novas conversas"** (padrão habilitado). Quando ativo, o usuário recebe **um e-mail agrupado** avisando de mensagens de chat não lidas — nunca um e-mail por mensagem: um job (Vercel Cron, a cada 5 min) aplica uma **janela anti-bombardeio** (envia após ~5 min sem novas mensagens, no máximo ~30 min) e junta tudo num único aviso via Resend. Detalhes: SPEC §21.4c. Também **altera a senha** — mas **apenas para contas criadas por e-mail** (exige a senha atual + nova senha forte com checklist); contas somente-SSO veem um aviso de que a senha é gerenciada pelo provedor. Detalhes: SPEC §20.6 / §Minha conta.

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
- ✅ Botão **"Converse com o dono"** na sidebar `EmbarcacaoBookingCard` (oculto para o próprio dono
  vendo sua embarcação) → `/embarcacoes/[id]/chat`, que abre o chat da plataforma com o dono da
  embarcação (ver 6.8 → Chat).

#### ✅ Implementado — Bloqueio automático de datas com reserva confirmada

- Uma embarcação pode realizar vários roteiros e também pode ser reservada diretamente — a partir
  de agora, uma reserva **confirmada** em qualquer um desses caminhos bloqueia a mesma data em
  **todos os outros**: nos demais roteiros que usam aquela embarcação, na reserva direta da
  embarcação e no próprio roteiro que gerou a reserva. A checagem é sempre pela embarcação (o
  recurso realmente compartilhado), não apenas pelo roteiro isolado.
- Só reserva **confirmada** bloqueia — solicitações **pendentes** continuam podendo coexistir
  livremente até o gestor decidir qual confirmar.
- O calendário de `/roteiros/[id]` e `/embarcacoes/[id]` já nasce refletindo isso (datas somem do
  seletor, junto dos bloqueios manuais do gestor); tentar solicitar ou confirmar uma reserva numa
  data já tomada é recusado com uma mensagem clara.
- No painel, ao abrir uma solicitação pendente cuja data já foi tomada por outra reserva
  confirmada, um aviso destacado avisa o gestor antes de ele tentar confirmar — a decisão de
  recusar continua manual, nada é feito automaticamente.
- Detalhes técnicos: `SPEC.md` §15-B → "Bloqueio por reserva confirmada".

**Próximos passos:** refinamentos do calendário (filtros por tipo/status); pagamento (Stripe).

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
- Só avaliações **aprovadas pelo admin** aparecem nesses pontos (ver 6.11) — uma avaliação recém-enviada fica com o selo "Aguardando aprovação" em `/minhas-reservas` até a moderação.

#### ✅ Implementado — Home: "Embarcações Mais Bem Avaliadas" (dinâmica)

- A seção da home deixou de usar mock: exibe as **4 embarcações mais bem avaliadas**, com todos os dados do card vindos do banco (imagem principal, tipo, nome, cidade/UF, `★ média (total)`, preço base/dia e capacidade).
- Como a avaliação é do **roteiro** (não da embarcação em si), as notas são agregadas por embarcação via `avaliacao.embarcacao_id` (copiado da reserva).
- **Ranking:** média bayesiana (fórmula IMDb) — quanto **mais avaliações** e **maior a nota**, melhor posicionada; uma única nota 5 não vence uma 4.8 com dezenas de avaliações.
- **Com localização do usuário** (permissão de geolocalização já concedida no navegador): mostra as mais bem avaliadas num raio de 100 km, completando com o topo da plataforma se a região não preencher as 4. **Sem localização:** topo da plataforma inteira. A home **não dispara** o prompt de permissão.
- **"Ver Todas"** → `/buscar?tipo=embarcacao` (busca com a aba Embarcações selecionada).
- O **coração do card** favorita/desfavorita a embarcação (ver 6.9); sem nenhuma embarcação avaliada, a seção não aparece.
- Detalhes técnicos: SPEC §18.9.

#### ✅ Implementado — Home: "Roteiros Mais Bem Avaliados" (dinâmica)

- A antiga seção "Featured Charters" virou **"Roteiros Mais Bem Avaliados"** (eyebrow "Roteiros Selecionados") e deixou de usar mock: exibe os **3 roteiros mais bem avaliados**, com o mesmo card da busca (imagem principal, tipo da embarcação, pessoas, duração, nome, cidade/UF, preço/dia e `★ média (total)`).
- **Mesmas regras da seção de embarcações:** ranking por média bayesiana (mais avaliações + maior nota); com localização do usuário (permissão já concedida) mostra os melhores num raio de 100 km, completando com o topo da plataforma; sem localização, plataforma inteira; sem nenhum roteiro avaliado, a seção não aparece.
- O **coração do card** favorita/desfavorita o roteiro (função já existente — ver 6.9).
- **"Ver Mais"** → `/buscar` (busca de roteiros).
- Detalhes técnicos: SPEC §18.9.

#### ✅ Implementado — Moderação pelo admin

- Toda avaliação nasce com status `pendente` e só é exibida publicamente depois de **aprovada** em `/administrator/avaliacoes`. Detalhes em 6.11.

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
- ✅ **Entrada direta pelo detalhe de embarcação/roteiro:** o botão **"Converse com o dono"** em `/embarcacoes/[id]` e `/roteiros/[id]` (oculto para o próprio dono) abre `.../chat`, que exige login (deslogado → `/entrar?redirect_to=...`, retornando ao chat após autenticar) e, uma vez logado, garante a conversa com o dono e já registra a origem (`embarcacao` ou `roteiro`) exibida no cabeçalho da conversa — mesmo padrão usado em "Conversar com o vendedor" (vendas) e "Conversar com o gestor" (reservas).
- ✅ **Aviso "converse pela plataforma" (lado cliente):** a primeira vez que o cliente abre qualquer conversa pelo site, um modal bloqueante pede confirmação de ciência ("Estou ciente") de que toda a tratativa deve ocorrer pelo chat da Boatzy e de que a plataforma **não se responsabiliza** por combinações feitas por outros meios (WhatsApp, telefone, e-mail, redes sociais). A confirmação fica registrada com data/hora na conta do cliente e não é pedida de novo. Exclusivo do lado cliente — o gestor não vê esse aviso no painel.
- ✅ **Mascaramento automático de telefone no chat:** qualquer mensagem (de cliente ou de gestor) que contenha um número em formato de telefone tem os dígitos ocultados automaticamente (ex.: `(11) 91234-5678` vira `(**) *****-****`) antes de ser salva — dificulta a combinação de continuar a negociação fora da plataforma. Aplica-se aos dois lados da conversa.
- Detalhes técnicos em `SPEC.md` §21.6 e §21.7.

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
- **Embarcação:** a disponibilidade também é refletida no calendário público (`EmbarcacaoBookingCard`, mesmo comportamento do roteiro). Detalhes técnicos em `SPEC.md` §15-B.

#### ✅ Implementado — Tutorial guiado do painel

- Na **primeira entrada** do gestor em `/painel`, um tutorial guiado abre automaticamente em overlay
  escurecido, destacando um elemento por vez (spotlight).
- Sequência de 12 passos: boas-vindas → **destaque da área de conteúdo do Dashboard** (quais
  informações ele encontra ali) → **cada item do menu lateral** com uma breve descrição
  (Dashboard, Agendamentos, Embarcações, Roteiros, Catálogo, Clientes, Receitas) → indução ao
  caminho inicial: **1) cadastrar uma embarcação** (botão que leva a `/painel/embarcacoes/novo`),
  **2) criar um roteiro** (botão que leva a `/painel/roteiros/novo`) → onde reabrir o tutorial.
- Cada passo mostra **"Passo X de N"** com barra de progresso e os botões **Próximo/Concluir**,
  **Voltar** e **Pular tutorial** (além do `X` e da tecla `Esc`).
- Um ícone (capelo) no **header, ao lado do sino de notificações**, reabre o tutorial a qualquer momento e
  exibe o tooltip **"Ver tutorial"** ao passar o mouse.
- O tutorial só abre sozinho uma vez: a conclusão/pulo é registrada no `localStorage` do navegador.
  Detalhes técnicos em `SPEC.md` §28.

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

#### ✅ Implementado — Favoritos de embarcação (migration 20260709)

- O coração dos **cards de embarcação** (home "Embarcações Mais Bem Avaliadas") favorita/desfavorita a embarcação para o usuário logado (toggle otimista).
- **Deslogado:** o clique leva a `/entrar` e, após o login, o favorito é **concluído automaticamente** ao voltar à página (parâmetro `fav_emb` no retorno).
- `/favoritos` passou a listar **roteiros e embarcações** (seções separadas quando há os dois tipos), cada item com "Remover dos favoritos". Embarcações desativadas não aparecem.
- Um favorito por par usuário↔embarcação. Detalhes técnicos: SPEC §23.5.

#### ✅ Implementado — Compartilhar roteiro

- O botão **Compartilhar** no detalhe do roteiro abre um menu com **WhatsApp**, **Facebook**, **Instagram** e **Copiar link**.
- WhatsApp e Facebook usam os endpoints web oficiais de compartilhamento (`wa.me` e `facebook.com/sharer`). O Instagram **não possui** endpoint web de compartilhamento por URL: a opção copia o link (para colar no story/direct) e abre o Instagram.

#### ✅ Implementado — Cadastro rápido de item de catálogo dentro do formulário de roteiro

- Na seção **Catálogo** do cadastro (`/painel/roteiros/novo`) e da edição (`/painel/roteiros/[id]/editar`, também usada em `/administrator/roteiros/[id]/editar`), o gestor tem um botão **"Cadastrar novo item"**.
- O botão abre um modal na própria página com descrição, tipo (produto/serviço) e valor. Ao salvar, o item é criado no catálogo do gestor e **aparece imediatamente na listagem, já selecionado** para o roteiro.
- O gestor **não sai da página nem precisa dar refresh**: nenhuma informação já preenchida do roteiro (fotos, regras de preço, disponibilidade, endereço) é perdida.
- O botão também aparece no estado vazio (gestor sem nenhum item de catálogo), substituindo o antigo link para `/painel/catalogo`.
- Detalhes técnicos: SPEC §26.

#### ✅ Implementado — Capacidade do roteiro herdada da embarcação

- No cadastro e na edição de roteiro, ao selecionar a **Embarcação vinculada**, o campo **Capacidade máxima** é preenchido automaticamente com a capacidade cadastrada naquela embarcação.
- O valor continua editável: o gestor pode ajustá-lo manualmente depois (ex.: roteiro que opera abaixo da lotação da embarcação).
- Se a embarcação não tem capacidade cadastrada, ou se o gestor escolhe "Sem vínculo", o campo mantém o valor atual em vez de ser limpo.
- Abrir a edição de um roteiro existente **não** sobrescreve a capacidade já salva — o preenchimento só ocorre quando o gestor troca a embarcação.
- Detalhes técnicos: SPEC §27.

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
- Menu com os módulos previstos:
  - **Avaliações** — ✅ implementado (ver abaixo)
  - **Embarcações** — ✅ implementado (ver abaixo)
  - **Roteiros** — ✅ implementado (ver abaixo)
  - **Publicidade** — 🔜 gestão de espaços de publicidade (placeholder)
  - **Taxas** — 🔜 taxas gerais do sistema (percentual da plataforma × repasse ao gestor) (placeholder)
  - **Categorias** — 🔜 cadastro de categorias (placeholder)
  - **Configurações** — 🔜 parâmetros gerais da plataforma (placeholder)

#### ✅ Implementado — Gestão de Avaliações (`/administrator/avaliacoes`)

- Lista geral de **todas** as avaliações da plataforma (qualquer cliente, roteiro ou embarcação), com busca (com debounce), ordenação por coluna e **paginação no servidor** (10/25/50 registros por página, padrão 10) — apenas a página atual é carregada do banco.
- Busca por cliente (nome/e-mail), roteiro, embarcação ou comentário; ordenação disponível nas colunas Data, Nota e Status.
- Cada linha mostra: data, cliente (nome + e-mail), vínculo (roteiro ou embarcação avaliado, com o nome), nota em estrelas, comentário e status (Pendente/Aprovada).
- Ações por avaliação:
  - **Aprovar** — só quando pendente; passa a aparecer nas páginas públicas do roteiro/embarcação e no card da busca.
  - **Editar** — altera nota e/ou comentário.
  - **Excluir** — remove definitivamente (é também a forma de "reprovar": não existe estado separado de reprovada).
- Toda avaliação enviada pelo cliente nasce **pendente**; só fica pública depois de aprovada aqui. Não há SLA nem notificação de moderação — decisão de escopo desta primeira versão.

#### ✅ Implementado — Gestão de Embarcações (`/administrator/embarcacoes`)

- Lista geral de **todas** as embarcações da plataforma (de todos os gestores), no mesmo padrão visual da lista do `/painel`, com busca, ordenação por coluna e **paginação no servidor** (10/25/50 por página, padrão 10) — apenas a página atual é carregada do banco, para suportar grande volume de registros.
- Busca (com debounce) por nome da embarcação ou gestor (nome/e-mail); ordenação disponível nas colunas Embarcação, Status e Capacidade.
- Cada linha mostra: foto + nome + ID curto, **gestor responsável (nome + e-mail)**, tipo, categoria, status (toggle Ativo/Inativo), localização (município/UF) e capacidade.
- Ações por embarcação:
  - **Ativar/Desativar** — toggle direto na lista; desativar exige confirmação e mostra os roteiros vinculados, que ficam inativos em cascata (reativar reativa os roteiros — mesmo comportamento do painel do gestor).
  - **Editar** — abre `/administrator/embarcacoes/[id]/editar`, reutilizando o formulário completo de edição do painel (dados, endereço/mapa, comodidades, fotos, regras de preço e disponibilidade). A página mostra o gestor responsável no cabeçalho.
- O admin pode editar qualquer embarcação, independentemente do dono; gestores continuam restritos às próprias (a verificação de posse das server actions passa a abrir exceção para a role `admin`).
- Não há criação nem exclusão de embarcação pelo admin nesta versão — cadastro continua sendo feito pelo gestor no `/painel`.

#### ✅ Implementado — Gestão de Roteiros (`/administrator/roteiros`)

- Mesma lógica do módulo de Embarcações, adaptada a roteiros: lista geral de **todos** os roteiros da plataforma (de todos os gestores), com busca, ordenação por coluna e **paginação no servidor** (10/25/50 por página, padrão 10) — apenas a página atual é carregada do banco.
- Busca (com debounce) por nome, origem, destino ou gestor (nome/e-mail); ordenação disponível nas colunas Roteiro, Duração, Pessoas e Status.
- Cada linha mostra: foto + nome + origem→destino, **gestor responsável (nome + e-mail)**, embarcação vinculada, localização (município/UF), duração, quantidade de pessoas e status (toggle Ativo/Inativo).
- Ações por roteiro:
  - **Ativar/Desativar** — toggle direto na lista, sem confirmação (roteiro é folha, não há cascata).
  - **Editar** — abre `/administrator/roteiros/[id]/editar`, reutilizando o formulário completo de edição do painel (dados, embarcação, endereço/mapa, catálogo de opcionais, fotos, regras de preço e disponibilidade). Os selects de embarcação e catálogo listam os itens **do gestor dono do roteiro** (não do admin). A página mostra o gestor responsável no cabeçalho.
- O admin pode editar qualquer roteiro, independentemente do dono; gestores continuam restritos aos próprios (mesma exceção de role `admin` nas server actions).
- Não há criação nem exclusão de roteiro pelo admin nesta versão — cadastro continua sendo feito pelo gestor no `/painel`.
- Novo item **ROTEIROS** no menu lateral do admin.

#### 🔜 A implementar

- Conteúdo dos demais módulos (Publicidade, Taxas, Categorias, Configurações), cada um em separado.

---

### 6.12 Vendas de Embarcações (novo vertical)

Além do aluguel, o gestor poderá **anunciar embarcações para venda**; o site ganha a busca
"Vendas" (3ª aba), páginas próprias de resultados e detalhes, e o painel ganha o cadastro de
anúncios e um **funil de vendas** com os leads gerados pelas interações dos usuários
(visualizou → revelou contato → favoritou → compartilhou → conversou). Plano completo e
decisões de escopo: `docs/planejamento-vendas.md`.

**Regras de produto centrais:**
- O anúncio **aproveita a embarcação já cadastrada** (fotos, ficha técnica, categoria,
  localização); o gestor só acrescenta fabricante, ano do modelo, ano de fabricação e valor.
- Um anúncio vigente por embarcação; ciclo de vida: ativo → pausado (temporário) →
  vendido/cancelado (encerram e liberam a embarcação para novo anúncio; sem exclusão).
- **Histórico de preço:** reduções são exibidas ao comprador (selo "Preço reduzido" com valor
  anterior); aumentos nunca aparecem.
- Detalhes do anúncio **exigem login**; dados do vendedor ficam ocultos até o clique em
  "Revelar contato". Visualização anônima conta apenas no contador de visualizações.
- Favoritar, compartilhar e conversar com o vendedor (chat existente) geram eventos que
  esquentam o lead no funil do gestor.

**Status por fase:**
- ✅ **Fase 1 — Fundação de dados** (migrations `20260712_vendas` + `20260713_vendas_rpcs`):
  tabelas `anuncio_venda`, `anuncio_venda_preco` (histórico), `anuncio_venda_interacao`
  (eventos do funil), favorito de anúncio, RLS completa e 4 RPCs (`buscar_anuncios_venda`,
  `registrar_visualizacao_anuncio`, `vendas_locais`, `vendas_funil`). Cadeia validada em
  Postgres local com smoke test (constraints, RPCs e RLS). Detalhes: SPEC §29.
- ✅ **Fase 2 — Painel: cadastro de anúncios** (`/painel/vendas`): novo item **VENDAS** no menu
  lateral (com passo no tutorial guiado); grid de anúncios (busca, ordenação, paginação) com
  foto/nome da embarcação, fabricante, ano modelo/fabricação, preço, **visualizações**, **leads**
  e status; toggle **Ativo/Pausado** direto no grid + ações **Marcar como vendido** e **Cancelar
  anúncio** (com confirmação — são terminais e liberam a embarcação para novo anúncio);
  cadastro (`/painel/vendas/novo`) aproveitando embarcação ativa sem anúncio vigente (card-resumo
  com os dados herdados) + campos da venda (fabricante*, anos*, valor*, detalhes); se a embarcação
  não tem categoria, o form exige e grava na embarcação; edição com **histórico de preço**
  (data, valor, variação %) — alterar o valor grava novo registro no histórico. Detalhes: SPEC §29.5.
- ✅ **Fase 3 — Site: busca e resultados de Vendas:** o toggle da busca (Hero e barras compactas)
  ganhou a 3ª aba **Vendas**, com filtros próprios: **Tipo** de embarcação (obrigatório — Lancha,
  Iate, Jet Ski…; sem ele o botão Buscar abre o seletor), **Localidade** (Estado → carrega as
  cidades do estado; cidade opcional, "Todo o estado" disponível), **Ano do modelo** (faixa
  de/até) e **Valor** (faixa min/máx) — tipo e localidade só ofertam opções **com anúncio ativo**.
  > **Correção (13/07/2026):** o filtro primário era Categoria (Passeio/Pesca/Luxo — orientada a
  > passeio, fazia a busca parecer venda de passeio) e passou a ser o **Tipo** da embarcação, que
  > é o classificador correto para venda; ajustado em toda a cadeia (busca, cadastro, cards,
  > detalhe). A categoria da embarcação segue intacta nos contextos de aluguel.
  Resultado em página própria
  `/vendas` (não `/buscar`): barra compacta com os mesmos filtros, chips removíveis, título
  contextual, grid responsivo 1→2→3→4 de cards com selo **"Preço reduzido"** (preço anterior
  riscado) quando o valor caiu, e paginação server-side (24/página) via RPC
  `buscar_anuncios_venda`. Alternar de/para a aba Vendas descarta os filtros da outra aba (domínios
  diferentes). Detalhes: SPEC §29.6.
- ✅ **Fase 4 — Site: detalhe do anúncio (`/vendas/[id]`):**
  - **Gate de login:** deslogado vê só o teaser (galeria, nome, categoria, preço + selo de
    redução) com CTA "Entrar ou criar conta"; a visualização anônima conta no contador, mas não
    gera lead. Logado vê tudo e registra o evento `visualizou` (estágio 1 — idempotente).
  - **Conteúdo completo:** ficha técnica (fabricante, anos, capacidade, comprimento, cabines,
    suítes, banheiros, tripulação), "Sobre esta venda" + descrição da embarcação, comodidades,
    localização (mapa + bairro/cidade — endereço exato não é exposto), avaliações da embarcação
    e preço com "De R$ X por R$ Y · reduzido em DD/MM" (aumentos nunca aparecem).
  - **Vendedor oculto:** nome mascarado ("R***** G*****") no HTML; o botão **"Revelar contato"**
    busca nome/e-mail via server action autenticada e registra `revelou_contato` (estágio 2).
  - **Favoritar** (card da busca, detalhe e `/favoritos`, com auto-favorito pós-login) registra
    `favoritou` (estágio 3; desfavoritar não remove o evento); **Compartilhar** (WhatsApp/
    Facebook/Instagram/Copiar link) registra `compartilhou` (estágio 4); **"Conversar com o
    vendedor"** abre o chat da plataforma em `/vendas/[id]/chat` (conversa gestor↔cliente
    existente, mensagem pré-preenchida citando o anúncio) e registra `conversou` (estágio 5).
  - O **dono** vendo o próprio anúncio não gera eventos (não é lead) e vê atalho para o painel.
  - Detalhes: SPEC §29.7.
- ✅ **Fase 5 — Painel: funil de vendas (`/painel/vendas/funil`):** visão CRM dos leads de todos
  os anúncios do gestor (com **filtro por anúncio**, pré-selecionável via ação "Funil" no grid —
  disponível inclusive para anúncios encerrados, cujos leads ficam preservados). **Kanban de 5
  colunas** (Visitante → Interessado → Engajado → Promotor → Em negociação); o lead aparece na
  coluna do seu estágio mais quente, com avatar, nome, anúncio de interesse, badges das
  interações, tempo da última interação e **atalho para o chat** com o cliente. Cabeçalho com
  métricas reativas ao filtro: visualizações, leads no funil, em negociação e conversão
  visualização→conversa. Dashboard (`/painel`) ganhou o card **"Anúncios de venda"** (ativos +
  leads no funil) linkando para o funil; botão "Funil de vendas" também no topo de
  `/painel/vendas`. Sem drag-and-drop nesta versão (estágio é derivado dos eventos); realtime é
  refinamento futuro. Detalhes: SPEC §29.8.
- 🔜 **Fase 6 — Encerramento:** testes manuais dos fluxos ponta a ponta em produção
  (deslogado→login→lead; redução de preço; pausar/vender/cancelar; funil refletindo interações).

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
