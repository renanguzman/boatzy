# Planejamento — Pagamentos e Repasses (gateway Asaas)

> **Status:** criado em 27/09/2026. **Fase 0 (fundação) implementada em 30/09/2026** — ver
> SPEC §34 e PRD §6.6. Próximo passo: sandbox habilitado + definir as regras de comissão (D7).
> Base: leitura da documentação oficial do Asaas (guias + API Reference, versões de
> ago–set/2026) e do estado atual do código (reserva, taxas, cupom, admin).
> **Bloqueadores antes de codar a Fase 3 (repasses):** decisões D1–D3 da §12.

---

## 1. Contexto e objetivo

O Boatzy passa a **intermediar o pagamento** entre cliente final e dono da embarcação
(gestor):

1. O cliente paga o roteiro/embarcação **pela plataforma** (Pix ou cartão), via Asaas.
2. O dinheiro fica sob controle do Boatzy.
3. **48h após o passeio** (sem disputa aberta), o Boatzy **repassa** ao gestor o valor
   dele; a taxa de serviço fica com o Boatzy.
4. **Tudo é controlável pelo painel admin** (`/administrator`): cobranças, estornos,
   repasses (reter, liberar, ajustar), disputas, conciliação e trilha de auditoria.

Hoje (SPEC §20) a reserva é só uma **solicitação**: nasce `pendente`, o gestor
confirma/recusa, **sem etapa de pagamento**. `PRD §6.6` e `SPEC §6` ainda citam Stripe
Connect — serão substituídos por este plano quando implementado.

---

## 2. O que a documentação do Asaas determina (fatos que moldam o desenho)

| # | Fato | Impacto no Boatzy | Fonte |
|---|------|-------------------|-------|
| F1 | **Split não aceita data futura.** É liquidado automaticamente quando a cobrança é *recebida*. O próprio Asaas diz: *"se precisa controlar quando o saldo será movimentado, avalie transferência em vez de Split"*. | Split puro não atende "repassar 48h após o passeio". | FAQ do Split |
| F2 | **Conta Escrow** retém o valor na *subconta* e libera por expiração (`daysToExpire`, contado do **recebimento**, não do passeio) ou manualmente (`POST /v3/escrow/{id}/finish`). Não há webhook de mudança de garantia. Tem **mensalidade por subconta**. | Única forma "nativa" de reter valor do gestor; exige liberação manual por job nosso e custo mensal por gestor. | Conta Escrow (intro, config, liberação) |
| F3 | Consultar/liberar escrow exige a **API Key da subconta** (`ESCROW:WRITE`). A `apiKey` de subconta só continua disponível após o período de avaliação se a operação for **BaaS** (alinhado com gerente de contas) ou filiais do mesmo CNPJ. | Modelo com escrow depende de habilitação BaaS. | Criação de subcontas; Gerenciamento de chaves de subcontas |
| F4 | **Cartão de crédito: `PAYMENT_CONFIRMED` na hora, mas o saldo só fica disponível (`PAYMENT_RECEIVED`) ~32 dias depois** (por parcela, em parcelados). Pix: `PAYMENT_RECEIVED` imediato. Débito: ~3 dias. | Não dá para repassar dinheiro de cartão que ainda não caiu, a menos que haja **antecipação** (tem custo) ou capital de giro do Boatzy. | Eventos para cobranças (fluxos) |
| F5 | Split/percentual é calculado sobre o **`netValue`** (após tarifa Asaas). | Se usarmos split, o valor do gestor deve ser `fixedValue` para não "descontar" a tarifa dele. | Split de pagamentos |
| F6 | Estorno de cobrança com split **estorna os splits junto**. Estornos podem ser **parciais**; `refunds[].status = DONE` é o que vale. | Política de cancelamento com reembolso parcial é viável. | Estornos |
| F7 | Transferência entre contas Asaas **só com vínculo** (conta-pai ↔ subconta). Para fora: Pix (chave ou conta) ou TED. | Repasse pode ir para chave Pix do gestor ou para subconta dele. | Transferências / FAQ |
| F8 | Saques via API geram **evento crítico** (aprovação manual no app/web) **a menos que** a requisição venha de **IP na whitelist** e o evento crítico seja desativado. | Na Vercel (IP de saída dinâmico) cada repasse ficaria aguardando aprovação manual. Ver D4. | Whitelist de IPs |
| F9 | **Validação de saque por webhook**: antes de executar qualquer transferência, o Asaas pergunta ao nosso sistema (`APPROVED`/`REFUSED`). 3 falhas = cancela. | Excelente antifraude: mesmo com a API Key vazada, ninguém saca sem um repasse registrado no nosso banco. | Mecanismo de validação de saque |
| F10 | Webhooks são **at-least-once**; persistir antes de responder `200`; idempotência pelo `id` do evento; após **15 falhas** a fila pausa (eventos guardados 14 dias). Autenticação por header `asaas-access-token` (32–255 chars). | Endpoint rápido + tabela de eventos + processamento assíncrono + reprocessamento. | Webhooks (receber, idempotência, penalização) |
| F11 | Cartão com **pré-autorização** (`authorizeOnly`): segura o limite por **3 dias** (até 25 para contas elegíveis) e captura depois. | Alternativa para "pagar na solicitação e capturar quando o gestor aceitar" — só cartão. | Criar cobrança com cartão |
| F12 | Criar subcontas via API exige conta-pai **CNPJ**; **período de avaliação regulatória** em produção: até 10 subcontas, R$ 2.000 em cobranças por subconta, 60 dias — depois exige homologação. Telas precisam exibir marca/textos do Asaas (playbook). | Qualquer modelo com subconta passa por homologação com o Asaas. | Subcontas; Fluxo de aprovação |
| F13 | Limites de API: **25 mil requisições / 12h**, 50 GETs concorrentes, `429` com headers `RateLimit-*`. Consulta de chave Pix: 5/min. | Jobs em lote com fila/controle de concorrência; nada de polling. | Requisições bloqueadas por limites; Consultar chave Pix |
| F14 | Auth: header `access_token` + **`User-Agent` obrigatório**; sandbox `https://api-sandbox.asaas.com/v3` (chave `$aact_hmlg_…`), produção `https://api.asaas.com/v3` (`$aact_prod_…`). Chave sem uso por 3 meses é desabilitada, 6 meses expira. | O `$` da chave precisa ser **escapado no `.env`** (`\$`) — o Next expande `$VAR`. | Autenticação; Chaves de API; docs Next `environment-variables.md` |
| F15 | Sandbox: cartão aprovado com qualquer número válido; recusa com `5184019740373151` / `4916561358240741`; endpoint "(Apenas sandbox) Confirmar pagamento"; chargeback só pedindo ao suporte; simular antecipação indisponível. | Base da matriz de testes (§10). | Sandbox / O que pode ser testado |

