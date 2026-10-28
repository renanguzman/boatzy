import { redirect } from 'next/navigation';
import Link from 'next/link';
import { FileCheck2, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ensureGestorEquipeMembro } from '@/lib/equipe';
import {
  getResumoDocumentos, listarCondutores, listarDocumentos, listarEmbarcacoesDoGestor,
} from '@/lib/documentos/server';
import type { FiltroSituacao } from '@/components/painel/documentos/ResumoValidadeCards';
import PainelDocumentos from './_components/PainelDocumentos';

const FILTROS: FiltroSituacao[] = ['vencido', 'vence_em_breve', 'em_dia', 'pendente'];

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ situacao?: string; aba?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  // A ficha "Você (gestor)" aparece em Condutores (o dono também pode ter CHA).
  await ensureGestorEquipeMembro(user.id);

  const [params, documentos, embarcacoes, condutores, resumo] = await Promise.all([
    searchParams,
    listarDocumentos(user.id),
    listarEmbarcacoesDoGestor(user.id),
    listarCondutores(user.id),
    getResumoDocumentos(user.id),
  ]);

  const filtro = FILTROS.includes(params.situacao as FiltroSituacao) ? (params.situacao as FiltroSituacao) : null;
  const aba = params.aba === 'condutores' ? 'condutores' : 'embarcacoes';

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 sm:items-center">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 sm:h-11 sm:w-11">
            <FileCheck2 className="h-5 w-5 text-teal-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0B2447] sm:text-2xl">Documentos</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Documentos das embarcações e habilitações da equipe num lugar só — avisamos antes de cada vencimento.
            </p>
          </div>
        </div>
        <Link
          href="/painel/documentos/novo"
          className="flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#0B2447] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#0B2447]/10 transition-colors hover:bg-[#0B3D91]"
        >
          <Upload className="h-4 w-4" />
          Enviar documento
        </Link>
      </div>

      <PainelDocumentos
        documentos={documentos}
        embarcacoes={embarcacoes}
        condutores={condutores}
        resumo={resumo}
        filtroInicial={filtro}
        abaInicial={aba}
      />
    </div>
  );
}
