import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import CatalogoGrid, { type CatalogoListItem } from './_components/CatalogoGrid';

export default async function CatalogoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  const { data } = await supabaseAdmin
    .from('catalogo')
    .select('id, descricao, valor, tipo, is_boatzy, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  const itens = (data ?? []) as CatalogoListItem[];

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Catálogo</h1>
          <p className="text-sm text-slate-400 mt-1">
            Gerencie seus produtos e serviços disponíveis para oferta.
          </p>
        </div>
        <Link
          href="/painel/catalogo/novo"
          className="flex items-center gap-2 bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-md shadow-[#0B2447]/10 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Novo item
        </Link>
      </div>

      <CatalogoGrid itens={itens} />
    </div>
  );
}