---

## 3. Decisão de arquitetura — como o dinheiro flui

### 3.1 Modelos avaliados

| | **A — Split + Conta Escrow** | **B — Custódia Boatzy + repasse por Pix** (recomendado p/ MVP) | **C — Custódia Boatzy + transferência p/ subconta** |
|---|---|---|---|
| Como funciona | Cobrança na conta Boatzy com `split` (`fixedValue` = parte do gestor) para a subconta do gestor; escrow retém; job libera em passeio+48h. | Cobrança 100% na conta Boatzy. Ledger interno registra quanto é do gestor. Job transfere via Pix para a **chave Pix do gestor** em passeio+48h. | Igual a B, mas o repasse é transferência interna para a **subconta** do gestor (`walletId`); o gestor saca pelo app Asaas. |
| Controle do momento do repasse | Médio (liberação manual do escrow; depende de `daysToExpire` como rede de segurança) | **Total** | **Total** |
| Onboarding do gestor | Pesado: criar subconta, e-mail de ativação, documentos + selfie, aprovação Asaas | **Leve**: informar chave Pix (validamos titularidade) | Pesado (igual A) |
| Dependências no Asaas | BaaS (para manter apiKey das subcontas), escrow habilitado, homologação | Apenas conta PJ + transferências | Subcontas + homologação |
| Custos extras | Mensalidade escrow por gestor + criação de subconta | Tarifa por Pix de saída (conferir contrato) | Criação de subconta |
| Fiscal (**validar com contador**) | Parte do gestor tende a **não** ser receita do Boatzy | Boatzy recebe o **bruto** → risco de tributar o valor total se não estruturado como intermediação | Igual a B |
| Chargeback após repasse | Estorno reverte split (se ainda no escrow) | Prejuízo do Boatzy → compensar em repasses futuros (ledger) | Igual a B |

### 3.2 Recomendação

**Construir o MVP no Modelo B**, com o executor do repasse **abstraído** (`repasse.metodo =
'pix' | 'subconta' | 'split_escrow'`). Ledger, máquina de estados, jobs e painel admin são
**os mesmos** nos três modelos — muda só o passo final "como o dinheiro sai".

