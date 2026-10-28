import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { camposAlteradosDesdeAprovacao, listarTimeline } from '@/lib/publicacao/server';
import { formatarComprimento } from '@/lib/comprimento';
import StatusPublicacaoBadge from '@/components/publicacao/StatusPublicacaoBadge';
import PainelDecisaoAdmin from '@/components/publicacao/PainelDecisaoAdmin';
import TimelinePublicacao from '@/components/publicacao/TimelinePublicacao';
import {
  CabecalhoRevisao, CamposAlteradosCard, DadosRevisao, GaleriaRevisao, SecaoRevisao,
} from '@/components/publicacao/RevisaoAdmin';
import { documentacaoDaEmbarcacao } from '@/lib/documentos/admin';
import { DocumentosEmbarcacaoAdmin, EquipeHabilitacoesAdmin } from './_components/DocumentacaoAdmin';
import type { ModalidadeCapitao, PublicacaoStatus } from '@/types/supabase';

const CAPITAO: Record<ModalidadeCapitao, string> = {
  com_capitao: 'Com capitão obrigatório',
  sem_capitao: 'Sem capitão',
  opcional: 'Capitão opcional',
};

/** Revisão de uma embarcação pelo admin: dados, o que mudou, decisão e histórico. */
export default async function AdminRevisaoEmbarcacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: emb } = await supabaseAdmin
    .from('embarcacao')
    .select(`
      id, owner_id, nome, descricao, status, modalidade_capitao, capacidade, comprimento, comprimento_unidade,
      quartos, banheiros, tripulacao, cep, bairro, logradouro, logradouro_numero, complemento, regras,
      created_at, enviado_analise_em, aprovado_em, primeira_aprovacao_em, revisao,
      embarcacao_tipo ( nome ),
      municipios ( nome, estados ( uf ) ),
      embarcacao_imagens ( url_imagem, titulo, principal, ordem ),
      embarcacao_comodidades ( comodidade ( nome ) ),
      embarcacao_acessorios ( acessorios ( nome ) ),
      embarcacao_equipamentos_seguranca ( equipamentos_seguranca ( nome ) ),
      roteiro ( id, nome, status )
    `)
    .eq('id', id)
    .maybeSingle();

  if (!emb) notFound();

  const [{ data: gestor }, campos, timeline, documentacao] = await Promise.all([
    supabaseAdmin.from('users').select('name, email').eq('id', emb.owner_id).maybeSingle(),
    camposAlteradosDesdeAprovacao('embarcacao', id),
    listarTimeline('embarcacao', id, { incluirInterna: true }),
    documentacaoDaEmbarcacao(id, emb.owner_id),
  ]);

  const tipo = emb.embarcacao_tipo as unknown as { nome: string } | null;
  const mun = emb.municipios as unknown as { nome: string; estados: { uf: string } | null } | null;
  const fotos = [...((emb.embarcacao_imagens ?? []) as unknown as { url_imagem: string; titulo: string | null; principal: boolean; ordem: number }[])]
    .sort((a, b) => a.ordem - b.ordem);
  const nomes = <T,>(rows: unknown, pegar: (r: T) => string | undefined) =>
    ((rows ?? []) as T[]).map(pegar).filter(Boolean).join(', ') || '—';
  const roteiros = (emb.roteiro ?? []) as unknown as { id: string; nome: string; status: PublicacaoStatus }[];
  const endereco = [emb.logradouro, emb.logradouro_numero, emb.complemento, emb.bairro].filter(Boolean).join(', ');

  return (
    <div className="p-8">
      <CabecalhoRevisao
        voltarHref="/administrator/embarcacoes" voltarLabel="Embarcações"
        titulo={emb.nome} status={emb.status} gestor={gestor ?? null}
        controle={emb} editarHref={`/administrator/embarcacoes/${id}/editar`}
      />

      <CamposAlteradosCard campos={campos} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-3">
          <SecaoRevisao titulo={`Fotos (${fotos.length})`}>
            <GaleriaRevisao fotos={fotos} destacar={!!campos?.includes('fotos')} />
          </SecaoRevisao>

          <SecaoRevisao titulo="Dados da embarcação">
            <DadosRevisao alterados={campos} linhas={[
              { label: 'Nome', valor: emb.nome, chave: 'nome' },
              { label: 'Tipo', valor: tipo?.nome, chave: 'embarcacao_tipo_id' },
              { label: 'Descrição', valor: emb.descricao, chave: 'descricao', largo: true },
              { label: 'Capitão', valor: emb.modalidade_capitao ? CAPITAO[emb.modalidade_capitao] : null, chave: 'modalidade_capitao' },
              { label: 'Capacidade', valor: emb.capacidade != null ? `${emb.capacidade} pessoas` : null, chave: 'capacidade' },
              { label: 'Comprimento', valor: emb.comprimento != null ? formatarComprimento(emb.comprimento, emb.comprimento_unidade) : null, chave: 'comprimento' },
              { label: 'Quartos', valor: emb.quartos, chave: 'quartos' },
              { label: 'Banheiros', valor: emb.banheiros, chave: 'banheiros' },
              { label: 'Tripulação', valor: emb.tripulacao, chave: 'tripulacao' },
              { label: 'Localização', valor: [endereco, mun ? `${mun.nome}${mun.estados ? ` / ${mun.estados.uf}` : ''}` : null, emb.cep].filter(Boolean).join(' · ') || null, chave: 'localizacao', largo: true },
              { label: 'Regras a bordo', valor: (emb.regras as string[] | null)?.length ? (emb.regras as string[]).join(' · ') : null, chave: 'regras', largo: true },
              { label: 'Comodidades', valor: nomes<{ comodidade: { nome: string } | null }>(emb.embarcacao_comodidades, r => r.comodidade?.nome), largo: true },
              { label: 'Acessórios', valor: nomes<{ acessorios: { nome: string } | null }>(emb.embarcacao_acessorios, r => r.acessorios?.nome), largo: true },
              { label: 'Equipamentos de segurança', valor: nomes<{ equipamentos_seguranca: { nome: string } | null }>(emb.embarcacao_equipamentos_seguranca, r => r.equipamentos_seguranca?.nome), largo: true },
            ]} />
          </SecaoRevisao>

          <DocumentosEmbarcacaoAdmin documentos={documentacao.documentos} />
          <EquipeHabilitacoesAdmin equipe={documentacao.equipe} />

          {roteiros.length > 0 && (
            <SecaoRevisao titulo={`Roteiros vinculados (${roteiros.length})`}>
              <ul className="divide-y divide-slate-100">
                {roteiros.map(r => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href={`/administrator/roteiros/${r.id}`} className="text-sm font-medium text-[#0B2447] hover:underline">{r.nome}</Link>
                    <StatusPublicacaoBadge status={r.status} />
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-400">Roteiros só aparecem no site quando eles e a embarcação estão Ativos.</p>
            </SecaoRevisao>
          )}
        </div>

        <div className="space-y-6 xl:col-span-2">
          <PainelDecisaoAdmin entidade="embarcacao" id={id} status={emb.status} />
          <TimelinePublicacao eventos={timeline} />
        </div>
      </div>
    </div>
  );
}
