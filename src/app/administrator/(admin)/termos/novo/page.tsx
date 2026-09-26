import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import TermoForm, { type SituacaoIdentificador } from '../_components/TermoForm';

export default async function NovoTermoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/administrator/login');

  // Situação de cada identificador: última versão e se já há rascunho em andamento.
  const { data: versoes } = await supabaseAdmin
    .from('termos_uso_plataforma')
    .select('identificador, versao, status');

  const situacao: Record<string, SituacaoIdentificador> = {};
  for (const v of versoes ?? []) {
    const s = (situacao[v.identificador] ??= { ultimaVersao: 0, temRascunho: false });
    s.ultimaVersao = Math.max(s.ultimaVersao, v.versao);
    if (v.status === 'rascunho') s.temRascunho = true;
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B2447]">Novo termo</h1>
        <p className="text-sm text-slate-400 mt-1">
          Escreva o texto em Markdown e acompanhe na pré-visualização como o usuário o verá.
        </p>
      </div>

      <TermoForm situacao={situacao} />
    </div>
  );
}
