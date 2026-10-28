import { NextRequest } from 'next/server';
import { processarUploadDocumento } from '@/lib/documentos/arquivo-server';

export async function POST(req: NextRequest) {
  return processarUploadDocumento(req);
}
