import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

/**
 * Rotas públicas do painel (login, cadastro, setup-role)
 */
const isPublicPainelRoute = createRouteMatcher([
  '/painel/login(.*)',
  '/painel/cadastro(.*)',
  '/painel/auth(.*)',
  '/api/painel/setup-role(.*)',
]);

const isPainelRoute = createRouteMatcher(['/painel(.*)']);

export default clerkMiddleware(async (auth, req) => {
  // Rotas do painel que NÃO são públicas → proteger
  if (isPainelRoute(req) && !isPublicPainelRoute(req)) {
    const { userId } = await auth();

    // Se não autenticado → redirecionar para login
    if (!userId) {
      return NextResponse.redirect(new URL('/painel/login', req.url));
    }
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