Motivos: atende literalmente o requisito ("nós recebemos e repassamos após 48h"), dá
controle total ao admin, onboarding simples para o gestor, não depende de BaaS/escrow.

**Condicionado a duas validações externas (D1 e D2 da §12)** — se qualquer uma for negativa,
trocamos para o Modelo A sem refazer o resto:
- **Asaas (gerente de contas):** a operação de marketplace pode receber 100% na conta
  Boatzy e repassar a terceiros, ou eles exigem subconta+split para esse perfil?
- **Contador:** receber o bruto e repassar é tributável sobre o total no regime do Boatzy?
  Com taxa de 12%, tributar o bruto pode consumir toda a margem.

---

## 4. Fluxo ponta a ponta (Modelo B)

```
CLIENTE                 BOATZY (app)                         ASAAS                  GESTOR
   │ solicita reserva ──▶ reserva: pendente ─────────────────────────────────────▶ notificado
   │                     (sem cobrança ainda)                                        │
   │                                                          aceita (define preço ◀─┘
   │                                                          se "a combinar")
   │                     reserva: aguardando_pagamento
   │                     cria customer (se não existe) ──────▶ POST /customers
   │                     cria cobrança (externalReference) ──▶ POST /payments
   │ ◀── link/QR Pix + prazo (ex.: 24h) ──────────────────────
   │ paga ──────────────────────────────────────────────────▶ PAYMENT_CONFIRMED/RECEIVED
   │                     webhook → persiste evento → 200
   │                     reserva: confirmada (datas bloqueadas)
   │                     ledger: +recebido, −tarifa Asaas, comissão, a_repassar
   │                     repasse: agendado p/ fim_passeio + 48h
   │   … passeio acontece (reserva → concluida) …
   │                     job hora a hora: repasse elegível?
   │                       (passou 48h, sem disputa, saldo disponível, não retido)
   │                     POST /transfers (Pix p/ chave do gestor, externalReference=repasse.id)
   │                                         ◀── validação de saque (APPROVED se bate)
   │                                                           TRANSFER_DONE ──────▶ recebe
   │                     repasse: pago (comprovante)
```

### 4.1 Por que "aceite → pagamento" (e não pagar na solicitação)

- Pix não tem pré-autorização: pagar na solicitação obrigaria estornar toda recusa.
- Existem reservas com **preço "a combinar"** (`preco_base` nulo) — o valor final só
  existe após o aceite do gestor.
- Evolução futura: **"reserva instantânea"** (paga na hora, aceite automático) para
  roteiros com preço fixo — reaproveita tudo.

### 4.2 Máquinas de estado

**`reserva.status`** (novos valores em negrito):

```
pendente ──aceite──▶ **aguardando_pagamento** ──pago──▶ confirmada ──data passou──▶ concluida
   │                        │                              │
   └─recusa─▶ recusada      └─prazo venceu─▶ **expirada**  └─cancelamento─▶ cancelada (+ estorno conforme política)
```

- Os índices únicos de bloqueio de data (`… WHERE status = 'confirmada'`) passam a
  incluir `aguardando_pagamento` — senão duas reservas podem ser aceitas para a mesma data.
- Reservas **legadas** já `confirmada`/`concluida` sem pagamento: marcadas
  `pagamento_exigido = false` para não entrarem no fluxo.

**`pagamento.status`** — espelho do Asaas (`PENDING`, `CONFIRMED`, `RECEIVED`, `OVERDUE`,
`REFUND_REQUESTED`, `REFUND_IN_PROGRESS`, `REFUNDED`, `CHARGEBACK_REQUESTED`,
`CHARGEBACK_DISPUTE`, `AWAITING_CHARGEBACK_REVERSAL`, `DELETED`…). Guardar o valor **cru**
(texto) e tolerar valores novos, como a doc recomenda.

**`repasse.status`**:

```
aguardando_passeio ─▶ agendado ─▶ aguardando_saldo (cartão ainda não caiu) ─▶ elegivel ─▶ processando ─▶ pago
                         │                                                                   └─▶ falhou ─▶ (retry/admin)
                         ├─▶ retido (admin, com motivo) ─▶ elegivel
                         └─▶ cancelado (estorno total) | compensado (chargeback)
```

---

## 5. Regras de negócio a definir

