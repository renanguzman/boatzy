# Planejamento — Cartão de crédito via Stone (Pagar.me v5) + Pix no Asaas

> Status (25/11/2026): **F1–F3 + admin implementados** (SPEC §109), cartão ainda no Asaas até o admin trocar o
> gateway. **F4 (liquidação/tarifa) aguardando a Stone** (§2.1).
> Complementa `docs/planejamento-pagamentos-asaas.md` (pedido, pagamento, ledger e repasses continuam os
> mesmos — muda a camada de cobrança). Documentação: https://docs.pagar.me (API v5).

## 1. Objetivo

Passar a ter **dois gateways, escolhidos pela forma de pagamento**:

| Forma | Gateway | Observação |
|---|---|---|
| Pix | **Asaas** | sem mudança (QR Code + copia e cola, webhook `PAYMENT_*`) |
| Cartão de crédito | **Pagar.me (Stone)** | novo — checkout transparente, brasileiros e estrangeiros |

O pedido (`pedido`), as tentativas (`pagamento`), o titular (`pagamento_tomador`), o ledger e os repasses
continuam únicos no Boatzy. O admin e o gestor enxergam um pedido só, com o gateway de cada tentativa.

## 2. Decisões (25/11/2026)

| # | Decisão | Escolha | Consequência no desenho |
|---|---|---|---|
| D-S1 | Tipo de conta Pagar.me | **Gateway** | `card_token` (tokenização no navegador) direto no `POST /orders`. **Sem split** (split é só PSP). Ver §2.1 — liquidação e tarifas. |
| D-S2 | Modelo do dinheiro | **Custódia Boatzy** (100% entra para o Boatzy, repasse ao gestor) | Igual ao Pix/Asaas. Ledger e repasse manual da Fase 3 continuam valendo. |
| D-S3 | Cartões aceitos | Bandeiras do contrato Stone + **cartões emitidos no exterior** | Confirmar com a Stone que cartão estrangeiro (cross-border) está liberado e a taxa dele — ver §2.2. |
| D-S4 | Liquidação | **Antecipação automática** | Cartão liquida em poucos dias (prazo do contrato), inclusive parcelado. O repasse "liquidado + 48h após o passeio" deixa de esperar D+30 por parcela. |
| D-S5 | Parcelamento | **Com juros, 100% repassados ao cliente** | Tabela de acréscimo por nº de parcelas no admin; valor cobrado ≠ `pedido.valor_total`; nova coluna `valor_juros`; informação obrigatória ao consumidor — ver §5. |
| D-S6 | Antifraude / 3DS | **Antifraude ligado**; 3DS numa fase 2 | Checkout coleta endereço de cobrança e telefone. Confirmar se o antifraude está contratado na conta Gateway. |
| D-S7 | Autenticação do webhook | **Basic Auth** | `PAGARME_WEBHOOK_USER` / `PAGARME_WEBHOOK_PASSWORD`; comparação em tempo constante; **sempre reconsultar a API** antes de aplicar o evento. |
| D-S8 | Estorno | **Estorno mínimo no admin** (total/parcial) já nesta entrega | `DELETE /charges/{id}` com `amount`; pago depois de expirado → alerta + estorno com 1 clique. |

### 2.1 Conta Gateway — o que precisa ser confirmado com a Stone (bloqueia a Fase 4)

No modelo **Gateway**, a Pagar.me roteia a transação para a adquirente contratada (Stone), e quem liquida
o dinheiro é a adquirente. A documentação não define o modelo explicitamente; o que ela mostra:

- `card_token` em `POST /orders` é o caminho do Gateway (PSP usa `card_id`).
- Split e recebedores são **só PSP** → coerente com D-S2 (custódia, sem split).
- **Tarifa, valor líquido e data de liquidação** só aparecem nos recebíveis (`GET /payables?charge_id=…`:
  `amount`, `fee`, `anticipation_fee`, `fraud_coverage_fee`, `installment`, `payment_date`, `status`).
  Não há campo de tarifa na cobrança/transação. **Não está confirmado se `/payables` traz dados numa conta
  Gateway** (a liquidação é da Stone).

