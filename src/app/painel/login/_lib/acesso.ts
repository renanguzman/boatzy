/**
 * Formulário de acesso do gestor na página `/painel/login` (landing "Anuncie sua lancha").
 * Módulo comum ao Server Component da página e aos componentes de cliente —
 * por isso não leva 'use client' (constante importada de um módulo de cliente
 * chegaria ao servidor como referência, não como valor).
 */

export type AbaAcesso = 'cadastro' | 'entrar';

/** Cookie gravado no primeiro login/cadastro neste navegador: a página abre direto em "Entrar". */
export const COOKIE_JA_ENTROU_PAINEL = 'boatzy_painel_conta';

const EVENTO_ABRIR_ACESSO = 'boatzy:abrir-acesso-gestor';
export const ID_FORMULARIO_ACESSO = 'acesso';

/**
 * Aba inicial: `?aba=` explícito → quem veio de uma página protegida (`redirect_to`) já tem
 * conta → navegador que já entrou no painel → senão, cadastro (o público da página).
 */
export function resolverAbaInicial(
  aba: string | undefined,
  redirectTo: string | undefined,
  jaEntrou: boolean,
): AbaAcesso {
  if (aba === 'entrar' || aba === 'cadastro') return aba;
  if (redirectTo || jaEntrou) return 'entrar';
  return 'cadastro';
}

/** Lembra por 1 ano que este navegador já tem conta no painel. */
export function lembrarQueJaEntrou() {
  document.cookie = `${COOKIE_JA_ENTROU_PAINEL}=1; path=/; max-age=31536000; samesite=lax`;
}

/** Leva o usuário ao formulário (rolando a página) já na aba pedida. Só no navegador. */
export function abrirAcesso(aba: AbaAcesso) {
  window.dispatchEvent(new CustomEvent<AbaAcesso>(EVENTO_ABRIR_ACESSO, { detail: aba }));
  const alvo = document.getElementById(ID_FORMULARIO_ACESSO);
  if (!alvo) return;
  const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  alvo.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: 'center' });
  // Foco no primeiro campo sem "pular" a rolagem suave.
  window.setTimeout(() => {
    alvo.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
  }, reduzir ? 0 : 450);
}

/** Inscreve o formulário nos pedidos de `abrirAcesso`. Devolve a função de cancelamento. */
export function aoAbrirAcesso(callback: (aba: AbaAcesso) => void) {
  const ouvinte = (e: Event) => callback((e as CustomEvent<AbaAcesso>).detail);
  window.addEventListener(EVENTO_ABRIR_ACESSO, ouvinte);
  return () => window.removeEventListener(EVENTO_ABRIR_ACESSO, ouvinte);
}
