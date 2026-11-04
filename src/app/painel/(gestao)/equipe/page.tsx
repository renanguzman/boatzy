import IconeLink from '@/components/ui/IconeLink';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UsersRound, UserPlus, IdCard } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ensureGestorEquipeMembro } from '@/lib/equipe';
import { habilitacaoDoGestor } from '@/lib/documentos/server';
import { TIPOS_DOCUMENTO, rotuloCategoria } from '@/lib/documentos/tipos';
import { situacaoValidade } from '@/lib/documentos/validade';
import type { DocumentoAtual } from '@/lib/documentos/rascunho';
import { PrazoValidade, SeloValidade } from '@/components/painel/documentos/SeloValidade';
import NovoMembroForm from './_components/NovoMembroForm';
import EquipeGrid, { type MembroListItem } from './_components/EquipeGrid';
import type { EquipeFuncao } from '@/types/supabase';

type MembroRow = {
  id: string;
  nome_completo: string;
  cpf: string | null;
  tipo_documento_estrangeiro: string | null;
  documento_estrangeiro: string | null;
  pais_documento: string | null;
  email: string | null;
  telefone: string | null;
  funcao: EquipeFuncao | null;
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

  const [{ data: membrosData }, { data: embarcacoesData }, gestorCondutor] = await Promise.all([
    supabaseAdmin
      .from('equipe_membro')
      .select(
        `id, nome_completo, cpf, tipo_documento_estrangeiro, documento_estrangeiro, pais_documento, email, telefone, funcao, foto_url, ativo, user_id, created_at,
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
    habilitacaoDoGestor(user.id),
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
    tipo_documento_estrangeiro: m.tipo_documento_estrangeiro,
    documento_estrangeiro: m.documento_estrangeiro,
    pais_documento: m.pais_documento,
    email: m.email,
    telefone: m.telefone,
    funcao: m.funcao,
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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-start sm:items-center gap-3">
        <div className="h-10 w-10 sm:h-11 sm:w-11 shrink-0 rounded-xl bg-teal-50 flex items-center justify-center">
          <UsersRound className="w-5 h-5 text-teal-500" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0B2447]">Equipe</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Cadastre as pessoas que ajudam a cuidar das suas embarcações. Ao confirmar uma reserva,
            você indica quem vai atender o cliente.
          </p>
        </div>
      </div>

      {embarcacoes.length > 0 && gestorCondutor.membroId && (
        <CartaoGestorCondutor membroId={gestorCondutor.membroId} documento={gestorCondutor.documento} />
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="flex items-center gap-2 mb-4 sm:mb-6">
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

/**
 * "Você (gestor)" como condutor (SPEC §95.10): a ficha do gestor não é editável na
 * Equipe, mas a habilitação dele mora aqui também — envio/renovação pelo menu Documentos.
 */
function CartaoGestorCondutor({ membroId, documento }: { membroId: string; documento: DocumentoAtual | null }) {
  const situacao = documento ? situacaoValidade(documento.data_validade) : null;
  const renovar = situacao === 'vencido' || situacao === 'vence_em_breve';
  const href = documento && !renovar
    ? '/painel/documentos?aba=condutores'
    : `/painel/documentos/novo?escopo=condutor&tipo=${documento?.tipo ?? 'cha'}&membro=${membroId}`;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B2447]/5">
        <IdCard className="h-5 w-5 text-[#0B2447]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#0B2447]">Você (gestor) também conduz?</p>
        {documento ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xs font-semibold text-slate-700">
              Sua {TIPOS_DOCUMENTO[documento.tipo].sigla}
              {rotuloCategoria(documento.categoria) ? ` · ${rotuloCategoria(documento.categoria)}` : ''}
            </span>
            <SeloValidade validade={documento.data_validade} />
            <PrazoValidade validade={documento.data_validade} />
          </div>
        ) : (
          <p className="mt-0.5 text-xs text-slate-500">
            Se você mesmo pilota suas embarcações, guarde sua habilitação (CHA) aqui — acompanhamos a validade e avisamos antes de vencer.
          </p>
        )}
      </div>
      <Link
        href={href}
        className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
          documento && !renovar
            ? 'border border-slate-200 text-slate-600 hover:bg-slate-50'
            : 'bg-[#0B2447] text-white hover:bg-[#0B3D91]'
        }`}
      >
        <IconeLink />
        {!documento ? 'Enviar minha habilitação' : renovar ? 'Renovar habilitação' : 'Ver em Documentos'}
      </Link>
    </div>
  );
}
