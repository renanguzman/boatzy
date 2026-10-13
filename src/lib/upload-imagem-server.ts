import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { r2, R2_BUCKET, R2_PUBLIC_URL, buildPublicUrl } from '@/lib/r2';
import { FOTOS_MINIMAS, MAX_IMAGE_SIZE_BYTES, MAX_IMAGE_SIZE_MB, TIPOS_IMAGEM_PERMITIDOS, formatarTamanho } from '@/lib/upload';
import { normalizarTituloImagem } from '@/lib/galeria';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Validade da URL assinada de envio. */
const EXPIRA_EM_SEGUNDOS = 600;

type ConfigGaleria = { tabela: 'embarcacao' | 'roteiro'; pasta: 'embarcacoes' | 'roteiros' };

function erro(mensagem: string, status: number) {
  return NextResponse.json({ error: mensagem }, { status });
}

/** Confere a assinatura binária: o conteúdo precisa ser de fato JPG, PNG ou WEBP. */
function conteudoEhImagem(buf: Buffer): boolean {
  const jpg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
  return jpg || png || webp;
}

/** URL pertence ao bucket público da plataforma (impede gravar URLs arbitrárias como foto). */
export function ehUrlDoStorage(url: string): boolean {
  return typeof url === 'string' && url.startsWith(`${R2_PUBLIC_URL.replace(/\/$/, '')}/`);
}

export function ehUuid(valor: string): boolean {
  return UUID.test(valor);
}

/**
 * Quem pode mexer nas fotos do registro: dono ou admin. Registro ainda
 * inexistente (cadastro novo — o formulário envia as fotos ANTES de criá-lo)
 * fica na pasta do próprio usuário. Devolve o dono da pasta ou uma resposta de erro.
 */
async function autorizar(
  userId: string, cfg: ConfigGaleria, entidadeId: string,
): Promise<{ ownerId: string } | NextResponse> {
  if (!(await checkRoleInDb(userId, ['gestor', 'admin']))) {
    return erro('sua conta não tem permissão para enviar fotos.', 403);
  }
  const { data: registro } = await supabaseAdmin
    .from(cfg.tabela)
    .select('owner_id')
    .eq('id', entidadeId)
    .maybeSingle();
  if (!registro) return { ownerId: userId };
  if (registro.owner_id !== userId && !(await checkRoleInDb(userId, ['admin']))) {
    return erro('sem permissão para alterar as fotos deste cadastro.', 403);
  }
  return { ownerId: registro.owner_id };
}

/**
 * Upload de foto de galeria (embarcação/roteiro) direto do navegador para o
 * R2, sem o arquivo passar pela função (a Vercel limita o corpo a 4,5 MB):
 *
 *   1. `acao: 'preparar'` — valida e devolve uma URL assinada de PUT
 *      (amarrada ao tipo e ao tamanho declarados).
 *   2. o navegador faz o PUT direto no R2.
 *   3. `acao: 'confirmar'` — lê o início do objeto gravado e confere que é
 *      mesmo uma imagem; se não for, apaga e recusa.
 *
 * Toda falha devolve `{ error }` com uma mensagem pronta para o usuário.
 */
