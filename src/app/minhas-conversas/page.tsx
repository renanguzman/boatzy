import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { MessageCircle, ChevronRight, User } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getFormatos } from '@/i18n/formatos-servidor';
import type { Formatos } from '@/i18n/formatos';

type Tradutores = {
  t: Awaited<ReturnType<typeof getTranslations<'MinhasConversas'>>>;
  tTempo: Awaited<ReturnType<typeof getTranslations<'Notificacoes.tempo'>>>;
  f: Formatos;
};

function tempoRelativo(iso: string, { t, tTempo, f }: Tradutores): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return tTempo('agora');
  if (min < 60) return tTempo('minutos', { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return tTempo('horas', { n: h });
  const d = Math.floor(h / 24);
  if (d < 7) return t('diasAtras', { n: d });
  return f.data(iso);
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('MinhasConversas'))('metaTitulo') };
}

export default async function MinhasConversasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar?redirect_to=/minhas-conversas');

  // service role: auth.uid() nulo — a guarda da RPC aceita o p_cliente explícito.
  const { data: conversas } = await supabaseAdmin.rpc('chat_conversas_cliente', {
    p_cliente: user.id,
  });

  const lista = conversas ?? [];
  const [t, tTempo, f] = await Promise.all([
    getTranslations('MinhasConversas'),
    getTranslations('Notificacoes.tempo'),
    getFormatos(),
  ]);


  return (
    <div className="min-h-screen flex flex-col bg-areia">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-marinho">{t('titulo')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('subtitulo')}</p>

        {lista.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white p-12 flex flex-col items-center text-center">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <MessageCircle className="h-7 w-7 text-slate-300" />
            </div>
            <h2 className="text-lg font-semibold text-slate-700">{t('vazioTitulo')}</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-sm">{t('vazioTexto')}</p>
            <Link
              href="/buscar"
              className="mt-6 px-5 py-2.5 bg-marinho hover:bg-marinho-escuro text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {t('explorar')}
            </Link>
          </div>
        ) : (
          <div className="mt-6 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
            {lista.map((c) => (
              <Link
                key={c.conversa_id}
                href={`/minhas-conversas/${c.conversa_id}/chat`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50/60 transition-colors"
              >
                {c.gestor_avatar ? (
                  <Image
                    src={c.gestor_avatar}
                    alt={c.gestor_nome}
                    width={44}
                    height={44}
                    className="h-11 w-11 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="h-11 w-11 rounded-full bg-marinho flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-white" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-marinho truncate">{c.gestor_nome}</p>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {c.ultima_em ? tempoRelativo(c.ultima_em, { t, tTempo, f }) : ''}
                    </span>
                  </div>
                  <p className={`text-xs truncate mt-0.5 ${c.nao_lidas > 0 ? 'font-semibold text-slate-700' : 'text-slate-400'}`}>
                    {c.ultima_mensagem ?? t('iniciarConversa')}
                  </p>
                </div>

                {c.nao_lidas > 0 ? (
                  <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none shrink-0">
                    {c.nao_lidas > 99 ? '99+' : c.nao_lidas}
                  </span>
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                )}
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
