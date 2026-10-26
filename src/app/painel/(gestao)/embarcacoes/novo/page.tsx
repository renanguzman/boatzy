import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import NovaEmbarcacaoForm from './_components/NovaEmbarcacaoForm';

export default async function NovaEmbarcacaoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  const [
    { data: tipos },
    { data: estados },
    { data: comodidades },
    { data: equipamentosSeguranca },
    { data: acessorios },
    { data: outrasEmbarcacoes },
  ] = await Promise.all([
    supabaseAdmin.from('embarcacao_tipo').select('id, nome').order('nome'),
    supabaseAdmin.from('estados').select('id, uf, nome').order('nome'),
    supabaseAdmin.from('comodidade').select('id, nome').order('nome'),
    supabaseAdmin.from('equipamentos_seguranca').select('id, nome').order('nome'),
    supabaseAdmin.from('acessorios').select('id, nome').order('nome'),
    supabaseAdmin.from('embarcacao').select('id, nome').eq('owner_id', user.id).order('nome'),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-[#0B2447]">Nova Embarcação</h1>
        <p className="text-sm text-slate-400 mt-1">
          Preencha em etapas — você pode ir e voltar entre elas quando quiser.
        </p>
      </div>

      <NovaEmbarcacaoForm
        tipos={tipos ?? []}
        estados={estados ?? []}
        comodidades={comodidades ?? []}
        equipamentosSeguranca={equipamentosSeguranca ?? []}
        acessorios={acessorios ?? []}
        embarcacoesParaCopiar={outrasEmbarcacoes ?? []}
      />
    </div>
  );
}
