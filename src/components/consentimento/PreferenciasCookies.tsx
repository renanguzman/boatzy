'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Lock, X } from 'lucide-react';

/**
 * Modal "Preferências de cookies": Necessários (travado) e Medição (Google
 * Analytics, opcional). Usado pelo banner ("Personalizar") e por Minha conta.
 */
export default function PreferenciasCookies({
  medicaoInicial,
  onSalvar,
  onFechar,
}: {
  medicaoInicial: boolean;
  onSalvar: (medicao: boolean) => void;
  onFechar: () => void;
}) {
  const [medicao, setMedicao] = useState(medicaoInicial);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar();
    }
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onFechar]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm sm:p-4"
      onClick={onFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="preferencias-cookies-titulo"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <h2 id="preferencias-cookies-titulo" className="text-lg font-bold text-marinho">Preferências de cookies</h2>
            <p className="mt-1 text-sm text-slate-500">
              Escolha quais cookies o Boatzy pode usar. Você pode mudar isso quando quiser em Minha conta.
            </p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 px-6 py-5">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-marinho" />
                <p className="text-sm font-semibold text-marinho">Necessários</p>
              </div>
              <span className="rounded-full bg-marinho/10 px-2.5 py-0.5 text-[11px] font-semibold text-marinho">Sempre ativos</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              Mantêm você conectado, guardam esta escolha e preferências do site (como buscas recentes). Sem eles a
              plataforma não funciona.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-marinho" />
                <p className="text-sm font-semibold text-marinho">Medição</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={medicao}
                aria-label="Permitir cookies de medição"
                onClick={() => setMedicao((m) => !m)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${medicao ? 'bg-marinho' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${medicao ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              Google Analytics: nos mostra, de forma estatística, como o site é usado (páginas visitadas, de onde
              vêm os acessos, tipo de aparelho) para melhorarmos o Boatzy. Não usamos para anúncios.
            </p>
          </div>

          <p className="text-xs text-slate-400">
            Detalhes de cada cookie na{' '}
            <Link href="/privacy#cookies" className="font-semibold text-marinho hover:underline" onClick={onFechar}>
              Política de Privacidade
            </Link>
            .
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => onSalvar(medicao)}
            className="rounded-xl border border-marinho px-5 py-2.5 text-sm font-semibold text-marinho hover:bg-marinho/5"
          >
            Salvar escolhas
          </button>
          <button
            type="button"
            onClick={() => onSalvar(true)}
            className="rounded-xl bg-marinho px-5 py-2.5 text-sm font-semibold text-white hover:bg-marinho-escuro"
          >
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  );
}
