// Passeios em destaque na home ("Coleção de experiências"). Conteúdo editorial fixo
// (não é mock/placeholder) — cada um tem uma página estática própria em /passeios/[slug].

export type Passeio = {
  slug: string;
  titulo: string;
  imagem: string;
  /** Resumo curto (dek) usado na listagem `/experiencias`, estilo chamada de blog. */
  resumo: string;
  /** Localidade exibida como badge na listagem. */
  local: string;
};

export const PASSEIOS_DESTAQUE: Passeio[] = [
  {
    slug: 'ilha-do-campeche',
    titulo: 'Descubra o "Caribe Brasileiro": Roteiro Exclusivo de Barco para a Ilha do Campeche',
    imagem: '/images/passeios/ilha-do-campeche.jpg',
    resumo:
      'Fuja das filas e dos horários rígidos das escunas: veja por que chegar de lancha particular é a forma mais leve de conhecer o "Caribe Brasileiro".',
    local: 'Florianópolis, SC',
  },
  {
    slug: 'costa-da-lagoa',
    titulo: 'O Segredo da Costa da Lagoa: Navegando pelas Águas de Florianópolis',
    imagem: '/images/passeios/costa-da-lagoa.png',
    resumo:
      'Uma vila só acessível por água, restaurantes badalados para ancorar e as águas calmas da Lagoa da Conceição — o roteiro perfeito para quem busca sossego.',
    local: 'Florianópolis, SC',
  },
  {
    slug: 'caixa-d-aco',
    titulo: 'O Destino Mais Badalado do Litoral: Roteiro Náutico para o Caixa D\'Aço',
    imagem: '/images/passeios/caixa-d-aco.png',
    resumo:
      'Bares flutuantes, o clipe do Michel Teló e a experiência VIP de chegar de lancha particular ao point mais concorrido do litoral catarinense.',
    local: 'Porto Belo, SC',
  },
  {
    slug: 'praia-do-tingua',
    titulo: 'O Refúgio Exclusivo dos Barcos: A Magia da Praia do Tinguá',
    imagem: '/images/passeios/praia-do-tingua.png',
    resumo:
      'Acesso terrestre difícil torna essa enseada praticamente exclusiva para quem chega de barco — mar liso, gastronomia à beira-mar e pouca gente.',
    local: 'Governador Celso Ramos, SC',
  },
  {
    slug: 'praia-de-palmas',
    titulo: 'Águas de Padrão Internacional: Navegando pela Praia e Ilha de Palmas',
    imagem: '/images/passeios/praia-de-palmas.png',
    resumo:
      'Selo "Bandeira Azul", águas cristalinas e mergulho de snorkel: conheça a ilha que carrega o padrão internacional de qualidade mais cobiçado do litoral.',
    local: 'Governador Celso Ramos, SC',
  },
];
