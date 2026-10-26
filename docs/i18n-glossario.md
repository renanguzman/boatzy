# Glossário de tradução do site (pt-BR → en-US / es)

Referência para manter os mesmos termos em todas as telas traduzidas. A fonte é sempre o pt-BR
(`messages/pt-BR`); en-US e es são traduções dela. Arquitetura e regras técnicas: `SPEC.md` §94.

## Tom de voz

| | en-US | es |
|---|---|---|
| Tratamento | *you*, direto e cordial | **tú** (latino-americano neutro); nunca *vos* nem *vosotros* |
| Público | turistas americanos e estrangeiros em geral | argentinos, uruguaios, chilenos, paraguaios |
| Estilo | frases curtas, verbos no imperativo nos botões ("Book now") | idem ("Reserva ahora") |
| Maiúsculas | *Title Case* em títulos de seção e no slogan; *Sentence case* em botões e textos | *Sentence case* em quase tudo (o espanhol não usa *Title Case*), exceto no slogan |

## Termos do produto

| pt-BR | en-US | es | Observação |
|---|---|---|---|
| Roteiro | Trip | Paseo | o produto reservável (passeio com itinerário) |
| Passeio | Boat tour / tour | Paseo en barco / paseo | nos artigos de `/passeios` |
| Embarcação | Boat | Embarcación | "barco" (es) só em textos informais |
| Lancha | Speedboat | Lancha | |
| Iate | Yacht | Yate | |
| Veleiro | Sailboat | Velero | |
| Jet ski | Jet ski | Moto de agua | |
| Catamarã | Catamaran | Catamarán | |
| Vendas (menu) | For Sale | En venta | anúncios de embarcações à venda |
| Anuncie sua embarcação | List your boat | Publica tu embarcación | |
| Proprietário / gestor / dono | Owner | Propietario | no site é sempre "proprietário" |
| Cliente | Renter (login) / guest | Cliente | |
| Reserva | Booking | Reserva | |
| Solicitação de reserva | Booking request | Solicitud de reserva | |
| Opcionais | Add-ons | Extras | |
| Comodidades | Amenities | Comodidades | |
| Equipamentos de segurança | Safety equipment | Equipo de seguridad | |
| Capitão / marinheiro | Captain / crew | Capitán / tripulación | |
| Ponto de embarque | Boarding point | Punto de embarque | |
| Taxa de serviço | Service fee | Tarifa de servicio | |
| Cupom | Coupon / promo code | Cupón | |
| Favoritos | Favorites | Favoritos | |
| Favoritar / Favoritado | Save / Saved | Guardar / Guardado | botão do roteiro |
| Diária / Por Diária | Day / Per day | Día / Por día | modelo de cobrança |
| Passeio (linha do preço) | Trip | Paseo | modelo Roteiro: "/trip", "/paseo" |
| Comprimento | Length | Eslora | pés: "ft" / "pies" |
| Quartos | Cabins | Camarotes | |
| Tripulação | Crew | Tripulación | |
| Convidados | Guests | Invitados | capacidade sem a tripulação |
| Pessoas (campo) | Guests | Personas | |
| Embarque / Desembarque | Boarding / Drop-off | Embarque / Desembarque | |
| Saída / Retorno aproximado | Departure / Approximate return | Salida / Regreso aproximado | |
| Solicitar reserva | Request booking | Solicitar reserva | |
| A partir de | From | Desde | |
| Turbine seu passeio | Upgrade your trip | Mejora tu paseo | |
| Minhas conversas | My messages | Mis mensajes | |
| Entrar / Sair | Sign in / Sign out | Ingresar / Cerrar sesión | |
| Navegue com Elegância | Sail in Style | Navega con Elegancia | slogan |

## Catálogos (tipos, comodidades, acessórios, equipamentos)

As traduções dos 75 itens cadastrados estão em `supabase/migrations/20261027_catalogos_traducoes.sql`; itens novos
são traduzidos no admin (Cadastros Auxiliares). Escolhas: Lancha → Speedboat, Bote → Small boat, Churrasqueira →
Barbecue grill / Parrilla, Cooler → Cooler / Hielera, Prancha de Stand Up → Stand-up paddleboard, Colete
Salva-Vidas → Life jacket / Chaleco salvavidas, Wi-Fi → Wi-Fi.

## Não traduzir

- **Boatzy** e nomes de lugares (Florianópolis, Costa da Lagoa, Ilha do Campeche, Praia do Tinguá…).
- **CPF**, **CNPJ**, **CEP** e **Pix**: manter a sigla; na primeira menção da tela, explicar
  (en: *CPF (Brazilian taxpayer ID)*; es: *CPF (documento fiscal brasileño)*).
- Conteúdo escrito pelo proprietário (descrição, regras, paradas, avaliações, chat): continua em
  português nesta fase.

## Formatos

- Moeda: sempre **reais (BRL)** — `formatCurrency` / `formatarPreco` com o idioma (R$ 1.500 / R$1,500).
- Datas e horas: sempre no **horário de Brasília** — `useFormatos()` / `getFormatos()` (en-US usa mês/dia
  e 12h; pt-BR e es, 24h).
- Previsão do tempo: en-US em °F, mph e polegadas; pt-BR e es em °C, km/h e mm.
- Plural e variáveis em formato ICU: `{count, plural, one {# guest} other {# guests}}`; os nomes das
  variáveis (`{nome}`, `{count}`) são os mesmos nos três idiomas (o `npm run i18n:verificar` confere).
