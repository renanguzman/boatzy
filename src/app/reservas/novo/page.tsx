import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Users, CalendarDays } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getTaxaEfetiva } from '@/lib/taxas';
import { buscarPrevisaoTempo } from '@/lib/weather';
import { getMotivoPeriodoIndisponivel, somarDiasISO } from '@/lib/reservas';
import { capacidadeMaxima } from '@/lib/capacidade';
import { obterTermoParaAceite } from '@/lib/termos/aceite';
import { getPrecoRoteiroNaData } from '@/lib/precos-roteiro-actions';
import ConfirmarReserva from './_components/ConfirmarReserva';
import OpcionaisCheckout, { SelecaoOpcionaisProvider, type OpcionalCheckout } from './_components/OpcionaisCheckout';
import PrevisaoTempoCard from './_components/PrevisaoTempoCard';
import GaleriaReserva from './_components/GaleriaReserva';
import ChatDonoModal from '@/components/chat/ChatDonoModal';
import { getFormatos } from '@/i18n/formatos-servidor';
import { ordenarImagens } from '@/lib/galeria';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type SearchParams = {
  roteiro?: string;
  data?: string;
  flex?: string;
  pessoas?: string;
  adicionais?: string;
  /** Modelo de cobrança escolhido no BookingCard. */
  modalidade?: string;
  /** Quantidade de diárias — só quando `modalidade === 'diaria'`. */
  diarias?: string;
};

