import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import EditarEmbarcacaoForm from './_components/EditarEmbarcacaoForm';

export default async function EditarEmbarcacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  const { id } = await params;

  const [
    { data: emb },
    { data: imagens },
    { data: tipos },
    { data: estados },
    { data: comodidades },
    { data: comodidadesVinculadas },
    { data: equipamentosSeguranca },
    { data: equipamentosVinculados },
    { data: acessorios },
    { data: acessoriosVinculados },
  ] = await Promise.all([
    supabaseAdmin
      .from('embarcacao')
      .select('id, nome, descricao, embarcacao_tipo_id, status, modalidade_capitao, capacidade, comprimento, comprimento_unidade, quartos, banheiros, tripulacao, municipio_id, latitude, longitude, cep, bairro, logradouro, logradouro_numero, complemento')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single(),
    supabaseAdmin
      .from('embarcacao_imagens')
      .select('id, url_imagem, titulo, principal, ordem')
      .eq('embarcacao_id', id)
      .order('ordem'),
    supabaseAdmin.from('embarcacao_tipo').select('id, nome').order('nome'),
    supabaseAdmin.from('estados').select('id, uf, nome').order('nome'),
    supabaseAdmin.from('comodidade').select('id, nome').order('nome'),
    supabaseAdmin.from('embarcacao_comodidades').select('comodidade_id').eq('embarcacao_id', id),
    supabaseAdmin.from('equipamentos_seguranca').select('id, nome').order('nome'),
    supabaseAdmin.from('embarcacao_equipamentos_seguranca').select('equipamento_seguranca_id').eq('embarcacao_id', id),
    supabaseAdmin.from('acessorios').select('id, nome').order('nome'),
    supabaseAdmin.from('embarcacao_acessorios').select('acessorio_id').eq('embarcacao_id', id),
  ]);

  if (!emb) notFound();

  let estadoId: number | null = null;
  let municipios: { id: number; nome: string }[] = [];

  if (emb.municipio_id) {
    const { data: mun } = await supabaseAdmin
      .from('municipios')
      .select('id, estado_id')
      .eq('id', emb.municipio_id)
      .single();

    if (mun?.estado_id) {
      estadoId = mun.estado_id;
      const { data: muns } = await supabaseAdmin
        .from('municipios')
        .select('id, nome')
        .eq('estado_id', mun.estado_id)
        .order('nome');
      municipios = muns ?? [];
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B2447]">Editar Embarcação</h1>
        <p className="text-sm text-slate-400 mt-1">
          Navegue pelas etapas e salve as alterações a qualquer momento.
        </p>
      </div>

      <EditarEmbarcacaoForm
        embarcacao={{
          ...emb,
          estado_id: estadoId,
          embarcacao_imagens: imagens ?? [],
        }}
        tipos={tipos ?? []}
        estados={estados ?? []}
        municipiosIniciais={municipios}
        comodidades={comodidades ?? []}
        comodidadesIniciais={(comodidadesVinculadas ?? []).map(c => c.comodidade_id)}
        equipamentosSeguranca={equipamentosSeguranca ?? []}
        equipamentosSegurancaIniciais={(equipamentosVinculados ?? []).map(e => e.equipamento_seguranca_id)}
        acessorios={acessorios ?? []}
        acessoriosIniciais={(acessoriosVinculados ?? []).map(a => a.acessorio_id)}
      />
    </div>
  );
}
