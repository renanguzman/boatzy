import type { Mensagens } from '../pt-BR';
import auth from './auth.json';
import busca from './busca.json';
import cards from './cards.json';
import chat from './chat.json';
import comum from './comum.json';
import comunicacoes from './comunicacoes.json';
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

const mensagens: Mensagens = {
  ...auth,
  ...busca,
  ...cards,
  ...chat,
  ...comum,
  ...comunicacoes,
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

export default mensagens;
