import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import FunilBoard, { type AnuncioFunil, type LeadFunil } from './_components/FunilBoard';

export default async function FunilVendasPage({
  searchParams,
}: {
  searchParams: Promise<{ anuncio?: string }>;
}) {
  const { anuncio: anuncioInicial } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  const [{ data: anunciosData }, { data: funilData }] = await Promise.all([
    supabaseAdmin
      .from('anuncio_venda')
      .select('id, status, visualizacoes, preco, embarcacao ( nome )')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    // service role: auth.uid() nulo — a guarda da RPC aceita o p_gestor explícito.
    supabaseAdmin.rpc('vendas_funil', { p_gestor: user.id }),
  ]);

  const anuncios: AnuncioFunil[] = ((anunciosData ?? []) as unknown as {
    id: string;
    status: string;
    visualizacoes: number;
    preco: number;
    embarcacao: { nome: string } | null;
  }[]).map((a) => ({
    id: a.id,
    nome: a.embarcacao?.nome ?? 'Embarcação',
    status: a.status,
    visualizacoes: Number(a.visualizacoes),
    preco: Number(a.preco),
  }));

  const leads: LeadFunil[] = (funilData ?? []).map((l) => ({
    anuncioId: l.anuncio_id,
    anuncioNome: l.embarcacao_nome,
    userId: l.user_id,
    nome: l.lead_nome,
    avatar: l.lead_avatar,
    eventos: l.eventos,
    estagio: l.estagio,
    ultimaInteracao: l.ultima_interacao,
  }));

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link
            href="/painel/vendas"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-[#0B2447] transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Anúncios de venda
          </Link>
          <h1 className="text-2xl font-bold text-[#0B2447]">Funil de vendas</h1>
          <p className="text-sm text-slate-400 mt-1">
            Interessados nos seus anúncios, do primeiro clique à negociação — quanto mais à
            direita, mais quente o lead.
          </p>
        </div>
      </div>

      <FunilBoard anuncios={anuncios} leads={leads} anuncioInicial={anuncioInicial ?? null} />
    </div>
  );
}
