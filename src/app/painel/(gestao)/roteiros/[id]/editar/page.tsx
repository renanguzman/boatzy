import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import EditarRoteiroForm from './_components/EditarRoteiroForm';

export default async function EditarRoteiroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  const { id } = await params;

  const [
    { data: roteiro },
    { data: imagens },
    { data: estados },
    { data: embarcacoes },
  ] = await Promise.all([
    supabaseAdmin
      .from('roteiro')
      .select('id, embarcacao_id, nome, descricao, duracao, quantidade_pessoas, origem, destino, municipio_id, cep, bairro, logradouro, logradouro_numero, complemento, latitude, longitude')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single(),
    supabaseAdmin
      .from('roteiro_imagens')
      .select('id, url_imagem, titulo, principal')
      .eq('roteiro_id', id),
    supabaseAdmin.from('estados').select('id, uf, nome').order('nome'),
    supabaseAdmin
      .from('embarcacao')
      .select('id, nome')
      .eq('owner_id', user.id)
      .eq('status', 'ativo')
      .order('nome'),
  ]);

  if (!roteiro) notFound();

  let estadoId: number | null = null;
  let municipios: { id: number; nome: string }[] = [];

  if (roteiro.municipio_id) {
    const { data: mun } = await supabaseAdmin
      .from('municipios')
      .select('id, estado_id')
      .eq('id', roteiro.municipio_id)
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
        <h1 className="text-2xl font-bold text-[#0B2447]">Editar Roteiro</h1>
        <p className="text-sm text-slate-400 mt-1">
          Atualize os dados e fotos do roteiro de passeio.
        </p>
      </div>

      <EditarRoteiroForm
        roteiro={{
          ...roteiro,
          estado_id: estadoId,
          roteiro_imagens: imagens ?? [],
        }}
        estados={estados ?? []}
        municipiosIniciais={municipios}
        embarcacoes={embarcacoes ?? []}
      />
    </div>
  );
}
