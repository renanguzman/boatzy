import { supabaseAdmin } from '@/lib/supabase';
import CadastrosAuxiliaresTabs from './_components/CadastrosAuxiliaresTabs';

export default async function CadastrosAuxiliaresPage() {
  const [{ data: acessorios }, { data: comodidades }, { data: equipamentosSeguranca }] = await Promise.all([
    supabaseAdmin.from('acessorios').select('id, nome, nome_en, nome_es').order('nome'),
    supabaseAdmin.from('comodidade').select('id, nome, nome_en, nome_es').order('nome'),
    supabaseAdmin.from('equipamentos_seguranca').select('id, nome, nome_en, nome_es').order('nome'),
  ]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B2447]">Cadastros Auxiliares</h1>
        <p className="text-sm text-slate-400 mt-1">
          Gerencie os catálogos de Acessórios, Comodidades e Equipamentos de Segurança disponíveis no cadastro de embarcações.
        </p>
      </div>

      <CadastrosAuxiliaresTabs
        acessorios={acessorios ?? []}
        comodidades={comodidades ?? []}
        equipamentosSeguranca={equipamentosSeguranca ?? []}
      />
    </div>
  );
}
