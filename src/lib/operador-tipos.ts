/**
 * Perfil do operador (SPEC §99) — tipos e regras SEM código de servidor, usados pelo
 * painel (formulário e prévia), pelo admin e pelas páginas públicas.
 */

export const OPERADOR_LIMITES = {
  nome: { min: 2, max: 80 },
  headline: { max: 90 },
  bio: { min: 120, max: 1200 },
} as const;

/** Dados públicos do operador (só da versão APROVADA) + resumo de reputação. */
export type OperadorPublico = {
  id: string;
  nome: string;
  /** Primeiro nome, para títulos ("Conheça Jayme"). */
  primeiroNome: string;
  headline: string | null;
  bio: string;
  fotoUrl: string;
  /** Ano de cadastro na plataforma (fuso de Brasília). */
  desdeAno: number;
  /** Média das avaliações aprovadas; `null` = ainda sem avaliações ("Novo"). */
  media: number | null;
  totalAvaliacoes: number;
  experiencias: number;
  embarcacoes: number;
  passeiosRealizados: number;
};

/** Decisão do admin sobre o perfil (SPEC §99). */
export type DecisaoPerfil = 'aprovar' | 'devolver' | 'retirar' | 'restaurar';

/** Retrato de exemplo (marinho → turquesa) para prévias sem foto. */
export const FOTO_EXEMPLO = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E2F4F"/><stop offset="1" stop-color="#17B5B0"/></linearGradient></defs><rect width="400" height="500" fill="url(#g)"/><circle cx="200" cy="200" r="64" fill="#fff" fill-opacity=".85"/><path d="M80 440c0-80 54-130 120-130s120 50 120 130z" fill="#fff" fill-opacity=".85"/></svg>',
)}`;

/** Monta o `OperadorPublico` a partir de um conteúdo (rascunho ou versão no ar) — prévias do painel e do admin. */
export function montarOperadorPublico(
  id: string,
  c: { nome_publico: string | null; headline: string | null; bio: string | null; foto_url: string | null },
  extras: Pick<OperadorPublico, 'desdeAno' | 'media' | 'totalAvaliacoes' | 'experiencias' | 'embarcacoes' | 'passeiosRealizados'>,
  nomeDaConta = 'Seu nome',
): OperadorPublico {
  const nome = c.nome_publico?.trim() || nomeDaConta;
  return {
    id,
    nome,
    primeiroNome: primeiroNome(nome),
    headline: c.headline?.trim() || null,
    bio: c.bio?.trim() || 'A apresentação ainda não foi escrita.',
    fotoUrl: c.foto_url ?? FOTO_EXEMPLO,
    ...extras,
  };
}

/** O que o gestor está editando no formulário. */
export type PerfilRascunho = {
  nome: string;
  headline: string;
  bio: string;
  fotoUrl: string | null;
  consentimento: boolean;
};

export type CampoPerfil = 'nome' | 'headline' | 'bio' | 'foto' | 'consentimento';

/** "Jayme Fonseca Ferreira Filho" → "Jayme"; "BOAT RENT" → "Boat Rent" (empresa mantém o nome inteiro). */
export function primeiroNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  // Nome todo em maiúsculas costuma ser empresa/marca: não corta e passa para "Boat Rent".
  if (partes.length > 1 && nome === nome.toUpperCase()) {
    return partes.map((p) => p.charAt(0) + p.slice(1).toLowerCase()).join(' ');
  }
  return partes[0];
}

/** "Jayme Fonseca" → "JF". */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const a = partes[0].charAt(0);
  const b = partes.length > 1 ? partes[partes.length - 1].charAt(0) : '';
  return (a + b).toUpperCase();
}

/**
 * Contato dentro do texto (telefone, e-mail, link ou @usuário). O contato entre cliente e
 * operador acontece pelo chat do Boatzy; o perfil não pode servir para levar a conversa para fora.
 * Heurística (não é infalível): anos e intervalos como "2010-2020" não contam.
 */
const PADROES_CONTATO: RegExp[] = [
  /\b(?:https?:\/\/|www\.)\S+/i,
  /[\w.+-]+@[\w-]+\.[\w.-]+/,
  /(?:^|\s)@[\w.]{3,}/,
  /\b[a-z0-9-]{2,}\.(?:com|net|org|app|io|br)\b/i,
  // Telefone com DDD (10-11 dígitos), com ou sem DDI/parênteses/separadores.
  /(?:\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/,
  // Celular sem DDD (9 dígitos começando em 9).
  /\b9\d{4}[\s.-]?\d{4}\b/,
];

export function contemContato(texto: string): boolean {
  return PADROES_CONTATO.some((re) => re.test(texto));
}

export const MENSAGEM_SEM_CONTATO =
  'Não coloque telefone, e-mail, link ou @ no texto — o contato acontece pelo chat do Boatzy.';

/** Remove espaços sobrando; preserva quebras de parágrafo (no máximo uma linha em branco). */
export function normalizarTextoPerfil(texto: string): string {
  return texto
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type ErrosPerfil = Partial<Record<CampoPerfil, string>>;

/**
 * Valida o perfil para ENVIAR à análise (rascunho incompleto pode ser salvo sem isto).
 * Usado no formulário (feedback imediato) e na server action (autoridade).
 */
export function validarPerfilParaEnvio(p: PerfilRascunho): ErrosPerfil {
  const erros: ErrosPerfil = {};
  const nome = p.nome.trim();
  const bio = normalizarTextoPerfil(p.bio);
  const headline = p.headline.trim();

  if (nome.length < OPERADOR_LIMITES.nome.min) erros.nome = 'Informe como você quer ser chamado.';
  else if (nome.length > OPERADOR_LIMITES.nome.max) erros.nome = `Use no máximo ${OPERADOR_LIMITES.nome.max} caracteres.`;
  else if (contemContato(nome)) erros.nome = MENSAGEM_SEM_CONTATO;

  if (headline.length > OPERADOR_LIMITES.headline.max) erros.headline = `Use no máximo ${OPERADOR_LIMITES.headline.max} caracteres.`;
  else if (headline && contemContato(headline)) erros.headline = MENSAGEM_SEM_CONTATO;

  if (bio.length < OPERADOR_LIMITES.bio.min) {
    erros.bio = `Conte um pouco mais — faltam ${OPERADOR_LIMITES.bio.min - bio.length} caracteres (mínimo ${OPERADOR_LIMITES.bio.min}).`;
  } else if (bio.length > OPERADOR_LIMITES.bio.max) erros.bio = `Use no máximo ${OPERADOR_LIMITES.bio.max} caracteres.`;
  else if (contemContato(bio)) erros.bio = MENSAGEM_SEM_CONTATO;

  if (!p.fotoUrl) erros.foto = 'Envie uma foto sua.';
  if (!p.consentimento) erros.consentimento = 'Autorize a exibição para enviar o perfil.';
  return erros;
}

export type ItemCompletude = { campo: CampoPerfil; rotulo: string; ok: boolean };

/** Progresso do preenchimento (foto, nome, apresentação, autorização). */
export function completudePerfil(p: PerfilRascunho): { itens: ItemCompletude[]; feitos: number; total: number; percentual: number } {
  const itens: ItemCompletude[] = [
    { campo: 'foto', rotulo: 'Foto', ok: !!p.fotoUrl },
    { campo: 'nome', rotulo: 'Nome', ok: p.nome.trim().length >= OPERADOR_LIMITES.nome.min },
    { campo: 'bio', rotulo: 'Apresentação', ok: normalizarTextoPerfil(p.bio).length >= OPERADOR_LIMITES.bio.min },
    { campo: 'consentimento', rotulo: 'Autorização', ok: p.consentimento },
  ];
  const feitos = itens.filter((i) => i.ok).length;
  return { itens, feitos, total: itens.length, percentual: Math.round((feitos / itens.length) * 100) };
}

/** Rótulo e tom de cada status, para painel e admin. */
export const STATUS_PERFIL_INFO: Record<
  'sem_perfil' | 'rascunho' | 'em_analise' | 'aprovado' | 'devolvido' | 'retirado',
  { rotulo: string; classe: string }
> = {
  sem_perfil: { rotulo: 'Sem perfil', classe: 'bg-slate-100 text-slate-600 ring-slate-200' },
  rascunho: { rotulo: 'Rascunho', classe: 'bg-slate-100 text-slate-700 ring-slate-200' },
  em_analise: { rotulo: 'Em análise', classe: 'bg-amber-50 text-amber-700 ring-amber-200' },
  aprovado: { rotulo: 'Aprovado', classe: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  devolvido: { rotulo: 'Devolvido', classe: 'bg-orange-50 text-orange-700 ring-orange-200' },
  retirado: { rotulo: 'Retirado do ar', classe: 'bg-rose-50 text-rose-700 ring-rose-200' },
};
