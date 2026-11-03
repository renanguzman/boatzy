import { NextRequest } from 'next/server';
import { processarUploadComprovante } from '@/lib/repasses/comprovante-server';

export async function POST(req: NextRequest) {
  return processarUploadComprovante(req);
}
