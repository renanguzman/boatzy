import { redirect } from 'next/navigation';

// A embarcação não tem reserva direta (preço e disponibilidade são do
// roteiro): o detalhe dela é a página com os seus roteiros. Mantida para
// links antigos/compartilhados.
export default async function EmbarcacaoDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') qs.set(k, v);
  }
  const query = qs.toString();
  redirect(`/embarcacoes/${id}/roteiros${query ? `?${query}` : ''}`);
}
