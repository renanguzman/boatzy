import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2, R2_BUCKET, buildR2Key, buildPublicUrl } from '@/lib/r2';
import { supabaseAdmin } from '@/lib/supabase';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const EXPIRES_IN    = 900; // 15 minutos

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { embarcacaoId, filename, contentType, size } = body ?? {};

  if (!embarcacaoId || !filename || !contentType || !size) {
    return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json({ error: 'Tipo de arquivo não permitido.' }, { status: 400 });
  }

  if (size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Arquivo excede o limite de 10 MB.' }, { status: 400 });
  }

  // Confirma que a embarcação pertence ao usuário logado
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

  const key = buildR2Key(dbUser.id, embarcacaoId, filename);

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
  });

  const presignedUrl = await getSignedUrl(r2, command, { expiresIn: EXPIRES_IN });
  const publicUrl    = buildPublicUrl(key);

  return NextResponse.json({ presignedUrl, publicUrl, key });
}
