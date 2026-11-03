import { redirect } from 'next/navigation';
import { Landmark } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import RecebimentoForm from './_components/RecebimentoForm';

export const metadata = { title: 'Dados de recebimento — Painel Boatzy' };

export default async function RecebimentosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');
  if (!(await checkRoleInDb(user.id, ['gestor', 'admin']))) redirect('/painel');

  const [{ data: ativo }, { data: historico }, { data: conta }] = await Promise.all([
    supabaseAdmin.from('gestor_recebimento').select('*').eq('owner_id', user.id).eq('ativo', true).maybeSingle(),
    supabaseAdmin
      .from('gestor_recebimento')
      .select('*')
      .eq('owner_id', user.id)
      .eq('ativo', false)
      .order('criado_em', { ascending: false })
      .limit(5),
    supabaseAdmin.from('users').select('name, cpf_cnpj').eq('id', user.id).maybeSingle(),
  ]);

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-start gap-3 sm:items-center">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 sm:h-11 sm:w-11">
          <Landmark className="h-5 w-5 text-teal-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#0B2447] sm:text-2xl">Dados de recebimento</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Onde o Boatzy deposita o valor dos seus passeios. Sem estes dados, não conseguimos fazer o seu repasse.
          </p>
        </div>
      </div>

      <RecebimentoForm
        ativo={ativo ?? null}
        historico={historico ?? []}
        nomeDaConta={conta?.name ?? ''}
        documentoDaConta={conta?.cpf_cnpj ?? null}
      />
    </div>
  );
}
