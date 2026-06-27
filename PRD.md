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
- Upload de imagens (em desenvolvimento)
- Definição de preço (em desenvolvimento)
- Gerenciamento de reservas (em desenvolvimento)

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

- Toggle `SearchTypeToggle` na Hero Section e na barra compacta (`/buscar` e `/embarcacoes`) permite escolher entre buscar **Roteiros** (padrão) ou **Embarcações**.
- Roteiros → resultados em `/buscar`; Embarcações → resultados em `/embarcacoes`. Os filtros (local, data, pessoas) são preservados ao alternar.

#### ✅ Implementado — Barra de Busca Inteligente (Hero Section)

- `LocationPicker`: autocomplete de municípios com roteiros cadastrados, opção "Próximo de mim" via geolocalização do navegador, histórico de buscas recentes (localStorage).
- `DatePicker`: calendário de 2 meses, datas passadas bloqueadas, opções de flexibilidade (Data exata, ±1, ±2, ±3, ±7 dias), totalmente em pt-BR.
- `GuestPicker`: contador +/− com mínimo 0, dropdown.
- Navegação para `/buscar?municipio=&data=&flex=&pessoas=` ao submeter.

#### ✅ Implementado — Página de Resultados de Embarcações `/embarcacoes`

- Espelha a estrutura de `/buscar`, listando embarcações com `status = 'ativo'`.
- Filtros: município (`municipio_id`), capacidade (`capacidade >= pessoas`), paginação server-side.
- `EmbarcacaoCard`: imagem principal, badge de tipo e localidade, capacidade, comprimento, preço base.
- Detalhe em `/embarcacoes/[id]` (galeria, specs, comodidades, mapa, sidebar de reserva).

#### ✅ Implementado — Página de Resultados `/buscar`

- Barra de busca compacta no topo (reutiliza os mesmos pickers com prop `compact`).
- Chips de filtros ativos com link de remoção individual.
- Grid de roteiros (4 colunas responsivo: 1 → 2 → 3 → 4).
- Paginação server-side via URL (`?pagina=N`), contagem exata via `count: 'exact'`.
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

---

### 6.6 Pagamentos

- Integração com Stripe Connect
- Split automático:
  - Comissão da plataforma
  - Repasse ao dono

---

### 6.7 Avaliações (Reviews)

#### Usuário pode:
- Avaliar após reserva concluída
- Dar nota (1 a 5 estrelas)
- Escrever comentário

#### Sistema exibe:
- Média de avaliações
- Lista de comentários

---

### 6.8 Painel do Dono (Owner Dashboard)

- Listar embarcações
- Editar dados
- Ver reservas
- Acompanhar ganhos

---

### 6.9 Perfil do Usuário

- Dados pessoais
- Histórico de reservas
- Avaliações feitas

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
