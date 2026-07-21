import { redirect } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import MinhaContaForm from './_components/MinhaContaForm';

export default async function MinhaContaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/entrar?redirect_to=/minha-conta');

  // Dados persistidos do cliente + lista de estados (mesma fonte do cadastro de roteiro).
  const [{ data: perfil }, { data: estados }] = await Promise.all([
    supabaseAdmin
      .from('users')
      .select(
        'name, email, cpf_cnpj, phone, birthday, avatar_url, created_at, endereco_cep, endereco_estado_id, endereco_municipio_id, endereco_bairro, endereco_logradouro, endereco_numero, endereco_complemento, notif_email_conversas',
      )
      .eq('id', user.id)
      .maybeSingle(),
    supabaseAdmin.from('estados').select('id, uf, nome').order('nome'),
  ]);

  // Município salvo (para preencher o select dependente já na carga).
  let municipiosIniciais: { id: number; nome: string }[] = [];
  if (perfil?.endereco_estado_id) {
    const { data } = await supabaseAdmin
      .from('municipios')
      .select('id, nome')
      .eq('estado_id', perfil.endereco_estado_id)
      .order('nome');
    municipiosIniciais = data ?? [];
  }

  // Provedores de login vinculados (email = conta por senha; google/facebook/apple = SSO).
  const providers = Array.from(
    new Set(
      (user.identities ?? [])
        .map((i) => i.provider)
        .concat((user.app_metadata?.providers as string[] | undefined) ?? []),
    ),
  );
  if (providers.length === 0) providers.push('email');
  const canChangePassword = providers.includes('email');

  const name =
    perfil?.name ??
    (user.user_metadata?.full_name as string | undefined) ??
    (user.email?.split('@')[0] ?? 'Cliente');

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold text-[#0B2447]">Minha conta</h1>
        <p className="mt-1 text-sm text-slate-500">Gerencie seus dados pessoais e preferências.</p>

        <MinhaContaForm
          email={perfil?.email ?? user.email ?? ''}
          name={name}
          cpf={perfil?.cpf_cnpj ?? null}
          phone={perfil?.phone ?? null}
          birthday={perfil?.birthday ?? null}
          avatarUrl={perfil?.avatar_url ?? null}
          createdAt={perfil?.created_at ?? user.created_at}
          canChangePassword={canChangePassword}
          providers={providers}
          notifEmailConversas={perfil?.notif_email_conversas ?? true}
          estados={estados ?? []}
          municipiosIniciais={municipiosIniciais}
          endereco={{
            cep: perfil?.endereco_cep ?? '',
            estado_id: perfil?.endereco_estado_id != null ? String(perfil.endereco_estado_id) : '',
            municipio_id: perfil?.endereco_municipio_id != null ? String(perfil.endereco_municipio_id) : '',
            bairro: perfil?.endereco_bairro ?? '',
            logradouro: perfil?.endereco_logradouro ?? '',
            numero: perfil?.endereco_numero ?? '',
            complemento: perfil?.endereco_complemento ?? '',
          }}
        />
      </main>

      <Footer />
    </div>
  );
}
