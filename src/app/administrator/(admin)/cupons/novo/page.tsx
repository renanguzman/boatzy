import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import CupomForm from '../_components/CupomForm';

export default async function NovoCupomPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/administrator/login');

  const { data: parceiros } = await supabaseAdmin
    .from('parceiro')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome', { ascending: true });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B2447]">Novo cupom</h1>
        <p className="text-sm text-slate-400 mt-1">
          Cadastre um novo cupom de desconto para a plataforma.
        </p>
      </div>

      <CupomForm parceiros={parceiros ?? []} />
    </div>
  );
}
