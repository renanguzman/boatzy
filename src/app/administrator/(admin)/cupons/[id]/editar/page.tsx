import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import CupomForm, { type CupomInicial } from '../../_components/CupomForm';

export default async function EditarCupomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/administrator/login');

  const { id } = await params;

  const [{ data: cupom }, { data: parceiros }] = await Promise.all([
    supabaseAdmin
      .from('cupom')
      .select(`
        id, codigo, descricao, tipo_desconto, valor, valor_desconto_maximo,
        valor_minimo_pedido, data_inicio, data_fim, limite_uso_total,
        limite_uso_por_cliente, ativo, parceiro_id
      `)
      .eq('id', id)
      .single(),
    supabaseAdmin
      .from('parceiro')
      .select('id, nome')
      .eq('ativo', true)
      .order('nome', { ascending: true }),
  ]);

  if (!cupom) notFound();

  const cupomInicial: CupomInicial = {
    id: cupom.id,
    codigo: cupom.codigo,
    descricao: cupom.descricao,
    tipoDesconto: cupom.tipo_desconto,
    valor: Number(cupom.valor),
    valorDescontoMaximo: cupom.valor_desconto_maximo != null ? Number(cupom.valor_desconto_maximo) : null,
    valorMinimoPedido: cupom.valor_minimo_pedido != null ? Number(cupom.valor_minimo_pedido) : null,
    dataInicio: cupom.data_inicio,
    dataFim: cupom.data_fim,
    limiteUsoTotal: cupom.limite_uso_total,
    limiteUsoPorCliente: cupom.limite_uso_por_cliente,
    ativo: cupom.ativo,
    parceiroId: cupom.parceiro_id,
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B2447]">Editar cupom</h1>
        <p className="text-sm text-slate-400 mt-1">
          Atualize as informações do cupom <span className="font-mono font-semibold">{cupom.codigo}</span>.
        </p>
      </div>

      <CupomForm parceiros={parceiros ?? []} cupom={cupomInicial} />
    </div>
  );
}
