// Detecta e mascara números de telefone dentro de mensagens de chat, para
// dificultar a combinação de continuar a conversa fora da plataforma.
//
// Heurística por regex (não é infalível): casa sequências no formato de
// telefone brasileiro — com ou sem DDI (+55), com ou sem DDD entre
// parênteses, com separador único (espaço, ponto ou hífen) entre os dois
// blocos de dígitos. Datas (dois separadores, ex.: "20-01-2026") e valores
// monetários não batem com o padrão e não são afetados.
const TELEFONE_REGEX =
  /(?:\+?55[\s.-]?)?(?:\(?\d{2}\)?[\s.-]?)?9?\d{4}[\s.-]?\d{4}/g;

/** Substitui os dígitos de possíveis telefones por "*", preservando separadores. */
export function mascararTelefones(texto: string): string {
  return texto.replace(TELEFONE_REGEX, (trecho) => trecho.replace(/\d/g, '*'));
}
