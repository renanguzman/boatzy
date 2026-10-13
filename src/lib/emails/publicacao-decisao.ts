import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { ENTIDADE_LABEL, type PublicacaoEntidade, type TipoEventoPublicacao } from '@/lib/publicacao/config';
import { baseUrl, enviarEmail, esc, montarEmailHtml } from './layout';

/**
 * E-mail ao gestor quando a equipe Boatzy decide sobre uma publicação:
 * aprovação (publicado), retorno (ajustes, com a observação) ou moderação
 * (retirado do ar, com a observação). A observação interna nunca vai.
 * Disparado por `decidirPublicacaoAdmin` depois da resposta (`after()`).
 */

const TABELA_NOME: Record<PublicacaoEntidade, { tabela: string; editar: (id: string) => string }> = {
  embarcacao:    { tabela: 'embarcacao', editar: id => `/painel/embarcacoes/${id}/editar` },
  roteiro:       { tabela: 'roteiro', editar: id => `/painel/roteiros/${id}/editar` },
  anuncio_venda: { tabela: 'anuncio_venda', editar: id => `/painel/vendas/${id}/editar` },
};

async function nomeDoRegistro(entidade: PublicacaoEntidade, id: string): Promise<{ nome: string; ownerId: string } | null> {
  if (entidade === 'anuncio_venda') {
    const { data } = await supabaseAdmin
      .from('anuncio_venda')
      .select('owner_id, embarcacao ( nome )')
      .eq('id', id)
      .maybeSingle();
    if (!data) return null;
    const emb = data.embarcacao as unknown as { nome: string } | null;
    return { nome: emb?.nome ?? 'Anúncio de venda', ownerId: data.owner_id };
  }
  const { data } = await supabaseAdmin
    .from(TABELA_NOME[entidade].tabela as 'embarcacao' | 'roteiro')
    .select('nome, owner_id')
    .eq('id', id)
    .maybeSingle();
  return data ? { nome: data.nome, ownerId: data.owner_id } : null;
}

export async function notificarGestorDecisaoPublicacao(input: {
  entidade: PublicacaoEntidade;
  id: string;
  tipo: Extract<TipoEventoPublicacao, 'aprovacao' | 'retorno' | 'moderacao'>;
  observacao: string | null;
}): Promise<void> {
  const registro = await nomeDoRegistro(input.entidade, input.id);
  if (!registro) return;

  const { data: dono } = await supabaseAdmin
    .from('users')
    .select('name, email')
    .eq('id', registro.ownerId)
    .maybeSingle();
  if (!dono?.email) return;

  const { singular, artigo } = ENTIDADE_LABEL[input.entidade];
  const Artigo = artigo === 'a' ? 'A' : 'O';
  const nome = esc(registro.nome);
  const url = `${baseUrl()}${TABELA_NOME[input.entidade].editar(input.id)}`;
  const obs = input.observacao ? `<strong>Observação da equipe:</strong> ${esc(input.observacao)}` : null;

  const conteudo = {
    aprovacao: {
      assunto: `${Artigo} ${singular} "${registro.nome}" foi aprovad${artigo} e publicad${artigo}`,
      paragrafos: [`${Artigo} ${singular} <strong>${nome}</strong> foi aprovad${artigo} pela equipe Boatzy e já aparece no site.`],
      botao: 'Ver no painel',
    },
    retorno: {
      assunto: `${Artigo} ${singular} "${registro.nome}" precisa de ajustes`,
      paragrafos: [
        `A equipe Boatzy analisou ${artigo} ${singular} <strong>${nome}</strong> e pediu alguns ajustes antes da publicação.`,
        ...(obs ? [obs] : []),
        'Depois de corrigir, use o botão "Reenviar para análise" no painel.',
      ],
      botao: 'Fazer os ajustes',
    },
    moderacao: {
      assunto: `${Artigo} ${singular} "${registro.nome}" foi retirad${artigo} do ar`,
      paragrafos: [
        `A equipe Boatzy retirou ${artigo} ${singular} <strong>${nome}</strong> do site.`,
        ...(obs ? [obs] : []),
        'Se quiser publicar novamente, faça os ajustes e solicite a reativação no painel.',
      ],
      botao: 'Abrir no painel',
    },
  }[input.tipo];

  const html = montarEmailHtml({
    nome: dono.name ?? '',
    paragrafos: conteudo.paragrafos,
    botao: { texto: conteudo.botao, url },
    rodape: 'Você recebeu este e-mail porque é o responsável por este cadastro no Boatzy.',
  });

  await enviarEmail(dono.email, conteudo.assunto, html, `publicacao ${input.tipo} ${input.entidade} ${input.id}`);
}
