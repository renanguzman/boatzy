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
- **Autenticação:** Clerk
- **Hospedagem:** Vercel
- **Pagamentos:** Stripe Connect (Marketplace)

---

## 5. Escopo do MVP

### 5.1 Funcionalidades Core

#### Usuário (Cliente) (role: cliente)
- Cadastro/Login (Clerk)
- Buscar embarcações
- Visualizar detalhes
- Solicitar reserva
- Realizar pagamento
- Avaliar embarcação

#### Dono da Embarcação (role: gestor)
- ✅ Cadastro/Login exclusivo em `/painel/cadastro` e `/painel/login` (Clerk)
- ✅ Role `gestor` atribuída automaticamente via API após cadastro
- ✅ Dashboard em `/painel` com visão geral (stats)
- ✅ Menu com Agendamentos e Embarcações
- Cadastro de embarcação (em desenvolvimento)
- Upload de imagens (em desenvolvimento)
- Definição de preço (em desenvolvimento)
- Gerenciamento de reservas (em desenvolvimento)

---

## 6. Funcionalidades Detalhadas

### 6.1 Autenticação

- Login via Clerk (email, Google, etc.)
- Separação de perfis:
  - Cliente
  - Dono (Owner)

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

---

### 6.4 Página da Embarcação

Exibir:

- Galeria de imagens
- Informações completas
- Avaliações
- Localização
- Botão "Reservar"

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
- Comissão padrão da plataforma: 20%
- Um usuário pode ter múltiplas reservas
- Um barco pode ter múltiplas avaliações

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
