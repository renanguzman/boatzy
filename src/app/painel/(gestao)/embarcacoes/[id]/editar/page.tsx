import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import EditarEmbarcacaoForm from './_components/EditarEmbarcacaoForm';

export default async function EditarEmbarcacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await auth.protect();

  const { id } = await params;

  const clerkUser = await currentUser();
  if (!clerkUser) redirect('/painel/login');

  const { data: dbUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id_clerk', clerkUser.id)
    .single();

  if (!dbUser) redirect('/painel/login');

  // Queries separadas para evitar problemas de inferência de tipo com joins aninhados
  const [
    { data: emb },
    { data: imagens },
    { data: regras },
    { data: tipos },
    { data: categorias },
    { data: estados },
  ] = await Promise.all([
    supabaseAdmin
      .from('embarcacao')
      .select('id, nome, descricao, embarcacao_tipo_id, embarcacao_categoria_id, status, capacidade, comprimento, cabines, tripulacao, preco_base, municipio_id, cep, bairro, logradouro, logradouro_numero, complemento')
      .eq('id', id)
      .eq('owner_id', dbUser.id)
      .single(),
    supabaseAdmin
      .from('embarcacao_imagens')
      .select('id, url_imagem, titulo, principal')
      .eq('embarcacao_id', id),
    supabaseAdmin
      .from('embarcacao_preco_regra')
      .select('id, nome, valor, tipo, prioridade, ativo, dias_semana, periodo_mes_inicio, periodo_dia_inicio, periodo_mes_fim, periodo_dia_fim, data_inicio, data_fim')
      .eq('embarcacao_id', id)
      .order('prioridade', { ascending: false }),
    supabaseAdmin.from('embarcacao_tipo').select('id, nome').order('nome'),
    supabaseAdmin.from('embarcacao_categoria').select('id, nome').order('nome'),
    supabaseAdmin.from('estados').select('id, uf, nome').order('nome'),
  ]);

  if (!emb) notFound();

  // Resolve estado_id a partir do municipio_id
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
          Atualize os dados, fotos e regras de preço da embarcação.
        </p>
      </div>

      <EditarEmbarcacaoForm
        embarcacao={{
          ...emb,
          estado_id: estadoId,
          embarcacao_imagens: imagens ?? [],
          embarcacao_preco_regra: (regras ?? []) as {
            id: string; nome: string; valor: number; tipo: string;
            prioridade: number; ativo: boolean;
            dias_semana: number[] | null;
            periodo_mes_inicio: number | null; periodo_dia_inicio: number | null;
            periodo_mes_fim: number | null;   periodo_dia_fim: number | null;
            data_inicio: string | null;       data_fim: string | null;
          }[],
        }}
        tipos={tipos ?? []}
        categorias={categorias ?? []}
        estados={estados ?? []}
        municipiosIniciais={municipios}
      />
    </div>
  );
}
