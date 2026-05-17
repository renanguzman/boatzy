import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { Users, UserPlus } from 'lucide-react';
import CreateUserForm from './CreateUserForm';

const roleLabel: Record<string, string> = {
  admin: 'Admin',
  gestor: 'Gestor',
  cliente: 'Cliente',
};

const roleBadge: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  gestor: 'bg-cyan-100 text-cyan-700',
  cliente: 'bg-slate-100 text-slate-600',
};

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  // Buscar usuários com suas roles
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('*, user_roles(role)')
    .order('created_at', { ascending: false });

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center gap-3">
        <Users className="w-6 h-6 text-cyan-500" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuários</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Cadastre e gerencie usuários da plataforma.</p>
        </div>
      </div>

      {/* Formulário de criação */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-8">
        <div className="flex items-center gap-2 mb-6">
          <UserPlus className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700">Novo usuário</h2>
        </div>
        <CreateUserForm />
      </div>

      {/* Tabela de usuários */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">
            Usuários cadastrados
            <span className="ml-2 text-slate-400 font-normal">({users?.length ?? 0})</span>
          </h2>
        </div>

        {!users || users.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Nenhum usuário cadastrado ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-6 py-3 font-medium text-slate-500">Nome</th>
                  <th className="px-6 py-3 font-medium text-slate-500">E-mail</th>
                  <th className="px-6 py-3 font-medium text-slate-500">CPF / CNPJ</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Perfis</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Cadastro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const roles = (user.user_roles as Array<{ role: string }>) ?? [];
                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 font-medium text-slate-900">{user.name}</td>
                      <td className="px-6 py-3 text-slate-600">{user.email}</td>
                      <td className="px-6 py-3 text-slate-500">{user.cpf_cnpj ?? '—'}</td>
                      <td className="px-6 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {roles.length > 0 ? roles.map((r) => (
                            <span
                              key={r.role}
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge[r.role] ?? ''}`}
                            >
                              {roleLabel[r.role] ?? r.role}
                            </span>
                          )) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-slate-500">
                        {new Intl.DateTimeFormat('pt-BR').format(new Date(user.created_at))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
