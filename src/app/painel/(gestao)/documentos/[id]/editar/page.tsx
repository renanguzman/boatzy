import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { listarCondutores, listarEmbarcacoesDoGestor, obterDocumento } from '@/lib/documentos/server';
import { ehUuid } from '@/lib/upload-imagem-server';
import { nomeCurtoDocumento } from '@/lib/documentos/tipos';
import DocumentoWizard from '../../_components/DocumentoWizard';

export default async function EditarDocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  const [documento, embarcacoes, condutores] = await Promise.all([
    obterDocumento(user.id, id),
    listarEmbarcacoesDoGestor(user.id),
    listarCondutores(user.id),
  ]);
  if (!documento) notFound();

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <Link href="/painel/documentos" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ChevronLeft className="h-4 w-4" /> Documentos
      </Link>
      <h1 className="mb-6 text-xl font-bold text-[#0B2447] sm:text-2xl">Editar {nomeCurtoDocumento(documento.tipo, documento.titulo)}</h1>
      <DocumentoWizard embarcacoes={embarcacoes} condutores={condutores} ativos={[]} documento={documento} />
    </div>
  );
}
