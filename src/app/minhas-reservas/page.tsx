import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  MapPin, Ship, Users, CalendarDays, ShoppingCart, Clock, MessageSquare,
  Hourglass, CheckCircle2, XCircle, Compass,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';

type ReservaCliente = {
  id: string;
  tipo: 'roteiro' | 'embarcacao';
  data_reserva: string;
  flexibilidade: number | null;
  quantidade_pessoas: number;
  roteiro_id: string | null;
  item_nome: string;
  preco_base: number | null;
  total_adicionais: number;
  taxa_servico: number | null;
  total_estimado: number | null;
  status: 'pendente' | 'confirmada' | 'recusada';
  observacao_gestor: string | null;
  solicitado_em: string;
  respondido_em: string | null;
  roteiro: {
    nome: string;
    municipios: { nome: string; estados: { uf: string } | null } | null;
    roteiro_imagens: { url_imagem: string; principal: boolean }[];
  } | null;
  embarcacao: { nome: string } | null;
  reserva_adicional: { id: string; descricao: string; valor: number; tipo: string }[];
};

const STATUS = {
  pendente: {
    label: 'Aguardando confirmação',
    badge: 'bg-amber-100 text-amber-700',
    Icon: Hourglass,
    note: 'Sua solicitação foi enviada. O gestor irá analisar e responder em breve.',
    noteClass: 'bg-amber-50 border-amber-100 text-amber-700',
  },
  confirmada: {
    label: 'Confirmada',
    badge: 'bg-emerald-100 text-emerald-700',
    Icon: CheckCircle2,
    note: 'Reserva confirmada pelo gestor.',
    noteClass: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  },
  recusada: {
    label: 'Recusada',
    badge: 'bg-red-100 text-red-600',
    Icon: XCircle,
    note: 'Esta solicitação foi recusada pelo gestor.',
    noteClass: 'bg-red-50 border-red-100 text-red-600',
  },
} as const;

