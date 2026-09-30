'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import * as XLSX from 'xlsx';
import {
  Search, ChevronUp, ChevronDown, Eye, Receipt, Loader2, Download, X, QrCode, CreditCard, FlaskConical,
  ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { formatCurrencyPrecise } from '@/lib/utils';
import { formatarDataHoraBR } from '@/lib/termos/formato';
import { cartaoDe, pagamentoPrincipal, type PedidoLinha } from '../_lib/linha';
import { FORMA_LABEL, PAGAMENTO_STATUS, PEDIDO_STATUS, formatarDataCurta } from '../_lib/rotulos';
import { exportarPedidos } from '../actions';
import { hojeISO } from '@/lib/datas';

type SortKey = 'numero' | 'criado_em' | 'cliente' | 'gestor' | 'data_passeio' | 'valor_total' | 'status';

type Props = {
  pedidos: PedidoLinha[];
  total: number;
  page: number;
  perPage: number;
  pageSizes: number[];
};

const controleCls =
  'rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40';

function getPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  if (current > 3) pages.push('…');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

function ThSortable({ col, label, className = '', sortKey, sortDir, onSort }: {
  col: SortKey; label: string; className?: string;
  sortKey: SortKey; sortDir: 'asc' | 'desc'; onSort: (col: SortKey) => void;
}) {
  const active = sortKey === col;
  return (
    <th onClick={() => onSort(col)} className={`pb-3 px-3 text-[10px] font-bold tracking-wider uppercase cursor-pointer select-none whitespace-nowrap ${className}`}>
      <div className="flex items-center gap-1 text-slate-400 hover:text-[#0B2447] transition-colors">
        {label}
        <span className="flex flex-col">
          <ChevronUp className={`w-2.5 h-2.5 -mb-0.5 ${active && sortDir === 'asc' ? 'text-[#0B2447]' : 'text-slate-300'}`} />
          <ChevronDown className={`w-2.5 h-2.5 ${active && sortDir === 'desc' ? 'text-[#0B2447]' : 'text-slate-300'}`} />
        </span>
      </div>
    </th>
  );
}

function ThPlain({ label, className = '' }: { label: string; className?: string }) {
  return <th className={`pb-3 px-3 text-[10px] font-bold text-slate-400 tracking-wider uppercase whitespace-nowrap ${className}`}>{label}</th>;
}

export default function AdminPedidosGrid({ pedidos, total, page, perPage, pageSizes }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sortKey = (searchParams.get('sort') ?? 'criado_em') as SortKey;
  const sortDir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';

  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [isNavigating, startNavigation] = useTransition();
  const [exportando, setExportando] = useState(false);
  const [erroExport, setErroExport] = useState<string | null>(null);

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') params.delete(key);
        else params.set(key, value);
      }
      startNavigation(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
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

  function handleSort(key: SortKey) {
    if (sortKey === key) setParams({ dir: sortDir === 'asc' ? 'desc' : 'asc', page: null });
    else setParams({ sort: key, dir: key === 'cliente' || key === 'gestor' ? 'asc' : 'desc', page: null });
  }

  async function handleExportar() {
    setExportando(true);
    setErroExport(null);
    const r = await exportarPedidos(searchParams.toString());
    setExportando(false);
    if (!r.ok) {
      setErroExport(r.error);
      return;
    }
    const sheet = XLSX.utils.json_to_sheet(r.linhas);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Pedidos');
    XLSX.writeFile(workbook, `pedidos-boatzy-${hojeISO()}.xlsx`);
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const filtrosAtivos = ['q', 'status', 'forma', 'de', 'ate'].some((k) => searchParams.get(k));

  return (
    <div>
      {/* Filtros */}
      <div className="flex flex-col xl:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          {isNavigating ? (
            <Loader2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin pointer-events-none" />
          ) : (
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          )}
          <input
            type="text"
            placeholder="Nº do pedido, cliente, gestor, e-mail, item, cupom, id do Asaas (pay_, cus_)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-10 pr-4 ${controleCls} placeholder:text-slate-400`}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <select value={searchParams.get('status') ?? ''} onChange={(e) => setParams({ status: e.target.value, page: null })} className={`${controleCls} cursor-pointer`}>
            <option value="">Todos os status</option>
            {Object.entries(PEDIDO_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={searchParams.get('forma') ?? ''} onChange={(e) => setParams({ forma: e.target.value, page: null })} className={`${controleCls} cursor-pointer`}>
            <option value="">Todas as formas</option>
            {Object.entries(FORMA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            De
            <input type="date" value={searchParams.get('de') ?? ''} onChange={(e) => setParams({ de: e.target.value, page: null })} className={controleCls} />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Até
            <input type="date" value={searchParams.get('ate') ?? ''} onChange={(e) => setParams({ ate: e.target.value, page: null })} className={controleCls} />
          </label>
          {filtrosAtivos && (
            <button
              type="button"
              onClick={() => { setSearch(''); setParams({ q: null, status: null, forma: null, de: null, ate: null, page: null }); }}
              className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-100"
            >
              <X className="w-4 h-4" /> Limpar
            </button>
          )}
          <button
            type="button"
            onClick={handleExportar}
            disabled={exportando || total === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B2447] text-white text-sm font-semibold hover:bg-[#0B3D91] disabled:opacity-40 transition-colors"
          >
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Exportar Excel
          </button>
        </div>
      </div>
      {erroExport && <p className="mb-4 text-sm text-red-600">{erroExport}</p>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {pedidos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Receipt className="w-12 h-12 text-slate-200 mb-4" />
            <p className="text-sm font-medium text-slate-500">{filtrosAtivos ? 'Nenhum pedido encontrado' : 'Nenhum pedido ainda'}</p>
            <p className="text-xs text-slate-400 mt-1">
              {filtrosAtivos ? 'Tente outros termos ou filtros.' : 'Os pedidos nascem quando um gestor aceita uma reserva com a cobrança ligada.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <ThSortable col="numero" label="Pedido" className="pl-6" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="cliente" label="Cliente" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="gestor" label="Gestor" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="data_passeio" label="Item / passeio" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThPlain label="Pagamento" />
                  <ThSortable col="valor_total" label="Valores" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="status" label="Status" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <ThSortable col="criado_em" label="Datas" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="pb-3 px-3 pr-6" />
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => {
                  const pg = pagamentoPrincipal(p);
                  const cartao = cartaoDe(pg);
                  const cupom = p.pedido_desconto.find((d) => d.cupom_codigo)?.cupom_codigo;
                  const FormaIcon = pg?.forma_pagamento === 'cartao_credito' ? CreditCard : QrCode;
                  const href = `/administrator/pedidos/${p.id}`;
                  return (
                    <tr key={p.id} onClick={() => router.push(href)} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors cursor-pointer align-top">
                      <td className="py-4 pl-6 pr-3">
                        <Link href={href} onClick={(e) => e.stopPropagation()} className="font-mono text-sm font-bold text-[#0B2447] hover:underline">
                          #{p.numero}
                        </Link>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{p.id.slice(0, 8)}</p>
                      </td>
                      <td className="py-4 px-3">
                        <p className="text-sm font-medium text-slate-700 whitespace-nowrap">{p.cliente?.name ?? '—'}</p>
                        <p className="text-[11px] text-slate-400">{p.cliente?.email}</p>
                      </td>
                      <td className="py-4 px-3">
                        <p className="text-sm text-slate-700 whitespace-nowrap">{p.gestor?.name ?? '—'}</p>
                        <p className="text-[11px] text-slate-400">{p.gestor?.email}</p>
                      </td>
                      <td className="py-4 px-3">
                        <p className="text-sm text-slate-700 max-w-[220px] truncate" title={p.reserva?.item_nome}>{p.reserva?.item_nome ?? '—'}</p>
                        <p className="text-[11px] text-slate-400 whitespace-nowrap">
                          {p.reserva?.tipo === 'embarcacao' ? 'Embarcação' : 'Roteiro'} · {formatarDataCurta(p.reserva?.data_reserva)}
                          {p.reserva?.data_fim_reserva && p.reserva.data_fim_reserva !== p.reserva.data_reserva && ` → ${formatarDataCurta(p.reserva.data_fim_reserva)}`}
                          {p.reserva && ` · ${p.reserva.quantidade_pessoas} pax`}
                        </p>
                      </td>
                      <td className="py-4 px-3">
                        {pg ? (
                          <>
                            <p className="flex items-center gap-1.5 text-sm text-slate-700 whitespace-nowrap">
                              <FormaIcon className="w-3.5 h-3.5 text-slate-400" />
                              {FORMA_LABEL[pg.forma_pagamento]}
                              {pg.numero_parcelas > 1 && <span className="text-slate-400">· {pg.numero_parcelas}x</span>}
                              {pg.ambiente === 'sandbox' && <FlaskConical className="w-3.5 h-3.5 text-amber-500" aria-label="Sandbox" />}
                            </p>
                            {cartao && <p className="text-[11px] text-slate-500 font-mono">{cartao}</p>}
                            <p className="text-[11px] text-slate-400">
                              {p.pagamento.length} tentativa{p.pagamento.length > 1 ? 's' : ''}
                            </p>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">Sem tentativa</span>
                        )}
                      </td>
                      <td className="py-4 px-3 whitespace-nowrap">
                        <p className="text-sm font-bold text-[#0B2447]">{formatCurrencyPrecise(Number(p.valor_total))}</p>
                        <p className="text-[11px] text-slate-400">
                          Gestor {formatCurrencyPrecise(Number(p.valor_itens))} · Comissão {formatCurrencyPrecise(Number(p.valor_comissao))}
                        </p>
                        {Number(p.valor_desconto) > 0 && (
                          <p className="text-[11px] text-emerald-600">−{formatCurrencyPrecise(Number(p.valor_desconto))}{cupom ? ` (${cupom})` : ''}</p>
                        )}
                        {pg?.valor_tarifa != null && <p className="text-[11px] text-amber-600">Tarifa {formatCurrencyPrecise(Number(pg.valor_tarifa))}</p>}
                      </td>
                      <td className="py-4 px-3">
                        <span className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${PEDIDO_STATUS[p.status].cls}`}>
                          {PEDIDO_STATUS[p.status].label}
                        </span>
                        {pg && (
                          <span className={`block w-fit mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${PAGAMENTO_STATUS[pg.status].cls}`}>
                            {PAGAMENTO_STATUS[pg.status].label}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                        <p>Criado {formatarDataHoraBR(p.criado_em)}</p>
                        {p.status === 'aguardando_pagamento' && p.expira_em && <p className="text-violet-600">Prazo {formatarDataHoraBR(p.expira_em)}</p>}
                        {p.pago_em && <p className="text-emerald-600">Pago {formatarDataHoraBR(p.pago_em)}</p>}
                        {p.cancelado_em && <p className="text-slate-400">Encerrado {formatarDataHoraBR(p.cancelado_em)}</p>}
                      </td>
                      <td className="py-4 px-3 pr-6">
                        <Link href={href} onClick={(e) => e.stopPropagation()} title="Ver detalhes"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#0B2447] hover:bg-slate-100 transition-colors">
                          <Eye className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
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
                Mostrando <span className="font-semibold text-slate-600">{(page - 1) * perPage + 1}–{Math.min(page * perPage, total)}</span> de{' '}
                <span className="font-semibold text-slate-600">{total}</span> pedidos
              </p>
              <label className="flex items-center gap-1.5 text-xs text-slate-400">
                Por página:
                <select
                  value={perPage}
                  onChange={(ev) => setParams({ per: ev.target.value === '25' ? null : ev.target.value, page: null })}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 focus:outline-none cursor-pointer"
                >
                  {pageSizes.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setParams({ page: null })} disabled={page === 1} title="Primeira página"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setParams({ page: page - 1 <= 1 ? null : String(page - 1) })} disabled={page === 1} title="Página anterior"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {getPageNumbers(page, totalPages).map((n, i) =>
                  n === '…' ? (
                    <span key={`e-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-slate-400">…</span>
                  ) : (
                    <button key={n} onClick={() => setParams({ page: n <= 1 ? null : String(n) })}
                      className={`w-7 h-7 rounded-lg text-xs font-semibold ${n === page ? 'bg-[#0B2447] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
                      {n}
                    </button>
                  ),
                )}
                <button onClick={() => setParams({ page: String(Math.min(totalPages, page + 1)) })} disabled={page === totalPages} title="Próxima página"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setParams({ page: String(totalPages) })} disabled={page === totalPages} title="Última página"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
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
