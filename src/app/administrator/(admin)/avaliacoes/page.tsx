import { redirect } from 'next/navigation';
import { Star } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import AvaliacoesGrid, { type AvaliacaoListItem } from './_components/AvaliacoesGrid';

export default async function AdminAvaliacoesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/administrator/login');

  const { data } = await supabaseAdmin
    .from('avaliacao')
    .select(
      `id, nota, comentario, status, created_at,
       cliente:users!avaliacao_cliente_id_fkey ( name, email ),
       roteiro ( id, nome ),
       embarcacao ( id, nome )`,
    )
    .order('created_at', { ascending: false });

  const avaliacoes = (data ?? []) as unknown as AvaliacaoListItem[];

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 rounded-xl bg-[#0B2447]/5 flex items-center justify-center">
          <Star className="w-5 h-5 text-[#0B2447]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Avaliações</h1>
          <p className="text-sm text-slate-500">
            Todas as avaliações enviadas por clientes na plataforma. Aprove para publicar no site,
            edite ou exclua quando necessário.
          </p>
        </div>
      </div>

      <AvaliacoesGrid avaliacoes={avaliacoes} />
    </div>
  );
}
