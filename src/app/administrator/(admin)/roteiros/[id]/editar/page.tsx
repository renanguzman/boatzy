import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import EditarRoteiroForm from '@/app/painel/(gestao)/roteiros/[id]/editar/_components/EditarRoteiroForm';

export default async function AdminEditarRoteiroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/administrator/login');

  const { id } = await params;

  // O roteiro vem primeiro: embarcações e catálogo dos selects são do gestor dono.
  const { data: roteiro } = await supabaseAdmin
    .from('roteiro')
    .select('id, owner_id, embarcacao_id, nome, descricao, duracao, quantidade_pessoas, origem, destino, municipio_id, cep, bairro, logradouro, logradouro_numero, complemento, latitude, longitude, preco_base, disponibilidade_dias_semana')
    .eq('id', id)
    .single();

  if (!roteiro) notFound();

  const [
    { data: gestor },
    { data: imagens },
    { data: regras },
    { data: estados },
    { data: embarcacoes },
    { data: catalogo },
    { data: catalogoVinculado },
    { data: bloqueios },
  ] = await Promise.all([
    supabaseAdmin.from('users').select('name, email').eq('id', roteiro.owner_id).single(),
    supabaseAdmin
      .from('roteiro_imagens')
      .select('id, url_imagem, titulo, principal')
      .eq('roteiro_id', id),
    supabaseAdmin
      .from('roteiro_preco_regra')
      .select('id, nome, valor, tipo, prioridade, ativo, dias_semana, periodo_mes_inicio, periodo_dia_inicio, periodo_mes_fim, periodo_dia_fim, data_inicio, data_fim')
      .eq('roteiro_id', id)
      .order('prioridade', { ascending: false }),
    supabaseAdmin.from('estados').select('id, uf, nome').order('nome'),
    supabaseAdmin
      .from('embarcacao')
      .select('id, nome')
      .eq('owner_id', roteiro.owner_id)
      .eq('status', 'ativo')
      .order('nome'),
    supabaseAdmin
      .from('catalogo')
      .select('id, descricao, valor, tipo')
      .eq('owner_id', roteiro.owner_id)
      .order('tipo')
      .order('descricao'),
    supabaseAdmin
      .from('roteiro_catalogo')
      .select('catalogo_id, valor_customizado')
      .eq('roteiro_id', id),
    supabaseAdmin
      .from('roteiro_disponibilidade_bloqueio')
      .select('data')
      .eq('roteiro_id', id)
      .order('data'),
  ]);

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
          {gestor
            ? <>Gestor responsável: <span className="font-semibold text-slate-500">{gestor.name}</span> ({gestor.email})</>
            : 'Atualize os dados e fotos do roteiro de passeio.'}
        </p>
      </div>

      <EditarRoteiroForm
        roteiro={{
          ...roteiro,
          estado_id: estadoId,
          roteiro_imagens: imagens ?? [],
          roteiro_preco_regra: (regras ?? []) as {
            id: string; nome: string; valor: number; tipo: string;
            prioridade: number; ativo: boolean;
            dias_semana: number[] | null;
            periodo_mes_inicio: number | null; periodo_dia_inicio: number | null;
            periodo_mes_fim: number | null; periodo_dia_fim: number | null;
            data_inicio: string | null; data_fim: string | null;
          }[],
        }}
        estados={estados ?? []}
        municipiosIniciais={municipios}
        embarcacoes={embarcacoes ?? []}
        catalogo={(catalogo ?? []) as { id: string; descricao: string; valor: number; tipo: 'produto' | 'servico' }[]}
        catalogoIniciais={(catalogoVinculado ?? []).map(c => ({
          catalogoId: c.catalogo_id,
          valorCustomizado: c.valor_customizado != null ? String(c.valor_customizado) : '',
        }))}
        bloqueiosIniciais={(bloqueios ?? []).map(b => b.data)}
        voltarHref="/administrator/roteiros"
      />
    </div>
  );
}
