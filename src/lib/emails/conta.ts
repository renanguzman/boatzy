import 'server-only';

import { getTranslations } from 'next-intl/server';
import { supabaseAdmin } from '@/lib/supabase';
import { IDIOMA_PADRAO, isIdioma, type Idioma } from '@/i18n/config';
import type { AcaoEmailAuth, PayloadEmailHook } from '@/lib/supabase/email-hook';
import { esc, montarEmailHtml } from './layout';

/**
 * E-mails da conta (Supabase Auth) com o layout do Boatzy, no idioma do usuário — SPEC §98.
 * Montados a partir do payload do Send Email Hook (`/api/auth/email-hook`).
 *
 * Links (os mesmos que os templates do Supabase geravam):
 * - recuperação de senha: `<redirect_to>?token_hash=…&type=recovery&next=/redefinir-senha` — vai direto para
 *   `/auth/confirm` (site) ou `/painel/auth/confirm` (painel), que validam com `verifyOtp` (link funciona
 *   em qualquer navegador — client `implicit`, SPEC "Recuperação de senha");
 * - demais: `<SUPABASE_URL>/auth/v1/verify?token=<token_hash>&type=<ação>&redirect_to=<redirect_to>` (o
 *   `{{ .ConfirmationURL }}` padrão — no cadastro, o Supabase confirma e devolve ao `emailRedirectTo`).
 *
 * Idioma: painel (`redirect_to` em `/painel/`) é sempre pt-BR; senão `user_metadata.idioma` (gravado no
 * cadastro pelo site), `users.idioma` (escolha salva na conta) ou pt-BR.
 */

export type EnvioEmailConta = { para: string; assunto: string; html: string };

type Grupo = 'cadastro' | 'senha' | 'acesso' | 'convite' | 'trocaEmail' | 'codigo' | 'seguranca';

const GRUPO: Record<AcaoEmailAuth, Grupo> = {
  signup: 'cadastro',
  recovery: 'senha',
  magiclink: 'acesso',
  email: 'acesso',
  invite: 'convite',
  email_change: 'trocaEmail',
  reauthentication: 'codigo',
  password_changed_notification: 'seguranca',
  email_changed_notification: 'seguranca',
  phone_changed_notification: 'seguranca',
  identity_linked_notification: 'seguranca',
  identity_unlinked_notification: 'seguranca',
  mfa_factor_enrolled_notification: 'seguranca',
  mfa_factor_unenrolled_notification: 'seguranca',
};

function supabaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
}

function linkVerificacao(tokenHash: string, tipo: AcaoEmailAuth, redirectTo: string): string {
  const url = new URL(`${supabaseUrl()}/auth/v1/verify`);
  url.searchParams.set('token', tokenHash);
  url.searchParams.set('type', tipo);
  if (redirectTo) url.searchParams.set('redirect_to', redirectTo);
  return url.toString();
}

/** Destino da recuperação: a rota de confirmação pedida (site ou painel); senão a do site. */
function linkRecuperacao(tokenHash: string, redirectTo: string, siteUrl: string): string {
  let destino: URL | null = null;
  try {
    const pedido = new URL(redirectTo);
    if (/\/auth\/confirm\/?$/.test(pedido.pathname)) destino = pedido;
  } catch {
    // redirect_to vazio ou inválido → rota do site
  }
  destino ??= new URL('/auth/confirm', siteUrl || 'https://boatzy.app');
  destino.searchParams.set('token_hash', tokenHash);
  destino.searchParams.set('type', 'recovery');
  destino.searchParams.set('next', '/redefinir-senha');
  return destino.toString();
}

async function perfilDoUsuario(p: PayloadEmailHook): Promise<{ idioma: Idioma; nome: string }> {
  const meta = p.user.user_metadata ?? {};
  const nomeMeta = [meta.full_name, meta.name].find((v): v is string => typeof v === 'string' && v.trim() !== '');
  const painel = /\/painel(\/|$)/.test(p.email_data.redirect_to ?? '');
  if ((painel || isIdioma(meta.idioma)) && nomeMeta) {
    return { idioma: painel ? 'pt-BR' : (meta.idioma as Idioma), nome: nomeMeta.trim() };
  }
  // Conta já existente (recuperação, troca de e-mail…): idioma e nome salvos no Boatzy.
  const { data } = await supabaseAdmin.from('users').select('name, idioma').eq('id', p.user.id).maybeSingle();
  const idioma = painel ? 'pt-BR' : isIdioma(meta.idioma) ? meta.idioma : isIdioma(data?.idioma) ? data.idioma : IDIOMA_PADRAO;
  return { idioma, nome: (nomeMeta ?? data?.name ?? '').trim() };
}

