import { redirect } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Users, CalendarDays, ShoppingCart } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import ConfirmarReserva from './_components/ConfirmarReserva';

const SERVICE_FEE_RATE = 0.12;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type SearchParams = {
  roteiro?: string;
  data?: string;
  flex?: string;
  pessoas?: string;
  adicionais?: string;
};

function formatDateLabel(iso: string, flex: number): string {
  const label = new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  return flex > 0 ? `${label} ± ${flex} dia${flex > 1 ? 's' : ''}` : label;
}

export default async function NovaReservaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  // Monta a URL atual para preservar a intenção após o login.
  const qs = new URLSearchParams();
  if (sp.roteiro) qs.set('roteiro', sp.roteiro);
  if (sp.data) qs.set('data', sp.data);
  if (sp.flex) qs.set('flex', sp.flex);
  if (sp.pessoas) qs.set('pessoas', sp.pessoas);
  if (sp.adicionais) qs.set('adicionais', sp.adicionais);
  const selfUrl = `/reservas/novo?${qs.toString()}`;

  // Parâmetros obrigatórios.
  const roteiroId = sp.roteiro;
  const data = sp.data;
  const flex = sp.flex ? Math.max(0, parseInt(sp.flex)) : 0;
  const pessoas = sp.pessoas ? parseInt(sp.pessoas) : 0;

  if (!roteiroId) redirect('/buscar');
  if (!data || !ISO_DATE.test(data) || pessoas < 1) {
    // Faltam dados obrigatórios — volta ao detalhe do roteiro para preenchê-los.
    redirect(`/roteiros/${roteiroId}`);
  }

  // Cliente deve estar logado.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/entrar?redirect_to=${encodeURIComponent(selfUrl)}`);
  }

  // Carrega o roteiro (deve estar ativo).
  const { data: roteiroRaw } = await supabaseAdmin
    .from('roteiro')
    .select(
      `id, nome, preco_base, duracao,
       municipios ( nome, estados ( uf ) )`,
    )
    .eq('id', roteiroId)
    .eq('ativo', true)
    .single();

  if (!roteiroRaw) redirect('/buscar');

  const roteiro = roteiroRaw as unknown as {
    id: string;
    nome: string;
    preco_base: number | null;
    duracao: string | null;
    municipios: { nome: string; estados: { uf: string } | null } | null;
  };

  // Reconstrói os adicionais selecionados a partir dos ids da query.
  const adicionalIds = (sp.adicionais ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let adicionais: { id: string; descricao: string; valor: number; tipo: string }[] = [];
  if (adicionalIds.length > 0) {
    const { data: itens } = await supabaseAdmin
      .from('roteiro_catalogo')
      .select('id, valor_customizado, catalogo ( descricao, valor, tipo )')
      .eq('roteiro_id', roteiro.id)
      .in('id', adicionalIds);

    adicionais = (itens ?? [])
      .filter((it) => it.catalogo)
      .map((it) => {
        const cat = it.catalogo as unknown as { descricao: string; valor: number; tipo: string };
        return {
          id: it.id,
          descricao: cat.descricao,
          valor: it.valor_customizado ?? cat.valor,
          tipo: cat.tipo,
        };
      });
  }

  const preco = roteiro.preco_base != null ? Number(roteiro.preco_base) : null;
  const totalAdicionais = adicionais.reduce((sum, a) => sum + Number(a.valor), 0);
  const subtotal = (preco ?? 0) + totalAdicionais;
  const taxaServico = preco != null ? Math.round(subtotal * SERVICE_FEE_RATE) : null;
  const total = preco != null && taxaServico != null ? subtotal + taxaServico : null;

  const localidade = roteiro.municipios
    ? roteiro.municipios.estados
      ? `${roteiro.municipios.nome}, ${roteiro.municipios.estados.uf}`
      : roteiro.municipios.nome
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10">
        <Link href={`/roteiros/${roteiro.id}`} className="text-sm text-slate-500 hover:text-slate-700">
          ← Voltar ao roteiro
        </Link>

        <h1 className="mt-3 text-2xl font-bold text-[#0B2447]">Confirmar solicitação de reserva</h1>
        <p className="text-sm text-slate-500 mt-1">
          Revise os dados abaixo. Após o envio, o gestor analisará e responderá sua solicitação.
        </p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Roteiro */}
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-base font-bold text-[#0B2447]">{roteiro.nome}</h2>
            {localidade && (
              <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                <MapPin className="h-4 w-4 shrink-0" />
                {localidade}
              </div>
            )}
          </div>

          {/* Data / Pessoas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <CalendarDays className="h-4 w-4 text-[#0B3D91]" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Data</p>
                <p className="text-sm font-semibold text-slate-800">{formatDateLabel(data, flex)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-[#0B3D91]" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Pessoas</p>
                <p className="text-sm font-semibold text-slate-800">
                  {pessoas} {pessoas === 1 ? 'pessoa' : 'pessoas'}
                </p>
              </div>
            </div>
          </div>

          {/* Adicionais */}
          {adicionais.length > 0 && (
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-center gap-1.5 mb-3">
                <ShoppingCart className="h-4 w-4 text-[#0B3D91]" />
                <span className="text-sm font-semibold text-[#0B2447]">Adicionais selecionados</span>
              </div>
              <div className="space-y-2">
                {adicionais.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      {a.descricao}
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-slate-400">{a.tipo}</span>
                    </span>
                    <span className="font-medium text-slate-800">{formatCurrency(a.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Valores */}
          <div className="p-5">
            {preco != null ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Diária</span>
                  <span className="font-medium text-slate-800">{formatCurrency(preco)}</span>
                </div>
                {totalAdicionais > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Adicionais</span>
                    <span className="font-medium text-slate-800">{formatCurrency(totalAdicionais)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Taxa de serviço</span>
                  <span className="font-medium text-slate-800">{formatCurrency(taxaServico!)}</span>
                </div>
                <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-200">
                  <span className="text-base font-bold text-[#0B2447]">Total estimado</span>
                  <span className="text-xl font-bold text-[#0B2447]">{formatCurrency(total!)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Preço a combinar com o gestor — o valor será confirmado na resposta da solicitação.
              </p>
            )}
          </div>
        </div>

        <ConfirmarReserva
          roteiroId={roteiro.id}
          data={data}
          flex={flex}
          pessoas={pessoas}
          adicionaisIds={adicionalIds}
        />
      </main>

      <Footer />
    </div>
  );
}