| Regra | Proposta (padrão sugerido) | Observação |
|-------|----------------------------|------------|
| **Momento do repasse** | `elegivel_em = (fim do passeio 23:59 BRT) + 48h`, onde fim = `coalesce(data_fim_reserva, data_reserva)`; e só se o valor já estiver disponível (`PAYMENT_RECEIVED`) | A reserva só tem **data**, sem hora. Prazo de 48h configurável no admin. |
| **Cartão (D+32)** | Opção 1: repasse = max(passeio+48h, crédito disponível). Opção 2: habilitar **antecipação automática** do cartão (custo). Opção 3: Boatzy adianta com caixa próprio. | Decisão D3. Sugestão MVP: opção 1, com prazo explícito para o gestor. |
| **Parcelamento** | MVP **sem parcelamento** (ou só com antecipação) | Cada parcela cai em um mês diferente → repasse se arrastaria por meses. |
| **Quem paga a tarifa do Asaas** | Boatzy, dentro da taxa de serviço | Ex.: cartão ~3–5% sobre o total come boa parte dos 12%. Conferir tabela real. |
| **Cupom** | Mantém a regra atual (sai da taxa; excedente abate do total) — o gestor sempre recebe o subtotal integral | Cupom + tarifa pode deixar a margem **negativa** — admin precisa ver isso no dashboard. |
| **Comissão da plataforma** | **A definir (D7).** Mecanismo já existe: taxa geral (`taxa_plataforma`) + taxa específica por gestor (`usuario_taxa`, com vigência), resolvida por `get_taxa_usuario(owner_id)` e gravada como snapshot em `reserva.taxa_percent`/`taxa_servico` (SPEC §14, §20.1) | Hoje a taxa é **somada ao preço** e paga pelo cliente. Falta decidir como ela se combina com tarifa Asaas, cupom e repasse — ver D7. |
| **Prazo para pagar após aceite** | 24h, limitado a N horas antes do passeio | Cobrança não paga → apagar no Asaas + `expirada` + libera data. |
| **Política de cancelamento** | Ex.: cliente cancela ≥ 7 dias antes → 100%; 2–7 dias → 50%; < 48h → 0%. Gestor cancela → 100% ao cliente. | **PRD §8 diz "respeitar política definida", mas ela não existe.** Precisa entrar nos Termos de Uso. Definir também como o valor retido no reembolso parcial é dividido (gestor/Boatzy). |
| **Estorno da taxa de serviço** | Em cancelamento pelo gestor/Boatzy: devolve tudo. Pelo cliente: segue a política. | |
| **Chargeback após repasse** | Lançamento negativo no ledger do gestor, compensado nos próximos repasses; admin pode cobrar manualmente | Deve constar no contrato/termo do gestor. |
| **Dados de recebimento do gestor** | Chave Pix cuja titularidade = CPF/CNPJ do cadastro dele | Troca de chave: revalidação + carência (ex.: 24h) + alerta ao admin — vetor clássico de fraude. |
| **CPF do cliente** | Obrigatório para pagar | Usuários via OAuth podem não ter CPF → coletar no checkout. |

---

## 6. Modelo de dados (Supabase)

Todas as tabelas novas com RLS + **GRANTs explícitos** (AGENTS.md). Escritas só via
`supabaseAdmin` em server actions/route handlers; leitura por RLS (cliente vê o seu,
gestor vê o seu, admin tudo).

