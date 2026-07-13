import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import AnuncioForm from '../../_components/AnuncioForm';
import { toOption, EMBARCACAO_OPTION_SELECT, type EmbarcacaoRow } from '../../_components/embarcacao-option';

export default async function EditarAnuncioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  const { data: anuncio } = await supabaseAdmin
    .from('anuncio_venda')
    .select('id, embarcacao_id, fabricante, ano_modelo, ano_fabricacao, preco, descricao_venda, status')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single();

  if (!anuncio) notFound();
  // Anúncio encerrado não é editável (ciclo terminou; crie um novo).
  if (anuncio.status === 'vendido' || anuncio.status === 'cancelado') {
    redirect('/painel/vendas');
  }

  const [{ data: embarcacao }, { data: historico }, { data: tipos }] = await Promise.all([
    supabaseAdmin
      .from('embarcacao')
      .select(EMBARCACAO_OPTION_SELECT)
      .eq('id', anuncio.embarcacao_id)
      .single(),
    supabaseAdmin
      .from('anuncio_venda_preco')
      .select('preco, created_at')
      .eq('anuncio_id', anuncio.id)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('embarcacao_tipo')
      .select('id, nome')
      .order('nome'),
  ]);

  if (!embarcacao) notFound();
  const option = toOption(embarcacao as unknown as EmbarcacaoRow);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B2447]">Editar anúncio de venda</h1>
        <p className="text-sm text-slate-400 mt-1">
          {option.nome} — reduções de preço ganham destaque no site.
        </p>
      </div>

      <AnuncioForm
        modo="editar"
        anuncioId={anuncio.id}
        embarcacoes={[option]}
        tipos={tipos ?? []}
        initial={{
          embarcacaoId: anuncio.embarcacao_id,
          fabricante: anuncio.fabricante,
          anoModelo: String(anuncio.ano_modelo),
          anoFabricacao: String(anuncio.ano_fabricacao),
          preco: String(anuncio.preco),
          descricaoVenda: anuncio.descricao_venda ?? '',
        }}
        historico={historico ?? []}
      />
    </div>
  );
}