Perguntas à Stone/Pagar.me:
1. Na nossa conta Gateway, `GET /payables` devolve os recebíveis (com `fee` e `payment_date`)? Se não, qual
   a API de conciliação da Stone (extrato/recebíveis) para obter tarifa, antecipação e data de crédito?
2. Antecipação automática: prazo (D+1? D+2?) e taxa; vale para todas as parcelas?
3. Antifraude está contratado na conta? Quais campos ele exige (endereço de cobrança, telefone, documento)?
4. Cartões emitidos no exterior estão liberados? Taxa (MDR) do cross-border? Quais bandeiras?
5. Webhook com Basic Auth: confirmar no dashboard; política de reenvio (quantas tentativas, intervalo).
6. Domínios permitidos para a tokenização (boatzy.app, localhost, preview da Vercel).

**Plano B (se `/payables` não servir na conta Gateway):** o Boatzy calcula a tarifa pela **tabela de taxas
do contrato** (MDR por faixa de parcelas + antecipação), cadastrada no admin, marca o pagamento como
`recebido` em **captura + N dias** (prazo da antecipação, configurável) com o líquido **estimado**, e a
conciliação com o extrato da Stone ajusta a diferença (importação do extrato numa fase seguinte). O ledger
lança a diferença como ajuste de tarifa.

### 2.2 D-S3 — o que é "cartão estrangeiro"

Bandeira (Visa, Mastercard, Amex, Elo, Hipercard, Diners…) é uma coisa; **onde o cartão foi emitido** é
outra. Um Visa emitido por um banco argentino é uma transação *cross-border* para a adquirente brasileira:
- pode vir **bloqueada por padrão** no contrato, ou com **MDR maior**;
- o antifraude tende a recusar mais (IP, país e endereço estrangeiros);
- a cobrança é em **BRL** — o banco do cliente converte e pode cobrar IOF/taxa internacional.

Elo e Hipercard são bandeiras brasileiras — o turista vai pagar com Visa, Mastercard ou Amex. Por isso a
confirmação com a Stone é sobre **aceitar cartões emitidos fora do Brasil** (e a taxa), não sobre bandeiras.

## 3. Arquitetura

### 3.1 Checkout transparente (tokenização no navegador)

1. O cliente digita o cartão num formulário **do Boatzy** (pt-BR, en, es).
2. O navegador envia o cartão **direto à Pagar.me** com a chave pública (`pk_…`) e recebe um `card_token`
   (válido por 60 s, uso único). Implementação a validar no sandbox: `POST /core/v5/tokens?appId=pk_…`
   ou o script `tokenizecard.js`. O número do cartão **nunca** passa pelo servidor do Boatzy.
3. A server action recebe só `card_token`, parcelas, endereço de cobrança e titular, e cria o pedido na
   Pagar.me (`POST /orders`).
4. A resposta já traz o resultado: **aprovado** (confirma o pedido na hora), **em análise** (tela acompanha,
   como no Pix) ou **recusado** (mensagem traduzida, tentar outro cartão).
5. O webhook confirma de forma idempotente e cobre os casos assíncronos (antifraude, estorno, chargeback).

Escopo PCI: SAQ A-EP (página do Boatzy hospeda o formulário; os dados vão direto à Pagar.me).

### 3.2 Módulo `src/lib/pagarme/` (server-only, espelho de `src/lib/asaas/`)

- `config.ts` — `PAGARME_SECRET_KEY`, `NEXT_PUBLIC_PAGARME_PUBLIC_KEY`, `PAGARME_WEBHOOK_USER`,
  `PAGARME_WEBHOOK_PASSWORD`. Ambiente pelo prefixo (`sk_test_`/`pk_test_` = sandbox; `sk_`/`pk_` =
  produção); chaves de ambientes diferentes → configuração recusada. Base `https://api.pagar.me/core/v5`,
  Basic Auth com a `sk` como usuário e senha vazia.
