import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2, R2_BUCKET, buildR2Key, buildPublicUrl } from '@/lib/r2';
import { supabaseAdmin } from '@/lib/supabase';
import { MAX_IMAGE_SIZE_BYTES, MAX_IMAGE_SIZE_ERROR } from '@/lib/upload';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const EXPIRES_IN = 900; // 15 minutos

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
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

  if (size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json({ error: MAX_IMAGE_SIZE_ERROR }, { status: 400 });
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

  const key = buildR2Key(user.id, embarcacaoId, filename);

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
  });

  const presignedUrl = await getSignedUrl(r2, command, { expiresIn: EXPIRES_IN });
  const publicUrl = buildPublicUrl(key);

  return NextResponse.json({ presignedUrl, publicUrl, key });
}
