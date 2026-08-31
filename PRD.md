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

### 6.0 Cabeçalho / Navegação Global

- ✅ O `Header` (site público, desktop e mobile) tem 3 links de navegação: **Roteiros** (`/buscar`), **Embarcações** (`/buscar?tipo=embarcacao`) e **Vendas** (`/vendas`). Substituem os antigos rótulos "Charters"/"Destinos"/"Experiências", que apontavam para rotas inexistentes (`/charters`, `/destinations`, `/experiences`).
- ✅ O `Footer`, bloco "Explorar", tem 4 links: **Roteiros** (`/buscar`), **Embarcações** (`/buscar?tipo=embarcacao`), **Vendas** (`/vendas`) e **Experiências** (`/experiencias`, ver 6.10).
- ✅ No `Header`, o antigo seletor de idioma ("PT") foi substituído pelo CTA **"Anuncie sua embarcação"** (ícone `Megaphone`, pill azul `#0B3D91`/10 com hover sólido), que leva a `/painel`. Presente tanto no desktop (ao lado do botão "Entrar") quanto no menu mobile (abaixo dos links de navegação).
- ✅ O botão **"Entrar"** do `Header` (usuário deslogado) oferece duas portas de acesso, bem visíveis: **"Entrar como Cliente"** (`/entrar`) e **"Entrar como Proprietário"** (`/painel`). No desktop é um dropdown (mesmo padrão visual do menu do usuário logado); no mobile são dois botões sempre visíveis (sem precisar abrir submenu) dentro do menu hambúrguer.

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

- Localização ✅
- Data ✅
- Preço ✅ (faixa mín./máx.)
- Capacidade ✅ (pessoas)
- Tipo de embarcação ✅
- Duração do passeio ✅ (faixa em horas)

Ordenação do resultado ✅: relevância (padrão), mais recentes, melhor avaliação, preço (menor/maior), duração (menor/maior).

Visualização:

- Lista ✅
- Mapa (Google Maps) ✅ — abaixo da lista, plotando os resultados da página atual

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

#### ✅ Implementado — Filtro de comodidades (busca de embarcações)

- Na aba **Embarcações** de `/buscar`, novo botão **"Comodidades"** ao lado de "Filtros" (preço/duração), com badge mostrando quantas estão selecionadas.
- Abre um painel com **busca embutida** (digitar filtra a lista na hora) e a lista de comodidades em **grid de 2 colunas com rolagem interna** — pensado para as ~25 comodidades cadastradas (lista extensa) sem virar um popover gigante nem quebrar no celular.
- A embarcação só aparece se tiver **todas** as comodidades marcadas (não basta ter uma). Chip removível "Comodidades: N" na barra de filtros; o filtro é preservado ao trocar local/data/pessoas.
- Só existe na aba Embarcações — comodidade é um atributo da embarcação, não do roteiro.
- Detalhes técnicos: SPEC §31.

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

#### ✅ Implementado — Filtros de preço/duração e ordenação dos resultados (10/08/2026)

Vale nas **duas abas** de `/buscar` (Roteiros e Embarcações), sempre resolvido no banco (paginação continua server-side).

- **Painel "Filtros"** (o botão que existia e não fazia nada agora abre de fato), com badge da quantidade de filtros ativos:
  - **Faixa de preço** — mínimo e máximo em R$, sobre o mesmo preço exibido no card. Item sem preço cadastrado não aparece quando a faixa está ativa.
  - **Duração do passeio** — faixas prontas (Até 3 horas, 3 a 6 horas, 6 a 12 horas, Dia inteiro, Mais de 1 dia) ou mínimo/máximo em horas. Na aba Embarcações, a embarcação aparece se **algum roteiro ativo dela** estiver na faixa.
  - Faixa invertida (mínimo > máximo) é corrigida automaticamente ao aplicar.