- `client.ts` — timeout, erros tipados (`PagarmeError`), reais ↔ centavos inteiros.
- `pedidos.ts` — `criarPedidoCartao` (`POST /orders`): `code` = id do `pagamento`; `items` (1 item:
  "Boatzy · Pedido #N", `amount` = total com juros, `code` = nº do pedido); `customer` inline
  (`code` = userId, CPF/CNPJ ou `document_type: PASSPORT`, e-mail, telefone com DDI, endereço);
  `payments[0].credit_card` = `card_token`, `installments`, `statement_descriptor: "BOATZY"`,
  `operation_type: auth_and_capture`, `billing_address`. `consultarPedido`, `consultarCobranca`,
  `buscarPedidoPorCode` (recuperação de timeout, como o `externalReference` do Asaas),
  `estornarCobranca` (`DELETE /charges/{id}`, `amount` opcional = parcial).
- `recebiveis.ts` — `GET /payables?charge_id=` (ou plano B, §2.1).
- `webhooks.ts` / `eventos.ts` — registrar, processar em `after()`, reprocessar pelo cron, listar/reenviar
  hooks (`/hooks`) para o admin.

### 3.3 Camada comum (`src/lib/pagamentos/`)

- `iniciarPagamento` separa: **Pix** → fluxo atual do Asaas; **cartão** → novo `pagarComCartao`
  (mesmas validações de prazo, forma, parcelas, tomador e estrangeiro; grava `pagamento` +
  `pagamento_tomador` antes de chamar a Pagar.me; recalcula os juros no servidor — nunca confia no valor
  do navegador).
- Status Pagar.me → `PagamentoStatus`:

| Pagar.me (charge / transação / evento) | Boatzy |
|---|---|
| `pending`, `processing`, `charge.antifraud_pending`/`_manual` | `em_analise` |
| `paid` / `captured` | `confirmado` |
| recebíveis liquidados (ou plano B) | `recebido` |
| `failed`, `not_authorized`, `with_error`, `charge.antifraud_reproved` | `recusado` |
| `voided`, `canceled` | `cancelado` |
| `refunded` / `partial_refunded` | `estornado` / `estornado_parcial` |
| `chargeback.received` (substituiu `charge.chargedback`) | `em_disputa` |

- Aprovado na resposta síncrona → `confirmarPedidoPago` na hora (idempotente com o webhook).
- `cancelarCobrancasPendentes` / expiração: cartão transparente não deixa cobrança pendente; se houver
  `pending`/`processing` da Pagar.me, `DELETE /charges/{id}`.
- **Pago depois de expirado/cancelado** (antifraude demorou): alerta ao admin + botão "Estornar" (D-S8).
- E-mail de recusa só na reprovação **assíncrona** (antifraude); recusa síncrona aparece na tela.
- `sincronizarPedido` (admin) por gateway.

### 3.4 Webhook — `POST /api/webhooks/pagarme`

Basic Auth (D-S7) → valida o formato → grava em `pagarme_webhook_evento` (id `hook_…` = idempotência) →
200 → `after()` reconsulta o pedido/cobrança na API e aplica. Eventos: `order.paid`,
`order.payment_failed`, `order.canceled`, `charge.paid`, `charge.payment_failed`, `charge.refunded`,
`charge.partial_canceled`, `charge.antifraud_*`, `chargeback.received`. Se o dashboard não aceitar campos de
usuário/senha, usar `https://usuario:senha@boatzy.app/api/webhooks/pagarme`.

### 3.5 Cron

`/api/cron/pagamentos`: reprocessa eventos do Asaas **e** da Pagar.me, expira pedidos. Nova rotina diária:
sincronizar recebíveis (ou aplicar o plano B) → `recebido` + `valor_liquido` + `lancarRecebimento`.

## 4. Banco — migration nova (GRANTs e fuso conforme AGENTS.md)

- `forma_pagamento`: `gateway` (`asaas` | `pagarme`); `codigo_asaas` → nullable (`codigo_gateway`).
  Seed: pix → asaas, cartao_credito → pagarme. Serve de **chave de rollback** (admin volta o cartão ao Asaas).
- `forma_pagamento_juros` (nova): `parcelas` (2–12), `acrescimo_percentual`, `ativo`, auditoria — tabela de
  juros do cartão (D-S5).
