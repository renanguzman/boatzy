import { redirect } from 'next/navigation';
import { UsersRound, UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ensureGestorEquipeMembro } from '@/lib/equipe';
import NovoMembroForm from './_components/NovoMembroForm';
import EquipeGrid, { type MembroListItem } from './_components/EquipeGrid';

type MembroRow = {
  id: string;
  nome_completo: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  foto_url: string | null;
  ativo: boolean;
  user_id: string | null;
  created_at: string;
  equipe_membro_embarcacao: { embarcacao: { id: string; nome: string } | null }[];
};

export default async function EquipePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  // Garante a ficha "Você (gestor)" — opção de atendente na confirmação.
  await ensureGestorEquipeMembro(user.id);

  const [{ data: membrosData }, { data: embarcacoesData }] = await Promise.all([
    supabaseAdmin
      .from('equipe_membro')
      .select(
        `id, nome_completo, cpf, email, telefone, foto_url, ativo, user_id, created_at,
         equipe_membro_embarcacao ( embarcacao ( id, nome ) )`,
      )
      .eq('owner_id', user.id)
      .eq('is_gestor', false)
      .order('nome_completo', { ascending: true }),
    supabaseAdmin
      .from('embarcacao')
      .select('id, nome')
      .eq('owner_id', user.id)
      .order('nome', { ascending: true }),
  ]);

  const membros = (membrosData ?? []) as unknown as MembroRow[];
  const embarcacoes = (embarcacoesData ?? []) as { id: string; nome: string }[];

  // Total de atendimentos por membro (semente do relatório futuro).
  const atendimentosPorMembro = new Map<string, number>();
  if (membros.length > 0) {
    const { data: atendRows } = await supabaseAdmin
      .from('reserva_atendente')
      .select('equipe_membro_id')
      .in('equipe_membro_id', membros.map((m) => m.id));
    for (const r of atendRows ?? []) {
      atendimentosPorMembro.set(
        r.equipe_membro_id,
        (atendimentosPorMembro.get(r.equipe_membro_id) ?? 0) + 1,
      );
    }
  }

  const lista: MembroListItem[] = membros.map((m) => ({
    id: m.id,
    nome_completo: m.nome_completo,
    cpf: m.cpf,
    email: m.email,
    telefone: m.telefone,
    foto_url: m.foto_url,
    ativo: m.ativo,
    tem_conta_vinculada: m.user_id != null,
    embarcacoes: (m.equipe_membro_embarcacao ?? [])
      .map((v) => v.embarcacao)
      .filter((e): e is { id: string; nome: string } => e != null),
    total_atendimentos: atendimentosPorMembro.get(m.id) ?? 0,
    created_at: m.created_at,
  }));

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-teal-50 flex items-center justify-center">
          <UsersRound className="w-5 h-5 text-teal-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Equipe</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Cadastre as pessoas que ajudam a cuidar das suas embarcações. Ao confirmar uma reserva,
            você indica quem vai atender o cliente.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
        <div className="flex items-center gap-2 mb-6">
          <UserPlus className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700">Novo membro</h2>
        </div>
        {embarcacoes.length === 0 ? (
          <p className="text-sm text-slate-500">
            Cadastre uma embarcação antes de adicionar membros à equipe.
          </p>
        ) : (
          <NovoMembroForm embarcacoes={embarcacoes} />
        )}
      </div>

      <EquipeGrid membros={lista} />
    </div>
  );
}
