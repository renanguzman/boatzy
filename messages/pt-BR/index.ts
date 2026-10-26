/**
 * Mensagens do site em pt-BR — a fonte das traduções (SPEC §94.3). Cada JSON
 * é uma área do site com um ou mais namespaces no primeiro nível; en-US e es
 * repetem a mesma estrutura, e o tipo `Mensagens` obriga as duas a ter todas
 * as chaves. Arquivo novo aqui = arquivo novo nas três pastas (e neste índice).
 */
import auth from './auth.json';
import busca from './busca.json';
import cards from './cards.json';
import chat from './chat.json';
import comum from './comum.json';
import conta from './conta.json';
import home from './home.json';
import institucional from './institucional.json';
import layout from './layout.json';
import legal from './legal.json';
import metadados from './metadados.json';
import minhasReservas from './minhas-reservas.json';
import notificacoes from './notificacoes.json';
import passeios from './passeios.json';
import passeiosArtigos from './passeios-artigos.json';
import reserva from './reserva.json';
import roteiro from './roteiro.json';
import vendas from './vendas.json';

const mensagens = {
  ...auth,
  ...busca,
  ...cards,
  ...chat,
  ...comum,
  ...conta,
  ...home,
  ...institucional,
  ...layout,
  ...legal,
  ...metadados,
  ...minhasReservas,
  ...notificacoes,
  ...passeios,
  ...passeiosArtigos,
  ...reserva,
  ...roteiro,
  ...vendas,
};

export type Mensagens = typeof mensagens;

export default mensagens;