function formatData(iso: string, flex: number | null): string {
  const label = new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  return flex && flex > 0 ? `${label} (± ${flex} dia${flex > 1 ? 's' : ''})` : label;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function thumb(r: ReservaCliente): string | null {
  const imgs = r.roteiro?.roteiro_imagens ?? [];
  return (imgs.find((i) => i.principal) ?? imgs[0])?.url_imagem ?? null;
}

export default async function MinhasReservasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/entrar?redirect_to=/minhas-reservas');

  const { data } = await supabaseAdmin
    .from('reserva')
    .select(
      `id, tipo, data_reserva, flexibilidade, quantidade_pessoas, roteiro_id, item_nome,
       preco_base, total_adicionais, taxa_servico, total_estimado,
       status, observacao_gestor, solicitado_em, respondido_em,
       roteiro ( nome, municipios ( nome, estados ( uf ) ), roteiro_imagens ( url_imagem, principal ) ),
       embarcacao ( nome ),
       reserva_adicional ( id, descricao, valor, tipo )`,
    )
    .eq('cliente_id', user.id)
    .order('solicitado_em', { ascending: false });

  const reservas = (data ?? []) as unknown as ReservaCliente[];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-[#0B2447]">Minhas reservas</h1>
        <p className="text-sm text-slate-500 mt-1">
          Acompanhe o status das suas solicitações e a resposta do gestor.
        </p>

        {reservas.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white p-12 flex flex-col items-center text-center">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Compass className="h-7 w-7 text-slate-300" />
            </div>
            <h2 className="text-lg font-semibold text-slate-700">Você ainda não tem reservas</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-sm">
              Explore os roteiros disponíveis e faça sua primeira solicitação.
            </p>
            <Link
              href="/buscar"
              className="mt-6 px-5 py-2.5 bg-[#0B3D91] hover:bg-[#0B2447] text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Explorar roteiros
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {reservas.map((r) => {
              const s = STATUS[r.status];
              const TipoIcon = r.tipo === 'embarcacao' ? Ship : MapPin;
              const localidade = r.roteiro?.municipios
                ? r.roteiro.municipios.estados
                  ? `${r.roteiro.municipios.nome}, ${r.roteiro.municipios.estados.uf}`
                  : r.roteiro.municipios.nome
                : null;
              const img = thumb(r);

              return (
                <article key={r.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  {/* Topo: imagem + título + status */}
                  <div className="flex items-stretch gap-4 p-4 border-b border-slate-100">
                    <div className="relative h-20 w-28 shrink-0 rounded-xl overflow-hidden bg-slate-100 hidden sm:block">
                      {img ? (
                        <Image src={img} alt={r.item_nome} fill className="object-cover" sizes="112px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <TipoIcon className="h-6 w-6 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            <TipoIcon className="h-3 w-3" />
                            {r.tipo === 'embarcacao' ? 'Embarcação' : 'Roteiro'}
                          </div>
                          <h2 className="mt-0.5 text-base font-bold text-[#0B2447] truncate">
                            {r.roteiro?.nome ?? r.item_nome}
                          </h2>
                          {localidade && (
                            <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                              <MapPin className="h-3 w-3 shrink-0" /> {localidade}
                            </div>
                          )}
                        </div>
                        <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${s.badge}`}>
                          <s.Icon className="h-3.5 w-3.5" />
                          {s.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Corpo: dados do pedido */}
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <CalendarDays className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="capitalize">{formatData(r.data_reserva, r.flexibilidade)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Users className="h-4 w-4 text-slate-400 shrink-0" />
                      {r.quantidade_pessoas} {r.quantidade_pessoas === 1 ? 'pessoa' : 'pessoas'}
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <Clock className="h-4 w-4 shrink-0" />
                      <span className="text-xs">Solicitada em {formatDateTime(r.solicitado_em)}</span>
                    </div>
                  </div>

                  {/* Adicionais */}
                  {r.reserva_adicional.length > 0 && (
                    <div className="px-4 pb-4">
                      <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                        <div className="flex items-center gap-1.5 mb-2">
                          <ShoppingCart className="h-3.5 w-3.5 text-slate-500" />
                          <span className="text-xs font-semibold text-slate-600">Adicionais</span>
                        </div>
                        <div className="space-y-1">
                          {r.reserva_adicional.map((a) => (
                            <div key={a.id} className="flex items-center justify-between text-xs text-slate-600">
                              <span>{a.descricao}</span>
                              <span className="font-medium">{formatCurrency(a.valor)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Total */}
                  {r.total_estimado != null && (
                    <div className="px-4 pb-4 flex items-center justify-between">
                      <span className="text-sm text-slate-500">Total estimado</span>
                      <span className="text-base font-bold text-[#0B2447]">{formatCurrency(r.total_estimado)}</span>
                    </div>
                  )}

                  {/* Resposta do gestor */}
                  <div className="px-4 pb-4">
                    {r.observacao_gestor ? (
                      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <MessageSquare className="h-4 w-4 text-indigo-500" />
                          <span className="text-sm font-semibold text-indigo-700">Resposta do gestor</span>
                        </div>
                        <p className="text-sm text-slate-600">{r.observacao_gestor}</p>
                        {r.respondido_em && (
                          <p className="mt-2 text-xs text-slate-400">Respondida em {formatDateTime(r.respondido_em)}</p>
                        )}
                      </div>
                    ) : (
                      <div className={`rounded-xl border p-3 text-xs font-medium ${s.noteClass}`}>{s.note}</div>
                    )}
                  </div>

                  {/* Ação: ver roteiro */}
                  {r.roteiro_id && (
                    <div className="border-t border-slate-100 px-4 py-3">
                      <Link
                        href={`/roteiros/${r.roteiro_id}`}
                        className="text-sm font-medium text-[#0B3D91] hover:text-[#0B2447] transition-colors"
                      >
                        Ver roteiro →
                      </Link>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
