'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2, R2_BUCKET, buildR2Key, buildPublicUrl } from '@/lib/r2';
import { supabaseAdmin } from '@/lib/supabase';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const embarcacaoId = formData.get('embarcacaoId') as string | null;

  if (!file || !embarcacaoId) {
    return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de arquivo não permitido.' }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Arquivo excede o limite de 10 MB.' }, { status: 400 });
  }

  // Verifica que a embarcação pertence ao usuário logado.
  const { data: embarcacao } = await supabaseAdmin
    .from('embarcacao')
    .select('id')
    .eq('id', embarcacaoId)
    .eq('owner_id', user.id)
    .single();

  if (!embarcacao) {
    return NextResponse.json({ error: 'Embarcação não encontrada ou sem permissão.' }, { status: 403 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = buildR2Key(user.id, embarcacaoId, file.name);

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
