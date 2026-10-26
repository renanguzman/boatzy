// Passeios em destaque na home ("Coleção de experiências"). Conteúdo editorial fixo
// (não é mock/placeholder) — cada um tem uma página estática própria em /passeios/[slug].
// Título e resumo (dek da listagem `/experiencias`) ficam nas mensagens do site, em
// `Passeios.<slug>` (messages/*/passeios.json) — um por idioma.

export type SlugPasseio = 'ilha-do-campeche' | 'costa-da-lagoa' | 'caixa-d-aco' | 'praia-do-tingua' | 'praia-de-palmas';

export type Passeio = {
  slug: SlugPasseio;
  imagem: string;
  /** Localidade exibida como badge na listagem (nome próprio — não muda com o idioma). */
  local: string;
};

export const PASSEIOS_DESTAQUE: Passeio[] = [
  {
    slug: 'ilha-do-campeche',
    imagem: '/images/passeios/ilha-do-campeche.jpg',
    local: 'Florianópolis, SC',
  },
  {
    slug: 'costa-da-lagoa',
    imagem: '/images/passeios/costa-da-lagoa.png',
    local: 'Florianópolis, SC',
  },
  {
    slug: 'caixa-d-aco',
    imagem: '/images/passeios/caixa-d-aco.png',
    local: 'Porto Belo, SC',
  },
  {
    slug: 'praia-do-tingua',
    imagem: '/images/passeios/praia-do-tingua.png',
    local: 'Governador Celso Ramos, SC',
  },
  {
    slug: 'praia-de-palmas',
    imagem: '/images/passeios/praia-de-palmas.png',
    local: 'Governador Celso Ramos, SC',
  },
];
