import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import NovaEmbarcacaoForm from './_components/NovaEmbarcacaoForm';

export default async function NovaEmbarcacaoPage() {
  await auth.protect();

  const clerkUser = await currentUser();
  if (!clerkUser) redirect('/painel/login');

  const { data: dbUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id_clerk', clerkUser.id)
    .single();

  if (!dbUser) redirect('/painel/login');

  // Carrega dropdowns de forma paralela
  const [{ data: tipos }, { data: categorias }, { data: estados }] = await Promise.all([
    supabaseAdmin.from('embarcacao_tipo').select('id, nome').order('nome'),
    supabaseAdmin.from('embarcacao_categoria').select('id, nome').order('nome'),
    supabaseAdmin.from('estados').select('id, uf, nome').order('nome'),
  ]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B2447]">Nova Embarcação</h1>
        <p className="text-sm text-slate-400 mt-1">
          Preencha os dados da embarcação e faça upload das imagens.
        </p>
      </div>

      <NovaEmbarcacaoForm
        tipos={tipos ?? []}
        categorias={categorias ?? []}
        estados={estados ?? []}
      />
    </div>
  );
}
