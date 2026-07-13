import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus, Filter } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import VendasGrid, { type AnuncioListItem } from './_components/VendasGrid';

export default async function VendasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  const { data } = await supabaseAdmin
    .from('anuncio_venda')
    .select(`
      id,
      fabricante,
      ano_modelo,
      ano_fabricacao,
      preco,
      status,
      visualizacoes,
      created_at,
      embarcacao ( id, nome, embarcacao_imagens ( url_imagem, principal ) )
    `)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  // Leads por anúncio (1 lead = 1 usuário com interação) via vendas_funil
  // (service role: auth.uid() nulo, a guarda aceita o p_gestor explícito).
  const { data: funil } = await supabaseAdmin.rpc('vendas_funil', { p_gestor: user.id });
  const leadsPorAnuncio = new Map<string, number>();
  for (const lead of funil ?? []) {
    leadsPorAnuncio.set(lead.anuncio_id, (leadsPorAnuncio.get(lead.anuncio_id) ?? 0) + 1);
  }

  const anuncios: AnuncioListItem[] = ((data ?? []) as unknown as Omit<AnuncioListItem, 'leads'>[])
    .map((a) => ({ ...a, leads: leadsPorAnuncio.get(a.id) ?? 0 }));

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Vendas</h1>
          <p className="text-sm text-slate-400 mt-1">
            Anuncie embarcações para venda e acompanhe visualizações e interessados.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/painel/vendas/funil"
            className="flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-[#0B2447] text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            <Filter className="w-4 h-4" />
            Funil de vendas
          </Link>
          <Link
            href="/painel/vendas/novo"
            className="flex items-center gap-2 bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-md shadow-[#0B2447]/10 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Novo anúncio
          </Link>
        </div>
      </div>

      <VendasGrid anuncios={anuncios} />
    </div>
  );
}
