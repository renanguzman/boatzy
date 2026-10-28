import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { urlAssinadaDocumento } from '@/lib/documentos/arquivo-server';
import { ehUuid } from '@/lib/upload-imagem-server';
import { checkRoleInDb } from '@/lib/roles';

/**
 * Abre o arquivo de um documento (bucket privado — SPEC §95.2): confere que o
 * documento é do usuário logado — ou que ele é admin (SPEC §95.9) — e
 * redireciona para uma URL assinada de 5 min. Ninguém mais acessa.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });

  const { data: doc } = await supabaseAdmin
    .from('documento')
    .select('owner_id, arquivo_key, arquivo_nome')
    .eq('id', id)
    .maybeSingle();
  const permitido = !!doc && (doc.owner_id === user.id || (await checkRoleInDb(user.id, ['admin'])));
  if (!doc || !permitido || !doc.arquivo_key) {
    return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
  }

  try {
    const url = await urlAssinadaDocumento(doc.arquivo_key, doc.arquivo_nome);
    return NextResponse.redirect(url, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[documentos] falha ao assinar leitura:', e);
    return NextResponse.json({ error: 'O armazenamento não respondeu. Tente novamente.' }, { status: 502 });
  }
}
