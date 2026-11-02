import Link from 'next/link';
import { Clock, MessageSquareWarning, EyeOff, PartyPopper } from 'lucide-react';
import { formatarDataHora } from '@/lib/datas';
import type { OperadorPerfilStatus } from '@/types/supabase';

/**
 * Situação do perfil para o gestor (SPEC §99): em análise, no ar, devolvido com o recado da
 * equipe ou retirado. Rascunho/sem perfil não mostram aviso — o incentivo vem do medidor.
 */
export default function AvisoStatusPerfil({
  status, enviadoEm, recado, ownerId, alteracoesPendentes,
}: {
  status: OperadorPerfilStatus | null;
  enviadoEm: string | null;
  recado: string | null;
  ownerId: string;
  /** Há edições no formulário que a versão no ar (ou em análise) ainda não tem. */
  alteracoesPendentes: boolean;
}) {
  if (status === 'em_analise') {
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 sm:p-5">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
        <div className="text-sm text-sky-950">
          <p className="font-semibold">Recebemos o seu perfil!</p>
          <p className="mt-0.5 text-sky-900/80">
            A equipe Boatzy vai revisar e avisar você por e-mail e aqui no painel.
            {enviadoEm && <> Enviado em {formatarDataHora(enviadoEm)}.</>}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'aprovado') {
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
        <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div className="flex-1 text-sm text-emerald-950">
          <p className="font-semibold">Seu perfil está no ar. Bem-vindo à tripulação!</p>
          <p className="mt-0.5 text-emerald-900/80">
            {alteracoesPendentes
              ? 'Você tem alterações ainda não enviadas — a versão atual continua no ar até a equipe aprovar a nova.'
              : 'Ele aparece no fim das páginas dos seus passeios e embarcações.'}
          </p>
        </div>
        <Link href={`/operadores/${ownerId}`} target="_blank"
          className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-50">
          Ver como o cliente vê
        </Link>
      </div>
    );
  }

  if (status === 'devolvido') {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 sm:p-5">
        <MessageSquareWarning className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
        <div className="text-sm text-orange-950">
          <p className="font-semibold">A equipe pediu alguns ajustes</p>
          {recado && <p className="mt-1 rounded-lg bg-white/70 px-3 py-2 text-orange-950">“{recado}”</p>}
          <p className="mt-1.5 text-orange-900/80">Ajuste o que for preciso e envie de novo — leva poucos minutos.</p>
        </div>
      </div>
    );
  }

  if (status === 'retirado') {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:p-5">
        <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
        <div className="text-sm text-rose-950">
          <p className="font-semibold">Seu perfil saiu do ar</p>
          {recado && <p className="mt-1 rounded-lg bg-white/70 px-3 py-2 text-rose-950">“{recado}”</p>}
          <p className="mt-1.5 text-rose-900/80">Ajuste e envie de novo para análise.</p>
        </div>
      </div>
    );
  }

  return null;
}
