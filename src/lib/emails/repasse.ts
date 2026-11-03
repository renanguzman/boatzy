import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { formatarDataHora } from '@/lib/datas';
import { resumoDestino } from '@/lib/recebimento-tipos';
import type { DestinoRepasse } from '@/types/supabase';
import { baseUrl, enviarEmail, esc, montarEmailHtml } from './layout';

/**
 * Avisos de repasse (SPEC §101):
 * - à equipe Boatzy (todos os admins) quando o gestor informa ou TROCA onde recebe — a troca de
 *   destino é o vetor clássico de fraude, então o aviso sai sempre (a chave aparece mascarada);
 * - ao gestor quando o admin registra um repasse (e-mail + sino do painel).
 * Disparados depois da resposta (`after()`); falha só é logada.
 */

export async function notificarAdminsRecebimentoAlterado(input: {
  ownerId: string;
  nome: string;
  destino: Parameters<typeof resumoDestino>[0];
  primeiraVez: boolean;
  quando: string;
}): Promise<void> {
  const { data: admins } = await supabaseAdmin
    .from('user_roles')
    .select('users ( name, email )')
    .eq('role', 'admin');

  const url = `${baseUrl()}/administrator/financeiro/repasses?gestor=${input.ownerId}`;
  const assunto = input.primeiraVez
    ? `Dados de recebimento informados — ${input.nome}`
    : `ATENÇÃO: dados de recebimento alterados — ${input.nome}`;
  for (const row of admins ?? []) {
    const admin = row.users as unknown as { name: string; email: string } | null;
    if (!admin?.email) continue;
    const html = montarEmailHtml({
      nome: admin.name ?? '',
      paragrafos: [
        input.primeiraVez
          ? `<strong>${esc(input.nome)}</strong> informou onde quer receber os repasses.`
          : `<strong>${esc(input.nome)}</strong> <strong>alterou</strong> onde recebe os repasses. Se você não esperava essa mudança, confirme com o gestor antes de registrar o próximo repasse.`,
      ],
      blocos: [{
        titulo: 'Novo destino',
        linhas: [['Gestor', input.nome], ['Destino', resumoDestino(input.destino, true)], ['Quando', formatarDataHora(input.quando)]],
      }],
      botao: { texto: 'Ver repasses do gestor', url },
      rodape: 'Você recebeu este e-mail porque é administrador do Boatzy.',
    });
    await enviarEmail(admin.email, assunto, html, `recebimento alterado ${input.ownerId}`);
  }
}

export type DadosAvisoRepasse = {
  gestorId: string;
  repasseId: string;
  numero: number;
  valorTotal: number;
  pedidos: number;
  metodo: string;
  pagoEm: string;
  destino: DestinoRepasse;
  temComprovante: boolean;
};

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** E-mail + aviso no sino do painel para o gestor: o repasse foi feito. */
export async function notificarGestorRepasse(d: DadosAvisoRepasse): Promise<void> {
  const { data: gestor } = await supabaseAdmin.from('users').select('name, email').eq('id', d.gestorId).maybeSingle();
  if (!gestor) return;

  const titulo = `Repasse de ${brl(d.valorTotal)} realizado`;
  const mensagem = `O Boatzy enviou o repasse #${d.numero} (${d.pedidos === 1 ? '1 reserva' : `${d.pedidos} reservas`}).${d.temComprovante ? ' O comprovante está disponível.' : ''}`;

  const { error } = await supabaseAdmin.from('notificacao').insert({
    user_id: d.gestorId,
    publico: 'gestor',
    tipo: 'repasse_realizado',
    titulo,
    mensagem,
    link: `/painel/receitas/repasses/${d.repasseId}`,
    chave: `gestor:repasse:${d.repasseId}`,
  });
  // 23505 = já avisado; qualquer outro erro não pode impedir o e-mail.
  if (error && error.code !== '23505') console.error('[repasse] falha ao criar aviso no sino:', error);

  if (!gestor.email) return;
  const html = montarEmailHtml({
    nome: gestor.name ?? '',
    paragrafos: [`O Boatzy <strong>realizou o repasse #${d.numero}</strong> referente aos seus passeios.`],
    blocos: [{
      titulo: 'Repasse',
      linhas: [
        ['Valor', brl(d.valorTotal)],
        ['Reservas', String(d.pedidos)],
        ['Data', formatarDataHora(d.pagoEm)],
        ['Destino', resumoDestino(d.destino, true)],
      ],
      destacarUltima: false,
    }],
    botao: { texto: 'Ver o repasse', url: `${baseUrl()}/painel/receitas/repasses/${d.repasseId}` },
    rodape: 'Você recebeu este e-mail porque é gestor no Boatzy.',
  });
  await enviarEmail(gestor.email, titulo, html, `repasse ${d.repasseId}`);
}
