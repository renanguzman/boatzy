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
  // Middleware só garante autenticação. O gating por role acontece no layout
  // do painel para permitir o fluxo de upgrade (cliente → gestor) sem
  // redirect-loop.
  if (isPainelRoute(req) && !isPublicPainelRoute(req)) {
    const { userId } = await auth();
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
