import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import type { SendEmailResult } from '@/lib/email';
import type { ComunicacaoPapel } from '@/types/supabase';

/**
 * Registro das comunicações da reserva na linha do tempo (`reserva_comunicacao`, SPEC §96).
 * Avisos no sino entram sozinhos (trigger em `notificacao`); e-mails são registrados aqui por
 * `enviarEmail(..., registro)`. Falha ao registrar só é logada — nunca interrompe o envio.
 */

export type RegistroEmail = {
  reservaId: string;
  papel: ComunicacaoPapel;
  /** Tipo do item na linha do tempo (ex.: 'reserva_confirmada', 'pagamento_aprovado'). */
  tipo: string;
};

export const ERRO_SEM_PROVEDOR = 'Provedor de e-mail não configurado (RESEND_API_KEY)';

export async function registrarEmail(registro: RegistroEmail, para: string, assunto: string, resultado: SendEmailResult) {
  const { error } = await supabaseAdmin.from('reserva_comunicacao').insert({
    reserva_id: registro.reservaId,
    tipo: registro.tipo,
    papel: registro.papel,
    canal: 'email',
    status: resultado.ok ? 'enviado' : 'falhou',
    destino: para,
    assunto,
    provedor_id: resultado.ok ? (resultado.id ?? null) : null,
    erro: resultado.ok ? null : resultado.error === 'no_provider' ? ERRO_SEM_PROVEDOR : resultado.error,
    tentativas: 1,
    enviado_em: resultado.ok ? new Date().toISOString() : null,
  });
  if (error) console.error('[comunicacao] registrar e-mail', registro.reservaId, error.message);
}
