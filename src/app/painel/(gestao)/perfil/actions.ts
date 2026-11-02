'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { ehFotoDePerfilDe } from '@/lib/r2';
import { apagarFotoPerfil } from '@/lib/operador';
import { notificarAdminsPerfilEnviado } from '@/lib/emails/operador-perfil';
import {
  MENSAGEM_SEM_CONTATO, OPERADOR_LIMITES, contemContato, normalizarTextoPerfil, validarPerfilParaEnvio,
  type CampoPerfil, type ErrosPerfil,
} from '@/lib/operador-tipos';
import type { OperadorPerfilStatus } from '@/types/supabase';

/**
 * Perfil do operador — ações do gestor (SPEC §99). Toda mudança de status passa pela função
 * SQL `salvar_operador_perfil`; aqui ficam a autenticação, as validações de conteúdo e os
 * efeitos de fora do banco (R2, e-mail ao admin, cache das páginas).
 */

export type SalvarPerfilEntrada = {
  nome: string;
  headline: string;
  bio: string;
  fotoUrl: string | null;
  consentimento: boolean;
  /** Salvar e enviar para a análise da equipe (exige o perfil completo). */
  enviar: boolean;
  /** `updated_at` que o formulário conhece: protege de duas abas editando ao mesmo tempo. */
  versao: string | null;
};

export type SalvarPerfilResultado =
  | { ok: true; status: OperadorPerfilStatus; enviado: boolean; atualizadoEm: string }
  | { ok: false; error: string; campos?: ErrosPerfil };

const ERROS_DO_BANCO: Record<string, string> = {
  apenas_gestor: 'Acesso não autorizado.',
  perfil_incompleto: 'Complete a foto, o nome, a apresentação e a autorização para enviar.',
  perfil_desatualizado: 'Este perfil foi alterado em outra janela. Recarregue a página para continuar.',
};

function mensagemDoBanco(texto: string | undefined): string {
  const achado = Object.keys(ERROS_DO_BANCO).find((k) => texto?.includes(k));
  return achado ? ERROS_DO_BANCO[achado] : 'Não foi possível salvar o perfil agora. Tente novamente.';
}

export async function salvarPerfil(entrada: SalvarPerfilEntrada): Promise<SalvarPerfilResultado> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sua sessão expirou. Entre de novo no painel.' };
  if (!(await checkRoleInDb(user.id, ['gestor', 'admin']))) return { ok: false, error: 'Acesso não autorizado.' };

  const nome = (entrada.nome ?? '').trim();
  const headline = (entrada.headline ?? '').trim();
  const bio = normalizarTextoPerfil(entrada.bio ?? '');
  const fotoUrl = entrada.fotoUrl?.trim() || null;

  // A foto precisa ser um arquivo da pasta do próprio gestor (enviado por /api/painel/perfil/upload).
  if (fotoUrl && !ehFotoDePerfilDe(user.id, fotoUrl)) {
    return { ok: false, error: 'Foto inválida. Envie a foto de novo.', campos: { foto: 'Envie a foto de novo.' } };
  }

  // Mesmo no rascunho: tamanhos máximos e nada de contato (o rascunho também pode ser aprovado por engano).
  const campos: ErrosPerfil = {};
  if (nome.length > OPERADOR_LIMITES.nome.max) campos.nome = `Use no máximo ${OPERADOR_LIMITES.nome.max} caracteres.`;
  else if (nome && contemContato(nome)) campos.nome = MENSAGEM_SEM_CONTATO;
  if (headline.length > OPERADOR_LIMITES.headline.max) campos.headline = `Use no máximo ${OPERADOR_LIMITES.headline.max} caracteres.`;
  else if (headline && contemContato(headline)) campos.headline = MENSAGEM_SEM_CONTATO;
  if (bio.length > OPERADOR_LIMITES.bio.max) campos.bio = `Use no máximo ${OPERADOR_LIMITES.bio.max} caracteres.`;
  else if (bio && contemContato(bio)) campos.bio = MENSAGEM_SEM_CONTATO;

  if (entrada.enviar) {
    const faltas = validarPerfilParaEnvio({ nome, headline, bio, fotoUrl, consentimento: entrada.consentimento });
    for (const [campo, msg] of Object.entries(faltas) as [CampoPerfil, string][]) campos[campo] ??= msg;
  }
  if (Object.keys(campos).length > 0) {
    return { ok: false, error: Object.values(campos)[0] ?? 'Confira os campos do perfil.', campos };
  }

  const { data, error } = await supabaseAdmin.rpc('salvar_operador_perfil', {
    p_owner: user.id,
    p_nome: nome || null,
    p_headline: headline || null,
    p_bio: bio || null,
    p_foto_url: fotoUrl,
    p_consentimento: entrada.consentimento,
    p_enviar: entrada.enviar,
    p_versao: entrada.versao,
  });
  if (error || !data) {
    if (error && !error.message.includes('perfil_')) console.error('[perfil] falha ao salvar:', error);
    return { ok: false, error: mensagemDoBanco(error?.message) };
  }

  // Foto que saiu de cena (nunca a que está no ar) e aviso à equipe — depois da resposta.
  after(async () => {
    await apagarFotoPerfil(user.id, data.foto_antiga);
    if (data.enviado) {
      await notificarAdminsPerfilEnviado({ ownerId: user.id, nome, enviadoEm: new Date().toISOString() });
    }
  });

  revalidatePath('/painel');
  revalidatePath('/painel/perfil');
  revalidatePath('/administrator/operadores');
  revalidatePath(`/administrator/operadores/${user.id}`);

  return { ok: true, status: data.status, enviado: data.enviado, atualizadoEm: data.atualizado_em };
}