- **Ordenar por** (select ao lado da contagem de resultados): **Relevância** (padrão — mais próximos quando há localização, senão mais recentes), **Mais recentes**, **Melhor avaliação**, **Menor preço**, **Maior preço**, **Menor duração**, **Maior duração**.
  - "Melhor avaliação" usa a mesma média bayesiana das seções "Mais Bem Avaliados" da home (muitas notas boas vencem uma única nota 5); itens sem avaliação vão para o fim da lista, nunca são escondidos.
  - Na aba Embarcações, a ordenação por duração usa a **menor** duração entre os roteiros ativos da embarcação.
- Os filtros e a ordenação viram **chips removíveis** e ficam na URL (link compartilhável), sobrevivem a uma nova busca e à troca de aba. Quando zeram o resultado, o estado vazio oferece **"Limpar preço e duração"**.
- **Impacto no cadastro:** o campo "Duração" do roteiro (painel e admin) deixou de ser texto livre e passou a ser **número + unidade** (Horas/Dias) — é o que torna o filtro e a ordenação por duração possíveis. O rótulo exibido nos cards ("4 horas", "2 dias") passa a ser gerado a partir desse par. Roteiros já cadastrados tiveram a duração convertida automaticamente; os poucos cujo texto não tinha número reconhecível ficam sem duração e só não aparecem quando o filtro de duração está ativo. Detalhes técnicos em `SPEC.md` §18.3/§18.3-A/§18.6.

#### ✅ Implementado — Mapa dos resultados na busca (10/08/2026)

- No rodapé de `/buscar` (abaixo da paginação), nas **duas abas**, um mapa do Google mostra os resultados **da página atual** — o mapa acompanha filtros, ordenação e paginação.
- **Ao passar o mouse** sobre um ponto, abre um cartão com foto, nome, embarcação (nos roteiros) ou tipo (nas embarcações), cidade/UF e preço; o cartão inteiro é um link para a página de detalhes — o mesmo destino do card do grid. Ele permanece aberto ao tirar o mouse (senão não daria para clicar) e fecha no X ou num clique no mapa.
- O mapa se enquadra automaticamente em todos os pontos. Itens **sem localização cadastrada** ficam de fora e o cabeçalho informa "X de Y com localização"; se nenhum resultado tiver coordenada, a seção nem aparece.
- Visual alinhado ao design system: moldura branca com borda suave, pinos no azul da marca e mapa sem poluição (sem pontos de interesse nem transporte).

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
- "Itinerário": timeline vertical com gradiente — partida, **paradas intermediárias cadastradas pelo gestor (0, 1 ou várias)** e chegada (ver "Paradas do itinerário do roteiro" abaixo).
- Reviews: seção placeholder.
- Sidebar `BookingCard`: seleção de data e pessoas, breakdown de preço com taxa de serviço (dinâmica — taxa geral da plataforma ou específica do gestor dono do roteiro, configuráveis em `/administrator/taxas`; ver 6.11), total estimado, botão "Solicitar Reserva" → `/reservas/novo`.
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
- Os **adicionais** (produtos/serviços do catálogo, quando o roteiro tem algum vinculado) são
  selecionados direto no `BookingCard`, num accordion fechado por padrão — entre o campo Pessoas e
  o resumo de preço — com título persuasivo, convidando ao clique: **"Deixe seu passeio
  inesquecível!"** (chamada) / **"Este roteiro tem N opcionais para você. Clique e confira!"**
  (subtítulo), trocando para **"Torne seu passeio inesquecível"** + contagem/valor selecionado
  assim que algo é marcado — visível mesmo com o accordion fechado. Cada item marcado entra na
  linha "Adicionais" do "Valor estimado" em tempo real. Os selecionados são registrados na
  solicitação.
