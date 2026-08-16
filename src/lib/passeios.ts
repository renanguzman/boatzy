// Passeios em destaque na home ("Coleção de experiências"). Conteúdo editorial fixo
// (não é mock/placeholder) — cada um tem uma página estática própria em /passeios/[slug].

export type Passeio = {
  slug: string;
  titulo: string;
  imagem: string;
};

export const PASSEIOS_DESTAQUE: Passeio[] = [
  {
    slug: 'ilha-do-campeche',
    titulo: 'Descubra o "Caribe Brasileiro": Roteiro Exclusivo de Barco para a Ilha do Campeche',
    imagem: '/images/passeios/ilha-do-campeche.jpg',
  },
  {
    slug: 'costa-da-lagoa',
    titulo: 'O Segredo da Costa da Lagoa: Navegando pelas Águas de Florianópolis',
    imagem: '/images/passeios/costa-da-lagoa.png',
  },
  {
    slug: 'caixa-d-aco',
    titulo: 'O Destino Mais Badalado do Litoral: Roteiro Náutico para o Caixa D\'Aço',
    imagem: '/images/passeios/caixa-d-aco.png',
  },
  {
    slug: 'praia-do-tingua',
    titulo: 'O Refúgio Exclusivo dos Barcos: A Magia da Praia do Tinguá',
    imagem: '/images/passeios/praia-do-tingua.png',
  },
  {
    slug: 'praia-de-palmas',
    titulo: 'Águas de Padrão Internacional: Navegando pela Praia e Ilha de Palmas',
    imagem: '/images/passeios/praia-de-palmas.png',
  },
];
