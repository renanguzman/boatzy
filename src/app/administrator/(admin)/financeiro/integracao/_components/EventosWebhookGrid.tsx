'use client';

import { Fragment, useState, useEffect, useTransition, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Search, Inbox, Loader2, RotateCcw, RefreshCw, ChevronDown, ChevronRight,
  ChevronsLeft, ChevronsRight, ChevronLeft,
} from 'lucide-react';
import type { AsaasWebhookEventoStatus } from '@/types/supabase';
import { formatarDataHoraBR } from '@/lib/termos/formato';
import { reprocessarEventoAsaas, reprocessarPendentesAsaas } from '../actions';

const PAGE_SIZES = [10, 25, 50];

export type EventoWebhookItem = {
  id: string;
  evento: string;
  recurso_tipo: string | null;
  recurso_id: string | null;
  payload: unknown;
  criado_asaas_em: string | null;
  recebido_em: string;
  status: AsaasWebhookEventoStatus;
  tentativas: number;
  erro: string | null;
  processado_em: string | null;
};

type Props = {
  eventos: EventoWebhookItem[];
  total: number;
  page: number;
  perPage: number;
  totaisPorStatus: Record<AsaasWebhookEventoStatus, number>;
};

const STATUS_INFO: Record<AsaasWebhookEventoStatus, { label: string; cls: string }> = {
  pendente: { label: 'Pendente', cls: 'bg-amber-50 text-amber-700' },
  processando: { label: 'Processando', cls: 'bg-blue-50 text-blue-700' },
  processado: { label: 'Processado', cls: 'bg-emerald-50 text-emerald-700' },
  ignorado: { label: 'Ignorado', cls: 'bg-slate-100 text-slate-500' },
  erro: { label: 'Erro', cls: 'bg-red-50 text-red-700' },
};

const REPROCESSAVEL: AsaasWebhookEventoStatus[] = ['erro', 'ignorado', 'pendente'];

function getPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  if (current > 3) pages.push('…');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

function Th({ label, className = '' }: { label: string; className?: string }) {
  return (
    <th className={`pb-3 px-4 text-[10px] font-bold text-slate-400 tracking-wider uppercase whitespace-nowrap ${className}`}>
      {label}
    </th>
  );
}

