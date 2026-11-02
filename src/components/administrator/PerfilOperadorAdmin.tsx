import Link from 'next/link';
import { UserRound } from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabase';
import { STATUS_PERFIL_INFO } from '@/lib/operador-tipos';

/**
 * Situação do perfil do operador (SPEC §99) na revisão de embarcação e de roteiro: o admin vê, sem
 * sair da tela, se o gestor já se apresentou e vai direto à análise do perfil.
 */
export default async function PerfilOperadorAdmin({ ownerId }: { ownerId: string }) {
  const { data } = await supabaseAdmin.from('operador_perfil').select('status').eq('owner_id', ownerId).maybeSingle();
  const status = data?.status ?? 'sem_perfil';
  const info = STATUS_PERFIL_INFO[status];

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B2447]/5">
          <UserRound className="h-4 w-4 text-[#0B2447]" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#0B2447]">Perfil do operador</p>
          <span className={`mt-0.5 inline-flex rounded-full px-2 py-px text-[11px] font-semibold ring-1 ring-inset ${info.classe}`}>{info.rotulo}</span>
        </div>
      </div>
      <Link href={`/administrator/operadores/${ownerId}`} className="shrink-0 text-xs font-semibold text-[#0B3D91] hover:underline">
        {status === 'em_analise' ? 'Analisar' : 'Ver'}
      </Link>
    </div>
  );
}
