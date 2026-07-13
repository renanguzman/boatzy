import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { MessageCircle, ChevronRight, User } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d} dia${d > 1 ? 's' : ''}`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-[#0B2447]">Minhas conversas</h1>
        <p className="text-sm text-slate-500 mt-1">
          Suas conversas com os gestores — reservas de roteiros, embarcações e anúncios de venda.
        </p>

        {lista.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white p-12 flex flex-col items-center text-center">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <MessageCircle className="h-7 w-7 text-slate-300" />
            </div>
            <h2 className="text-lg font-semibold text-slate-700">Você ainda não tem conversas</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-sm">
              Ao conversar com um gestor sobre uma reserva ou um anúncio de venda, a conversa
              aparece aqui.
            </p>
            <Link
              href="/buscar"
              className="mt-6 px-5 py-2.5 bg-[#0B3D91] hover:bg-[#0B2447] text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Explorar o Boatzy
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
                  <div className="h-11 w-11 rounded-full bg-[#0B2447] flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-white" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#0B2447] truncate">{c.gestor_nome}</p>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {c.ultima_em ? tempoRelativo(c.ultima_em) : ''}
                    </span>
                  </div>
                  <p className={`text-xs truncate mt-0.5 ${c.nao_lidas > 0 ? 'font-semibold text-slate-700' : 'text-slate-400'}`}>
                    {c.ultima_mensagem ?? 'Iniciar conversa'}
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
