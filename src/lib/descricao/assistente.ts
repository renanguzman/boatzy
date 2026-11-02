/**
 * Assistente de descrição (SPEC §98) — embarcação, passeio (roteiro) e apresentação do
 * operador (SPEC §99). Módulo neutro:
 * tipos do pedido, opções de toque, ideias do que contar e o rascunho simples (sem IA).
 *
 * Princípio: o texto só usa fatos dados pelo dono — cadastro, relato (falado ou digitado)
 * e destaques que ele marcou. Nada é aplicado sem ele ver e aprovar.
 */

export type AlvoDescricao = 'embarcacao' | 'roteiro' | 'operador';

/** Um fato do cadastro, já rotulado ("Capacidade" → "12 pessoas"). */
export type FatoDescricao = { rotulo: string; valor: string };

export type PedidoDescricao = {
  alvo: AlvoDescricao;
  fatos: FatoDescricao[];
  /** O que o dono contou (ditado ou digitado). */
  relato: string;
  /** Opções de toque marcadas. */
  destaques: string[];
  /** Descrição que já estava no campo (ponto de partida). */
  textoAtual: string;
  /** Roteiro: a embarcação vinculada — o servidor completa os fatos dela. */
  embarcacaoId?: string | null;
  /** "Gerar outra versão": a versão anterior, para variar a escrita. */
  versaoAnterior?: string | null;
  /** Roteiro: pesquisar na web sobre os lugares do itinerário para enriquecer o texto. */
  pesquisar?: boolean;
  /** Operador: escrever como pessoa ("Sou…", padrão) ou como empresa ("Somos…"). */
  voz?: 'primeira' | 'empresa';
};

/** Tamanho máximo do texto devolvido, por alvo (a apresentação do operador cabe em 1.200 caracteres). */
export const TEXTO_MAXIMO: Record<AlvoDescricao, number> = { embarcacao: 3000, roteiro: 3000, operador: 1200 };

/** Página consultada na pesquisa (mostrada ao dono na revisão). */
export type FonteDescricao = { titulo: string; url: string };

export type RespostaDescricao =
  | { ok: true; texto: string; sugestoes: string[]; fontes: FonteDescricao[] }
  | { ok: false; error: string; semIa?: boolean };

export const LIMITES_DESCRICAO = {
  relato: 4000,
  textoAtual: 4000,
  fatos: 30,
  valorFato: 400,
  destaques: 20,
} as const;

/** Opções de toque: coisas que o cadastro não diz (para quem é, ocasião, diferenciais). */
export const DESTAQUES: Record<AlvoDescricao, string[]> = {
  embarcacao: [
    'Ideal para famílias',
    'Ótima para festas e aniversários',
    'Ideal para casais',
    'Boa para grupos de amigos',
    'Boa para pesca',
    'Nova ou recém-reformada',
    'Bastante espaço para tomar sol',
    'Área com sombra',
    'Som de qualidade',
    'Muito estável e confortável',
    'Marinheiro experiente',
  ],
  roteiro: [
    'Pôr do sol',
    'Água cristalina',
    'Parada para banho de mar',
    'Mergulho com snorkel',
    'Praias desertas',
    'Parada para almoço',
    'Golfinhos ou tartarugas',
    'Lugares lindos para fotos',
    'Passeio tranquilo',
    'Clima de festa com música',
    'Ideal para famílias com crianças',
    'Ideal para casais',
    'Ideal para grupos de amigos',
    'Bom para quem nunca andou de barco',
  ],
  operador: [
    'Muitos anos de experiência no mar',
    'Habilitação náutica (Arrais, Mestre ou Capitão)',
    'Instrutor ou professor de esportes náuticos',
    'Atendimento a famílias e crianças',
    'Passeios românticos e pôr do sol',
    'Pesca esportiva',
    'Festas e eventos a bordo',
    'Foco em segurança',
    'Conhece muito bem a região',
    'Atendimento em outros idiomas',
    'Empresa familiar',
    'Equipe própria de marinheiros',
  ],
};

/** Ideias do que contar — guiam o relato sem exigir um texto pronto. */
export const IDEIAS: Record<AlvoDescricao, string[]> = {
  embarcacao: [
    'Para quem ela é ideal: família, festa, casal, pesca?',
    'O que ela tem de especial?',
    'Como é o conforto a bordo?',
    'Algo importante que o cliente precisa saber?',
  ],
  roteiro: [
    'Como é o passeio, do começo ao fim?',
    'Qual é o momento mais bonito?',
    'O que dá para fazer em cada parada?',
    'Para quem esse passeio é perfeito?',
  ],
  operador: [
    'Quem é você e há quanto tempo está no mar?',
    'Qual é a sua experiência ou formação náutica?',
    'Onde você atua e que tipo de passeio faz?',
    'Como você gosta de receber os seus clientes?',
  ],
};

