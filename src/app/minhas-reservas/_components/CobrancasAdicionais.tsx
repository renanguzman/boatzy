import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { HandCoins } from 'lucide-react';
import { useFormatos } from '@/i18n/formatos';
import type { CobrancaAvulsa } from '@/lib/pagamentos/avulso';

/** Cobranças avulsas do proprietário na reserva do cliente (SPEC §34.16) — valores já com a taxa embutida. */
export default function CobrancasAdicionais({ cobrancas }: { cobrancas: CobrancaAvulsa[] }) {
  const t = useTranslations('Cobranca');
  const f = useFormatos();
  if (!cobrancas.length) return null;

  const agora = new Date();
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <h2 className="flex items-center gap-1.5 text-base font-bold text-marinho">
        <HandCoins className="h-4 w-4" /> {t('secaoTitulo')}
      </h2>
      <p className="mt-0.5 text-xs text-slate-500">{t('secaoTexto')}</p>
      <ul className="mt-3 space-y-2.5">
        {cobrancas.map((c) => {
          const aberta = c.status === 'aguardando_pagamento' && (!c.expira_em || new Date(c.expira_em) > agora);
          const status = c.status === 'aguardando_pagamento' && !aberta ? 'expirado' : c.status;
          return (
            <li key={c.id} className={`rounded-xl border p-3.5 text-sm ${aberta ? 'border-violet-200 bg-violet-50' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-700 break-words">{c.titulo}</p>
                  <p className="text-[11px] text-slate-400">{t('numero', { numero: c.numero })}</p>
                </div>
                <span className="shrink-0 font-bold text-marinho">{f.moedaCentavos(Number(c.valor_total))}</span>
              </div>
              <p className={`mt-1 text-xs ${aberta ? 'text-violet-700' : 'text-slate-500'}`}>
                {t(`status.${status}`)}
                {aberta && c.expira_em && <> · {t('pagueAte', { data: f.dataHora(c.expira_em) })}</>}
                {c.status === 'pago' && c.pago_em && <> · {t('pagaEm', { data: f.dataHora(c.pago_em) })}</>}
              </p>
              <Link
                href={`/cobrancas/${c.id}`}
                className={aberta
                  ? 'mt-3 flex w-full items-center justify-center rounded-xl bg-marinho hover:bg-marinho-escuro px-4 py-2.5 text-sm font-semibold text-white transition-colors'
                  : 'mt-2 inline-flex text-xs font-semibold text-marinho hover:underline'}
              >
                {aberta ? t('pagar', { valor: f.moedaCentavos(Number(c.valor_total)) }) : t('verCobranca')}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
