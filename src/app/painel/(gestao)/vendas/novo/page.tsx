import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Ship } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import AnuncioForm from '../_components/AnuncioForm';
import { toOption, EMBARCACAO_OPTION_SELECT, type EmbarcacaoRow } from '../_components/embarcacao-option';

export default async function NovoAnuncioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  const [{ data: embarcacoes }, { data: vigentes }, { data: tipos }] = await Promise.all([
    supabaseAdmin
      .from('embarcacao')
      .select(EMBARCACAO_OPTION_SELECT)
      .eq('owner_id', user.id)
      .eq('status', 'ativo')
      .order('nome'),
    supabaseAdmin
      .from('anuncio_venda')
      .select('embarcacao_id')
      .eq('owner_id', user.id)
      .in('status', ['ativo', 'pausado']),
    supabaseAdmin
      .from('embarcacao_tipo')
      .select('id, nome')
      .order('nome'),
  ]);

  const jaAnunciadas = new Set((vigentes ?? []).map((v) => v.embarcacao_id));
  const elegiveis = ((embarcacoes ?? []) as unknown as EmbarcacaoRow[])
    .filter((e) => !jaAnunciadas.has(e.id))
    .map(toOption);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B2447]">Novo anúncio de venda</h1>
        <p className="text-sm text-slate-400 mt-1">
          Aproveite os dados de uma embarcação já cadastrada e informe apenas o que é da venda.
        </p>
      </div>

      {elegiveis.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center py-20 text-center max-w-2xl">
          <Ship className="w-12 h-12 text-slate-200 mb-4" />
          <p className="text-sm font-medium text-slate-500">
            Nenhuma embarcação disponível para anunciar
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Todas as suas embarcações ativas já possuem anúncio vigente — ou você ainda não
            cadastrou nenhuma embarcação.
          </p>
          <div className="flex items-center gap-4 mt-4">
            <Link
              href="/painel/embarcacoes/novo"
              className="text-sm font-semibold text-[#0B3D91] hover:text-[#0B2447] transition-colors"
            >
              Cadastrar embarcação →
            </Link>
            <Link
              href="/painel/vendas"
              className="text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
            >
              Ver anúncios
            </Link>
          </div>
        </div>
      ) : (
        <AnuncioForm modo="novo" embarcacoes={elegiveis} tipos={tipos ?? []} />
      )}
    </div>
  );
}
