import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { urlAssinadaDocumento } from '@/lib/documentos/arquivo-server';
import { ehUuid } from '@/lib/upload-imagem-server';
import { checkRoleInDb } from '@/lib/roles';

/**
 * Abre o comprovante de um repasse (bucket privado — SPEC §101): confere que o repasse é do
 * gestor logado — ou que ele é admin — e redireciona para uma URL assinada de 5 min.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) return NextResponse.json({ error: 'Comprovante não encontrado.' }, { status: 404 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });

  const { data: repasse } = await supabaseAdmin
    .from('repasse')
    .select('gestor_id, comprovante_key, comprovante_nome')
    .eq('id', id)
    .maybeSingle();
  const permitido = !!repasse && (repasse.gestor_id === user.id || (await checkRoleInDb(user.id, ['admin'])));
  if (!repasse || !permitido || !repasse.comprovante_key) {
    return NextResponse.json({ error: 'Comprovante não encontrado.' }, { status: 404 });
  }

  try {
    const url = await urlAssinadaDocumento(repasse.comprovante_key, repasse.comprovante_nome);
    return NextResponse.redirect(url, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[repasses] falha ao assinar leitura do comprovante:', e);
    return NextResponse.json({ error: 'O armazenamento não respondeu. Tente novamente.' }, { status: 502 });
  }
}
