'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import NotificacaoItem from '@/components/notificacoes/NotificacaoItem';
import { useNotificacoes } from '@/components/notificacoes/useNotificacoes';

const PAGINA = 20;

/** Histórico completo do cliente: filtro Todas/Não lidas, marcar todas, "Carregar mais". */
export default function ListaNotificacoes({ userId }: { userId: string }) {
  const t = useTranslations('Notificacoes');
  const [filtro, setFiltro] = useState<'todas' | 'nao_lidas'>('todas');
  const [limite, setLimite] = useState(PAGINA);
  const { itens, naoLidas, total, carregando, marcarLida, marcarTodasLidas } = useNotificacoes(userId, {
    limite,
    apenasNaoLidas: filtro === 'nao_lidas',
  });

  const abas = [
    { valor: 'todas' as const, rotulo: t('abas.todas') },
    { valor: 'nao_lidas' as const, rotulo: naoLidas > 0 ? t('abas.naoLidasN', { count: naoLidas }) : t('abas.naoLidas') },
  ];

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
          {abas.map((a) => (
            <button
              key={a.valor}
              type="button"
              onClick={() => { setFiltro(a.valor); setLimite(PAGINA); }}
              aria-pressed={filtro === a.valor}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                filtro === a.valor ? 'bg-marinho text-white' : 'text-slate-500 hover:text-marinho'
              }`}
            >
              {a.rotulo}
            </button>
          ))}
        </div>
        {naoLidas > 0 && (
          <button
            type="button"
            onClick={() => void marcarTodasLidas()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-marinho hover:text-turquesa-escuro"
          >
            <CheckCheck className="h-4 w-4" />
            {t('marcarTodas')}
          </button>
        )}
      </div>

      {carregando ? (
        <div className="flex justify-center rounded-2xl border border-slate-100 bg-white py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        </div>
      ) : itens.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Bell className="h-7 w-7 text-slate-300" />
          </div>
          <h2 className="text-lg font-semibold text-slate-700">
            {filtro === 'nao_lidas' ? t('lista.tudoEmDia') : t('lista.nenhumaAinda')}
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-sm">
            {filtro === 'nao_lidas' ? t('lista.viuTodas') : t('lista.quando')}
          </p>
          {filtro === 'todas' && (
            <Link
              href="/buscar"
              className="mt-6 px-5 py-2.5 bg-marinho hover:bg-marinho-escuro text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {t('lista.explorar')}
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
            {itens.map((n) => (
              <NotificacaoItem key={n.id} n={n} onAbrir={(x) => { if (!x.lida_em) void marcarLida(x.id); }} />
            ))}
          </div>
          {itens.length < total && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setLimite((l) => l + PAGINA)}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-marinho hover:border-marinho/40"
              >
                {t('lista.carregarMais')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
