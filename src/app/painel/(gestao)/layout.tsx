import Sidebar from '@/components/painel/Sidebar';
import Header from '@/components/painel/Header';
import AtualizarAoVivo from '@/components/painel/AtualizarAoVivo';
import SolicitacaoGestor from '@/components/painel/SolicitacaoGestor';
import { TutorialProvider } from '@/components/painel/TutorialPainel';
import { MenuMobileProvider } from '@/components/painel/MenuMobile';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ultimaSolicitacaoGestor } from '@/lib/solicitacao-gestor';
import { getMunicipiosByEstado } from '@/lib/conta-actions';
import { redirect } from 'next/navigation';
import type { UserRole } from '@/types/supabase';

export default async function GestaoLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Busca roles diretamente no banco — fonte da verdade.
  let roles: UserRole[] = [];
  if (user) {
    const { data: rows } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    roles = (rows ?? []).map((r) => r.role);
  }

  const canAccess = roles.includes('gestor') || roles.includes('admin');

  // Badges da sidebar: mensagens de chat não lidas e solicitações de reserva pendentes.
  let naoLidas = 0;
  let pendentes = 0;
  if (user && canAccess) {
    const [{ data }, { count }] = await Promise.all([
      supabaseAdmin.rpc('chat_total_nao_lidas', { p_gestor: user.id }),
      supabaseAdmin
        .from('reserva')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .eq('status', 'pendente'),
    ]);
    naoLidas = Number(data ?? 0);
    pendentes = count ?? 0;
  }

  // Sem o papel de gestor: o acesso é pedido e só vem com a aprovação do admin (SPEC §62).
  if (!canAccess) {
    if (!user) redirect('/painel/login');

    const ultima = await ultimaSolicitacaoGestor(user.id);
    const [{ data: estados }, { data: perfil }, municipiosIniciais] = await Promise.all([
      supabaseAdmin.from('estados').select('id, uf, nome').order('nome'),
      supabaseAdmin.from('users').select('name, phone, cpf_cnpj').eq('id', user.id).maybeSingle(),
      ultima?.status === 'recusada' ? getMunicipiosByEstado(ultima.estadoId) : Promise.resolve([]),
    ]);

    return (
      <SolicitacaoGestor
        estados={estados ?? []}
        municipiosIniciais={municipiosIniciais}
        perfil={{ nome: perfil?.name ?? '', telefone: perfil?.phone ?? null, documento: perfil?.cpf_cnpj ?? null }}
        ultima={ultima}
      />
    );
  }

  return (
    <MenuMobileProvider>
      <TutorialProvider>
        {/* h-dvh: no Safari/Chrome mobile acompanha a barra de endereço (h-screen corta o rodapé). */}
        <div className="painel-shell flex h-dvh overflow-hidden bg-[#F8F9FB]">
          <Sidebar naoLidas={naoLidas} pendentes={pendentes} userId={user?.id ?? null} />
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <Header />
            <AtualizarAoVivo />
            <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain pb-[env(safe-area-inset-bottom)]" data-tour="dashboard-content">
              {children}
            </main>
          </div>
        </div>
      </TutorialProvider>
    </MenuMobileProvider>
  );
}
