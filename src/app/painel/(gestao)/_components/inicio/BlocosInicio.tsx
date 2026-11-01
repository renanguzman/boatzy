import Link from 'next/link';
import { ChevronRight, Hourglass, CheckCircle2, type LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { formatarData, hojeISO } from '@/lib/datas';
import { diasParaVencer } from '@/lib/documentos/validade';

/**
 * Blocos do Início do painel (SPEC §97) — sem estado, renderizados no servidor.
 * Linguagem direta, um assunto por bloco: o que fazer, números, agenda e desempenho.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Para fazer agora
// ─────────────────────────────────────────────────────────────────────────────

export type Tarefa = {
  id: string;
  icone: LucideIcon;
  titulo: string;
  detalhe?: string;
  tom: 'urgente' | 'alerta' | 'normal';
  itens: { id: string; titulo: string; sub?: string; href: string; acao: string }[];
  /** "Ver todos" quando há mais itens do que os mostrados. */
  mais?: { label: string; href: string };
};

const TOM_TAREFA = {
  urgente: 'bg-amber-100 text-amber-700',
  alerta: 'bg-orange-100 text-orange-700',
  normal: 'bg-slate-100 text-slate-600',
} as const;

export function ParaFazerAgora({ tarefas, aguardando }: { tarefas: Tarefa[]; aguardando: string[] }) {
  return (
    <section aria-labelledby="para-fazer" className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <h2 id="para-fazer" className="border-b border-slate-100 px-4 py-3.5 text-base font-bold text-[#0B2447] sm:px-6">
        {tarefas.length > 0 ? 'Para fazer agora' : 'Tudo em dia'}
      </h2>
      {tarefas.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {tarefas.map((t) => (
            <li key={t.id} className="px-4 py-4 sm:px-6">
              <div className="flex items-start gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TOM_TAREFA[t.tom]}`}>
                  <t.icone className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#0B2447]">{t.titulo}</p>
                  {t.detalhe && <p className="mt-0.5 text-xs text-slate-500">{t.detalhe}</p>}
                  <ul className="mt-2.5 space-y-2">
                    {t.itens.map((i) => (
                      <li key={i.id}>
                        <Link
                          href={i.href}
                          className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 transition-colors hover:border-slate-300 hover:bg-slate-50"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-800">{i.titulo}</span>
                            {i.sub && <span className="block truncate text-xs text-slate-500">{i.sub}</span>}
                          </span>
                          <span className="shrink-0 rounded-lg bg-[#0B2447] px-3 py-1.5 text-xs font-semibold text-white">{i.acao}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {t.mais && (
                    <Link href={t.mais.href} className="mt-2 inline-flex items-center gap-0.5 text-xs font-semibold text-[#0B3D91] hover:underline">
                      {t.mais.label} <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 px-4 py-4 text-sm text-slate-600 sm:px-6">
          <CheckCircle2 className="h-4 w-4 text-teal-600" /> Nenhuma pendência no momento.
        </p>
      )}
      {aguardando.length > 0 && (
        <div className="flex flex-wrap items-start gap-x-2 gap-y-1 border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-xs text-slate-500 sm:px-6">
          <Hourglass className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="font-semibold text-slate-600">Aguardando outras pessoas:</span>
          <span>{aguardando.join(' · ')}</span>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Resumo (números agrupados por assunto)
// ─────────────────────────────────────────────────────────────────────────────

export type CartaoResumo = {
  id: string;
  titulo: string;
  icone: LucideIcon;
  valor: string;
  unidade: string;
  linha?: string;
  tomLinha?: 'alerta' | 'perigo' | 'ok';
  href: string;
};

const TOM_LINHA = { alerta: 'text-amber-700', perigo: 'text-red-600', ok: 'text-teal-700' } as const;

export function Resumo({ cartoes }: { cartoes: CartaoResumo[] }) {
  return (
    <section aria-label="Resumo" className={`grid grid-cols-2 gap-3 sm:gap-4 ${cartoes.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
      {cartoes.map((c) => (
        <Link
          key={c.id}
          href={c.href}
          className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <c.icone className="h-3.5 w-3.5" /> {c.titulo}
          </p>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-[#0B2447]">{c.valor}</span>
            <span className="truncate text-sm text-slate-500">{c.unidade}</span>
          </p>
          {c.linha && <p className={`mt-1 truncate text-xs ${c.tomLinha ? TOM_LINHA[c.tomLinha] : 'text-slate-400'}`}>{c.linha}</p>}
        </Link>
      ))}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Próximos passeios
// ─────────────────────────────────────────────────────────────────────────────

export type PasseioAgenda = {
  id: string;
  item_nome: string;
  data_reserva: string;
  quantidade_pessoas: number;
  total_estimado: number | null;
  cliente: string;
};

function quando(data: string): string {
  const dias = diasParaVencer(data, hojeISO());
  if (dias === 0) return 'Hoje';
  if (dias === 1) return 'Amanhã';
  const semana = formatarData(data, { weekday: 'short' }).replace('.', '');
  return semana.charAt(0).toUpperCase() + semana.slice(1);
}

export function ProximosPasseios({ passeios, className = '' }: { passeios: PasseioAgenda[]; className?: string }) {
  return (
    <section aria-labelledby="proximos" className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-6">
        <h2 id="proximos" className="text-base font-bold text-[#0B2447]">Próximos passeios</h2>
        <Link href="/painel/agendamentos" className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#0B3D91] hover:underline">
          Ver agenda <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {passeios.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-400 sm:px-6">Nenhum passeio confirmado para os próximos dias.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {passeios.map((p) => (
            <li key={p.id}>
              <Link href={`/painel/agendamentos/${p.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 sm:px-6">
                <span className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-slate-50 py-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400">{quando(p.data_reserva)}</span>
                  <span className="text-sm font-bold text-[#0B2447]">{formatarData(p.data_reserva, { day: '2-digit', month: '2-digit' })}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[#0B2447]">{p.item_nome}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {p.cliente} · {p.quantidade_pessoas} {p.quantidade_pessoas === 1 ? 'pessoa' : 'pessoas'}
                  </span>
                </span>
                {p.total_estimado != null && (
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">{formatCurrency(p.total_estimado)}</span>
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Desempenho (pedidos por mês + mais procurado)
// ─────────────────────────────────────────────────────────────────────────────

export function Desempenho({
  meses, destaque, className = '',
}: {
  meses: { chave: string; label: string; total: number }[];
  destaque: { nome: string; percentual: number; total: number } | null;
  className?: string;
}) {
  const max = Math.max(1, ...meses.map((m) => m.total));
  return (
    <section aria-labelledby="desempenho" className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="border-b border-slate-100 px-4 py-3.5 sm:px-6">
        <h2 id="desempenho" className="text-base font-bold text-[#0B2447]">Pedidos de reserva por mês</h2>
        <p className="text-xs text-slate-400">Últimos 6 meses</p>
      </div>
      <div className="px-4 pb-4 pt-5 sm:px-6">
        <div className="flex h-36 items-end justify-between gap-2">
          {meses.map((m) => (
            <div key={m.chave} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[11px] font-bold tabular-nums text-slate-500">{m.total > 0 ? m.total : ''}</span>
              <div
                className={`w-full max-w-9 rounded-t-md ${m.total === max && m.total > 0 ? 'bg-[#0B2447]' : 'bg-slate-200'}`}
                style={{ height: `${Math.max(m.total > 0 ? 8 : 2, (m.total / max) * 104)}px` }}
              />
              <span className="text-[10px] font-bold tracking-wider text-slate-400">{m.label}</span>
            </div>
          ))}
        </div>
        {destaque && (
          <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
            Mais procurado: <strong className="text-[#0B2447]">{destaque.nome}</strong> — {destaque.percentual}% dos pedidos
            ({destaque.total} {destaque.total === 1 ? 'pedido' : 'pedidos'}).
          </p>
        )}
      </div>
    </section>
  );
}