export async function processarUploadImagemGaleria(req: NextRequest, cfg: ConfigGaleria): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return erro('sua sessão expirou. Entre novamente no painel e tente de novo.', 401);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const entidadeId = typeof body?.entidadeId === 'string' ? body.entidadeId : '';
  if (!body || !ehUuid(entidadeId)) return erro('o envio chegou incompleto. Tente novamente.', 400);

  const acesso = await autorizar(user.id, cfg, entidadeId);
  if (acesso instanceof NextResponse) return acesso;
  const pastaRegistro = `${cfg.pasta}/${acesso.ownerId}/${entidadeId}/`;

  if (body.acao === 'preparar') {
    const nome = typeof body.nome === 'string' ? body.nome : '';
    const tipo = typeof body.tipo === 'string' ? body.tipo : '';
    const tamanho = typeof body.tamanho === 'number' ? body.tamanho : 0;

    if (!(TIPOS_IMAGEM_PERMITIDOS as readonly string[]).includes(tipo)) {
      return erro(`formato não suportado${tipo ? ` (${tipo})` : ''}. Envie JPG, PNG ou WEBP.`, 400);
    }
    if (!Number.isInteger(tamanho) || tamanho <= 0) return erro('o arquivo está vazio.', 400);
    if (tamanho > MAX_IMAGE_SIZE_BYTES) {
      return erro(`tem ${formatarTamanho(tamanho)} — o máximo é ${MAX_IMAGE_SIZE_MB} MB por foto.`, 400);
    }

    // Prefixo aleatório: duas fotos com o mesmo nome (ex.: "image.jpg") não se sobrescrevem.
    const nomeSeguro = nome.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'foto';
    const key = `${pastaRegistro}${crypto.randomUUID().slice(0, 8)}-${nomeSeguro}`;

    try {
      const uploadUrl = await getSignedUrl(
        r2,
        new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: tipo, ContentLength: tamanho }),
        // content-length e content-type assinados: o PUT só vale para o tamanho e o tipo validados aqui.
        { expiresIn: EXPIRA_EM_SEGUNDOS, signableHeaders: new Set(['content-type']) },
      );
      return NextResponse.json({ uploadUrl, key });
    } catch (e) {
      console.error(`[upload ${cfg.pasta}] falha ao assinar URL:`, e);
      return erro('o armazenamento de imagens não respondeu. Tente novamente em instantes.', 502);
    }
  }

  if (body.acao === 'confirmar') {
    const key = typeof body.key === 'string' ? body.key : '';
    if (!key.startsWith(pastaRegistro) || key.includes('..')) return erro('o envio chegou incompleto. Tente novamente.', 400);

    let inicio: Buffer;
    let tamanho: number;
    try {
      const obj = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key, Range: 'bytes=0-15' }));
      inicio = Buffer.from(await obj.Body!.transformToByteArray());
      tamanho = Number(obj.ContentRange?.split('/')[1] ?? 0);
    } catch (e) {
      const nome = (e as { name?: string }).name;
      if (nome === 'NoSuchKey' || nome === 'NotFound') {
        return erro('a foto não chegou ao armazenamento. Tente enviar de novo.', 400);
      }
      console.error(`[upload ${cfg.pasta}] falha ao conferir objeto:`, e);
      return erro('o armazenamento de imagens não respondeu. Tente novamente em instantes.', 502);
    }

    const problema = !conteudoEhImagem(inicio)
      ? 'o conteúdo do arquivo não é uma imagem JPG, PNG ou WEBP válida (pode estar corrompido ou ter a extensão trocada).'
      : tamanho > MAX_IMAGE_SIZE_BYTES
        ? `tem ${formatarTamanho(tamanho)} — o máximo é ${MAX_IMAGE_SIZE_MB} MB por foto.`
        : null;
    if (problema) {
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })).catch(() => null);
      return erro(problema, 400);
    }

    return NextResponse.json({ publicUrl: buildPublicUrl(key) });
  }

  return erro('o envio chegou incompleto. Tente novamente.', 400);
}

/** Foto já enviada ao storage, a ser registrada junto com um cadastro novo. */
export type ImagemNovaPayload = { url: string; titulo: string; principal: boolean; ordem: number };

/**
 * Valida as fotos de um cadastro novo e monta as linhas de `*_imagens`
 * (exatamente uma principal). Devolve a mensagem de erro, se houver.
 */
export function prepararImagensNovas(
  imagens: ImagemNovaPayload[] | undefined,
): { ok: true; linhas: { url_imagem: string; titulo: string | null; principal: boolean; ordem: number }[] } | { ok: false; error: string } {
  const lista = Array.isArray(imagens) ? imagens : [];
  if (lista.length < FOTOS_MINIMAS) return { ok: false, error: 'Adicione pelo menos 1 foto — ela é obrigatória para salvar.' };
  if (lista.some(i => !ehUrlDoStorage(i.url))) return { ok: false, error: 'Uma das fotos não foi enviada corretamente. Envie-a novamente.' };
  const idxPrincipal = Math.max(0, lista.findIndex(i => i.principal));
  return {
    ok: true,
    linhas: lista.map((img, i) => ({
      url_imagem: img.url,
      titulo: normalizarTituloImagem(img.titulo),
      principal: i === idxPrincipal,
      ordem: Math.max(0, Math.trunc(img.ordem ?? i)),
    })),
  };
}
