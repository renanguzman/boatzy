import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { r2, R2_DOCUMENTOS_BUCKET } from '@/lib/r2';
import { formatarTamanho } from '@/lib/upload';
import { ehUuid } from '@/lib/upload-imagem-server';
import {
  MAX_ARQUIVO_DOCUMENTO_BYTES,
  MAX_ARQUIVO_DOCUMENTO_MB,
  TIPOS_ARQUIVO_DOCUMENTO,
} from './tipos';

/**
 * Arquivos de documentos no bucket R2 PRIVADO (SPEC §95.2). Mesmo fluxo das
 * fotos de galeria (§44.2) — preparar → PUT direto no R2 → confirmar —, mas:
 *  - aceita PDF além de JPG/PNG/WEBP;
 *  - nunca devolve URL pública: o arquivo só abre por URL assinada de curta
 *    duração, gerada para o dono (`urlAssinadaDocumento`).
 *
 * Key: documentos/{ownerId}/{documentoId}/{8 chars}-{nome}
 */

const EXPIRA_ENVIO_S = 600;
const EXPIRA_LEITURA_S = 300;

function erro(mensagem: string, status: number) {
  return NextResponse.json({ error: mensagem }, { status });
}

export function pastaDocumento(ownerId: string, documentoId: string): string {
  return `documentos/${ownerId}/${documentoId}/`;
}

/** Assinatura binária: JPG, PNG, WEBP ou PDF de verdade. */
function conteudoValido(buf: Buffer): boolean {
  const jpg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
  const pdf = buf.length > 4 && buf.toString('ascii', 0, 5) === '%PDF-';
  return jpg || png || webp || pdf;
}

/**
 * POST /api/painel/documentos/upload
 *   { acao: 'preparar', documentoId, nome, tipo, tamanho } → { uploadUrl, key }
 *   { acao: 'confirmar', documentoId, key }               → { key }
 * Documento já existente (troca de arquivo): só o dono. Inexistente
 * (cadastro novo — o id vem do navegador): pasta do próprio usuário.
 */
export async function processarUploadDocumento(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return erro('sua sessão expirou. Entre novamente no painel e tente de novo.', 401);
  if (!(await checkRoleInDb(user.id, ['gestor', 'admin']))) {
    return erro('sua conta não tem permissão para enviar documentos.', 403);
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const documentoId = typeof body?.documentoId === 'string' ? body.documentoId : '';
  if (!body || !ehUuid(documentoId)) return erro('o envio chegou incompleto. Tente novamente.', 400);

  const { data: existente } = await supabaseAdmin
    .from('documento')
    .select('owner_id')
    .eq('id', documentoId)
    .maybeSingle();
  if (existente && existente.owner_id !== user.id) return erro('sem permissão para alterar este documento.', 403);
  const pasta = pastaDocumento(user.id, documentoId);

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

    const nomeSeguro = nome.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'documento';
    const key = `${pasta}${crypto.randomUUID().slice(0, 8)}-${nomeSeguro}`;
    try {
      const uploadUrl = await getSignedUrl(
        r2,
        new PutObjectCommand({ Bucket: R2_DOCUMENTOS_BUCKET, Key: key, ContentType: tipo, ContentLength: tamanho }),
        { expiresIn: EXPIRA_ENVIO_S, signableHeaders: new Set(['content-type']) },
      );
      return NextResponse.json({ uploadUrl, key });
    } catch (e) {
      console.error('[upload documentos] falha ao assinar URL:', e);
      return erro('o armazenamento de documentos não respondeu. Tente novamente em instantes.', 502);
    }
  }

  if (body.acao === 'confirmar') {
    const key = typeof body.key === 'string' ? body.key : '';
    if (!key.startsWith(pasta) || key.includes('..')) return erro('o envio chegou incompleto. Tente novamente.', 400);

    let inicio: Buffer;
    let tamanho: number;
    try {
      const obj = await r2.send(new GetObjectCommand({ Bucket: R2_DOCUMENTOS_BUCKET, Key: key, Range: 'bytes=0-15' }));
      inicio = Buffer.from(await obj.Body!.transformToByteArray());
      tamanho = Number(obj.ContentRange?.split('/')[1] ?? 0);
    } catch (e) {
      const nome = (e as { name?: string }).name;
      if (nome === 'NoSuchKey' || nome === 'NotFound') {
        return erro('o arquivo não chegou ao armazenamento. Tente enviar de novo.', 400);
      }
      console.error('[upload documentos] falha ao conferir objeto:', e);
      return erro('o armazenamento de documentos não respondeu. Tente novamente em instantes.', 502);
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

/** URL temporária (5 min) para abrir o arquivo no navegador. */
export async function urlAssinadaDocumento(key: string, nomeArquivo: string | null): Promise<string> {
  const nome = (nomeArquivo ?? 'documento').replace(/["\\\r\n]/g, '_');
  return getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: R2_DOCUMENTOS_BUCKET,
      Key: key,
      ResponseContentDisposition: `inline; filename="${nome}"`,
    }),
    { expiresIn: EXPIRA_LEITURA_S },
  );
}

/** Remove o objeto (falha só é logada — não interrompe quem chamou). */
export async function apagarArquivoDocumento(key: string | null | undefined): Promise<void> {
  if (!key) return;
  await r2
    .send(new DeleteObjectCommand({ Bucket: R2_DOCUMENTOS_BUCKET, Key: key }))
    .catch((e) => console.error('[documentos] falha ao apagar arquivo:', e));
}
