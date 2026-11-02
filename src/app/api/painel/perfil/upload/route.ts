import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@/lib/supabase/server';
import { checkRoleInDb } from '@/lib/roles';
import { r2, R2_BUCKET, buildPerfilKey, buildPublicUrl } from '@/lib/r2';
import { conteudoEhImagem } from '@/lib/upload-imagem-server';
import { FOTO_PERFIL_MAX_BYTES } from '@/lib/imagem-perfil';

/**
 * POST /api/painel/perfil/upload — foto do perfil do operador (SPEC §99).
 * O navegador já recortou e reduziu a imagem (≈ 100–400 KB), então ela cabe no corpo da
 * função. Só guarda o arquivo na pasta do PRÓPRIO gestor; quem vincula a foto ao perfil é
 * `salvarPerfil`, que confere o prefixo `perfil/{userId}/`.
 */

const EXTENSAO: Record<string, 'webp' | 'jpg' | 'png'> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

const erro = (mensagem: string, status: number) => NextResponse.json({ error: mensagem }, { status });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return erro('Sua sessão expirou. Entre de novo no painel.', 401);
  if (!(await checkRoleInDb(user.id, ['gestor', 'admin']))) return erro('Acesso não autorizado.', 403);

  const formData = await req.formData().catch(() => null);
  const arquivo = formData?.get('file');
  if (!(arquivo instanceof File)) return erro('Envie a foto.', 400);

  const extensao = EXTENSAO[arquivo.type];
  if (!extensao) return erro('Formato não suportado. Use JPG, PNG ou WEBP.', 400);
  if (arquivo.size === 0) return erro('O arquivo está vazio.', 400);
  if (arquivo.size > FOTO_PERFIL_MAX_BYTES) return erro('A foto ficou grande demais. Tente outra imagem.', 400);

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  // O tipo declarado vem do navegador: confere a assinatura binária do conteúdo.
  if (!conteudoEhImagem(buffer)) return erro('O arquivo não é uma imagem válida.', 400);

  const key = buildPerfilKey(user.id, extensao);
  try {
    await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: buffer, ContentType: arquivo.type }));
  } catch (e) {
    console.error('[perfil/upload] falha ao gravar no R2:', e);
    return erro('Não foi possível enviar a foto agora. Tente novamente.', 502);
  }

  return NextResponse.json({ publicUrl: buildPublicUrl(key), key });
}
