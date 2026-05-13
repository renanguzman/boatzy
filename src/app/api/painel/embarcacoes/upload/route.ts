'use server';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2, R2_BUCKET, buildR2Key, buildPublicUrl } from '@/lib/r2';
import { supabaseAdmin } from '@/lib/supabase';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const file        = formData.get('file') as File | null;
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

  const { data: dbUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id_clerk', clerkId)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 403 });
  }

  const { data: embarcacao } = await supabaseAdmin
    .from('embarcacao')
    .select('id')
    .eq('id', embarcacaoId)
    .eq('owner_id', dbUser.id)
    .single();

  if (!embarcacao) {
    return NextResponse.json({ error: 'Embarcação não encontrada ou sem permissão.' }, { status: 403 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key    = buildR2Key(dbUser.id, embarcacaoId, file.name);

  await r2.send(
    new PutObjectCommand({
      Bucket:      R2_BUCKET,
      Key:         key,
      Body:        buffer,
      ContentType: file.type,
    }),
  );

  const publicUrl = buildPublicUrl(key);
  return NextResponse.json({ publicUrl, key });
}
