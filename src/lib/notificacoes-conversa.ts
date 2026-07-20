import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';
import { origemTipoLabel } from '@/lib/conversa-origem';

// ============================================================
// Notificação agrupada de novas conversas (chat).
//
// Executado pelo cron (/api/cron/notificar-conversas). Junta, por
// destinatário, todas as mensagens não lidas e ainda não notificadas
// (RPC chat_notificacoes_pendentes) e aplica a "janela anti-bombardeio":
//
//   • QUIET  — só envia se a mensagem mais recente do destinatário já
//     tem pelo menos N minutos (a rajada "acalmou").
//   • MAX_WAIT — teto: se a mensagem não lida mais antiga já espera
//     tanto tempo, envia mesmo que a conversa siga ativa.
//
// Assim, quem recebe várias mensagens em sequência recebe UM e-mail,
// e não um por mensagem.
// ============================================================

const QUIET_MINUTES = Number(process.env.NOTIF_QUIET_MINUTES ?? 5);
const MAX_WAIT_MINUTES = Number(process.env.NOTIF_MAX_WAIT_MINUTES ?? 30);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

type PendenteRow = {
  recipient_id: string;
  recipient_email: string;
  recipient_name: string;
  recipient_is_gestor: boolean;
  conversa_id: string;
  cliente_id: string;
  origem_tipo: string | null;
  origem_label: string | null;
  remetente_nome: string;
  qtd: number;
  primeira_em: string;
  ultima_em: string;
  msg_ids: string[];
};

/** Deep-link para a conversa, conforme o papel do destinatário. */
function linkConversa(row: PendenteRow): string {
  return row.recipient_is_gestor
    ? `${APP_URL}/painel/clientes/${row.cliente_id}/chat`
    : `${APP_URL}/minhas-conversas/${row.conversa_id}/chat`;
}

export type ProcessarResultado = {
  destinatariosPendentes: number;
  enviados: number;
  adiados: number;
  falhas: number;
  /** Motivos de falha (e-mail mascarado) — para diagnóstico via cron. */
  erros: string[];
};

/** Mascara o e-mail para não expor o endereço completo no retorno de diagnóstico. */
function mascararEmail(email: string): string {
  const [user, dominio] = (email ?? '').split('@');
  if (!dominio) return email;
  return `${user.slice(0, 2)}***@${dominio}`;
}

export async function processarNotificacoesConversas(): Promise<ProcessarResultado> {
  const { data, error } = await supabaseAdmin.rpc('chat_notificacoes_pendentes');
  if (error) throw new Error(`RPC chat_notificacoes_pendentes: ${error.message}`);

  const rows = (data ?? []) as PendenteRow[];

  // Agrupa por destinatário.
  const porDestinatario = new Map<string, PendenteRow[]>();
  for (const row of rows) {
    const lista = porDestinatario.get(row.recipient_id) ?? [];
    lista.push(row);
    porDestinatario.set(row.recipient_id, lista);
  }

  const agora = Date.now();
  const quietMs = QUIET_MINUTES * 60_000;
  const maxWaitMs = MAX_WAIT_MINUTES * 60_000;

  let enviados = 0;
  let adiados = 0;
  let falhas = 0;
  const erros: string[] = [];

  for (const grupo of porDestinatario.values()) {
    const ultimaMsg = Math.max(...grupo.map((r) => new Date(r.ultima_em).getTime()));
    const primeiraMsg = Math.min(...grupo.map((r) => new Date(r.primeira_em).getTime()));

    const rajadaAcalmou = agora - ultimaMsg >= quietMs;
    const esperaNoTeto = agora - primeiraMsg >= maxWaitMs;

    // Ainda em rajada e dentro do teto → adia para a próxima rodada.
    if (!rajadaAcalmou && !esperaNoTeto) {
      adiados += 1;
      continue;
    }

    const { recipient_email, recipient_name } = grupo[0];
    const totalMsgs = grupo.reduce((acc, r) => acc + Number(r.qtd), 0);
    const isGestor = grupo.every((r) => r.recipient_is_gestor);
    // 1 conversa → botão vai direto para ela; várias → vai para o hub.
    const linkPrincipal =
      grupo.length === 1
        ? linkConversa(grupo[0])
        : isGestor
          ? `${APP_URL}/painel/clientes`
          : `${APP_URL}/minhas-conversas`;

    const res = await sendEmail({
      to: recipient_email,
      subject: assunto(totalMsgs),
      html: montarHtml({ nome: recipient_name, grupo, totalMsgs, link: linkPrincipal }),
    });

    if (!res.ok) {
      falhas += 1;
      erros.push(`${mascararEmail(recipient_email)}: ${res.error}`);
      continue; // não marca como notificada → tenta de novo na próxima rodada
    }

    // Carimba as mensagens incluídas neste e-mail.
    const ids = grupo.flatMap((r) => r.msg_ids);
    const { error: updErr } = await supabaseAdmin
      .from('mensagem')
      .update({ notificada_em: new Date().toISOString() })
      .in('id', ids);

    if (updErr) {
      falhas += 1;
      erros.push(`${mascararEmail(recipient_email)}: update notificada_em: ${updErr.message}`);
      continue;
    }

    enviados += 1;
  }

  return {
    destinatariosPendentes: porDestinatario.size,
    enviados,
    adiados,
    falhas,
    erros,
  };
}