- `pagamento`: `gateway` NOT NULL (backfill `asaas`), `gateway_pedido_id` (`or_`), `gateway_cobranca_id`
  (`ch_`, UNIQUE), `gateway_customer_id`, `status_gateway`, `valor_juros` (default 0) e CHECK
  `valor = valor_base + valor_juros` (valor_base = `pedido.valor_total`). `asaas_*` continuam para Pix e
  legado; CHECK de coerência por gateway.
- `pagamento_cartao`: `adquirente_nsu`, `codigo_autorizacao`, `adquirente_tid`, `codigo_retorno` (ABECS),
  `nome_portador`.
- `pagamento_parcela`: `gateway_recebivel_id`; `asaas_payment_id` nullable.
- `pagamento_transacao`: `gateway`, `gateway_evento_id` (no lugar da FK fixa para `asaas_webhook_evento`).
- `pagarme_webhook_evento` (nova, espelho de `asaas_webhook_evento`, com RPC de reserva atômica).
- `pagamento_estorno.origem`: + `pagarme`.
- `financeiro_config`: `dias_liquidacao_cartao` (plano B), tabela de MDR se necessário.
- Ledger: contas `1.1.02 Saldo Stone/Pagar.me`, `3.1.03 Tarifas de cartão (MDR)`,
  `3.1.04 Custo de antecipação`, `4.1.02 Receita de juros de parcelamento` (validar com o contador);
  `lancar_recebimento_pagamento` escolhe as contas pelo gateway e lança os juros.
  `repasse.conta_origem` (Asaas ou Stone).
- Regenerar `src/types/supabase.ts`.

## 5. Juros do parcelamento (D-S5)

- **1x (à vista): sem juros** — a tarifa do cartão à vista continua absorvida pelo Boatzy (como hoje).
- **2x a 12x**: total = `pedido.valor_total × (1 + acréscimo%[n])`; parcela = total / n (centavos: a
  diferença vai para a 1ª parcela). O admin cadastra o acréscimo de cada nº de parcelas — o objetivo é
  cobrir o MDR parcelado + a antecipação, então a tabela parte das taxas do contrato Stone.
- A Pagar.me não calcula juros no `POST /orders` (só nos links de pagamento): o Boatzy manda o valor final.
- **Informação ao consumidor** (checkout, e-mail e comprovante): preço à vista, nº de parcelas, valor da
  parcela, **total a prazo** e o acréscimo/taxa. Ex.: "3x de R$ 345,00 — total R$ 1.035,00 (à vista
  R$ 1.000,00)".
- Comissão, cupom e valor do gestor **não mudam** — os juros não entram no repasse.
- Estorno total devolve o valor cobrado (com juros). Estorno parcial: proporcional; regra a fechar na Fase 2.
- GA4: `value` = valor do pedido (sem juros), parâmetro `juros` separado.

## 6. Impactos por área

### 6.1 Site do cliente
- `CheckoutPagamento`: novo `CartaoForm` — número (máscara, bandeira), nome impresso, validade, CVV,
  parcelas com juros, **endereço de cobrança** (Brasil: CEP + ViaCEP; exterior: país, código postal,
  estado/província, cidade, endereço) e telefone com DDI. Sai o redirecionamento para a fatura do Asaas e
  o `?retorno=1`. Telas: aprovado / em análise / recusado (com tentar de novo).
- `/reservas/[id]/pagar` e `/cobrancas/[id]`: cada forma só aparece se o gateway dela estiver configurado.
- Comprovante (`/minhas-reservas/[id]`): no cartão, id da cobrança, NSU, autorização, parcelas e juros.
- Estrangeiro: segue o "Sou estrangeiro" (país + documento); o documento vai à Pagar.me como `PASSPORT`
  (validar DNI/cédula no sandbox). Aviso: "cobrado em reais; seu banco converte". A liberação de
  "pagadores estrangeiros" no Asaas de produção **deixa de ser necessária**.
- Em nome de terceiro (§97): o tomador vira o `customer` da Pagar.me; endereço de cobrança pré-preenchido
  com o do tomador.
