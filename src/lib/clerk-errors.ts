/**
 * Mapeia códigos de erro do Clerk para mensagens em pt-BR.
 * Use `translateClerkError(err)` em fluxos custom (que não passam pelos
 * componentes prontos do Clerk).
 */

const MESSAGES: Record<string, string> = {
  // Identificador / senha
  form_identifier_not_found: 'Não encontramos uma conta com esse e-mail.',
  form_password_incorrect: 'Senha incorreta. Tente novamente.',
  form_password_validation_failed: 'A senha não atende aos requisitos.',
  form_password_length_too_short: 'A senha é muito curta.',
  form_password_pwned: 'Esta senha apareceu em vazamentos públicos. Escolha outra.',
  form_password_not_strong_enough: 'Sua senha é fraca demais. Tente uma combinação mais forte.',

  // Formato / parâmetros
  form_param_format_invalid: 'O formato informado é inválido.',
  form_param_nil: 'Preencha todos os campos obrigatórios.',
  form_param_missing: 'Preencha todos os campos obrigatórios.',

  // E-mail / identificador
  form_identifier_exists: 'Este e-mail já está em uso.',
  form_identifier_invalid: 'O e-mail informado é inválido.',
  identifier_already_signed_in: 'Você já está autenticado nesta conta.',

  // Sessão
  session_exists: 'Você já está autenticado. Atualize a página.',
  session_token_expired: 'Sua sessão expirou. Faça login novamente.',

  // Rate limiting
  too_many_attempts: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  too_many_requests: 'Muitas requisições. Aguarde alguns instantes.',

  // Verificação
  form_code_incorrect: 'Código de verificação inválido.',
  verification_expired: 'O código expirou. Solicite um novo.',
  verification_failed: 'Falha na verificação. Tente novamente.',

  // Captcha / rede
  captcha_invalid: 'Não foi possível validar o captcha. Recarregue a página.',
  captcha_unavailable: 'O serviço de captcha está indisponível no momento.',
  network_error: 'Erro de rede. Verifique sua conexão.',

  // Genérico
  authentication_invalid: 'Credenciais inválidas. Tente novamente.',
};

type ClerkErrorLike = {
  errors?: Array<{ code?: string; message?: string; longMessage?: string }>;
};

export function translateClerkError(
  err: unknown,
  fallback = 'Não foi possível concluir. Tente novamente.',
): string {
  const e = err as ClerkErrorLike;
  const first = e?.errors?.[0];
  if (!first) {
    return err instanceof Error ? fallback : fallback;
  }
  if (first.code && MESSAGES[first.code]) return MESSAGES[first.code];
  return first.longMessage ?? first.message ?? fallback;
}
