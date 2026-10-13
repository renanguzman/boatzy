import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { camposAlteradosDesdeAprovacao, listarTimeline } from '@/lib/publicacao/server';
import StatusPublicacaoBadge from '@/components/publicacao/StatusPublicacaoBadge';
import PainelDecisaoAdmin from '@/components/publicacao/PainelDecisaoAdmin';
import TimelinePublicacao from '@/components/publicacao/TimelinePublicacao';
import {
  CabecalhoRevisao, CamposAlteradosCard, DadosRevisao, GaleriaRevisao, SecaoRevisao,
} from '@/components/publicacao/RevisaoAdmin';
import type { PublicacaoStatus } from '@/types/supabase';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Revisão de um anúncio de venda pelo admin. Os dados técnicos e as fotos
 * vêm da embarcação vinculada (revisada na própria tela dela).
 */
export default async function AdminRevisaoAnuncioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: anuncio } = await supabaseAdmin
    .from('anuncio_venda')
    .select(`
      id, owner_id, fabricante, ano_modelo, ano_fabricacao, preco, descricao_venda, status, visualizacoes,
      created_at, enviado_analise_em, aprovado_em, primeira_aprovacao_em, revisao,
      embarcacao ( id, nome, status, embarcacao_tipo ( nome ), embarcacao_imagens ( url_imagem, titulo, principal, ordem ) )
    `)
    .eq('id', id)
    .maybeSingle();

  if (!anuncio) notFound();

  const [{ data: gestor }, campos, timeline] = await Promise.all([
    supabaseAdmin.from('users').select('name, email').eq('id', anuncio.owner_id).maybeSingle(),
    camposAlteradosDesdeAprovacao('anuncio_venda', id),
    listarTimeline('anuncio_venda', id, { incluirInterna: true }),
  ]);

  const emb = anuncio.embarcacao as unknown as {
    id: string; nome: string; status: PublicacaoStatus;
    embarcacao_tipo: { nome: string } | null;
    embarcacao_imagens: { url_imagem: string; titulo: string | null; principal: boolean; ordem: number }[];
  } | null;
  const fotos = [...(emb?.embarcacao_imagens ?? [])].sort((a, b) => a.ordem - b.ordem);

  const avisoEmbarcacao = emb && emb.status !== 'ativo'
    ? `A embarcação (${emb.nome}) não está Ativa. Mesmo aprovado, o anúncio só aparece no site quando a embarcação também estiver aprovada.`
    : null;

  return (
    <div className="p-8">
      <CabecalhoRevisao
        voltarHref="/administrator/vendas" voltarLabel="Anúncios de venda"
        titulo={emb?.nome ?? 'Anúncio de venda'} subtitulo="Anúncio de venda"
        status={anuncio.status} gestor={gestor ?? null} controle={anuncio}
      />

      <CamposAlteradosCard campos={campos} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-3">
          <SecaoRevisao titulo="Dados do anúncio">
            <DadosRevisao alterados={campos} linhas={[
              {
                label: 'Embarcação',
                valor: emb ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <Link href={`/administrator/embarcacoes/${emb.id}`} className="font-medium text-[#0B2447] hover:underline">{emb.nome}</Link>
                    <StatusPublicacaoBadge status={emb.status} />
                  </span>
                ) : null,
              },
              { label: 'Tipo', valor: emb?.embarcacao_tipo?.nome },
              { label: 'Fabricante', valor: anuncio.fabricante, chave: 'fabricante' },
              { label: 'Ano do modelo', valor: anuncio.ano_modelo, chave: 'ano_modelo' },
              { label: 'Ano de fabricação', valor: anuncio.ano_fabricacao, chave: 'ano_fabricacao' },
              { label: 'Valor', valor: brl.format(Number(anuncio.preco)) },
              { label: 'Descrição do anúncio', valor: anuncio.descricao_venda, chave: 'descricao_venda', largo: true },
              { label: 'Visualizações', valor: anuncio.visualizacoes },
            ]} />
          </SecaoRevisao>

          <SecaoRevisao titulo={`Fotos da embarcação (${fotos.length})`}>
            <GaleriaRevisao fotos={fotos} />
          </SecaoRevisao>
        </div>

        <div className="space-y-6 xl:col-span-2">
          <PainelDecisaoAdmin entidade="anuncio_venda" id={id} status={anuncio.status} aviso={avisoEmbarcacao} />
          <TimelinePublicacao eventos={timeline} />
        </div>
      </div>
    </div>
  );
}
