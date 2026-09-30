import { redirect } from 'next/navigation';
import { Receipt, Hourglass, BadgeCheck, TrendingUp, Landmark, Percent, TimerOff, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatCurrencyPrecise } from '@/lib/utils';
import { expirarPedidosVencidosSemFalhar } from '@/lib/pagamentos/pedidos';
import { buscarPedidos, lerFiltros, LIMITE } from './_lib/consulta';
import AdminPedidosGrid from './_components/AdminPedidosGrid';

const PAGE_SIZES = [10, 25, 50, 100] as const;

type SearchParams = Record<string, string | undefined>;

function Indicador({
  label, valor, sub, icon: Icon, cor,
}: { label: string; valor: string; sub?: string; icon: React.ElementType; cor: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">{label}</p>
        <Icon className={`w-4 h-4 ${cor}`} />
      </div>
      <p className="mt-2 text-xl font-bold text-[#0B2447]">{valor}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default async function AdminPedidosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/administrator/login');

  const sp = await searchParams;
  const filtros = lerFiltros(sp);
  const perPage = PAGE_SIZES.includes(Number(sp.per) as (typeof PAGE_SIZES)[number]) ? Number(sp.per) : 25;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  // Pedidos com prazo vencido expiram antes de listar (transição lazy).
  await expirarPedidosVencidosSemFalhar();

  const { linhas, indicadores: k, truncado } = await buscarPedidos(filtros);
  const pagina = linhas.slice((page - 1) * perPage, page * perPage);
  const brl = formatCurrencyPrecise;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#0B2447]/5 flex items-center justify-center">
          <Receipt className="w-5 h-5 text-[#0B2447]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Pedidos</h1>
          <p className="text-sm text-slate-500">
            Todos os pedidos da plataforma — cliente, gestor, reserva, pagamentos e transações no Asaas.
            Os indicadores seguem os filtros aplicados.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
        <Indicador label="Pedidos" valor={String(k.total)} sub={`${k.encerrados} expirado(s)/cancelado(s)`} icon={Receipt} cor="text-slate-400" />
        <Indicador label="Aguardando" valor={String(k.aguardando.qtd)} sub={brl(k.aguardando.valor)} icon={Hourglass} cor="text-violet-500" />
        <Indicador label="Pagos" valor={String(k.pagos.qtd)} sub="pago, reembolso parcial ou disputa" icon={BadgeCheck} cor="text-emerald-500" />
        <Indicador label="Recebido (GMV)" valor={brl(k.pagos.valor)} sub="total pago pelos clientes" icon={TrendingUp} cor="text-emerald-500" />
        <Indicador label="Dos gestores" valor={brl(k.aRepassar)} sub="valor dos itens dos pagos" icon={Landmark} cor="text-sky-500" />
        <Indicador label="Comissão líquida" valor={brl(k.comissaoLiquida)} sub="comissão − descontos" icon={Percent} cor="text-[#0B3D91]" />
        <Indicador label="Tarifas Asaas" valor={brl(k.tarifas)} sub="absorvidas pelo Boatzy" icon={Wallet} cor="text-amber-500" />
        <Indicador
          label="Margem Boatzy"
          valor={brl(k.margem)}
          sub="comissão líquida − tarifas"
          icon={k.margem < 0 ? TimerOff : TrendingUp}
          cor={k.margem < 0 ? 'text-red-500' : 'text-emerald-600'}
        />
      </div>

      {truncado && (
        <p className="mb-4 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2">
          Mostrando os {LIMITE} pedidos mais recentes que batem com os filtros — refine a busca ou o período.
        </p>
      )}

      <AdminPedidosGrid pedidos={pagina} total={linhas.length} page={page} perPage={perPage} pageSizes={[...PAGE_SIZES]} />
    </div>
  );
}
