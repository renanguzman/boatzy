import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

/**
 * Cliente S3-compatível apontando para o Cloudflare R2.
 *
 * Variáveis de ambiente necessárias (.env.local):
 *   R2_ENDPOINT          → https://{ACCOUNT_ID}.r2.cloudflarestorage.com  ✅ já existe
 *   R2_ACCESS_KEY_ID     → Access Key ID do token R2                       ✅ já existe
 *   R2_SECRET_ACCESS_KEY → Secret Access Key do mesmo token                ✅ já existe
 *   R2_BUCKET_NAME       → Nome do bucket (ex: boatzy-prod)                ✅ já existe
 *   R2_PUBLIC_URL        → URL pública para servir os arquivos              ⚠️  ADICIONAR
 *                          → No painel R2 › bucket › Settings › Public access
 *                          → ex: https://pub-xxxxxxxxxxxxxxxx.r2.dev
 *                          → ou domínio customizado configurado no bucket
 */

export const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_BUCKET     = process.env.R2_BUCKET_NAME!;
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;

/**
 * Monta o caminho (key) de uma imagem no R2.
 * Estrutura: embarcacoes/{userId}/{embarcacaoId}/{filename}
 */
export function buildR2Key(userId: string, embarcacaoId: string, filename: string): string {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `embarcacoes/${userId}/${embarcacaoId}/${safeFilename}`;
}

/**
 * Retorna a URL pública de um objeto dado seu key.
 */
export function buildPublicUrl(key: string): string {
  return `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
}

/**
 * Extrai a key do R2 a partir da URL pública.
 * Ex: https://pub-xxx.r2.dev/embarcacoes/uid/id/foto.jpg → embarcacoes/uid/id/foto.jpg
 */
export function buildKeyFromUrl(publicUrl: string): string {
  const base = R2_PUBLIC_URL.replace(/\/$/, '');
  return publicUrl.replace(`${base}/`, '');
}

/**
 * Remove um objeto do bucket R2 pelo seu key.
 */
export async function deleteFromR2(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}
