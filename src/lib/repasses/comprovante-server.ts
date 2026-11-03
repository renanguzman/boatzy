import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@/lib/supabase/server';
import { checkRoleInDb } from '@/lib/roles';
import { r2, R2_DOCUMENTOS_BUCKET } from '@/lib/r2';
import { formatarTamanho } from '@/lib/upload';
import { ehUuid } from '@/lib/upload-imagem-server';
import { apagarArquivoDocumento, conteudoValido } from '@/lib/documentos/arquivo-server';
import { MAX_ARQUIVO_DOCUMENTO_BYTES, MAX_ARQUIVO_DOCUMENTO_MB, TIPOS_ARQUIVO_DOCUMENTO } from '@/lib/documentos/tipos';

/**
 * Comprovantes de repasse no bucket R2 PRIVADO (SPEC §101) — o mesmo fluxo dos documentos
 * (§95.2): preparar → PUT assinado direto no R2 → confirmar. Só o admin envia; o gestor
 * dono do repasse (e o admin) abrem por URL assinada de curta duração
 * (`/api/painel/repasses/[id]/comprovante`).
 *
 * Key: repasses/{gestorId}/{repasseId}/{8 chars}-{nome}
 * O `repasseId` vem do navegador (é o id que o repasse terá ao ser registrado), então o
 * comprovante pode subir antes do registro.
 */

const EXPIRA_ENVIO_S = 600;

function erro(mensagem: string, status: number) {
  return NextResponse.json({ error: mensagem }, { status });
}

export function pastaComprovante(gestorId: string, repasseId: string): string {
  return `repasses/${gestorId}/${repasseId}/`;
}

/** A key pertence à pasta do repasse (a action de registro/anexo confere antes de gravar). */
export function keyDoComprovanteValida(key: string, gestorId: string, repasseId: string): boolean {
  return key.startsWith(pastaComprovante(gestorId, repasseId)) && !key.includes('..');
}

/**
 * POST /api/administrator/repasses/upload
 *   { acao: 'preparar', gestorId, repasseId, nome, tipo, tamanho } → { uploadUrl, key }
 *   { acao: 'confirmar', gestorId, repasseId, key }                → { key }
 */
export async function processarUploadComprovante(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return erro('sua sessão expirou. Entre novamente e tente de novo.', 401);
  if (!(await checkRoleInDb(user.id, ['admin']))) return erro('acesso não autorizado.', 403);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const gestorId = typeof body?.gestorId === 'string' ? body.gestorId : '';
  const repasseId = typeof body?.repasseId === 'string' ? body.repasseId : '';
  if (!body || !ehUuid(gestorId) || !ehUuid(repasseId)) return erro('o envio chegou incompleto. Tente novamente.', 400);
  const pasta = pastaComprovante(gestorId, repasseId);

  if (body.acao === 'preparar') {
    const nome = typeof body.nome === 'string' ? body.nome : '';
    const tipo = typeof body.tipo === 'string' ? body.tipo : '';
    const tamanho = typeof body.tamanho === 'number' ? body.tamanho : 0;

    if (!(TIPOS_ARQUIVO_DOCUMENTO as readonly string[]).includes(tipo)) {
      return erro(`formato não suportado${tipo ? ` (${tipo})` : ''}. Envie uma foto (JPG, PNG, WEBP) ou um PDF.`, 400);
    }
    if (!Number.isInteger(tamanho) || tamanho <= 0) return erro('o arquivo está vazio.', 400);
    if (tamanho > MAX_ARQUIVO_DOCUMENTO_BYTES) {
      return erro(`tem ${formatarTamanho(tamanho)} — o máximo é ${MAX_ARQUIVO_DOCUMENTO_MB} MB.`, 400);
    }

    const nomeSeguro = nome.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'comprovante';
    const key = `${pasta}${crypto.randomUUID().slice(0, 8)}-${nomeSeguro}`;
    try {
      const uploadUrl = await getSignedUrl(
        r2,
        new PutObjectCommand({ Bucket: R2_DOCUMENTOS_BUCKET, Key: key, ContentType: tipo, ContentLength: tamanho }),
        { expiresIn: EXPIRA_ENVIO_S, signableHeaders: new Set(['content-type']) },
      );
      return NextResponse.json({ uploadUrl, key });
    } catch (e) {
      console.error('[upload comprovante] falha ao assinar URL:', e);
      return erro('o armazenamento não respondeu. Tente novamente em instantes.', 502);
    }
  }

  if (body.acao === 'confirmar') {
    const key = typeof body.key === 'string' ? body.key : '';
    if (!keyDoComprovanteValida(key, gestorId, repasseId)) return erro('o envio chegou incompleto. Tente novamente.', 400);

    let inicio: Buffer;
    let tamanho: number;
    try {
      const obj = await r2.send(new GetObjectCommand({ Bucket: R2_DOCUMENTOS_BUCKET, Key: key, Range: 'bytes=0-15' }));
      inicio = Buffer.from(await obj.Body!.transformToByteArray());
      tamanho = Number(obj.ContentRange?.split('/')[1] ?? 0);
    } catch (e) {
      const nome = (e as { name?: string }).name;
      if (nome === 'NoSuchKey' || nome === 'NotFound') return erro('o arquivo não chegou ao armazenamento. Tente enviar de novo.', 400);
      console.error('[upload comprovante] falha ao conferir objeto:', e);
      return erro('o armazenamento não respondeu. Tente novamente em instantes.', 502);
    }

    const problema = !conteudoValido(inicio)
      ? 'o conteúdo do arquivo não é uma imagem (JPG, PNG, WEBP) nem um PDF válido.'
      : tamanho > MAX_ARQUIVO_DOCUMENTO_BYTES
        ? `tem ${formatarTamanho(tamanho)} — o máximo é ${MAX_ARQUIVO_DOCUMENTO_MB} MB.`
        : null;
    if (problema) {
      await apagarArquivoDocumento(key);
      return erro(problema, 400);
    }
    return NextResponse.json({ key });
  }

  return erro('ação inválida.', 400);
}
