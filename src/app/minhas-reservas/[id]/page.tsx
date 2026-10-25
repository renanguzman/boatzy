import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DetalheReserva from './_components/DetalheReserva';

/**
 * Detalhe da reserva para o cliente: passeio, linha do tempo, valores, situação do pagamento e,
 * quando pago, o comprovante (SPEC §90).
 */
export default async function DetalheReservaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?redirect_to=/minhas-reservas/${id}`);

  return <DetalheReserva reservaId={id} clienteId={user.id} />;
}
