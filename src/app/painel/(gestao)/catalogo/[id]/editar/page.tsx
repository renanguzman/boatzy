import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import EditarCatalogoForm from './_components/EditarCatalogoForm';
import type { CatalogoTipo } from '@/types/supabase';

export default async function EditarCatalogoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  const { id } = await params;

  const { data: item } = await supabaseAdmin
    .from('catalogo')
    .select('id, descricao, valor, tipo, is_boatzy')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single();

  if (!item) notFound();

  if (item.is_boatzy) {
    return (
      <div className="p-8">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-5 max-w-lg">
          <p className="text-sm font-semibold text-amber-800">
            Este item é gerenciado pela Boatzy e não pode ser editado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B2447]">Editar item do Catálogo</h1>
        <p className="text-sm text-slate-400 mt-1">
          Atualize as informações do produto ou serviço.
        </p>
      </div>

      <EditarCatalogoForm
        catalogo={{
          id: item.id,
          descricao: item.descricao,
          valor: item.valor,
          tipo: item.tipo as CatalogoTipo,
        }}
      />
    </div>
  );
}
