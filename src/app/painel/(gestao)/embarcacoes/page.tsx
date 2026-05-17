import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import EmbarcacoesGrid, { type EmbarcacaoListItem } from './_components/EmbarcacoesGrid';

export default async function EmbarcacoesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  const { data } = await supabaseAdmin
    .from('embarcacao')
    .select(`
      id,
      nome,
      status,
      capacidade,
      created_at,
      embarcacao_tipo ( nome ),
      embarcacao_categoria ( nome ),
      municipios ( nome, estados ( uf ) ),
      embarcacao_imagens ( url_imagem, principal )
    `)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  const embarcacoes = (data ?? []) as unknown as EmbarcacaoListItem[];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Vessel Directory</h1>
          <p className="text-sm text-slate-400 mt-1">
            Gerencie sua frota — dados, imagens e disponibilidade em um só lugar.
          </p>
        </div>
        <Link
          href="/painel/embarcacoes/novo"
          className="flex items-center gap-2 bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-md shadow-[#0B2447]/10 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Nova embarcação
        </Link>
      </div>

      <EmbarcacoesGrid embarcacoes={embarcacoes} />
    </div>
  );
}
