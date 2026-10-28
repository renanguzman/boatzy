import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ensureGestorEquipeMembro } from '@/lib/equipe';
import { listarCondutores, listarDocumentos, listarEmbarcacoesDoGestor } from '@/lib/documentos/server';
import { TIPOS_DOCUMENTO, TIPOS_POR_ESCOPO } from '@/lib/documentos/tipos';
import type { DocumentoEscopo, DocumentoTipo } from '@/types/supabase';
import DocumentoWizard from '../_components/DocumentoWizard';

export default async function NovoDocumentoPage({
  searchParams,
}: {
  searchParams: Promise<{ escopo?: string; tipo?: string; embarcacao?: string; membro?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  await ensureGestorEquipeMembro(user.id);
  const [params, embarcacoes, condutores, documentos] = await Promise.all([
    searchParams,
    listarEmbarcacoesDoGestor(user.id),
    listarCondutores(user.id),
    listarDocumentos(user.id),
  ]);

  // Atalhos vindos da lista ("Enviar", "Renovar"): só valores válidos e do próprio gestor.
  const escopo: DocumentoEscopo = params.escopo === 'condutor' ? 'condutor' : 'embarcacao';
  const tipo = params.tipo && params.tipo in TIPOS_DOCUMENTO && TIPOS_POR_ESCOPO[escopo].includes(params.tipo as DocumentoTipo)
    ? (params.tipo as DocumentoTipo)
    : undefined;
  const embarcacaoId = embarcacoes.some((e) => e.id === params.embarcacao) ? params.embarcacao : undefined;
  const membroId = condutores.some((m) => m.id === params.membro) ? params.membro : undefined;

  const ativos = documentos
    .filter((d) => !d.arquivado_em)
    .map((d) => ({ id: d.id, tipo: d.tipo, embarcacao_id: d.embarcacao_id, equipe_membro_id: d.equipe_membro_id, data_validade: d.data_validade }));

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <Link href="/painel/documentos" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ChevronLeft className="h-4 w-4" /> Documentos
      </Link>
      <h1 className="mb-1 text-xl font-bold text-[#0B2447] sm:text-2xl">Enviar documento</h1>
      <p className="mb-6 text-sm text-slate-500">Tire uma foto ou envie o PDF — nós lemos e preenchemos os dados para você conferir.</p>
      <DocumentoWizard
        embarcacoes={embarcacoes}
        condutores={condutores}
        ativos={ativos}
        inicial={{ escopo, tipo, embarcacaoId, membroId }}
      />
    </div>
  );
}
