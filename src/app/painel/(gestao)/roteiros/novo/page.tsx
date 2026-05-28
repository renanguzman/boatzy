import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import NovoRoteiroForm from './_components/NovoRoteiroForm';

export default async function NovoRoteiroPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  const [{ data: estados }, { data: embarcacoes }] = await Promise.all([
    supabaseAdmin.from('estados').select('id, uf, nome').order('nome'),
    supabaseAdmin
      .from('embarcacao')
      .select('id, nome')
      .eq('owner_id', user.id)
      .eq('status', 'ativo')
      .order('nome'),
  ]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B2447]">Novo Roteiro</h1>
        <p className="text-sm text-slate-400 mt-1">
          Cadastre um roteiro de passeio e vincule às suas embarcações.
        </p>
      </div>

      <NovoRoteiroForm
        estados={estados ?? []}
        embarcacoes={embarcacoes ?? []}
      />
    </div>
  );
}
