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
];