export default async function NovaReservaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const [t, tData, tPessoas, tDiarias, f] = await Promise.all([
    getTranslations('NovaReserva'),
    getTranslations('CamposBusca.data'),
    getTranslations('CamposBusca.quantidade.pessoas'),
    getTranslations('CamposBusca.quantidade.diarias'),
    getFormatos(),
  ]);
  /** "12 de setembro de 2026", com a flexibilidade da busca: "… ±2 dias". */
  const formatDateLabel = (iso: string, flexDias: number) => {
    const label = f.data(iso, { day: '2-digit', month: 'long', year: 'numeric' });
    return flexDias > 0 ? `${label} ${tData('flex', { count: flexDias })}` : label;
  };

  // Só roteiro é reservável: a embarcação não tem preço nem disponibilidade
  // próprios (links antigos com `?embarcacao=` caem na busca).
  const alvoId = sp.roteiro;
  const voltarHref = `/roteiros/${alvoId}`;

  // Monta a URL atual para preservar a intenção após o login.
  const qs = new URLSearchParams();
  if (sp.roteiro) qs.set('roteiro', sp.roteiro);
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

  if (!alvoId) redirect('/buscar');
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

  // Carrega o roteiro — deve estar ativo.
  let precoUnitario: number | null;
  // Modelo de cobrança efetivamente resolvido (validado contra os modelos
  // ativos do roteiro — parâmetro de URL não é fonte confiável).
  let modalidade: 'roteiro' | 'diaria' = 'roteiro';
  let diarias: number | undefined;
  let multiplicador = 1;

  // Todos os opcionais do roteiro — o cliente pode adicionar ou retirar aqui (os ids da query
  // são só a seleção inicial).
  let opcionais: OpcionalCheckout[] = [];
  const adicionalIds = (sp.adicionais ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const { data: roteiroRaw } = await supabaseAdmin
    .from('roteiro')
    .select(`
      id, owner_id, nome, descricao, preco_base, latitude, longitude, quantidade_pessoas,
      preco_diaria_ativo, preco_diaria_valor, preco_diaria_minimo,
      municipios ( nome, estados ( uf ), latitude, longitude ),
      embarcacao ( capacidade ),
      roteiro_imagens ( id, url_imagem, titulo, principal, ordem )
    `)
    .eq('id', alvoId)
    .eq('ativo', true)
    .single();

  if (!roteiroRaw) redirect('/buscar');
  const roteiro = roteiroRaw as unknown as {
    id: string;
    owner_id: string;
    nome: string;
    descricao: string | null;
    roteiro_imagens: { id: string; url_imagem: string; titulo: string | null; principal: boolean; ordem: number | null }[];
    preco_base: number | null;
    preco_diaria_ativo: boolean;
    preco_diaria_valor: number | null;
    preco_diaria_minimo: number;
    quantidade_pessoas: number | null;
    embarcacao: { capacidade: number | null } | null;
    latitude: number | null;
    longitude: number | null;
    municipios: { nome: string; estados: { uf: string } | null; latitude: number | null; longitude: number | null } | null;
  };
  const nome = roteiro.nome;
  // Capa = foto principal; demais na ordem do gestor.
  const fotos = ordenarImagens(roteiro.roteiro_imagens ?? []).sort((a, b) => Number(b.principal) - Number(a.principal));
  const ownerId = roteiro.owner_id;

  // Resolve o modelo pedido pela URL contra os modelos realmente ativos
  // do roteiro — cai para 'roteiro' quando inválido/indisponível.
  if (sp.modalidade === 'diaria' && roteiro.preco_diaria_ativo && roteiro.preco_diaria_valor != null) {
    modalidade = 'diaria';
    diarias = Math.max(roteiro.preco_diaria_minimo || 1, parseInt(sp.diarias ?? '', 10) || roteiro.preco_diaria_minimo || 1);
    multiplicador = diarias;
    precoUnitario = Number(roteiro.preco_diaria_valor);
  } else {
    modalidade = 'roteiro';
    // Mesma resolução por data que `criarReserva` usa para cobrar: as regras
    // do gestor sobrepõem `preco_base`.
    precoUnitario = data
      ? await getPrecoRoteiroNaData(roteiro.id, data)
      : roteiro.preco_base != null ? Number(roteiro.preco_base) : null;
  }
  // Data indisponível (URL editada, ou ocupada/fechada depois de escolhida):
  // volta ao detalhe, que a descarta — mesma regra do calendário do site.
  const fimPeriodo = modalidade === 'diaria' ? somarDiasISO(data!, (diarias ?? 1) - 1) : data!;
  if (await getMotivoPeriodoIndisponivel(roteiro.id, data!, fimPeriodo)) redirect(voltarHref);

  // Máximo de pessoas do grupo (capacidade da embarcação/roteiro — src/lib/capacidade.ts).
  const limitePessoas = capacidadeMaxima(
    roteiro.quantidade_pessoas,
    roteiro.embarcacao?.capacidade,
  );

  const localidade = roteiro.municipios
    ? roteiro.municipios.estados
      ? `${roteiro.municipios.nome}, ${roteiro.municipios.estados.uf}`
      : roteiro.municipios.nome
    : null;
  // Coordenadas para a previsão do tempo — prioriza a do roteiro e cai para o
  // centro do município quando ausente.
  const lat = roteiro.latitude ?? roteiro.municipios?.latitude ?? null;
  const lng = roteiro.longitude ?? roteiro.municipios?.longitude ?? null;

  {
    const { data: itens } = await supabaseAdmin
      .from('roteiro_catalogo')
      .select('id, valor_customizado, catalogo ( descricao, valor, tipo )')
      .eq('roteiro_id', roteiro.id);

    opcionais = (itens ?? [])
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

  // Grupo acima da capacidade (ex.: URL editada): volta ao detalhe, que ajusta o
  // número ao máximo e avisa o cliente.
  if (limitePessoas != null && pessoas > limitePessoas) {
    const volta = new URLSearchParams({ data: data!, pessoas: String(pessoas) });
    if (flex > 0) volta.set('flex', String(flex));
    redirect(`${voltarHref}?${volta.toString()}`);
  }

  // Taxa de serviço efetiva do gestor dono do roteiro (específica ou geral — ver SPEC §14).
  const taxaPercent = await getTaxaEfetiva(ownerId);

  // Previsão do tempo para a data escolhida (Open-Meteo) — só um complemento
  // informativo; sem coordenada, a seção simplesmente não é exibida.
  const [previsaoTempo, termo] = await Promise.all([
    lat != null && lng != null ? buscarPrevisaoTempo(lat, lng, data) : Promise.resolve(null),
    // Termo que o cliente precisa aceitar para enviar a solicitação (null = sem versão vigente).
    obterTermoParaAceite('reserva_cliente', user.id),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-areia">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10">
        <Link href={voltarHref} className="text-sm text-slate-500 hover:text-slate-700">
          {t('voltar')}
        </Link>

        <h1 className="mt-3 text-2xl font-bold text-marinho">{t('titulo')}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('subtitulo')}
        </p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Alvo — foto de capa com o nome sobreposto, miniaturas e descrição */}
          <div>
            <GaleriaReserva fotos={fotos} nome={nome} localidade={localidade} />

            {roteiro.descricao?.trim() && (
              <p className="px-5 py-4 text-sm leading-relaxed text-slate-600 whitespace-pre-line">{roteiro.descricao.trim()}</p>
            )}
            {!roteiro.descricao?.trim() && <div className="pb-1" />}
          </div>

        </div>

        {/* Chat com o dono em modal, por cima da confirmação (com atalho para nova aba). Oculto para o próprio dono. */}
        {user.id !== ownerId && (
          <ChatDonoModal roteiroId={alvoId} roteiroNome={nome} dataLabel={f.data(data)} pessoas={pessoas} />
        )}

        {previsaoTempo && (
          <div className="mt-6">
            <PrevisaoTempoCard
              resultado={previsaoTempo}
              localidade={localidade}
              dataLabel={formatDateLabel(data, 0)}
            />
          </div>
        )}

        <SelecaoOpcionaisProvider opcionais={opcionais} iniciais={adicionalIds} roteiroId={alvoId}>
        {/* (a previsão já traz margem inferior; sem previsão, o espaçamento vem do mt-6) */}
        <div className={`${previsaoTempo ? '' : 'mt-6 '}rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden`}>
          {/* Data / Pessoas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <CalendarDays className="h-4 w-4 text-marinho" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                  {modalidade === 'diaria' ? t('periodo') : t('data')}
                </p>
                {modalidade === 'diaria' && diarias ? (
                  <p className="text-sm font-semibold text-grafite">
                    {formatDateLabel(data, 0)} → {formatDateLabel(somarDiasISO(data, diarias - 1), 0)}
                    <span className="block text-xs font-normal text-slate-400">
                      {tDiarias('valor', { count: diarias })}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-grafite">{formatDateLabel(data, flex)}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-marinho" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{t('pessoas')}</p>
                <p className="text-sm font-semibold text-grafite">
                  {tPessoas('valor', { count: pessoas })}
                </p>
              </div>
            </div>
          </div>

          {/* Opcionais: todos os do roteiro, com adicionar/retirar */}
          <OpcionaisCheckout taxaPercent={taxaPercent} />
        </div>

        <ConfirmarReserva
          roteiroId={alvoId}
          data={data}
          flex={flex}
          pessoas={pessoas}
          modalidade={modalidade}
          diarias={diarias}
          precoUnitario={precoUnitario}
          multiplicador={multiplicador}
          taxaPercent={taxaPercent}
          termo={termo}
        />
        </SelecaoOpcionaisProvider>
      </main>

      <Footer />
    </div>
  );
}