| Tabela | Papel | Campos principais |
|--------|-------|-------------------|
| `users` (alterar) | vínculo com o customer Asaas | `asaas_customer_id` |
| `reserva` (alterar) | | novos status; `pagamento_exigido bool`; `pagamento_prazo_em timestamptz`; `aceita_em` |
| `pagamento` | uma tentativa de cobrança (pode haver mais de uma por reserva) | `reserva_id`, `asaas_payment_id` UNIQUE, `billing_type`, `status` (texto cru), `valor`, `valor_liquido` (`netValue`), `tarifa_asaas`, `invoice_url`, `pix_payload`, `pix_qrcode_expira_em`, `vencimento`, `confirmado_em`, `recebido_em`, `credito_estimado_em`, `external_reference` |
| `pagamento_estorno` | histórico de estornos (total/parcial) | `pagamento_id`, `valor`, `status` (`PENDING/DONE/CANCELLED`), `motivo`, `origem` (cliente/gestor/admin/chargeback), `solicitado_por`, `comprovante_url` |
| `repasse` | o que devemos ao gestor por reserva | `reserva_id`, `owner_id`, `valor_bruto`, `ajustes`, `valor_liquido`, `status`, `elegivel_em`, `retido_motivo`, `metodo`, `destino_snapshot jsonb`, `asaas_transfer_id`, `pago_em`, `comprovante_url`, `tentativas`, `erro` |
| `gestor_recebimento` | dados bancários / Pix do gestor | `owner_id`, `tipo_chave`, `chave`, `titular_nome`, `titular_documento`, `status` (pendente/verificado/bloqueado), `verificado_em`, `valido_a_partir_de` (carência) — histórico de trocas preservado |
| `lancamento_financeiro` | **ledger** (fonte da verdade contábil) | `reserva_id`, `owner_id`, `conta` (`boatzy`/`gestor`/`cliente`/`asaas`), `tipo` (recebimento, tarifa, comissao, repasse, estorno, chargeback, ajuste), `valor` (com sinal), `ref_asaas`, `criado_por`, `criado_em` — append-only |
| `asaas_webhook_evento` | fila/idempotência de webhooks | `id` (id do evento, PK), `evento`, `payload jsonb`, `recebido_em`, `status` (pendente/processado/erro/ignorado), `tentativas`, `erro`, `processado_em` |
| `financeiro_auditoria` | toda ação manual do admin | `admin_id`, `acao`, `entidade`, `entidade_id`, `antes jsonb`, `depois jsonb`, `motivo` (obrigatório), `criado_em` |
| `financeiro_config` (singleton) | parâmetros | `horas_apos_passeio` (48), `horas_prazo_pagamento` (24), `metodos_habilitados`, `parcelas_max`, `politica_cancelamento jsonb`, `repasse_automatico bool` (liga/desliga geral) |

Saldo do gestor = soma dos lançamentos `conta = 'gestor'`; saldo em custódia =
recebido − repassado − estornado. A conciliação compara isso com o saldo e o extrato do
Asaas (endpoints "Recuperar saldo da conta" e "Recuperar extrato").

---

## 7. Integração técnica

### 7.1 Cliente HTTP — `src/lib/asaas/` (`server-only`)

- `client.ts`: `fetch` com `access_token`, `User-Agent: boatzy`, timeout, log sem segredos,
  tratamento de `429` (respeitar `RateLimit-Reset`, sem retry imediato) e de `5xx`.
- **Idempotência de saída:** toda criação leva `externalReference` = nosso UUID. Em timeout,
  **consultar antes de repetir** (`GET /payments?externalReference=…`,
  `GET /transfers` filtrando) — a doc cita cobrança duplicada por retry cego como erro comum.
- Módulos: `clientes.ts` (garantir customer), `cobrancas.ts`, `estornos.ts`,
  `transferencias.ts`, `pix.ts` (consulta de chave para validar titularidade), `financeiro.ts`
  (saldo/extrato).
- Env vars (nunca no código/cliente):
  ```
  ASAAS_API_URL=https://api-sandbox.asaas.com/v3
  ASAAS_API_KEY=\$aact_hmlg_...        # o "\$" é obrigatório no .env do Next
  ASAAS_WEBHOOK_TOKEN=...              # 32–255 chars, gerado por nós
  ASAAS_SAQUE_WEBHOOK_TOKEN=...        # token da validação de saque
  ```

### 7.2 Webhooks — `src/app/api/webhooks/asaas/route.ts`

1. Valida `asaas-access-token` (comparação em tempo constante). Inválido → `401`.
2. `INSERT … ON CONFLICT (id) DO NOTHING` em `asaas_webhook_evento`.
3. Responde `200` imediatamente.
4. Processa em `after()` (`next/server`; na Vercel usa `waitUntil`).
5. Processador idempotente **também no negócio**: transições guardadas
   (`UPDATE reserva SET status='confirmada' WHERE id=… AND status='aguardando_pagamento'`).
6. Cron de reprocessamento pega eventos `pendente`/`erro` (rede de segurança se o `after`
   falhar).

