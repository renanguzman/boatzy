import { onlyDigits } from '@/lib/validators';

/** Link do WhatsApp com a mensagem da cobrança — direto para o cliente se houver celular cadastrado. */
export function linkWhatsAppCobranca(input: { telefone: string | null; link: string; titulo: string; itemNome: string }): string {
  const texto = `Olá! Segue o link para pagar a cobrança "${input.titulo}" referente ao passeio ${input.itemNome} pelo Boatzy: ${input.link}`;
  let numero = input.telefone ? onlyDigits(input.telefone) : '';
  if (numero.length === 10 || numero.length === 11) numero = `55${numero}`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
