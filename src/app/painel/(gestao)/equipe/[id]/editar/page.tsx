import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import MembroForm, { type MembroFormData } from '../../_components/MembroForm';

type MembroRow = {
  id: string;
  owner_id: string;
  is_gestor: boolean;
  nome_completo: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  foto_url: string | null;
  user_id: string | null;
  equipe_membro_embarcacao: { embarcacao_id: string }[];
  conta: { name: string; email: string } | null;
};

export default async function EditarMembroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  const { data } = await supabaseAdmin
    .from('equipe_membro')
    .select(
      `id, owner_id, is_gestor, nome_completo, cpf, email, telefone, foto_url, user_id,
       equipe_membro_embarcacao ( embarcacao_id ),
       conta:users!equipe_membro_user_id_fkey ( name, email )`,
    )
    .eq('id', id)
    .eq('owner_id', user.id)
    .single();

  if (!data) notFound();
  const m = data as unknown as MembroRow;
  if (m.is_gestor) redirect('/painel/equipe');

  const { data: embarcacoesData } = await supabaseAdmin
    .from('embarcacao')
    .select('id, nome')
    .eq('owner_id', user.id)
    .order('nome', { ascending: true });

  const membro: MembroFormData = {
    id: m.id,
    nome_completo: m.nome_completo,
    cpf: m.cpf,
    email: m.email,
    telefone: m.telefone,
    foto_url: m.foto_url,
    user_id: m.user_id,
    conta_nome: m.conta ? `${m.conta.name} (${m.conta.email})` : null,
    embarcacaoIds: (m.equipe_membro_embarcacao ?? []).map((v) => v.embarcacao_id),
  };

  return (
    <div className="p-8 max-w-3xl">
      <Link
        href="/painel/equipe"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0B2447] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar à equipe
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-[#0B2447]">Editar membro</h1>
      <p className="text-slate-500 mt-0.5 text-sm mb-6">{m.nome_completo}</p>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <MembroForm embarcacoes={(embarcacoesData ?? []) as { id: string; nome: string }[]} membro={membro} />
      </div>
    </div>
  );
}
