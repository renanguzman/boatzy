import { NextRequest } from 'next/server';
import { processarUploadImagemGaleria } from '@/lib/upload-imagem-server';

export async function POST(req: NextRequest) {
  return processarUploadImagemGaleria(req, { tabela: 'roteiro', pasta: 'roteiros' });
}