Eventos tratados: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`,
`PAYMENT_DELETED`, `PAYMENT_REFUNDED`, `PAYMENT_PARTIALLY_REFUNDED`,
`PAYMENT_REFUND_IN_PROGRESS`, `PAYMENT_CHARGEBACK_*`, `PAYMENT_AWAITING_CHARGEBACK_REVERSAL`,
`PAYMENT_REPROVED_BY_RISK_ANALYSIS`, `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED`, `TRANSFER_*`.
Demais: gravar como `ignorado`.

### 7.3 Validação de saque — `src/app/api/webhooks/asaas/validacao-saque/route.ts`

Responde `APPROVED` **somente** se existir `repasse` em `processando` com o mesmo
`asaas_transfer_id`, valor e destino; senão `REFUSED`. Loga toda decisão.

### 7.4 Jobs (cron)

| Job | Frequência | Faz |
|-----|-----------|-----|
| `pagamentos-expirar` | 15 min | `aguardando_pagamento` vencida → `DELETE /payments/{id}` + `expirada` + libera data |
| `repasses` | 1 h | calcula elegíveis → cria transferências (lote pequeno, sequencial) |
| `webhooks-reprocessar` | 10 min | reprocessa eventos pendentes/erro |
| `conciliacao` | diário | compara `pagamento`/`repasse`/ledger com cobranças, transferências e saldo no Asaas; grava divergências |
| `concluir-reservas` | diário | substitui a transição *lazy* atual (`concluirReservasVencidas`) — o repasse não pode depender de alguém abrir uma página |

⚠️ O `vercel.json` hoje tem 1 cron diário. **Plano Hobby da Vercel só permite cron
diário** — frequências menores exigem Pro, ou `pg_cron` + `pg_net` no Supabase chamando os
endpoints. Autenticar crons com `CRON_SECRET` (mesmo padrão do cron existente).

### 7.5 Pagamento na tela do cliente

- **Pix transparente** (recomendado): cria cobrança `PIX`, busca `GET /payments/{id}/pixQrCode`
  e mostra QR + copia-e-cola + contagem regressiva na nossa página; confirma via webhook
  (com polling leve **no nosso banco**, não no Asaas, para atualizar a tela).
- **Cartão**: redirecionar para a **fatura do Asaas** (`invoiceUrl`) — zero dado de cartão
  no Boatzy (fora do escopo PCI). Checkout próprio com tokenização fica para depois.
- `callback.successUrl` só para UX; **a confirmação financeira é sempre o webhook**.
- Boleto: desabilitado (compensação lenta demais para reservas).
- Cadastrar uma **chave Pix na conta Boatzy** (o QR sem chave expira no mesmo dia e será
  descontinuado).

---

## 8. Painel admin — novo menu **Financeiro**

Todas as ações que movem dinheiro: diálogo de confirmação + **motivo obrigatório** +
registro em `financeiro_auditoria`.

| Tela | Conteúdo | Ações |
|------|----------|-------|
| `/administrator/financeiro` | Dashboard: GMV, receita Boatzy (comissão − tarifas − cupons), em custódia, a repassar (próx. 7 dias), repassado, estornado, em disputa; **saldo real no Asaas** vs. esperado; alertas (divergências, repasses falhos, fila de webhook parada) | — |
| `/financeiro/pagamentos` + `[id]` | Lista com filtros (status, método, período, gestor); detalhe com linha do tempo de eventos Asaas, links de fatura/comprovante | Estornar total/parcial, cancelar cobrança pendente, reenviar link, reconsultar no Asaas |
| `/financeiro/repasses` | Fila por status; totais por gestor | **Reter** / liberar, **antecipar** liberação, **ajustar valor** (gera lançamento), reprocessar falha, marcar como pago manualmente (fora da plataforma), pausar repasses automáticos (chave geral) |
| `/financeiro/recebedores` | Gestores, chave Pix, status de verificação, histórico de trocas, saldo (incl. negativo por chargeback) | Verificar/bloquear recebedor |
| `/financeiro/disputas` | Chargebacks e estornos em andamento | Abrir disputa com documentos (endpoint "Criar disputa de chargeback") |
| `/financeiro/conciliacao` | Divergências do job diário | Marcar resolvida com nota |
| `/financeiro/integracao` | Log de webhooks (payload, status, erro), estado da fila | Reprocessar evento |
| `/financeiro/configuracoes` | `financeiro_config` + política de cancelamento | Editar |
| `/financeiro/auditoria` | Trilha de ações manuais | Exportar |

Export CSV/XLSX em todas as listas (o projeto já usa `xlsx`/`jspdf`).

## 9. Painel do gestor e site do cliente

**Gestor (`/painel`)**
- Aceitar reserva agora dispara a cobrança; se "a combinar", informa o valor final antes.
- Novo `/painel/recebimentos`: cadastrar/validar chave Pix; aceite do termo de repasse.
  **Não aceitar reservas pagas sem recebedor verificado.**
- `/painel/receitas`: separar "a receber" (agendado, com data prevista) de "recebido"
  (com comprovante).
- Detalhe do agendamento: status do pagamento e do repasse.

**Cliente**
- `/reservas/[id]/pagar`: resumo, CPF (se faltar), escolha Pix/cartão, QR/redirect, prazo.
- `/minhas-reservas`: status do pagamento, comprovante, cancelamento com **prévia do
  reembolso** conforme a política.
- E-mails (`src/lib/email.ts`): reserva aceita (pague até…), pagamento confirmado,
  reembolso, e para o gestor: reserva paga, repasse realizado.

---

## 10. Sandbox — o que você precisa fazer agora

1. **Chave de API** (Integrações → Chaves de API). Ela aparece **uma única vez**. Coloque
   no `.env.local` como `ASAAS_API_KEY=\$aact_hmlg_…` (com a barra antes do `$`).
   **Não precisa colar a chave no chat.**
2. **Chave Pix** na conta sandbox (aleatória serve) — necessária para o QR dinâmico.
3. **Adicionar saldo** na conta sandbox (guia "Adicionando saldo") — para testar
   transferências/repasses e estornos.
4. **Gerar um token de webhook** (32–255 caracteres, sem espaços; ex.: `openssl rand -hex 32`).
   Coloque em `ASAAS_WEBHOOK_TOKEN`. O webhook em si é cadastrado pela tela **Admin → Financeiro →
   Integração** (botão "Cadastrar"), apontando para uma URL pública (`cloudflared`/`ngrok` no
   local, ou preview da Vercel) — o Asaas não alcança `localhost`.
5. **Taxas da conta** (Configurações da conta → Taxas): anote Pix, cartão à vista,
   transferência Pix, antecipação — entram na simulação de margem.
6. **Mecanismos de segurança**: não mexer ainda; configuramos validação de saque na Fase 3.
7. Se formos para o Modelo A/C: em Configurações → Sandbox, habilitar **BaaS** e
   **autoaprovação de subcontas**.

## 11. Matriz de testes no sandbox

| Cenário | Como simular | Esperado |
|---------|--------------|----------|
| Pix pago | "Confirmar pagamento" (sandbox) | `PAYMENT_RECEIVED` → reserva `confirmada`, repasse `agendado` |
| Cartão aprovado | número válido qualquer | `PAYMENT_CONFIRMED` → `confirmada`; repasse `aguardando_saldo` |
| Cartão recusado | `5184019740373151` / `4916561358240741` | `400`, reserva segue `aguardando_pagamento` |
| Prazo vencido | aguardar/forçar job | cobrança apagada, reserva `expirada`, data liberada |
| Webhook duplicado | reenviar pelo log do Asaas | processado uma vez só |
| Endpoint fora do ar | derrubar local | fila reenvia; reprocessamento recupera |
| Cancelamento com reembolso parcial | ação do cliente | `refunds[]` `DONE`, ledger correto |
| Recusa pós-pagamento pelo gestor | ação do gestor | estorno total |
| Repasse | data do passeio no passado | transferência criada, validação de saque `APPROVED`, `TRANSFER_DONE` |
| Validação de saque recusa | transferência criada fora do sistema | `REFUSED` |
| Admin retém repasse | ação admin | não transfere; auditoria gravada |
| Chargeback | pedir ao suporte do Asaas com o ID da cobrança | repasse retido ou compensado |

## 12. Decisões pendentes (bloqueadoras)

| # | Decisão | Com quem |
|---|---------|----------|
| **D1** | O Asaas permite o Modelo B (receber 100% e repassar a terceiros) para o perfil do Boatzy, ou exige subconta+split? Custos de Pix de saída, antecipação, pré-autorização. | Gerente de contas Asaas (0800 009 0037 / contato@asaas.com.br) |
| **D2** | Tributação: receber o bruto e repassar — como declarar só a comissão como receita? Emissão de NFS-e da taxa de serviço para o cliente. | Contador |
| **D3** | Cartão: aceitar D+32 no repasse, contratar antecipação automática, ou adiantar com caixa? Parcelamento sim/não? | Negócio (você) |
| **D4** | Repasses automáticos precisam de IP fixo na whitelist (senão cada saque pede aprovação manual no app Asaas). IP fixo (Vercel Static IPs/Pro ou proxy) **ou** aprovação manual em lote pelo admin no app? | Você + infraestrutura |
| **D5** | Política de cancelamento e divisão do valor retido; texto nos Termos de Uso. | Negócio/jurídico |
| **D6** | Interpretação de "48h após a confirmação do passeio": 48h após a **data do passeio** (proposta) ou após o gestor marcar como realizado? | Você |
| **D7** | **Regras de comissão no fluxo de pagamento.** Reaproveitar o mecanismo existente (`get_taxa_usuario` + snapshot na reserva) e definir: (a) a comissão continua sendo cobrada **do cliente** por cima do preço, ou passa a ser descontada do gestor, ou um misto? (b) quem absorve a tarifa do Asaas (Pix/cartão)? (c) cupom continua saindo só da comissão? (d) no reembolso parcial, a comissão é devolvida proporcionalmente? (e) taxa específica do gestor vale pela data da **solicitação** (hoje) ou do **pagamento**? | Negócio (você) — antes da Fase 1 |

## 13. Fases de entrega (cada fase deployável)

| Fase | Entrega | Depende de |
|------|---------|------------|
| **0 — Fundação** ✅ 30/09/2026 | Env vars, `src/lib/asaas/`, tabela de eventos `asaas_webhook_evento` (+ GRANTs), endpoint de webhook, cron de reprocessamento, tela `/financeiro/integracao` com teste de conexão. **Escopo reduzido de propósito:** as demais tabelas da §6 entram na fase que as usa, para não fixar o modelo antes de D1/D7. | chave sandbox (para testar) |
| **1 — Cobrança** | Novos status, aceite do gestor → cobrança, página de pagamento (Pix transparente + cartão via fatura), confirmação por webhook, expiração, CPF no checkout, e-mails, bloqueio de data em `aguardando_pagamento`; tabelas `pagamento`, `lancamento_financeiro`, `financeiro_auditoria`, `financeiro_config`; handlers `PAYMENT_*` | Fase 0, D6, **D7** |
| **2 — Cancelamento e estornos** | Política configurável, cancelamento do cliente com prévia, recusa pós-pagamento, estorno manual pelo admin, ledger de estornos | Fase 1, D5 |
| **3 — Repasses** | Cadastro/validação de recebedor, cálculo, job de repasse, validação de saque, webhooks de transferência, fila no admin (reter/liberar/ajustar), "a receber" no painel do gestor | Fase 2, **D1–D4** |
| **4 — Controle total** | Dashboard financeiro, conciliação diária, disputas/chargeback, auditoria, exports | Fase 3 |
| **5 — Produção** | Chave de produção, webhooks de produção, checklist "Preparação para produção" do Asaas, homologação (se subcontas), monitoramento/alertas, NFS-e da comissão. **Atenção:** hoje o único ambiente (`boatzy.app`) recebe o webhook da conta **sandbox**. Na virada: **gerar um novo `ASAAS_WEBHOOK_TOKEN`** e **desativar/excluir o webhook da conta sandbox**, senão eventos de teste continuariam sendo aceitos no banco de produção; limpar `asaas_webhook_evento` e dados financeiros de teste. | D2 |

Ao fim de cada fase: atualizar `PRD.md` (§6.6 Pagamentos, §8 Regras) e `SPEC.md` (substituir
§6 Stripe por uma seção Asaas; §20 reserva; §25 admin).

## 14. Riscos

- **Margem negativa** (tarifa de cartão + cupom > taxa de serviço) — dashboard precisa mostrar
  margem por reserva.
- **Chargeback após repasse** — até ~120 dias; ledger com saldo negativo do gestor e cláusula
  contratual de compensação.
- **Troca fraudulenta de chave Pix** do gestor — carência + revalidação + alerta.
- **Fila de webhook pausada** (15 falhas) — alerta no admin; eventos somem após 14 dias.
- **Chave API inativa** 3 meses → desabilitada; monitorar `ACCESS_TOKEN_*`.
- **Divergência de estado** local × Asaas — conciliação diária + "reconsultar no Asaas" no admin.
- Reserva sem hora de término — o marco de 48h é por data (fim do dia do passeio).

## Fontes principais (docs.asaas.com)

Split de pagamentos · FAQ do Split · Split para contas com Conta Escrow · Conta Escrow
(introdução, configuração, valores sob garantia, liberação, taxa) · Subcontas / Criação /
Fluxo de aprovação / Gerenciamento de chaves · BaaS · Cobranças via cartão · Cobranças via Pix
· Estornos · Chargeback · Antecipação · Transferências (intro, conta Asaas, FAQ) · Mecanismo
de validação de saque · Webhooks (receber, idempotência, eventos de cobrança/transferência/
conta, penalização) · Autenticação · Chaves de API · Whitelist de IPs · Asaas Checkout ·
Sandbox (configuração, cartão, o que pode ser testado) · Consultar chave Pix · Limites (429)
· API Reference (cobrança, cartão/pré-autorização, escrow, subconta, estorno, transferência).
