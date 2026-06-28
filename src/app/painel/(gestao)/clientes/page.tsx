import { redirect } from 'next/navigation';
import { Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import ClientesGrid, { type ClienteListItem } from './_components/ClientesGrid';

type ReservaClienteRow = {
  solicitado_em: string;
  cliente: {
    id: string;
    name: string;
    email: string;
    cpf_cnpj: string | null;
    avatar_url: string | null;
    created_at: string;
  } | null;
};

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  // Todas as reservas (de embarcação ou roteiro) feitas com este gestor,
  // com os dados do cliente que as efetuou.
  const { data } = await supabaseAdmin
    .from('reserva')
    .select(
      `solicitado_em,
       cliente:users!reserva_cliente_id_fkey ( id, name, email, cpf_cnpj, avatar_url, created_at )`,
    )
    .eq('owner_id', user.id);

  const rows = (data ?? []) as unknown as ReservaClienteRow[];

  // Mensagens de chat não lidas por cliente (enviadas pelo cliente ao gestor).
  const { data: naoLidasRows } = await supabaseAdmin.rpc('chat_nao_lidas_por_cliente', {
    p_gestor: user.id,
  });
  const naoLidasPorCliente = new Map<string, number>(
    (naoLidasRows ?? []).map((r) => [r.cliente_id, Number(r.total)]),
  );

  // Agrupa por cliente: cada cliente aparece uma única vez, com o total de
  // reservas e a data da reserva mais recente.
  const porCliente = new Map<string, ClienteListItem>();
  for (const row of rows) {
    const c = row.cliente;
    if (!c) continue;
    // O gestor nunca é cliente de si mesmo (reservas de teste podem ter
    // cliente_id == owner_id); não faz sentido listá-lo nem abrir chat consigo.
    if (c.id === user.id) continue;

    const existente = porCliente.get(c.id);
    if (existente) {
      existente.total_reservas += 1;
      if (row.solicitado_em > existente.ultima_reserva) {
        existente.ultima_reserva = row.solicitado_em;
      }
    } else {
      porCliente.set(c.id, {
        id: c.id,
        name: c.name,
        email: c.email,
        cpf_cnpj: c.cpf_cnpj,
        avatar_url: c.avatar_url,
        cliente_desde: c.created_at,
        total_reservas: 1,
        ultima_reserva: row.solicitado_em,
        nao_lidas: naoLidasPorCliente.get(c.id) ?? 0,
      });
    }
  }

  const clientes = Array.from(porCliente.values());

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-blue-50 flex items-center justify-center">
          <Users className="w-5 h-5 text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Clientes</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Todos os clientes que já efetuaram uma reserva de embarcação ou roteiro com você.
          </p>
        </div>
      </div>

      <ClientesGrid clientes={clientes} />
    </div>
  );
}