/** Há lugares no itinerário para pesquisar (embarque, paradas ou desembarque). */
export function temLugaresParaPesquisar(fatos: FatoDescricao[]): boolean {
  return fatos.some((f) => ['Embarque', 'Paradas', 'Desembarque'].includes(f.rotulo) && f.valor.trim().length > 0);
}

/** Mínimo para gerar: falar/escrever algo ou marcar ao menos uma opção. */
export function podeGerar(relato: string, destaques: string[]): boolean {
  return relato.trim().length >= 10 || destaques.length > 0;
}

const valor = (fatos: FatoDescricao[], rotulo: string) => fatos.find((f) => f.rotulo === rotulo)?.valor ?? '';

function frase(texto: string): string {
  const t = texto.trim().replace(/\s+/g, ' ');
  if (!t) return '';
  const comMaiuscula = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(comMaiuscula) ? comMaiuscula : `${comMaiuscula}.`;
}

const listar = (itens: string[]) =>
  itens.length <= 1 ? (itens[0] ?? '') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`;

/**
 * Rascunho simples, montado só com os fatos (sem IA) — quando o assistente com IA não
 * está disponível. O dono ainda revisa antes de usar.
 */
export function rascunhoSimples(p: Pick<PedidoDescricao, 'alvo' | 'fatos' | 'relato' | 'destaques' | 'voz'>): string {
  const f = p.fatos;
  const paragrafos: string[] = [];
  if (p.alvo === 'embarcacao') {
    const nome = valor(f, 'Nome') || 'Esta embarcação';
    const tipo = valor(f, 'Tipo').toLowerCase();
    const tamanho = valor(f, 'Comprimento');
    const capacidade = valor(f, 'Capacidade');
    const local = valor(f, 'Local');
    paragrafos.push(frase([
      `${nome} é ${tipo ? `uma ${tipo}` : 'uma embarcação'}${tamanho ? ` de ${tamanho}` : ''}`,
      capacidade ? `para até ${capacidade}` : '',
      local ? `em ${local}` : '',
    ].filter(Boolean).join(', ')));
    const conforto = [valor(f, 'Quartos') && `${valor(f, 'Quartos')} quarto(s)`, valor(f, 'Banheiros') && `${valor(f, 'Banheiros')} banheiro(s)`]
      .filter(Boolean) as string[];
    const bordo = valor(f, 'Comodidades');
    if (conforto.length || bordo) {
      paragrafos.push(frase(`A bordo: ${[listar(conforto), bordo].filter(Boolean).join('; ')}`));
    }
  } else if (p.alvo === 'operador') {
    const empresa = p.voz === 'empresa';
    const nome = valor(f, 'Nome');
    const desde = valor(f, 'Membro do Boatzy desde');
    const local = valor(f, 'Atua em');
    const barcos = valor(f, 'Embarcações');
    paragrafos.push(frase(`${empresa ? 'Somos' : 'Sou'}${nome ? ` ${nome}` : ''}, ${empresa ? 'operadores' : 'operador'} no Boatzy${desde ? ` desde ${desde}` : ''}`));
    if (local || barcos) {
      paragrafos.push(frase(`${empresa ? 'Atuamos' : 'Atuo'}${local ? ` em ${local}` : ''}${barcos ? `, com ${barcos}` : ''}`));
    }
  } else {
    const nome = valor(f, 'Nome') || 'Este passeio';
    const saida = valor(f, 'Embarque');
    // "1) Ilha do Campeche; 2) Praia do Forte" → "Ilha do Campeche e Praia do Forte"
    const paradas = listar(valor(f, 'Paradas').split(';').map((x) => x.replace(/^\s*\d+\)\s*/, '').trim()).filter(Boolean));
    const chegada = valor(f, 'Desembarque');
    const duracao = valor(f, 'Duração');
    const horario = valor(f, 'Horário de saída');
    paragrafos.push(frase([
      `${nome}${duracao ? `: ${duracao} de passeio` : ''}`,
      saida ? `com saída de ${saida}${horario ? ` às ${horario}` : ''}` : '',
      paradas ? `paradas em ${paradas}` : '',
      chegada ? `e chegada em ${chegada}` : '',
    ].filter(Boolean).join(', ')));
    const barco = valor(f, 'Embarcação');
    if (barco) paragrafos.push(frase(`O passeio é feito na embarcação ${barco}`));
  }
  if (p.destaques.length) paragrafos.push(frase(`Destaques: ${listar(p.destaques.map((d) => d.toLowerCase()))}`));
  if (p.relato.trim()) paragrafos.push(frase(p.relato));
  return paragrafos.filter(Boolean).join('\n\n');
}