function assunto(total: number): string {
  return total === 1
    ? 'Você tem uma nova mensagem no Boatzy'
    : `Você tem ${total} novas mensagens no Boatzy`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function montarHtml({
  nome,
  grupo,
  totalMsgs,
  link,
}: {
  nome: string;
  grupo: PendenteRow[];
  totalMsgs: number;
  link: string;
}): string {
  const primeiroNome = esc((nome ?? '').split(' ')[0] || 'Olá');
  const linhas = grupo
    .map((r) => {
      const qtd = Number(r.qtd);
      const label = qtd === 1 ? '1 nova mensagem' : `${qtd} novas mensagens`;
      // Selo do contexto (a que a conversa se refere), quando houver.
      const contexto = r.origem_label
        ? `<span style="display:inline-block;margin-top:6px;padding:2px 10px;border-radius:999px;background:#e8eefb;color:#0B3D91;font-size:12px;font-weight:bold;">${esc(origemTipoLabel(r.origem_tipo))}: ${esc(r.origem_label)}</span>`
        : '';
      return `<tr>
        <td style="padding:12px 16px;border-bottom:1px solid #eef2f7;">
          <a href="${esc(linkConversa(r))}" style="text-decoration:none;color:inherit;display:block;">
            <strong style="color:#0B2447;">${esc(r.remetente_nome)}</strong>
            <div style="color:#64748b;font-size:13px;">${label}</div>
            ${contexto}
          </a>
        </td>
      </tr>`;
    })
    .join('');

  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#0B2447;padding:20px 24px;color:#ffffff;font-size:18px;font-weight:bold;">Boatzy</td></tr>
        <tr><td style="padding:24px;">
          <h1 style="margin:0 0 8px;color:#0B2447;font-size:18px;">Olá, ${primeiroNome}!</h1>
          <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.5;">
            Você tem <strong>${totalMsgs}</strong> ${totalMsgs === 1 ? 'nova mensagem' : 'novas mensagens'} não ${totalMsgs === 1 ? 'lida' : 'lidas'} no chat da plataforma:
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eef2f7;border-radius:12px;overflow:hidden;margin-bottom:20px;">
            ${linhas}
          </table>
          <a href="${esc(link)}" style="display:inline-block;background:#0B3D91;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 24px;border-radius:12px;">Ver mensagens</a>
        </td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid #eef2f7;color:#94a3b8;font-size:12px;line-height:1.5;">
          Você recebe este aviso porque a notificação de novas conversas está ativa.
          Para desativar, acesse <strong>Minha conta → Notificações</strong>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
