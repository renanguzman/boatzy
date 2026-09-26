import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { termoIdentificadorLabel } from '@/lib/termos/identificadores';
import TermoForm, { type TermoInicial } from '../../_components/TermoForm';

export default async function EditarTermoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/administrator/login');

  const { id } = await params;

  const { data: termo } = await supabaseAdmin
    .from('termos_uso_plataforma')
    .select('id, identificador, versao, titulo, conteudo, descricao_interna, status, exige_rolagem_completa, exige_confirmacao_digitada')
    .eq('id', id)
    .single();

  if (!termo) notFound();

  // Versões publicadas/arquivadas são imutáveis: volta para a visualização.
  if (termo.status !== 'rascunho') redirect(`/administrator/termos/${id}`);

  const termoInicial: TermoInicial = {
    id: termo.id,
    identificador: termo.identificador,
    versao: termo.versao,
    titulo: termo.titulo,
    conteudo: termo.conteudo,
    descricaoInterna: termo.descricao_interna,
    exigeRolagemCompleta: termo.exige_rolagem_completa,
    exigeConfirmacaoDigitada: termo.exige_confirmacao_digitada,
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B2447]">Editar rascunho</h1>
        <p className="text-sm text-slate-400 mt-1">
          {termoIdentificadorLabel(termo.identificador)} — <span className="font-semibold">versão {termo.versao}</span>
        </p>
      </div>

      <TermoForm termo={termoInicial} />
    </div>
  );
}
