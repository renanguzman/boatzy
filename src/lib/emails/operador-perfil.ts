import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { formatarDataHora } from '@/lib/datas';
import { baseUrl, enviarEmail, esc, montarEmailHtml } from './layout';

/**
 * E-mails e avisos do perfil do operador (SPEC §99):
 * - à equipe Boatzy (todos os admins) quando um perfil entra em análise;
 * - ao gestor quando o admin aprova, devolve ou retira o perfil do ar (com a observação) —
 *   por e-mail e no sino do painel.
 * A observação interna nunca vai. Disparados depois da resposta (`after()`).
 */

import type { DecisaoPerfil } from '@/lib/operador-tipos';

export async function notificarAdminsPerfilEnviado(input: { ownerId: string; nome: string; enviadoEm: string }): Promise<void> {
  const { data: admins } = await supabaseAdmin
    .from('user_roles')
    .select('users ( name, email )')
    .eq('role', 'admin');

  const url = `${baseUrl()}/administrator/operadores/${input.ownerId}`;
  for (const row of admins ?? []) {
    const admin = row.users as unknown as { name: string; email: string } | null;
    if (!admin?.email) continue;
    const html = montarEmailHtml({
      nome: admin.name ?? '',
      paragrafos: [`<strong>${esc(input.nome)}</strong> enviou o perfil de operador para análise. Ele só aparece no site depois da sua aprovação.`],
      blocos: [{ titulo: 'Perfil', linhas: [['Operador', input.nome], ['Enviado em', formatarDataHora(input.enviadoEm)]] }],
      botao: { texto: 'Analisar perfil', url },
      rodape: 'Você recebeu este e-mail porque é administrador do Boatzy.',
    });
    await enviarEmail(admin.email, `Perfil de operador para analisar — ${input.nome}`, html, `operador-perfil enviado ${input.ownerId}`);
  }
}

const TEXTO_DECISAO: Record<DecisaoPerfil, { assunto: string; paragrafos: string[]; botao: string; aviso: { titulo: string; mensagem: string } }> = {
  aprovar: {
    assunto: 'Seu perfil de operador foi aprovado',
    paragrafos: [
      'A equipe Boatzy <strong>aprovou o seu perfil de operador</strong>. Ele já aparece nas páginas dos seus passeios e embarcações.',
      'Obrigado por se apresentar: quem conhece quem vai conduzir o passeio reserva com mais confiança.',
    ],
    botao: 'Ver meu perfil',
    aviso: { titulo: 'Seu perfil foi aprovado 🎉', mensagem: 'Ele já aparece nas páginas dos seus passeios. Bem-vindo à tripulação!' },
  },
  restaurar: {
    assunto: 'Seu perfil de operador voltou ao ar',
    paragrafos: ['A equipe Boatzy <strong>recolocou o seu perfil de operador no ar</strong>.'],
    botao: 'Ver meu perfil',
    aviso: { titulo: 'Seu perfil voltou ao ar', mensagem: 'Ele já aparece de novo nas páginas dos seus passeios.' },
  },
  devolver: {
    assunto: 'Ajustes no seu perfil de operador',
    paragrafos: [
      'A equipe Boatzy analisou o seu perfil de operador e <strong>pediu alguns ajustes</strong> antes de publicar.',
      'Faça as mudanças e envie de novo — leva poucos minutos.',
    ],
    botao: 'Ajustar meu perfil',
    aviso: { titulo: 'A equipe pediu ajustes no seu perfil', mensagem: 'Veja o recado, ajuste e envie de novo para análise.' },
  },
  retirar: {
    assunto: 'Seu perfil de operador saiu do ar',
    paragrafos: [
      'A equipe Boatzy <strong>retirou o seu perfil de operador do ar</strong>.',
      'Veja o motivo abaixo, ajuste o que for preciso e envie de novo para análise.',
    ],
    botao: 'Ajustar meu perfil',
    aviso: { titulo: 'Seu perfil saiu do ar', mensagem: 'Veja o recado da equipe, ajuste e envie de novo para análise.' },
  },
};

/** E-mail + aviso no sino do painel para o gestor. `revisao` mantém a chave do aviso única por decisão. */
export async function notificarGestorDecisaoPerfil(input: {
  ownerId: string;
  decisao: DecisaoPerfil;
  observacao: string | null;
  revisao: number;
}): Promise<void> {
  const { data: usuario } = await supabaseAdmin.from('users').select('name, email').eq('id', input.ownerId).maybeSingle();
  if (!usuario) return;
  const texto = TEXTO_DECISAO[input.decisao];

  // Aviso no sino (idempotente: a mesma decisão da mesma revisão não duplica).
  const aprovado = input.decisao === 'aprovar' || input.decisao === 'restaurar';
  const { error } = await supabaseAdmin.from('notificacao').insert({
    user_id: input.ownerId,
    publico: 'gestor',
    tipo: aprovado ? 'perfil_operador_aprovado' : 'perfil_operador_ajustes',
    titulo: texto.aviso.titulo,
    mensagem: input.observacao ? `${texto.aviso.mensagem} Recado: ${input.observacao}`.slice(0, 500) : texto.aviso.mensagem,
    link: '/painel/perfil',
    // Aprovação: uma por revisão. Devolver/retirar podem se repetir na mesma revisão, então levam a hora.
    chave: `gestor:perfil:${input.ownerId}:${input.revisao}:${input.decisao}${input.decisao === 'aprovar' ? '' : `:${Date.now()}`}`,
  });
  // 23505 = já avisado; qualquer outro erro não pode impedir o e-mail.
  if (error && error.code !== '23505') console.error('[operador-perfil] falha ao criar aviso no sino:', error);

  if (!usuario.email) return;
  const obs = input.observacao ? `<strong>Recado da equipe:</strong> ${esc(input.observacao)}` : null;
  const html = montarEmailHtml({
    nome: usuario.name ?? '',
    paragrafos: [...texto.paragrafos.slice(0, 1), ...(obs ? [obs] : []), ...texto.paragrafos.slice(1)],
    botao: { texto: texto.botao, url: `${baseUrl()}/painel/perfil` },
    rodape: 'Você recebeu este e-mail porque tem um perfil de operador no Boatzy.',
  });
  await enviarEmail(usuario.email, texto.assunto, html, `operador-perfil decisao ${input.decisao} ${input.ownerId}`);
}
