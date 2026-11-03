import Link from 'next/link';
import { AlertTriangle, ArrowRight, BadgeCheck, Clock, HandCoins } from 'lucide-react';
import { formatCurrencyPrecise } from '@/lib/utils';

export type TotaisRepasse = { aguardando: number; liberado: number; pago: number; temRecebimento: boolean };

/**
 * Faixa de repasses no topo de Receitas (SPEC §101): quanto o Boatzy ainda vai repassar
 * (aguardando e liberado) e quanto já pagou — o detalhe e os comprovantes ficam em /repasses.
 */
export default function ResumoRepasses({ totais }: { totais: TotaisRepasse }) {
  const brl = formatCurrencyPrecise;
  const aReceber = totais.aguardando + totais.liberado;
  const cartoes = [
    { rotulo: 'Aguardando liberação', valor: totais.aguardando, sub: 'Passeio por acontecer ou prazo de espera', icone: Clock, cor: 'text-sky-500' },
    { rotulo: 'Liberado para repasse', valor: totais.liberado, sub: 'O Boatzy já pode depositar', icone: HandCoins, cor: 'text-emerald-500' },
    { rotulo: 'Já repassado', valor: totais.pago, sub: 'Com comprovante em cada repasse', icone: BadgeCheck, cor: 'text-teal-600' },
  ];

  return (
    <section aria-label="Repasses do Boatzy" className="mb-6">
      {!totais.temRecebimento && aReceber > 0 && (
        <div role="alert" className="mb-3 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Você tem <strong>{brl(aReceber)}</strong> a receber, mas ainda não informou onde depositar. Sem isso, o repasse não sai.
            </span>
          </p>
          <Link href="/painel/recebimentos" className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-center text-xs font-bold text-white hover:bg-amber-700">
            Informar dados de recebimento
          </Link>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cartoes.map(({ rotulo, valor, sub, icone: Icone, cor }) => (
          <div key={rotulo} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{rotulo}</p>
              <Icone className={`h-4 w-4 ${cor}`} />
            </div>
            <p className="mt-2 text-xl font-bold text-[#0B2447]">{brl(valor)}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>
          </div>
        ))}
      </div>
      <Link href="/painel/receitas/repasses" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0B3D91] hover:underline">
        Ver meus repasses <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
