import { redirect } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Ship, Users, CalendarDays, ShoppingCart } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { getTaxaEfetiva } from '@/lib/taxas';
import { buscarPrevisaoTempo } from '@/lib/weather';
import { somarDiasISO } from '@/lib/reservas';
import { capacidadeMaxima } from '@/lib/capacidade';
import { obterTermoParaAceite } from '@/lib/termos/aceite';
import ConfirmarReserva from './_components/ConfirmarReserva';
import PrevisaoTempoCard from './_components/PrevisaoTempoCard';
import { FUSO_HORARIO } from '@/lib/datas';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type SearchParams = {
  roteiro?: string;
  embarcacao?: string;
  data?: string;
  flex?: string;
  pessoas?: string;
  adicionais?: string;
  /** Modelo de cobrança escolhido no BookingCard — só relevante para roteiro. */
  modalidade?: string;
  /** Quantidade de diárias — só quando `modalidade === 'diaria'`. */
  diarias?: string;
};

function formatDateLabel(iso: string, flex: number): string {
  const label = new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { timeZone: FUSO_HORARIO, 
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

  const isEmbarcacao = !!sp.embarcacao && !sp.roteiro;
  const tipo: 'roteiro' | 'embarcacao' = isEmbarcacao ? 'embarcacao' : 'roteiro';
  const alvoId = isEmbarcacao ? sp.embarcacao! : sp.roteiro;
  const voltarHref = isEmbarcacao ? `/embarcacoes/${alvoId}` : `/roteiros/${alvoId}`;

  // Monta a URL atual para preservar a intenção após o login.
  const qs = new URLSearchParams();
  if (sp.roteiro) qs.set('roteiro', sp.roteiro);
  if (sp.embarcacao) qs.set('embarcacao', sp.embarcacao);
  if (sp.data) qs.set('data', sp.data);
  if (sp.flex) qs.set('flex', sp.flex);
  if (sp.pessoas) qs.set('pessoas', sp.pessoas);
  if (sp.adicionais) qs.set('adicionais', sp.adicionais);
  if (sp.modalidade) qs.set('modalidade', sp.modalidade);
  if (sp.diarias) qs.set('diarias', sp.diarias);
  const selfUrl = `/reservas/novo?${qs.toString()}`;

  // Parâmetros obrigatórios.
  const data = sp.data;
  const flex = sp.flex ? Math.max(0, parseInt(sp.flex)) : 0;
  const pessoas = sp.pessoas ? parseInt(sp.pessoas) : 0;

  if (!alvoId) redirect(isEmbarcacao ? '/embarcacoes' : '/buscar');
  if (!data || !ISO_DATE.test(data) || pessoas < 1) {
    // Faltam dados obrigatórios — volta ao detalhe para preenchê-los.
    redirect(voltarHref);
  }

  // Cliente deve estar logado.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/entrar?redirect_to=${encodeURIComponent(selfUrl)}`);
  }

  // Carrega o alvo (roteiro ou embarcação) — deve estar ativo.
  let nome: string;
  let precoUnitario: number | null;
  let localidade: string | null = null;
  // Modelo de cobrança efetivamente resolvido (validado contra os modelos
  // ativos do roteiro — parâmetro de URL não é fonte confiável).
  let modalidade: 'roteiro' | 'diaria' | 'pessoa' = 'roteiro';
  let diarias: number | undefined;
  let multiplicador = 1;
  let rotuloLinha = 'Diária';

  // Adicionais só existem para roteiro.
  let adicionais: { id: string; descricao: string; valor: number; tipo: string }[] = [];
  const adicionalIds = (sp.adicionais ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let ownerId: string;
  // Máximo de pessoas do grupo (capacidade da embarcação/roteiro — src/lib/capacidade.ts).
  let limitePessoas: number | null = null;
  // Coordenadas para a previsão do tempo — prioriza a coordenada exata do
  // roteiro/embarcação e cai para o centro do município quando ausente.
  let lat: number | null = null;
  let lng: number | null = null;

  if (isEmbarcacao) {
    const { data: embRaw } = await supabaseAdmin
      .from('embarcacao')
      .select(
        `id, owner_id, nome, preco_base, capacidade, latitude, longitude, municipios ( nome, estados ( uf ), latitude, longitude )`,
      )
      .eq('id', alvoId)
      .eq('status', 'ativo')
      .single();

    if (!embRaw) redirect('/embarcacoes');
    const emb = embRaw as unknown as {
      owner_id: string;
      nome: string;
      preco_base: number | null;
      capacidade: number | null;
      latitude: number | null;
      longitude: number | null;
      municipios: { nome: string; estados: { uf: string } | null; latitude: number | null; longitude: number | null } | null;
    };
    limitePessoas = capacidadeMaxima(emb.capacidade);
    nome = emb.nome;
    ownerId = emb.owner_id;
    precoUnitario = emb.preco_base != null ? Number(emb.preco_base) : null;
    localidade = emb.municipios
      ? emb.municipios.estados
        ? `${emb.municipios.nome}, ${emb.municipios.estados.uf}`
        : emb.municipios.nome
      : null;
    lat = emb.latitude ?? emb.municipios?.latitude ?? null;
    lng = emb.longitude ?? emb.municipios?.longitude ?? null;
  } else {
    const { data: roteiroRaw } = await supabaseAdmin
      .from('roteiro')
      .select(`
        id, owner_id, nome, preco_base, latitude, longitude, quantidade_pessoas,
        preco_diaria_ativo, preco_diaria_valor, preco_diaria_minimo,
        preco_pessoa_ativo, preco_pessoa_valor, preco_pessoa_capacidade_maxima,
        municipios ( nome, estados ( uf ), latitude, longitude ),
        embarcacao ( capacidade )
      `)
      .eq('id', alvoId)
      .eq('ativo', true)
      .single();

    if (!roteiroRaw) redirect('/buscar');
    const roteiro = roteiroRaw as unknown as {
      id: string;
      owner_id: string;
      nome: string;
      preco_base: number | null;
      preco_diaria_ativo: boolean;
      preco_diaria_valor: number | null;
      preco_diaria_minimo: number;
      preco_pessoa_ativo: boolean;
      preco_pessoa_valor: number | null;
      preco_pessoa_capacidade_maxima: number | null;
      quantidade_pessoas: number | null;
      embarcacao: { capacidade: number | null } | null;
      latitude: number | null;
      longitude: number | null;
      municipios: { nome: string; estados: { uf: string } | null; latitude: number | null; longitude: number | null } | null;
    };
    nome = roteiro.nome;
    ownerId = roteiro.owner_id;

    // Resolve o modelo pedido pela URL contra os modelos realmente ativos
    // do roteiro — cai para 'roteiro' quando inválido/indisponível.
    if (sp.modalidade === 'diaria' && roteiro.preco_diaria_ativo && roteiro.preco_diaria_valor != null) {
      modalidade = 'diaria';
      diarias = Math.max(roteiro.preco_diaria_minimo || 1, parseInt(sp.diarias ?? '', 10) || roteiro.preco_diaria_minimo || 1);
      multiplicador = diarias;
      rotuloLinha = 'Diária';
      precoUnitario = Number(roteiro.preco_diaria_valor);
    } else if (sp.modalidade === 'pessoa' && roteiro.preco_pessoa_ativo && roteiro.preco_pessoa_valor != null) {
      modalidade = 'pessoa';
      multiplicador = pessoas;
      rotuloLinha = 'Pessoa';
      precoUnitario = Number(roteiro.preco_pessoa_valor);
    } else {
      modalidade = 'roteiro';
      precoUnitario = roteiro.preco_base != null ? Number(roteiro.preco_base) : null;
    }
    limitePessoas = capacidadeMaxima(
      roteiro.quantidade_pessoas,
      roteiro.embarcacao?.capacidade,
      modalidade === 'pessoa' ? roteiro.preco_pessoa_capacidade_maxima : null,
    );

    localidade = roteiro.municipios
      ? roteiro.municipios.estados
        ? `${roteiro.municipios.nome}, ${roteiro.municipios.estados.uf}`
        : roteiro.municipios.nome
      : null;
    lat = roteiro.latitude ?? roteiro.municipios?.latitude ?? null;
    lng = roteiro.longitude ?? roteiro.municipios?.longitude ?? null;

    // Reconstrói os adicionais selecionados a partir dos ids da query.
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
  }

  // Grupo acima da capacidade (ex.: URL editada): volta ao detalhe, que ajusta o
  // número ao máximo e avisa o cliente.
  if (limitePessoas != null && pessoas > limitePessoas) {
    const volta = new URLSearchParams({ data: data!, pessoas: String(pessoas) });
    if (flex > 0) volta.set('flex', String(flex));
    redirect(`${voltarHref}?${volta.toString()}`);
  }

  const totalAdicionais = adicionais.reduce((sum, a) => sum + Number(a.valor), 0);
  // Taxa de serviço efetiva do gestor dono do alvo (específica ou geral — ver SPEC §14).
  const taxaPercent = await getTaxaEfetiva(ownerId);

  // Previsão do tempo para a data escolhida (Open-Meteo) — só um complemento
  // informativo; sem coordenada, a seção simplesmente não é exibida.
  const [previsaoTempo, termo] = await Promise.all([
    lat != null && lng != null ? buscarPrevisaoTempo(lat, lng, data) : Promise.resolve(null),
    // Termo que o cliente precisa aceitar para enviar a solicitação (null = sem versão vigente).
    obterTermoParaAceite('reserva_cliente', user.id),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10">
        <Link href={voltarHref} className="text-sm text-slate-500 hover:text-slate-700">
          ← Voltar {isEmbarcacao ? 'à embarcação' : 'ao roteiro'}
        </Link>

        <h1 className="mt-3 text-2xl font-bold text-[#0B2447]">Confirmar solicitação de reserva</h1>
        <p className="text-sm text-slate-500 mt-1">
          Revise os dados abaixo. Após o envio, o gestor analisará sua solicitação; se aceitar, você paga pelo Boatzy (Pix ou cartão) para garantir a data.
        </p>

        {previsaoTempo && (
          <div className="mt-6">
            <PrevisaoTempoCard
              resultado={previsaoTempo}
              localidade={localidade}
              dataLabel={formatDateLabel(data, 0)}
            />
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Alvo */}
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              {isEmbarcacao ? <Ship className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
              {isEmbarcacao ? 'Embarcação' : 'Roteiro'}
            </div>
            <h2 className="text-base font-bold text-[#0B2447]">{nome}</h2>
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
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                  {modalidade === 'diaria' ? 'Período' : 'Data'}
                </p>
                {modalidade === 'diaria' && diarias ? (
                  <p className="text-sm font-semibold text-slate-800">
                    {formatDateLabel(data, 0)} → {formatDateLabel(somarDiasISO(data, diarias - 1), 0)}
                    <span className="block text-xs font-normal text-slate-400">
                      {diarias} diária{diarias > 1 ? 's' : ''}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-slate-800">{formatDateLabel(data, flex)}</p>
                )}
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

          {/* Adicionais (apenas roteiro) */}
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
        </div>

        <ConfirmarReserva
          tipo={tipo}
          roteiroId={isEmbarcacao ? undefined : alvoId}
          embarcacaoId={isEmbarcacao ? alvoId : undefined}
          data={data}
          flex={flex}
          pessoas={pessoas}
          adicionaisIds={adicionalIds}
          modalidade={modalidade}
          diarias={diarias}
          precoUnitario={precoUnitario}
          multiplicador={multiplicador}
          rotuloLinha={rotuloLinha}
          totalAdicionais={totalAdicionais}
          taxaPercent={taxaPercent}
          termo={termo}
        />
      </main>

      <Footer />
    </div>
  );
}
