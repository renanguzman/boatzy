import { redirect } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { partesNoFuso } from '@/lib/datas';
import { getOperadorPerfil, getResumoOperador, listarEventosPerfil } from '@/lib/operador';
import { fatosDoOperador } from '@/lib/descricao/fatos-operador';
import PerfilForm from './_components/PerfilForm';

export const metadata = { title: 'Meu perfil — Painel Boatzy' };

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');
  if (!(await checkRoleInDb(user.id, ['gestor', 'admin']))) redirect('/painel');

  const [perfil, resumo, eventos, { data: conta }, fatos] = await Promise.all([
    getOperadorPerfil(user.id),
    getResumoOperador(user.id),
    listarEventosPerfil(user.id, { incluirInterna: false, limite: 10 }),
    supabaseAdmin.from('users').select('name, created_at').eq('id', user.id).maybeSingle(),
    // Dados do cadastro que a IA usa (o servidor monta de novo ao gerar; aqui só para mostrar ao gestor).
    fatosDoOperador(user.id, ''),
  ]);

  // Último recado da equipe: vale enquanto o perfil estiver devolvido ou retirado.
  const recado = perfil && (perfil.status === 'devolvido' || perfil.status === 'retirado')
    ? eventos.find((e) => e.tipo === perfil.status)?.observacao ?? null
    : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-start gap-3 sm:items-center">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 sm:h-11 sm:w-11">
          <UserRound className="h-5 w-5 text-teal-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#0B2447] sm:text-2xl">Meu perfil</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Apresente-se aos clientes: uma foto e algumas linhas sobre você aparecem no fim das páginas dos seus passeios e embarcações.
          </p>
        </div>
      </div>

      <PerfilForm
        ownerId={user.id}
        nomeDaConta={conta?.name ?? ''}
        desdeAno={partesNoFuso(conta?.created_at ? new Date(conta.created_at) : new Date()).ano}
        status={perfil?.status ?? null}
        versao={perfil?.updated_at ?? null}
        inicial={{
          nome: perfil?.nome_publico ?? '',
          headline: perfil?.headline ?? '',
          bio: perfil?.bio ?? '',
          fotoUrl: perfil?.foto_url ?? null,
          consentimento: !!perfil?.consentimento_em,
        }}
        publicado={perfil?.publicado ?? null}
        enviadoEm={perfil?.enviado_analise_em ?? null}
        recado={recado}
        fatos={fatos}
        resumo={resumo}
      />
    </div>
  );
}
