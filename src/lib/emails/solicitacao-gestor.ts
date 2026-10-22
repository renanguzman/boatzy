import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { formatarDataHora } from '@/lib/datas';
import { baseUrl, enviarEmail, esc, montarEmailHtml } from './layout';

/**
 * E-mails do pedido de acesso de gestor (SPEC §62):
 * - à equipe Boatzy (todos os admins) quando chega um pedido novo;
 * - ao solicitante quando o admin aprova ou recusa (com a observação).
 * A observação interna nunca vai. Disparados depois da resposta (`after()`).
 */

type DadosPedido = {
  id: string;
  nome: string;
  email: string;
  municipio: string;
  qtdEmbarcacoes: number;
  criadoEm: string;
};

export async function notificarAdminsNovaSolicitacao(pedido: DadosPedido): Promise<void> {
  const { data: admins } = await supabaseAdmin
    .from('user_roles')
    .select('users ( name, email )')
    .eq('role', 'admin');

  const url = `${baseUrl()}/administrator/usuarios/solicitacoes`;
  for (const row of admins ?? []) {
    const admin = row.users as unknown as { name: string; email: string } | null;
    if (!admin?.email) continue;
    const html = montarEmailHtml({
      nome: admin.name ?? '',
      paragrafos: [`<strong>${esc(pedido.nome)}</strong> pediu acesso ao painel de gestor do Boatzy e aguarda a análise da equipe.`],
      blocos: [{
        titulo: 'Pedido',
        linhas: [
          ['Nome', pedido.nome],
          ['E-mail', pedido.email],
          ['Cidade', pedido.municipio],
          ['Embarcações', String(pedido.qtdEmbarcacoes)],
          ['Enviado em', formatarDataHora(pedido.criadoEm)],
        ],
      }],
      botao: { texto: 'Analisar pedido', url },
      rodape: 'Você recebeu este e-mail porque é administrador do Boatzy.',
    });
    await enviarEmail(admin.email, `Novo pedido de acesso de gestor — ${pedido.nome}`, html, `solicitacao-gestor nova ${pedido.id}`);
  }
}

export async function notificarSolicitanteDecisao(input: {
  solicitacaoId: string;
  aprovada: boolean;
}): Promise<void> {
  const { data } = await supabaseAdmin
    .from('solicitacao_gestor')
    .select('observacao, users!solicitacao_gestor_user_id_fkey ( name, email )')
    .eq('id', input.solicitacaoId)
    .maybeSingle();
  const usuario = data?.users as unknown as { name: string; email: string } | null;
  if (!data || !usuario?.email) return;

  const obs = data.observacao ? `<strong>Observação da equipe:</strong> ${esc(data.observacao)}` : null;
  const html = montarEmailHtml({
    nome: usuario.name ?? '',
    paragrafos: input.aprovada
      ? [
          'Seu pedido de acesso de gestor foi <strong>aprovado</strong> pela equipe Boatzy.',
          ...(obs ? [obs] : []),
          'Você já pode entrar no painel e cadastrar sua primeira embarcação.',
        ]
      : [
          'A equipe Boatzy analisou seu pedido de acesso de gestor e <strong>não pôde aprová-lo</strong> neste momento.',
          ...(obs ? [obs] : []),
          'Se quiser, ajuste os dados e envie um novo pedido pelo painel.',
        ],
    botao: { texto: input.aprovada ? 'Entrar no painel' : 'Abrir o painel', url: `${baseUrl()}/painel` },
    rodape: 'Você recebeu este e-mail porque pediu acesso ao painel de gestor do Boatzy.',
  });

  await enviarEmail(
    usuario.email,
    input.aprovada ? 'Seu acesso de gestor no Boatzy foi aprovado' : 'Seu pedido de acesso de gestor no Boatzy',
    html,
    `solicitacao-gestor decisao ${input.solicitacaoId}`,
  );
}