export default function EventosWebhookGrid({ eventos, total, page, perPage, totaisPorStatus }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const statusFiltro = searchParams.get('status') ?? '';
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [isNavigating, startNavigation] = useTransition();
  const [aberto, setAberto] = useState<string | null>(null);
  const [reprocessando, setReprocessando] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') params.delete(key);
        else params.set(key, value);
      }
      startNavigation(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [router, pathname, searchParams],
  );

  // Busca com debounce: só consulta o servidor após 400ms sem digitação.
  useEffect(() => {
    const current = searchParams.get('q') ?? '';
    if (search === current) return;
    const t = setTimeout(() => setParams({ q: search, page: null }), 400);
    return () => clearTimeout(t);
  }, [search, searchParams, setParams]);

  async function handleReprocessar(id: string) {
    setReprocessando(id);
    setMensagem(null);
    const r = await reprocessarEventoAsaas(id);
    setReprocessando(null);
    if (r.ok) {
      setMensagem({ ok: true, texto: r.status ? `Evento reprocessado: ${STATUS_INFO[r.status].label.toLowerCase()}.` : 'O evento não estava elegível (já processado ou em processamento).' });
      router.refresh();
    } else {
      setMensagem({ ok: false, texto: r.error });
    }
  }

  async function handleReprocessarPendentes() {
    setReprocessando('*');
    setMensagem(null);
    const r = await reprocessarPendentesAsaas();
    setReprocessando(null);
    if (r.ok) {
      const { total: t, processados, ignorados, erros } = r.resumo;
      setMensagem({
        ok: erros === 0,
        texto: t === 0 ? 'Nenhum evento pendente.' : `${t} evento(s): ${processados} processado(s), ${ignorados} ignorado(s), ${erros} com erro.`,
      });
      router.refresh();
    } else {
      setMensagem({ ok: false, texto: r.error });
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const filtrando = !!search || !!statusFiltro;
  const pendentes = totaisPorStatus.pendente + totaisPorStatus.erro;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-[#0B2447]">Eventos recebidos</h2>
          <p className="text-sm text-slate-500">
            Cada evento é gravado uma única vez (pelo id do Asaas) e processado depois da resposta.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReprocessarPendentes}
          disabled={reprocessando !== null || pendentes === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#0B2447] bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {reprocessando === '*' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Reprocessar pendentes{pendentes > 0 && ` (${pendentes})`}
        </button>
      </div>

      {/* Totais por status — clicáveis como filtro */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.keys(STATUS_INFO) as AsaasWebhookEventoStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setParams({ status: statusFiltro === s ? null : s, page: null })}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              statusFiltro === s ? 'border-[#0B2447] ring-1 ring-[#0B2447]/20' : 'border-transparent'
            } ${STATUS_INFO[s].cls}`}
          >
            {STATUS_INFO[s].label} · {totaisPorStatus[s]}
          </button>
        ))}
      </div>

      <div className="relative mb-5">
        {isNavigating ? (
          <Loader2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin pointer-events-none" />
        ) : (
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        )}
        <input
          type="text"
          placeholder="Buscar por id do evento, id da cobrança/transferência ou tipo de evento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition"
        />
      </div>

      {mensagem && (
        <p
          className={`mb-4 text-sm rounded-xl px-4 py-3 border ${
            mensagem.ok ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-red-700 bg-red-50 border-red-100'
          }`}
        >
          {mensagem.texto}
        </p>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {eventos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Inbox className="w-12 h-12 text-slate-200 mb-4" />
            <p className="text-sm font-medium text-slate-500">
              {filtrando ? 'Nenhum evento encontrado' : 'Nenhum evento recebido ainda'}
            </p>
            {filtrando && <p className="text-xs text-slate-400 mt-1">Tente outra busca ou outro filtro.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <Th label="Evento" className="pl-6" />
                  <Th label="Recurso" />
                  <Th label="Recebido em" />
                  <Th label="Status" />
                  <Th label="Tentativas" />
                  <th className="pb-3 px-4 pr-6 text-[10px] font-bold text-slate-400 tracking-wider uppercase text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((ev) => {
                  const expandido = aberto === ev.id;
                  return (
                    <Fragment key={ev.id}>
                      <tr className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        <td className="py-4 pl-6 pr-4">
                          <button
                            type="button"
                            onClick={() => setAberto(expandido ? null : ev.id)}
                            className="flex items-center gap-1.5 text-left"
                          >
                            {expandido ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                            <span className="font-mono text-xs font-semibold text-[#0B2447]">{ev.evento}</span>
                          </button>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5 ml-5 truncate max-w-[260px]" title={ev.id}>{ev.id}</p>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-sm text-slate-700 font-mono whitespace-nowrap">{ev.recurso_id ?? '—'}</p>
                          {ev.recurso_tipo && <p className="text-[11px] text-slate-400">{ev.recurso_tipo}</p>}
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-slate-600 whitespace-nowrap">{formatarDataHoraBR(ev.recebido_em, { segundos: true })}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_INFO[ev.status].cls}`}>
                            {STATUS_INFO[ev.status].label}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-sm text-slate-600">{ev.tentativas}</td>
                        <td className="py-4 px-4 pr-6">
                          <div className="flex items-center justify-end">
                            {REPROCESSAVEL.includes(ev.status) && (
                              <button
                                type="button"
                                onClick={() => handleReprocessar(ev.id)}
                                disabled={reprocessando !== null}
                                title="Reprocessar"
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#0B2447] hover:bg-slate-100 disabled:opacity-40 transition-colors"
                              >
                                {reprocessando === ev.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandido && (
                        <tr className="border-b border-slate-50 bg-slate-50/60">
                          <td colSpan={6} className="px-6 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3 text-xs text-slate-500">
                              <p><span className="font-semibold">Criado no Asaas:</span> {formatarDataHoraBR(ev.criado_asaas_em, { segundos: true })}</p>
                              <p><span className="font-semibold">Processado em:</span> {formatarDataHoraBR(ev.processado_em, { segundos: true })}</p>
                            </div>
                            {ev.erro && (
                              <p className="mb-3 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 whitespace-pre-wrap">{ev.erro}</p>
                            )}
                            <pre className="text-[11px] leading-relaxed text-slate-700 bg-white border border-slate-100 rounded-lg p-3 overflow-auto max-h-80">
                              {JSON.stringify(ev.payload, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <p className="text-xs text-slate-400">
                Mostrando{' '}
                <span className="font-semibold text-slate-600">
                  {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)}
                </span>{' '}
                de <span className="font-semibold text-slate-600">{total}</span> eventos
              </p>
              <label className="flex items-center gap-1.5 text-xs text-slate-400">
                Por página:
                <select
                  value={perPage}
                  onChange={(ev) => setParams({ per: ev.target.value === '10' ? null : ev.target.value, page: null })}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 cursor-pointer"
                >
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setParams({ page: null })} disabled={page === 1} title="Primeira página"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setParams({ page: page - 1 <= 1 ? null : String(page - 1) })} disabled={page === 1} title="Página anterior"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {getPageNumbers(page, totalPages).map((n, i) =>
                  n === '…' ? (
                    <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-slate-400">…</span>
                  ) : (
                    <button key={n} onClick={() => setParams({ page: n <= 1 ? null : String(n) })}
                      className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
                        n === page ? 'bg-[#0B2447] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
                      }`}>
                      {n}
                    </button>
                  ),
                )}
                <button onClick={() => setParams({ page: String(Math.min(totalPages, page + 1)) })} disabled={page === totalPages} title="Próxima página"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setParams({ page: String(totalPages) })} disabled={page === totalPages} title="Última página"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