- O detalhe do roteiro/embarcação **não mostra a taxa de serviço** — só "Diária" + "Adicionais" →
  "Valor estimado", com uma nota avisando que a taxa aparece na confirmação. A taxa (e o "Total
  estimado" já com ela somada) só é exibida em `/reservas/novo`, ao confirmar a solicitação.
- "Solicitar Reserva" leva a `/reservas/novo`, que **exige login** e mostra um resumo; ao confirmar,
  cria a reserva como **Pendente** com `cliente_id`, data/hora da solicitação e **snapshot** dos
  valores e adicionais.
- **Previsão do tempo:** acima dos dados da embarcação/roteiro, `/reservas/novo` mostra um card com
  a previsão meteorológica (via Open-Meteo, API gratuita) para a data e o local escolhidos —
  temperatura, sensação térmica, vento, chance/volume de chuva, índice UV, nascer/pôr do sol e uma
  previsão hora a hora, esta numa segunda camada expansível. O card **nasce colapsado** (só o
  resumo — ícone, temperatura, condição, data — fica visível) para não ocupar espaço logo no topo
  da página; um clique no cabeçalho expande os detalhes. Deixa claro, com destaque visual e link
  para a fonte, que é uma previsão sujeita a mudanças e que o Boatzy não se responsabiliza pela
  exatidão dela. Sem coordenadas cadastradas, a seção simplesmente não aparece; para datas muito
  distantes (> 16 dias, limite da previsão diária gratuita) ou falha na consulta, mostra um aviso
  neutro (também colapsável) no lugar — nunca impede a solicitação de reserva.
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

#### ✅ Implementado — Aplicação de cupom de desconto na reserva

- Em `/reservas/novo` (roteiro ou embarcação), o cliente pode informar um código de cupom antes
  de enviar a solicitação: campo + botão "Aplicar" que valida na hora (sem recarregar a página,
  como em qualquer e-commerce) e já mostra o desconto refletido no "Total estimado".
- Todas as regras do cupom (cadastradas no admin — ver 6.11) são checadas: cupom existe e está
  ativo, dentro da vigência, pedido mínimo atingido, limite de uso total e por cliente ainda
  disponíveis. Cada erro tem mensagem específica.
- O desconto sai da taxa de serviço da Boatzy (com piso R$0; se maior que a taxa, o excedente
  também abate do total) — o preço que o gestor cadastrou nunca é alterado por um cupom.
- **Segurança contra força bruta**: 5 tentativas de cupom malsucedidas seguidas (mesmo cliente)
  bloqueiam o campo por 15 minutos, com contagem regressiva visível. A validação final é sempre
  refeita no servidor no momento do envio — o que o cliente vê na pré-visualização nunca é
  aceito "de olhos fechados".
- O uso é registrado (rastreável, para eventual repasse a um parceiro) só quando a reserva é
  efetivamente solicitada, nunca durante a pré-visualização. Se o cupom deixar de valer entre a
  pré-visualização e o envio (ex.: limite esgotado por outro cliente nesse meio-tempo), a
  solicitação não é criada e o cliente é avisado.
- O desconto aplicado aparece tanto para o cliente ("Minhas reservas") quanto para o gestor
  (`/painel/agendamentos/[id]`).
- Detalhes técnicos: `SPEC.md` §20.8.

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

#### ✅ Implementado — Home: "Coleção de experiências" (ex-"Curation of Moments")

- Eyebrow "Inspire-se" mantida; título trocado de "Curation of Moments" para **"Coleção de experiências"**.
- A seção virou um **carrossel horizontal** (antes era um grid fixo de 4): mostra ~4 cards completos por vez em telas grandes, com uma fatia do próximo item à mostra indicando que há mais conteúdo, e setas de navegação (ocultas no mobile, onde a rolagem é por gesto de arrastar). Todos os cards agora são **passeios com página própria** (conteúdo editorial fixo, não mock) — clicáveis, levam a `/passeios/[slug]`. O mock antigo ("moments") não aparece mais na seção; o código continua preparado para completar slots vazios com ele automaticamente caso a lista de passeios fique com menos de 4 itens.
- **✅ Passeio 1 — Ilha do Campeche** (`/passeios/ilha-do-campeche`): artigo completo — "Descubra o 'Caribe Brasileiro': Roteiro Exclusivo de Barco para a Ilha do Campeche". Cobre o acesso tradicional (escunas/botes) vs. a experiência premium de lancha particular, os diferenciais do Boatzy, sugestões de atividades na ilha (snorkel, churrasco a bordo, trilhas guiadas) e dicas práticas (antecedência, vento, horário de saída), fechando com CTA para `/buscar`. Duas fotos reais da ilha (capa do card/hero + imagem no meio do artigo).
- **✅ Passeio 2 — Costa da Lagoa** (`/passeios/costa-da-lagoa`): artigo completo — "O Segredo da Costa da Lagoa: Navegando pelas Águas de Florianópolis". Cobre a travessia até a vila da Costa da Lagoa (acesso só por água), sugestões de restaurantes para ancorar (Cabral, Ponto 16, Coração de Mãe & Sabor da Costa), esportes aquáticos, a experiência de navegar com barco particular vs. baleeiras públicas e os mesmos diferenciais do Boatzy, fechando com CTA para `/buscar`. Duas fotos reais da Lagoa da Conceição (capa do card/hero + imagem no meio do artigo).
- **✅ Passeio 3 — Caixa D'Aço** (`/passeios/caixa-d-aco`): artigo completo — "O Destino Mais Badalado do Litoral: Roteiro Náutico para o Caixa D'Aço". Cobre a enseada de Porto Belo, os bares flutuantes (incluindo a curiosidade do clipe "Ai Se Eu Te Pego", do Michel Teló, gravado no local), a experiência VIP de chegar de lancha particular, dicas de ouro (saída cedo, ponto de ancoragem) e para quem é ideal (despedidas de solteiro, grupos), fechando com os mesmos diferenciais do Boatzy e CTA para `/buscar`. Três fotos reais da enseada (capa/hero + duas imagens no meio do artigo).
- **✅ Passeio 4 — Praia do Tinguá** (`/passeios/praia-do-tingua`): artigo completo — "O Refúgio Exclusivo dos Barcos: A Magia da Praia do Tinguá". Cobre a enseada de Governador Celso Ramos (acesso terrestre difícil, praticamente exclusiva para quem chega de barco), a proteção natural contra vento que deixa o mar "liso", gastronomia/estrutura à beira-mar e a experiência de ser Navegador, fechando com os mesmos diferenciais do Boatzy e CTA para `/buscar`. Duas fotos reais da enseada (capa/hero + imagem no meio do artigo).
- **✅ Passeio 5 — Praia e Ilha de Palmas** (`/passeios/praia-de-palmas`): artigo completo — "Águas de Padrão Internacional: Navegando pela Praia e Ilha de Palmas". Cobre a Ilha de Palmas em Governador Celso Ramos, o selo internacional "Bandeira Azul" já ostentado pela Praia de Palmas (mesma baía), a experiência de mergulho/snorkel como Navegador e os mesmos diferenciais do Boatzy, fechando com CTA para `/buscar`. Uma foto real da praia (capa/hero).
- Detalhes técnicos: SPEC §18.9.

#### ✅ Implementado — Home: barra de confiança (logo abaixo do hero)

- Os 4 selos passaram a ser os pontos de maior impacto de confiança **antes da busca**, alinhados 1:1 com 4 dos 6 cards de "Por que reservar com o Boatzy" (mesmos ícones): **Transparência no preço**, **Pagamento protegido**, **Cancelamento sem dor de cabeça**, **Calendário ao vivo**.
- Substituiu o conjunto anterior (Pagamento Seguro / Seguro Embarcação / Embarcações Verificadas / Seguro Completo), que tinha redundância interna (dois selos de "seguro/cobertura" quase idênticos) e repetia mensagem com a seção de benefícios mais abaixo.
- Detalhes técnicos: SPEC §18.9.

#### ✅ Implementado — Home: "Por que reservar com o Boatzy"

- Substituiu a antiga seção "Clube de Vantagens Boatzy" (assinatura fictícia, sem funcionalidade correspondente no produto).
- Grid de 6 diferenciais da plataforma, cada um com ícone, título e descrição curta: **Transparência no preço**, **Tudo sobre o barco em um só lugar**, **Calendário ao vivo**, **Personalize seu passeio**, **Cancelamento sem dor de cabeça** e **Pagamento protegido**.
- CTA **"Buscar embarcações"** → `/buscar`.
- Detalhes técnicos: SPEC §18.9.

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

#### ✅ Implementado — Paradas do itinerário do roteiro

- O roteiro continua tendo **Local de partida (origem)** e **Local de chegada (destino)**, mas agora o gestor pode cadastrar, entre os dois, **quantas paradas quiser** — nenhuma, uma ou várias — no cadastro (`/painel/roteiros/novo`) e na edição (`/painel/roteiros/[id]/editar`, também usada em `/administrator/roteiros/[id]/editar`).
- Novo bloco **"Paradas do itinerário"**, logo abaixo dos campos de partida/chegada: campo de texto + botão "Adicionar" inclui uma parada; cada parada da lista pode ser reordenada (mover para cima/baixo) ou removida.
- No site, a página do roteiro (`/roteiros/[id]`) exibe a seção **"Itinerário"** com a timeline completa: Saída → Parada 1 → Parada 2 → ... → Chegada, refletindo exatamente o que o gestor cadastrou.
- Detalhes técnicos: SPEC §30.

### 6.10 Páginas Institucionais / Legais

#### ✅ Implementado — Sobre Nós `/sobre`

- Página estática institucional acessível pelo item "Sobre Nós" no rodapé (antes apontava para `/about`, rota inexistente/404; corrigido para `/sobre`).
- Conteúdo editorial (não jurídico) em 6 blocos: Hero ("Tornar o mar acessível."), origem em Florianópolis, "Dois lados, uma plataforma" (cliente x proprietário), princípios ("O que nos guia": Simplicidade, Acesso, Confiança), plano de expansão nacional e chamada final com 2 CTAs ("Ver embarcações" → `/buscar`, "Quero anunciar" → `/painel`) e e-mail de contato institucional `adm@boatzy.app`.
- `export const metadata` com `title`/`description` fornecidos pelo usuário.
- **Ressalva do próprio texto-fonte, repassada aqui:** a afirmação de "pagamento protegido" no bloco de princípios ("Confiança") descreve a visão de produto — a integração de pagamentos (Stripe Connect, split automático) consta no roadmap (§6.6) mas **ainda não está implementada**. Revisar esse texto (ou adiantar a entrega da funcionalidade) antes de tratar a página como descrição 100% fiel do MVP atual.
- Detalhes técnicos: SPEC §18.8.

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

#### ✅ Implementado — Página de Contato `/contact`

- Página estática institucional acessível pelo item "Contato" no rodapé (já presente na home, sem link quebrado desde a criação da página).
- Formulário com **Nome**, **E-mail**, **Assunto** (select: Contato / Dúvidas / Elogio / Comercial / Financeiro / Outros), **Mensagem** (textarea) e verificador anti-spam (soma simples de dois números, gerada e validada no servidor — sem dependência de serviço externo de captcha).
- Envio via e-mail (Resend) para **gabriela@boatzy.app**, com `reply_to` = e-mail de quem preencheu (permite responder direto no e-mail recebido).
- Campo honeypot invisível adicional contra bots simples.
- Detalhes técnicos no `SPEC.md`.

#### ✅ Implementado — Central de Ajuda / FAQ `/help`

- Página estática acessível pelo item "Central de Ajuda" no rodapé (antes um link sem destino próprio).
- Hero no padrão das demais páginas institucionais + campo de **busca** (ícone de lupa, botão de limpar) que filtra em tempo real pergunta, resposta e categoria — sem chamada ao servidor, tudo client-side.
- **19 perguntas** organizadas em 8 categorias (Reservas, Pagamentos, Conta, Embarcações e proprietários, Busca e favoritos, Avaliações, Segurança e confiança, Vendas de embarcações), cada uma em um **accordion** (clique no título expande/recolhe a resposta, com ícone de seta que gira e transição suave). Conteúdo derivado das funcionalidades já implementadas do MVP (fluxo de reserva/cancelamento, status da reserva, ausência de pagamento integrado, cadastro/edição de conta, painel do gestor, favoritos, avaliações e moderação, papel de intermediário do Boatzy, vendas de embarcações).
- Estado vazio da busca ("Nenhuma pergunta encontrada") com sugestão de contato.
- CTA final "Fale conosco" → `/contact`.
- Detalhes técnicos: `SPEC.md` §18.8.

#### ✅ Implementado — Experiências `/experiencias`

- Página estática, estilo editorial/blog, acessível pelo item "Experiências" no rodapé (antes um link provisório `#`, sem página própria).
- Funciona como uma "chamada" (index) para os artigos já publicados em `/passeios/[slug]` — os mesmos 5 passeios exibidos no carrossel "Coleção de experiências" da home (`PASSEIOS_DESTAQUE`, `src/lib/passeios.ts`).
- Hero `#0B2447` com o mesmo tratamento visual da home ("Inspire-se" + título com gradiente ciano). Abaixo, o primeiro passeio aparece em destaque (card grande, imagem + título + resumo) e os demais em grade de cards (imagem, badge de localidade, título, resumo, "Ler experiência →"). Todo card é clicável e leva direto ao artigo completo em `/passeios/[slug]` — não há conteúdo próprio nesta página além das chamadas.
- CTA final "Buscar embarcações" → `/buscar`.
- Cada passeio (`Passeio` em `src/lib/passeios.ts`) ganhou os campos `resumo` (chamada curta, estilo dek de blog) e `local` (badge de cidade/UF exibido no card), usados só nesta página — o carrossel da home continua usando apenas `titulo`/`imagem`/`slug`.
- Detalhes técnicos: `SPEC.md` §18.8.

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
  - **Taxas** — ✅ implementado (ver abaixo)
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

#### ✅ Implementado — Gestão de Cupons (`/administrator/cupons`)

- Único módulo administrativo com **CRUD completo** (os demais só editam/ativam registros criados fora do admin): o admin cria, lista, busca, edita e exclui cupons de desconto. Lista com busca, ordenação por coluna e **paginação no servidor** (10/25/50 por página, padrão 10), no mesmo padrão dos outros módulos.
- Cada cupom tem: código único (sem espaços, normalizado em maiúsculas), descrição interna opcional, tipo de desconto (percentual ou valor fixo em R$), teto de desconto em R$ (só para percentual), valor mínimo do pedido para valer, vigência por data (início/fim opcionais — sem as duas datas, validade é indeterminada), limite de uso total e limite de uso por cliente (ambos opcionais — em branco, ilimitado), status ativo/pausado (independente da vigência por data) e vínculo opcional a um parceiro.
- **Parceiro**: como o cadastro completo de parceiros ainda não existe, foi criada uma tabela mínima (`parceiro`: nome + ativo) só para o cupom poder referenciar um parceiro com integridade referencial; o cadastro é feito por um modal rápido dentro do próprio formulário do cupom (sem tela própria ainda). Quando o cadastro completo de parceiros for implementado, essa tabela é estendida.
- **Rastreabilidade de uso**: existe uma tabela de histórico (`cupom_uso`) que registra cada uso do cupom (reserva, cliente, valor do desconto aplicado) — sustenta a contagem "quantas vezes foi usado" e o repasse a um parceiro. Passou a ser alimentada de verdade desde que a aplicação do cupom no fluxo de reserva foi implementada (ver 6.5 → "Aplicação de cupom de desconto na reserva").
- Ações por cupom:
  - **Ativar/Pausar** — toggle direto na lista, sem confirmação (sem cascata).
  - **Editar** — formulário completo de edição.
  - **Excluir** — remove definitivamente, mas só quando o cupom **nunca foi usado**; um cupom com histórico de uso não pode ser excluído (preserva a rastreabilidade para o repasse) — a lista já mostra o botão desabilitado nesse caso, com a orientação de pausar em vez de excluir.
- Novo item **CUPONS** no menu lateral do admin, entre Roteiros e Publicidade.

#### ✅ Implementado — Gestão de Taxas (`/administrator/taxas`)

- **Taxa geral**: um único percentual, cobrado sobre o valor do roteiro/embarcação em toda reserva da plataforma — hoje era fixo em 12% no código; passa a ser configurável só por aqui, editável a qualquer momento pelo admin (edição inline, sem tela separada).
- **Taxa específica por gestor** (opcional): o admin pode definir, para qualquer gestor da plataforma, uma taxa diferente da geral — **maior ou menor** — com status ativo/inativo e validade opcional (data de expiração; sem data, vale indefinidamente). Um gestor sem taxa específica (ou com uma inativa/expirada) segue na taxa geral automaticamente.
- A lista de gestores tem busca (nome/e-mail), ordenação e paginação, no mesmo padrão dos outros módulos; cada linha mostra qual taxa está **realmente em vigor** para aquele gestor agora (geral ou específica), sinalizando quando existe uma taxa específica cadastrada mas fora de vigor.
- **Onde isso é aplicado:** toda solicitação de reserva (roteiro ou embarcação, ver 6.5) resolve a taxa efetiva do **gestor dono do item** no momento da solicitação — nunca do cliente que reserva — e grava um snapshot dela na reserva, preservando o histórico mesmo que a taxa do gestor mude depois.

#### 🔜 A implementar

- Conteúdo dos demais módulos (Publicidade, Categorias, Configurações), cada um em separado.
- Cadastro completo de parceiros (tela própria) — hoje só existe o cadastro mínimo embutido no formulário de cupom.

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

### 6.13 Equipe (funcionários da embarcação)

**Status:** ✅ Implementado (relatório de atendimentos por membro/mês fica como to-do — ver
Roadmap §12).

Novo menu **Equipe** no painel do gestor (`/painel/equipe`). O gestor cadastra as pessoas que
ajudam a cuidar das suas embarcações e, **ao confirmar uma reserva**, indica quem vai atender o
cliente — pode ser um ou mais membros da equipe e/ou **ele próprio** ("Você (gestor)"). O cliente
vê quem vai atendê-lo (nome, foto, telefone) em **Minhas reservas** assim que a reserva é
confirmada — mais segurança e previsibilidade para quem contratou.

**Cadastro de um membro:**
- Nome completo (obrigatório);
- CPF (obrigatório, validado);
- E-mail (opcional);
- Telefone (obrigatório);
- Foto (opcional) — salva no Cloudflare R2 em `equipe/{id-do-gestor}/{id-do-membro}/`;
- Embarcação(ões) em que o membro é sempre indicado como atendente (N:N, ≥ 1);
- Vínculo opcional com uma conta da plataforma — para quando a pessoa já existe na Boatzy ou vier
  a se tornar um gestor de embarcação (apenas identidade; não concede acesso).

**Regras:**
- Membro com histórico de atendimento não é excluído, apenas desativado.
- A ficha "Você (gestor)" é criada automaticamente, sempre ativa, não editável/excluível.
- Confirmar uma reserva exige pelo menos um atendente; a seleção pode ser ajustada depois enquanto
  a reserva estiver confirmada/concluída.

Detalhes técnicos: SPEC §32.

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

### equipe_membro

```
id
owner_id            (gestor dono do cadastro)
user_id             (opcional — conta da plataforma vinculada)
is_gestor           (linha do próprio gestor como atendente)
nome_completo
cpf
email               (opcional)
telefone
foto_url            (Cloudflare R2)
ativo
created_at / updated_at
```

### equipe_membro_embarcacao  (N:N membro ↔ embarcação)

```
id
equipe_membro_id
embarcacao_id
```

### reserva_atendente  (quem atende a reserva)

```
id
reserva_id
equipe_membro_id
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
- **Relatório de atendimentos da equipe** (§6.13): a nível de gestor, quantos atendimentos cada
  membro (incluindo o próprio gestor) fez num determinado mês — `reserva_atendente ⨝ reserva`
  agrupado por membro. Modelo de dados já preparado (índice `reserva_atendente_membro_idx`).

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