async function montar(input: {
  acao: AcaoEmailAuth;
  idioma: Idioma;
  nome: string;
  link: string | null;
  codigo: string | null;
  emailAtual?: string;
  emailNovo?: string;
}): Promise<{ assunto: string; html: string }> {
  const t = await getTranslations({ locale: input.idioma, namespace: 'EmailConta' });
  const grupo = GRUPO[input.acao];

  const paragrafos: string[] = [];
  let assunto: string;
  let botao: string | null = null;
  let aviso: string;
  switch (grupo) {
    case 'cadastro':
      assunto = t('cadastro.assunto');
      paragrafos.push(esc(t('cadastro.intro')), esc(t('cadastro.depois')));
      botao = t('cadastro.botao');
      aviso = t('cadastro.aviso');
      break;
    case 'trocaEmail':
      assunto = t('trocaEmail.assunto');
      paragrafos.push(esc(t('trocaEmail.intro', { atual: input.emailAtual ?? '—', novo: input.emailNovo ?? '—' })));
      botao = t('trocaEmail.botao');
      aviso = t('trocaEmail.aviso');
      break;
    case 'codigo':
      assunto = t('codigo.assunto');
      paragrafos.push(esc(t('codigo.intro')));
      aviso = t('codigo.aviso');
      break;
    case 'seguranca': {
      const evento = input.acao.replace(/_notification$/, '') as 'password_changed';
      assunto = t('seguranca.assunto');
      paragrafos.push(esc(t(`seguranca.eventos.${evento}`)));
      aviso = t('seguranca.aviso');
      break;
    }
    default:
      assunto = t(`${grupo}.assunto`);
      paragrafos.push(esc(t(`${grupo}.intro`)));
      botao = t(`${grupo}.botao`);
      aviso = t(`${grupo}.aviso`);
  }

  const link = botao ? input.link : null;
  const aposBotao = [
    link ? esc(t('usoUnico')) : null,
    esc(aviso),
    link
      ? `${esc(t('linkAlternativo'))}<br><a href="${esc(link)}" style="color:#0E2F4F;word-break:break-all;">${esc(link)}</a>`
      : null,
  ].filter(Boolean).join('<br><br>');

  const html = montarEmailHtml({
    nome: input.nome,
    titulo: input.nome ? t('saudacao', { nome: input.nome.split(' ')[0] }) : t('saudacaoSemNome'),
    paragrafos,
    blocos: input.codigo ? [{ linhas: [[t('codigoRotulo'), input.codigo]], destacarUltima: true }] : [],
    botao: link && botao ? { texto: botao, url: link } : undefined,
    aposBotao,
    rodape: t('rodape'),
    lang: input.idioma,
  });
  return { assunto, html };
}

/** Os e-mails que o hook pede (1, ou 2 na troca de e-mail segura). */
export async function enviosDoHook(p: PayloadEmailHook): Promise<EnvioEmailConta[]> {
  const { user, email_data: d } = p;
  const acao = d.email_action_type;
  if (!(acao in GRUPO)) throw new Error(`ação de e-mail desconhecida: ${String(acao)}`);
  const { idioma, nome } = await perfilDoUsuario(p);

  if (acao === 'email_change') {
    const novo = user.new_email || null;
    // Nomes dos hashes invertidos por compatibilidade (doc do Supabase): `token_hash_new` vai para o e-mail
    // ATUAL e `token_hash` para o NOVO. Sem troca segura, só o novo recebe.
    const destinos = d.token_hash_new && novo
      ? [{ para: user.email, hash: d.token_hash_new }, { para: novo, hash: d.token_hash }]
      : [{ para: novo ?? user.email, hash: d.token_hash }];
    return Promise.all(destinos.map(async ({ para, hash }) => ({
      para,
      ...(await montar({
        acao, idioma, nome, codigo: null,
        link: linkVerificacao(hash, acao, d.redirect_to),
        emailAtual: d.old_email || user.email,
        emailNovo: novo ?? user.email,
      })),
    })));
  }

  const link = GRUPO[acao] === 'codigo' || GRUPO[acao] === 'seguranca'
    ? null
    : acao === 'recovery'
      ? linkRecuperacao(d.token_hash, d.redirect_to, d.site_url)
      : linkVerificacao(d.token_hash, acao, d.redirect_to);
  const codigo = acao === 'reauthentication' ? d.token || null : null;
  return [{ para: user.email, ...(await montar({ acao, idioma, nome, link, codigo })) }];
}
