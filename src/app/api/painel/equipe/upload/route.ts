'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2, R2_BUCKET, buildEquipeKey, buildPublicUrl } from '@/lib/r2';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { MAX_IMAGE_SIZE_BYTES, MAX_IMAGE_SIZE_ERROR } from '@/lib/upload';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const autorizado = await checkRoleInDb(user.id, ['gestor', 'admin']);
  if (!autorizado) {
    return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const membroId = formData.get('membroId') as string | null;

  if (!file || !membroId) {
    return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de arquivo não permitido.' }, { status: 400 });
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json({ error: MAX_IMAGE_SIZE_ERROR }, { status: 400 });
  }

  // Verifica que o membro pertence ao gestor logado.
  const { data: membro } = await supabaseAdmin
    .from('equipe_membro')
    .select('id')
    .eq('id', membroId)
    .eq('owner_id', user.id)
    .single();

  if (!membro) {
    return NextResponse.json({ error: 'Membro não encontrado ou sem permissão.' }, { status: 403 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = buildEquipeKey(user.id, membroId, file.name);

  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    }),
  );

  const publicUrl = buildPublicUrl(key);
  return NextResponse.json({ publicUrl, key });
}
