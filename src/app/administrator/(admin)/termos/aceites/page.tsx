import { redirect } from 'next/navigation';
import { FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isTermoIdentificador } from '@/lib/termos/identificadores';
import TermosAbas from '../_components/TermosAbas';
import AdminAceitesGrid, { type AdminAceiteListItem } from './_components/AdminAceitesGrid';
import VerificarCadeiaButton from './_components/VerificarCadeiaButton';

const PAGE_SIZES = [10, 25, 50] as const;

const SORT_COLUMNS: Record<string, string> = {
  aceito_em: 'sequencia', // sequência = ordem cronológica da cadeia (índice único)
  usuario_nome: 'usuario_nome',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX = /^[0-9a-f]{6,64}$/i;

type SearchParams = { q?: string; page?: string; per?: string; sort?: string; dir?: string; termo?: string };

export default async function AdminAceitesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/administrator/login');

  const sp = await searchParams;
  const perPage = PAGE_SIZES.includes(Number(sp.per) as (typeof PAGE_SIZES)[number]) ? Number(sp.per) : 10;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const sortCol = SORT_COLUMNS[sp.sort ?? ''] ?? 'sequencia';
  const ascending = sp.dir === 'asc';
  const termo = sp.termo && isTermoIdentificador(sp.termo) ? sp.termo : null;
  // Remove caracteres que quebram a sintaxe do or() do PostgREST.
  const q = (sp.q ?? '').trim().replace(/[,()"%*]/g, '');

  let query = supabaseAdmin
    .from('termos_uso_aceite')
    .select(
      `id, sequencia, aceito_em, evidencia_hash, termo_identificador, termo_versao,
       usuario_nome, usuario_email, contexto_tipo, contexto_id,
       dispositivo_tipo, navegador, geo_gps_status, geo_ip_cidade, geo_ip_regiao`,
      { count: 'exact' },
    );

  if (q) {
    // Um único campo de busca: nome/e-mail, documento (dígitos), protocolo (hash) ou id (aceite/reserva).
    const partes = [`usuario_nome.ilike.%${q}%`, `usuario_email.ilike.%${q}%`];
    const digitos = q.replace(/\D/g, '');
    if (digitos.length >= 3) partes.push(`usuario_cpf_cnpj.ilike.%${digitos}%`);
    if (HEX.test(q)) partes.push(`evidencia_hash.ilike.${q.toLowerCase()}%`);
    if (UUID.test(q)) partes.push(`id.eq.${q}`, `contexto_id.eq.${q}`, `user_id.eq.${q}`);
    query = query.or(partes.join(','));
  }
  if (termo) query = query.eq('termo_identificador', termo);

  const { data, count } = await query
    .order(sortCol, { ascending })
    .order('sequencia', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#0B2447]/5 flex items-center justify-center">
            <FileText className="w-5 h-5 text-[#0B2447]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0B2447]">Termos de Uso</h1>
            <p className="text-sm text-slate-500">
              Registros de aceite com todas as evidências coletadas. Registros são imutáveis e
              encadeados por hash — a verificação de integridade detecta qualquer alteração.
            </p>
          </div>
        </div>
        <VerificarCadeiaButton />
      </div>

      <TermosAbas ativa="aceites" />

      <AdminAceitesGrid
        aceites={(data ?? []) as AdminAceiteListItem[]}
        total={count ?? 0}
        page={page}
        perPage={perPage}
      />
    </div>
  );
}
