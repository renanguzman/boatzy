'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, User, Globe } from 'lucide-react';
import { Show, UserButton, SignInButton } from '@clerk/nextjs';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2" id="header-logo">
            <Image
              src="/images/logo.png"
              alt="Boatzy"
              width={120}
              height={36}
              className="h-9 w-auto"
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8" id="main-nav">
            <Link
              href="/charters"
              className="text-sm font-medium text-slate-700 hover:text-[#0B3D91] transition-colors"
            >
              Charters
            </Link>
            <Link
              href="/destinations"
              className="text-sm font-medium text-slate-700 hover:text-[#0B3D91] transition-colors"
            >
              Destinos
            </Link>
            <Link
              href="/experiences"
              className="text-sm font-medium text-slate-700 hover:text-[#0B3D91] transition-colors"
            >
              Experiências
            </Link>
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            <button
              className="hidden md:flex items-center gap-1.5 text-sm text-slate-600 hover:text-[#0B3D91] transition-colors"
              id="language-selector"
            >
              <Globe className="h-4 w-4" />
              <span>PT</span>
            </button>

            {/* Clerk Auth Section */}
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button
                  className="hidden md:flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-[#0B3D91] hover:text-[#0B3D91] transition-all"
                  id="auth-button"
                >
                  <User className="h-4 w-4" />
                  <span>Entrar</span>
                </button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <div className="hidden md:flex items-center">
                <UserButton />
              </div>
            </Show>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden rounded-lg border border-slate-200 p-2"
              id="mobile-menu-toggle"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5 text-slate-700" />
              ) : (
                <Menu className="h-5 w-5 text-slate-700" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 py-4 animate-in slide-in-from-top">
            <nav className="flex flex-col gap-3">
              <Link
                href="/charters"
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Charters
              </Link>
              <Link
                href="/destinations"
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Destinos
              </Link>
              <Link
                href="/experiences"
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Experiências
              </Link>
              <hr className="border-slate-100" />
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-[#0B3D91]">
                    <User className="h-4 w-4" />
                    Entrar
                  </button>
                </SignInButton>
              </Show>
              <Show when="signed-in">
                <div className="px-3 py-2">
                  <UserButton />
                </div>
              </Show>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
