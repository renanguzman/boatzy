'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Eye,
  Contact,
  Heart,
  Share2,
  MessageCircle,
  Users,
  TrendingUp,
  Filter,
} from 'lucide-react';

export type AnuncioFunil = {
  id: string;
  nome: string;
  status: string;
  visualizacoes: number;
  preco: number;
};

export type LeadFunil = {
  anuncioId: string;
  anuncioNome: string;
  userId: string;
  nome: string;
  avatar: string | null;
  eventos: string[];
  estagio: number;
  ultimaInteracao: string;
};

/** Estágios do funil — derivados do evento mais quente (SPEC §29.2). */
const ESTAGIOS: { n: number; label: string; hint: string; accent: string; badge: string }[] = [
  { n: 1, label: 'Visitante', hint: 'viu os detalhes', accent: 'border-t-slate-300', badge: 'bg-slate-100 text-slate-600' },
  { n: 2, label: 'Interessado', hint: 'revelou o contato', accent: 'border-t-sky-400', badge: 'bg-sky-50 text-sky-700' },
  { n: 3, label: 'Engajado', hint: 'favoritou', accent: 'border-t-amber-400', badge: 'bg-amber-50 text-amber-700' },
  { n: 4, label: 'Promotor', hint: 'compartilhou', accent: 'border-t-violet-400', badge: 'bg-violet-50 text-violet-700' },
  { n: 5, label: 'Em negociação', hint: 'conversou com você', accent: 'border-t-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
];

const EVENTO_META: Record<string, { icon: typeof Eye; label: string }> = {
  visualizou: { icon: Eye, label: 'Visualizou os detalhes' },
  revelou_contato: { icon: Contact, label: 'Revelou seu contato' },
  favoritou: { icon: Heart, label: 'Favoritou o anúncio' },
  compartilhou: { icon: Share2, label: 'Compartilhou o anúncio' },
  conversou: { icon: MessageCircle, label: 'Iniciou conversa' },
};

function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} dia${d > 1 ? 's' : ''}`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function FunilBoard({
  anuncios,
  leads,
  anuncioInicial,
}: {
  anuncios: AnuncioFunil[];
  leads: LeadFunil[];
  anuncioInicial: string | null;
}) {
  const [anuncioId, setAnuncioId] = useState<string>(
    anuncioInicial && anuncios.some((a) => a.id === anuncioInicial) ? anuncioInicial : 'todos',
  );

  const leadsFiltrados = useMemo(
    () => (anuncioId === 'todos' ? leads : leads.filter((l) => l.anuncioId === anuncioId)),
    [leads, anuncioId],
  );

  const visualizacoes = useMemo(() => {
    const base = anuncioId === 'todos' ? anuncios : anuncios.filter((a) => a.id === anuncioId);
    return base.reduce((acc, a) => acc + a.visualizacoes, 0);
  }, [anuncios, anuncioId]);

  const emNegociacao = leadsFiltrados.filter((l) => l.estagio === 5).length;
  const conversao = visualizacoes > 0 ? Math.round((emNegociacao / visualizacoes) * 100) : 0;

  const metricas = [
    { label: 'Visualizações', value: String(visualizacoes), icon: Eye, iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
    { label: 'Leads no funil', value: String(leadsFiltrados.length), icon: Users, iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
    { label: 'Em negociação', value: String(emNegociacao), icon: MessageCircle, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
    { label: 'Visualização → conversa', value: `${conversao}%`, icon: TrendingUp, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600' },
  ];

  return (
    <div>
      {/* Filtro por anúncio */}
      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-4 h-4 text-slate-400 shrink-0" />
        <select
          value={anuncioId}
          onChange={(e) => setAnuncioId(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition appearance-none cursor-pointer min-w-[220px]"
        >
          <option value="todos">Todos os anúncios</option>
          {anuncios.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
              {a.status !== 'ativo' ? ` (${a.status})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {metricas.map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">{m.label}</p>
              <div className={`w-9 h-9 rounded-xl ${m.iconBg} flex items-center justify-center`}>
                <m.icon className={`w-4 h-4 ${m.iconColor}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-[#0B2447]">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Kanban */}
      {leadsFiltrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-12 h-12 text-slate-200 mb-4" />
          <p className="text-sm font-medium text-slate-500">Nenhum lead ainda</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Quando usuários logados visualizarem, favoritarem, compartilharem ou conversarem
            sobre {anuncioId === 'todos' ? 'seus anúncios' : 'este anúncio'}, eles aparecem aqui.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="grid grid-cols-5 gap-4 min-w-[1100px]">
            {ESTAGIOS.map((estagio) => {
              const daColuna = leadsFiltrados.filter((l) => l.estagio === estagio.n);
              return (
                <div
                  key={estagio.n}
                  className={`bg-slate-50/80 rounded-2xl border border-slate-100 border-t-4 ${estagio.accent} flex flex-col`}
                >
                  {/* Cabeçalho da coluna */}
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[#0B2447]">{estagio.label}</h3>
                      <span className={`min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full text-[11px] font-bold ${estagio.badge}`}>
                        {daColuna.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{estagio.hint}</p>
                  </div>

                  {/* Cards de lead */}
                  <div className="px-3 pb-3 space-y-2.5 flex-1">
                    {daColuna.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center">
                        <p className="text-[11px] text-slate-300">—</p>
                      </div>
                    ) : (
                      daColuna.map((lead) => (
                        <div
                          key={`${lead.anuncioId}:${lead.userId}`}
                          className="bg-white rounded-xl border border-slate-100 shadow-sm p-3.5"
                        >
                          <div className="flex items-center gap-2.5">
                            {lead.avatar ? (
                              <Image
                                src={lead.avatar}
                                alt={lead.nome}
                                width={32}
                                height={32}
                                className="h-8 w-8 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-[#0B2447] text-white text-xs font-bold flex items-center justify-center shrink-0">
                                {lead.nome.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate leading-tight">
                                {lead.nome}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {tempoRelativo(lead.ultimaInteracao)}
                              </p>
                            </div>
                          </div>

                          {anuncioId === 'todos' && (
                            <p className="mt-2 text-[11px] text-slate-500 truncate">
                              🛥 {lead.anuncioNome}
                            </p>
                          )}

                          {/* Badges das interações + chat */}
                          <div className="mt-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              {lead.eventos.map((ev) => {
                                const meta = EVENTO_META[ev];
                                if (!meta) return null;
                                return (
                                  <span
                                    key={ev}
                                    title={meta.label}
                                    className="h-6 w-6 rounded-lg bg-slate-100 flex items-center justify-center"
                                  >
                                    <meta.icon className="h-3 w-3 text-slate-500" />
                                  </span>
                                );
                              })}
                            </div>
                            <Link
                              href={`/painel/clientes/${lead.userId}/chat`}
                              title={`Conversar com ${lead.nome}`}
                              className="h-7 w-7 rounded-lg bg-[#0B2447] hover:bg-[#0B3D91] flex items-center justify-center transition-colors shrink-0"
                            >
                              <MessageCircle className="h-3.5 w-3.5 text-white" />
                            </Link>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