- Textos pt-BR/en/es: `cartaoSeguro`, `sandbox` (cartão de teste `4000000000000010`),
  `minhas-reservas.processado`, FAQ, "aparecerá na fatura como BOATZY", mensagens de recusa.
- Política de Privacidade: Stone/Pagar.me e Asaas como processadores de pagamento (LGPD).

### 6.2 Painel do gestor
- Card Pagamento: "Pago" imediato no cartão aprovado; parcelas ("cliente parcelou em 3x, juros pagos pelo
  cliente"); valor do gestor inalterado. Previsão do repasse com a liquidação antecipada.

### 6.3 Admin
- Financeiro → Integração: abas **Asaas (Pix)** e **Pagar.me (cartão)** — conexão, webhooks (`/hooks`,
  reenviar), eventos com reprocessamento.
- Financeiro → Configurações: gateway de cada forma (rollback), parcelas máximas, **tabela de juros**,
  valor mínimo da parcela, dias de liquidação (plano B).
- Pedidos: filtro por gateway; busca por `or_`, `ch_`, NSU, autorização; indicadores de tarifa por gateway
  e receita de juros; exportação. Detalhe: dados da adquirente, antifraude, eventos Pagar.me, juros,
  **Estornar** (total/parcial, motivo obrigatório, auditoria).
- Repasses: "Aguardando o Asaas" → "Aguardando liquidação"; conta de origem.
- Relatórios: novas contas no balancete; conciliação por gateway.

## 7. Segurança
- Limite de tentativas de cartão por pedido/usuário (ex.: 5/h) e bloqueio após N recusas seguidas
  (*card testing*); login obrigatório (já existe); avaliar Turnstile.
- Nunca logar dados do formulário do cartão; só o token chega ao servidor.
- Webhook: Basic Auth + reconsulta na API.

## 8. Transição
1. Construir no sandbox com `cartao_credito.gateway = 'asaas'` (desligado).
2. Virada: `gateway = 'pagarme'` + cancelar no Asaas as cobranças de **cartão pendentes**.
3. Cartões já pagos no Asaas seguem no Asaas (liquidação, estorno, chargeback, ledger).
4. Rollback: voltar a forma para `asaas`.

## 9. Fases

Andamento: F1 ✅ · F2 ✅ · F3 ✅ · F5 parcial ✅ (configurações, integração, detalhe do pedido com estorno) ·
F4 ⏳ (Stone) · F6 ⏳ (testes no sandbox e virada).

- **F0** — respostas da Stone (§2.1), domínios cadastrados, webhook configurado.
- **F1** — fundação: config, cliente HTTP, webhook + tabela, admin Integração (sem cobrar).
- **F2** — migration (gateway, juros, ids, contas) + tipos.
- **F3** — checkout de cartão (brasileiro, estrangeiro, terceiro, juros), resposta síncrona + webhook,
  reserva e cobrança avulsa, i18n.
- **F4** — recebíveis/liquidação (ou plano B), ledger, repasses, conciliação.
- **F5** — admin (pedidos, estorno, configurações, relatórios), painel, textos legais.
- **F6** — testes, chaves de produção, virada, monitoramento.

## 10. Matriz de testes (sandbox)
Cartão BR à vista e parcelado com juros · estrangeiro (AR/DNI, US/passaporte) · terceiro CPF e CNPJ ·
recusa · antifraude reprovando/em análise · timeout na criação (recuperar pelo `code`) · webhook
duplicado/fora de ordem/sem Basic Auth (401) · expira durante a análise e depois paga · estorno total e
parcial · `chargeback.received` · cobrança avulsa no cartão · Pix segue no Asaas · rollback do gateway ·
limite de tentativas · liquidação → lançamento contábil → repasse liberado.

## 11. Não confirmado na documentação
Definição formal Gateway × PSP e quem liquida; `/payables` em conta Gateway; antifraude (página 404);
Basic Auth e reenvio do webhook; URL/atributos do `tokenizecard.js` e domínios; aceite de cartão
estrangeiro; tabela de cartões de teste que simulam recusa. Divergências: URL `sdx-api` citada na página
de link de pagamento × endpoint único na de autenticação.
