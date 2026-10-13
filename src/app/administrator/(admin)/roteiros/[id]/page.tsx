import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { camposAlteradosDesdeAprovacao, listarTimeline } from '@/lib/publicacao/server';
import { duracaoTexto } from '@/lib/duracao';
import StatusPublicacaoBadge from '@/components/publicacao/StatusPublicacaoBadge';
import PainelDecisaoAdmin from '@/components/publicacao/PainelDecisaoAdmin';
import TimelinePublicacao from '@/components/publicacao/TimelinePublicacao';
import {
  CabecalhoRevisao, CamposAlteradosCard, DadosRevisao, GaleriaRevisao, SecaoRevisao,
} from '@/components/publicacao/RevisaoAdmin';
import type { PublicacaoStatus } from '@/types/supabase';

/** Revisão de um roteiro pelo admin: dados, o que mudou, decisão e histórico. */
export default async function AdminRevisaoRoteiroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: rot } = await supabaseAdmin
    .from('roteiro')
    .select(`
      id, owner_id, nome, descricao, status, origem, destino, duracao_horas, quantidade_pessoas, horario_saida,
      created_at, enviado_analise_em, aprovado_em, primeira_aprovacao_em, revisao,
      embarcacao ( id, nome, status ),
      municipios ( nome, estados ( uf ) ),
      roteiro_imagens ( url_imagem, titulo, principal, ordem ),
      roteiro_parada ( nome, ordem )
    `)
    .eq('id', id)
    .maybeSingle();

  if (!rot) notFound();

  const [{ data: gestor }, campos, timeline] = await Promise.all([
    supabaseAdmin.from('users').select('name, email').eq('id', rot.owner_id).maybeSingle(),
    camposAlteradosDesdeAprovacao('roteiro', id),
    listarTimeline('roteiro', id, { incluirInterna: true }),
  ]);

  const emb = rot.embarcacao as unknown as { id: string; nome: string; status: PublicacaoStatus } | null;
  const mun = rot.municipios as unknown as { nome: string; estados: { uf: string } | null } | null;
  const fotos = [...((rot.roteiro_imagens ?? []) as unknown as { url_imagem: string; titulo: string | null; principal: boolean; ordem: number }[])]
    .sort((a, b) => a.ordem - b.ordem);
  const paradas = [...((rot.roteiro_parada ?? []) as unknown as { nome: string; ordem: number }[])]
    .sort((a, b) => a.ordem - b.ordem).map(p => p.nome);

  const avisoEmbarcacao = emb && emb.status !== 'ativo'
    ? `A embarcação vinculada (${emb.nome}) não está Ativa. Mesmo aprovado, o roteiro só aparece no site quando a embarcação também for aprovada.`
    : null;

  return (
    <div className="p-8">
      <CabecalhoRevisao
        voltarHref="/administrator/roteiros" voltarLabel="Roteiros"
        titulo={rot.nome}
        subtitulo={[rot.origem, rot.destino].filter(Boolean).join(' → ') || undefined}
        status={rot.status} gestor={gestor ?? null}
        controle={rot} editarHref={`/administrator/roteiros/${id}/editar`}
      />

      <CamposAlteradosCard campos={campos} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-3">
          <SecaoRevisao titulo={`Fotos (${fotos.length})`}>
            <GaleriaRevisao fotos={fotos} destacar={!!campos?.includes('fotos')} />
          </SecaoRevisao>

          <SecaoRevisao titulo="Dados do roteiro">
            <DadosRevisao alterados={campos} linhas={[
              { label: 'Nome', valor: rot.nome, chave: 'nome' },
              {
                label: 'Embarcação vinculada', chave: 'embarcacao_id',
                valor: emb ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <Link href={`/administrator/embarcacoes/${emb.id}`} className="font-medium text-[#0B2447] hover:underline">{emb.nome}</Link>
                    <StatusPublicacaoBadge status={emb.status} />
                  </span>
                ) : null,
              },
              { label: 'Descrição', valor: rot.descricao, chave: 'descricao', largo: true },
              { label: 'Origem', valor: rot.origem, chave: 'origem' },
              { label: 'Destino', valor: rot.destino, chave: 'destino' },
              { label: 'Paradas', valor: paradas.length > 0 ? paradas.join(' → ') : 'Sem paradas', chave: 'paradas', largo: true },
              { label: 'Duração', valor: duracaoTexto(rot.duracao_horas), chave: 'duracao_horas' },
              { label: 'Pessoas', valor: rot.quantidade_pessoas },
              { label: 'Horário de saída', valor: rot.horario_saida?.slice(0, 5) },
              { label: 'Município', valor: mun ? `${mun.nome}${mun.estados ? ` / ${mun.estados.uf}` : ''}` : null },
            ]} />
          </SecaoRevisao>
        </div>

        <div className="space-y-6 xl:col-span-2">
          <PainelDecisaoAdmin entidade="roteiro" id={id} status={rot.status} aviso={avisoEmbarcacao} />
          <TimelinePublicacao eventos={timeline} />
        </div>
      </div>
    </div>
  );
}
