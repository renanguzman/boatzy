import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Wallet, Percent, ArrowRight, TriangleAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getTaxaGeral } from '@/lib/taxas';
import { getFinanceiroConfig, getFormasPagamento, type FinanceiroConfig, type FormaPagamento } from '@/lib/financeiro/config';
import { formatarDataHoraBR } from '@/lib/termos/formato';
import FinanceiroAbas from '../_components/FinanceiroAbas';
import FormasPagamentoCard from './_components/FormasPagamentoCard';
import PrazosCard from './_components/PrazosCard';

const ACAO_LABEL: Record<string, string> = {
  'forma_pagamento.atualizar': 'Forma de pagamento alterada',
  'financeiro_config.atualizar': 'Prazos alterados',
};

export default async function AdminFinanceiroConfiguracoesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/administrator/login');

  let formas: FormaPagamento[] = [];
  let config: FinanceiroConfig | null = null;
  let erroCarga: string | null = null;
  try {
    [formas, config] = await Promise.all([getFormasPagamento(), getFinanceiroConfig()]);
  } catch (err) {
    erroCarga = err instanceof Error ? err.message : 'Erro ao carregar.';
  }

  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // AAAA-MM-DD
  const [taxaGeral, { count: gestoresComTaxaPropria }, { data: alteracoes }] = await Promise.all([
    getTaxaGeral(),
    supabaseAdmin
      .from('usuario_taxa')
      .select('id', { count: 'exact', head: true })
      .eq('ativo', true)
      .or(`data_validade.is.null,data_validade.gte.${hoje}`),
    supabaseAdmin
      .from('financeiro_auditoria')
      .select('id, acao, entidade_id, criado_em, admin_id')
      .order('criado_em', { ascending: false })
      .limit(5),
  ]);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#0B2447]/5 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-[#0B2447]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Financeiro</h1>
          <p className="text-sm text-slate-500">
            Formas de pagamento, parcelamento e prazos. Toda alteração fica registrada na auditoria.
          </p>
        </div>
      </div>

      <FinanceiroAbas ativa="configuracoes" />

      {erroCarga || !config ? (
        <div className="flex items-start gap-3 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <TriangleAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Configurações indisponíveis.</p>
            <p>Confira se a migration <code>20260930b_pagamentos_modelo.sql</code> foi aplicada. ({erroCarga})</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <FormasPagamentoCard formas={formas} />

          <div className="space-y-6">
            <PrazosCard
              horasPrazoPagamento={config.horas_prazo_pagamento}
              horasRepasseAposPasseio={config.horas_repasse_apos_passeio}
            />

            {/* Comissão: configurada no módulo Taxas — aqui só a regra e o atalho. */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Comissão da plataforma</p>
                <Percent className="w-4 h-4 text-slate-300" />
              </div>
              <p className="text-3xl font-bold text-[#0B2447] leading-none">
                {taxaGeral ? `${taxaGeral.taxaPercent.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : '—'}
                <span className="text-sm font-medium text-slate-400 ml-2">taxa geral</span>
              </p>
              <p className="text-sm text-slate-500 mt-2">
                {gestoresComTaxaPropria
                  ? `${gestoresComTaxaPropria} gestor(es) com taxa específica em vigor.`
                  : 'Nenhum gestor com taxa específica em vigor.'}
              </p>
              <ul className="text-xs text-slate-500 mt-4 space-y-1.5 list-disc pl-4">
                <li>Vale a taxa efetiva do gestor (geral ou específica) no momento da <b>solicitação</b> da reserva.</li>
                <li>É paga pelo cliente, somada ao preço — o gestor recebe o valor dos itens integral.</li>
                <li>O cupom de desconto sai só da comissão.</li>
                <li>A tarifa do Asaas é absorvida pelo Boatzy.</li>
              </ul>
              <Link
                href="/administrator/taxas"
                className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-[#0B2447] hover:underline"
              >
                Gerenciar taxas <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase mb-3">Últimas alterações</p>
              {!alteracoes?.length ? (
                <p className="text-sm text-slate-400">Nenhuma alteração registrada.</p>
              ) : (
                <ul className="space-y-2">
                  {alteracoes.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-600">
                        {ACAO_LABEL[a.acao] ?? a.acao}
                        {a.entidade_id && a.acao.startsWith('forma_pagamento') && (
                          <span className="text-slate-400"> · {a.entidade_id}</span>
                        )}
                      </span>
                      <span className="text-xs text-slate-400 whitespace-nowrap">{formatarDataHoraBR(a.criado_em)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
