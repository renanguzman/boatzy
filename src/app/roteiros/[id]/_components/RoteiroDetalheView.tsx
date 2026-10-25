import {
  MapPin,
  Clock,
  Navigation,
  BadgeCheck,
  Sparkles,
  ShipWheel,
  Star,
  AlarmClock,
  AlarmClockCheck,
  Ship,
  ExternalLink,
} from 'lucide-react';
import BookingCard from './BookingCard';
import RoteiroAcoes from './RoteiroAcoes';
import EmbarcacaoFotosModal from './EmbarcacaoFotosModal';
import EquipamentosEmbarcacao from './EquipamentosEmbarcacao';
import OpcionaisRoteiro from './OpcionaisRoteiro';
import { CartProvider } from './CartContext';
import { DataReservaProvider } from './DataReservaContext';
import type { CalendarioCliente } from '@/lib/disponibilidade';
import LocalizacaoRoteiro from './LocalizacaoRoteiro';
import GaleriaRoteiro from './GaleriaRoteiro';
import AvaliacoesSection, { type AvaliacaoPublica } from '@/components/avaliacoes/AvaliacoesSection';
import { formatarComprimento } from '@/lib/comprimento';
import { ordenarImagens } from '@/lib/galeria';
import { capacidadeMaxima } from '@/lib/capacidade';
import { horarioRetorno, retornoTexto } from '@/lib/duracao';
import { decomporPreco } from '@/lib/precos-calendario';
import { formatCurrency } from '@/lib/utils';

/** Dados que a página do roteiro exibe — vindos do banco ou do formulário (prévia). */
export type RoteiroDetalheDados = {
  id: string;
  nome: string;
  descricao: string;
  origem: string | null;
  destino: string | null;
  duracao: string | null;
  /** Duração em horas (`roteiro.duracao_horas`) — base do "Retorno aproximado". */
  duracao_horas: number | null;
  quantidade_pessoas: number | null;
  preco_base: number | null;
  /** Menor preço só do modelo Roteiro — "a partir de" do card de reserva. */
  preco_diaria_ativo: boolean;
  preco_diaria_valor: number | null;
  preco_diaria_minimo: number;
  disponibilidade_dias_semana: number[] | null;
  horario_saida: string | null;
  latitude: number | null;
  longitude: number | null;
  cep: string | null;
  bairro: string | null;
  logradouro: string | null;
  logradouro_numero: string | null;
  complemento: string | null;
  municipios: { nome: string; estados: { uf: string; nome: string } | null } | null;
  roteiro_imagens: { id: string; url_imagem: string; titulo: string | null; principal: boolean; ordem: number }[];
  embarcacao: {
    id: string;
    nome: string;
    capacidade: number | null;
    comprimento: number | null;
    comprimento_unidade: string | null;
    quartos: number | null;
    banheiros: number | null;
    tripulacao: number | null;
    modalidade_capitao: string;
    embarcacao_tipo: { nome: string } | null;
    embarcacao_comodidades: { comodidade: { nome: string } | null }[];
    embarcacao_equipamentos_seguranca: { equipamentos_seguranca: { nome: string } | null }[];
    embarcacao_acessorios: { acessorios: { nome: string } | null }[];
    embarcacao_imagens: { id: string; url_imagem: string; titulo: string | null; principal: boolean; ordem: number }[];
  } | null;
  roteiro_catalogo: {
    id: string;
    valor_customizado: number | null;
    catalogo: { id: string; descricao: string; valor: number; tipo: string } | null;
  }[];
  roteiro_parada: { nome: string }[];
};

/**
 * Conteúdo da página pública do roteiro (galeria → informações, embarcação,
 * itinerário, localização, avaliações | card de reserva), sem Header/Footer.
 *
 * Único ponto de verdade do layout: usado por `/roteiros/[id]` (dados do
 * banco) e pela pré-visualização do painel (`/preview/roteiro`, dados do
 * formulário ainda não salvo). Sem hooks nem imports de servidor.
 */
export default function RoteiroDetalheView({
  roteiro,
  avaliacoes,
  ehDono,
  isFavorito,
  calendario,
  initialData,
  initialFlex,
  initialPessoas,
  initialModalidade,
}: {
  roteiro: RoteiroDetalheDados;
  avaliacoes: AvaliacaoPublica[];
  ehDono: boolean;
  isFavorito: boolean;
  /** Calendário do roteiro (o mesmo do painel): disponibilidade e total por dia, janela de reservas. */
  calendario: CalendarioCliente;
  initialData?: string;
  initialFlex?: number;
  initialPessoas?: number;
  /** Modelo em que o card de reserva abre — o mesmo do preço anunciado no card. */
  initialModalidade?: 'roteiro' | 'diaria';
}) {
  // Ordem da galeria definida pelo gestor
  const images = ordenarImagens(roteiro.roteiro_imagens);

  // Foto principal da embarcação (miniatura no bloco "Sobre a Embarcação").
  const imagensEmb = roteiro.embarcacao?.embarcacao_imagens ?? [];
  const fotoEmbarcacao = (imagensEmb.find((i) => i.principal) ?? ordenarImagens(imagensEmb)[0])?.url_imagem ?? null;

  // "Veja outros roteiros desta embarcação" — leva os filtros da busca e volta para este roteiro.
  const hrefRoteirosEmbarcacao = roteiro.embarcacao?.id
    ? (() => {
        const q = new URLSearchParams();
        if (initialData) q.set('data', initialData);
        if (initialFlex) q.set('flex', String(initialFlex));
        if (initialPessoas) q.set('pessoas', String(initialPessoas));
        q.set('voltar', `/roteiros/${roteiro.id}`);
        return `/embarcacoes/${roteiro.embarcacao.id}/roteiros?${q.toString()}`;
      })()
    : null;

  const retorno = horarioRetorno(roteiro.horario_saida, roteiro.duracao_horas);

  // Embarque e desembarque no mesmo lugar: a rota vira um local só e o itinerário
  // (sem paradas) não acrescenta nada.
  const mesmoLocal = Boolean(
    roteiro.origem && roteiro.destino
    && roteiro.origem.trim().toLowerCase() === roteiro.destino.trim().toLowerCase(),
  );
  const mostrarItinerario = roteiro.roteiro_parada.length > 0 || Boolean(roteiro.origem && roteiro.destino && !mesmoLocal);

  // Avaliações: sem nenhuma, a seção some e o roteiro ganha o selo "Novo no Boatzy".
  const totalAvaliacoes = avaliacoes.length;
  const mediaAvaliacoes = totalAvaliacoes > 0
    ? avaliacoes.reduce((acc, a) => acc + a.nota, 0) / totalAvaliacoes
    : 0;

  // Preço logo abaixo do título (celular) — o mesmo "a partir de" do card de reserva, no
  // modelo em que ele abre: menor total entre os dias disponíveis, ou a diária com a taxa.
  const modalidadeAnunciada = initialModalidade
    ?? (roteiro.preco_base != null || !roteiro.preco_diaria_ativo ? 'roteiro' : 'diaria');
  const totaisDisponiveis = calendario.dias
    .filter((d) => d.status === 'disponivel' && d.total != null)
    .map((d) => d.total!);
  const precoTopo = modalidadeAnunciada === 'diaria'
    ? (roteiro.preco_diaria_valor != null ? decomporPreco(roteiro.preco_diaria_valor, calendario.taxaPercent).clientePaga : null)
    : totaisDisponiveis.length > 0 ? Math.min(...totaisDisponiveis) : null;

  // Convidados = capacidade da embarcação sem a tripulação (mesma base do limite do card de reserva).
  const convidados = roteiro.embarcacao?.capacidade != null
    ? roteiro.embarcacao.capacidade - (roteiro.embarcacao.tripulacao ?? 0)
    : null;

  const localidade = roteiro.municipios
    ? roteiro.municipios.estados
      ? `${roteiro.municipios.nome}, ${roteiro.municipios.estados.uf}`
      : roteiro.municipios.nome
    : null;

  const modalidadeLabel: Record<string, string> = {
    com_capitao: 'Com Capitão',
    sem_capitao: 'Sem Capitão',
    opcional: 'Capitão Opcional',
  };

  const catalogAddons = roteiro.roteiro_catalogo
    .filter((rc) => rc.catalogo)
    .map((rc) => ({
      id: rc.id,
      descricao: rc.catalogo!.descricao,
      preco: rc.valor_customizado ?? rc.catalogo!.valor,
      tipo: rc.catalogo!.tipo,
    }));

  return (
    <>
      <GaleriaRoteiro
        images={images}
        nome={roteiro.nome}
        acoes={<RoteiroAcoes roteiroId={roteiro.id} roteiroNome={roteiro.nome} initialFavorito={isFavorito} variante="sobreFoto" />}
      />

      {/* Content */}
      <section className="pb-10 lg:pb-16" id="roteiro-content">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <CartProvider addons={catalogAddons} taxaPercent={calendario.taxaPercent}>
          {/* Data vinda da busca só vale se o dia estiver disponível no calendário. */}
          <DataReservaProvider
            dataInicial={initialData && calendario.dias.find(d => d.data === initialData)?.status === 'disponivel' ? initialData : null}
            flexInicial={initialFlex ?? 0}
            modalidadeInicial={initialModalidade ?? (roteiro.preco_base != null || !roteiro.preco_diaria_ativo ? 'roteiro' : 'diaria')}
            diariasIniciais={roteiro.preco_diaria_minimo}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10">

            {/* ── Left column ── */}
            {/* Seções a 32px uma da outra; a última não deixa sobra antes do card de reserva (celular) */}
            <div className="lg:col-span-2 [&>*:last-child]:mb-0">
              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {totalAvaliacoes === 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-turquesa-escuro bg-turquesa/10 px-3 py-1.5 rounded-full">
                    <Sparkles className="h-3 w-3" />
                    Novo no Boatzy
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-xs font-medium text-turquesa-escuro bg-turquesa/10 px-3 py-1.5 rounded-full">
                  <BadgeCheck className="h-3 w-3" />
                  Roteiro Verificado
                </span>
                {/* Todo passeio inclui a embarcação; o que diferencia é o capitão (não se repete em "Sobre a Embarcação") */}
                {roteiro.embarcacao && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-marinho bg-marinho/10 px-3 py-1.5 rounded-full">
                    <ShipWheel className="h-3 w-3" />
                    {modalidadeLabel[roteiro.embarcacao.modalidade_capitao] ?? roteiro.embarcacao.modalidade_capitao}
                  </span>
                )}
              </div>

              {/* Title & location */}
              <h1 className="text-3xl md:text-4xl font-bold text-marinho mb-2">
                {roteiro.nome}
              </h1>
              {(localidade || totalAvaliacoes > 0) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 text-sm mb-4 lg:mb-6">
                  {localidade && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 shrink-0" />
                      {localidade}
                    </span>
                  )}
                  {totalAvaliacoes > 0 && (
                    <a href="#avaliacoes" className="inline-flex items-center gap-1 hover:underline underline-offset-4">
                      <Star className="h-4 w-4 fill-destaque text-destaque" />
                      <span className="font-semibold text-marinho">
                        {mediaAvaliacoes.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </span>
                      · {totalAvaliacoes} {totalAvaliacoes === 1 ? 'avaliação' : 'avaliações'}
                    </a>
                  )}
                </div>
              )}

              {/* Preço já na primeira tela do celular (no desktop ele está no card de reserva, ao lado) */}
              {precoTopo != null && (
                <p className="lg:hidden mb-6 flex flex-wrap items-baseline gap-x-1.5">
                  <span className="text-xs text-slate-500">A partir de</span>
                  <span className="text-xl font-bold text-marinho">{formatCurrency(precoTopo)}</span>
                  <span className="text-sm text-slate-500">{modalidadeAnunciada === 'diaria' ? 'por diária' : 'por passeio'}</span>
                </p>
              )}

              {/* Description */}
              <p className="text-slate-600 text-sm leading-relaxed mb-8 max-w-2xl">
                {roteiro.descricao}
              </p>

              {/* Specs row — Duração · Saída · Retorno lado a lado (no celular, ícone em cima do texto para
                  caber em 3 colunas); local de embarque na linha inteira. Capacidade e embarcação ficam em
                  "Sobre a Embarcação" e no BookingCard. */}
              <div className="grid grid-cols-3 gap-x-3 gap-y-5 py-5 sm:py-6 border-y border-slate-100 mb-8">
                {roteiro.duracao && (
                  <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3 min-w-0">
                    <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4 text-marinho" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Duração</p>
                      <p className="text-sm font-semibold text-grafite truncate">{roteiro.duracao}</p>
                    </div>
                  </div>
                )}
                {roteiro.horario_saida && (
                  <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3 min-w-0">
                    <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <AlarmClock className="h-4 w-4 text-marinho" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Saída</p>
                      <p className="text-sm font-semibold text-grafite truncate">
                        {roteiro.horario_saida.slice(0, 5)}
                      </p>
                    </div>
                  </div>
                )}
                {/* Retorno aproximado = saída + duração (relógio de 24 h; pode cair de madrugada / em outro dia) */}
                {retorno && (
                  <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3 min-w-0">
                    <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <AlarmClockCheck className="h-4 w-4 text-marinho" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                        <span className="sm:hidden">Retorno aprox.</span>
                        <span className="hidden sm:inline">Retorno Aproximado</span>
                      </p>
                      <p className="text-sm font-semibold text-grafite truncate" title={retornoTexto(retorno)}>
                        {retorno.horario}
                        {retorno.diasDepois > 0 && (
                          <span className="ml-1 text-xs font-medium text-slate-500">
                            {retorno.diasDepois === 1 ? '(dia seguinte)' : `(+${retorno.diasDepois} dias)`}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
                {(roteiro.origem || roteiro.destino) && (
                  <div className="col-span-full flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <Navigation className="h-4 w-4 text-marinho" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                        {mesmoLocal ? 'Embarque e desembarque' : 'Local de partida'}
                      </p>
                      <p className="text-sm font-semibold text-grafite sm:truncate">
                        {roteiro.origem && roteiro.destino && !mesmoLocal
                          ? `${roteiro.origem} → ${roteiro.destino}`
                          : roteiro.origem ?? roteiro.destino}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Opcionais do dono à vista, antes da embarcação (some sem opcionais) */}
              <OpcionaisRoteiro roteiroId={roteiro.id} variante="conteudo" />

              {/* Embarcação details */}
              {roteiro.embarcacao && (
                <div className="mb-8">
                  <h2 className="text-xl font-bold text-marinho mb-4">
                    Sobre a Embarcação
                  </h2>
                  <div className="rounded-2xl border border-slate-100 p-5 bg-slate-50/50">
                    {/* Foto grande (abre a galeria) | nome, tipo, capitão e link p/ os outros roteiros */}
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 mb-5 min-w-0">
                      <EmbarcacaoFotosModal capa={fotoEmbarcacao} embarcacao={roteiro.embarcacao} />
                      <div className="min-w-0 flex-1 flex flex-col">
                        {/* Capitão: selo no topo da página (não repete aqui) */}
                        <div className="min-w-0">
                          <p className="text-lg font-semibold text-grafite leading-snug">{roteiro.embarcacao.nome}</p>
                          {roteiro.embarcacao.embarcacao_tipo && (
                            <p className="text-xs text-slate-500 mt-0.5">{roteiro.embarcacao.embarcacao_tipo.nome}</p>
                          )}
                        </div>
                        {hrefRoteirosEmbarcacao && (
                          <a
                            href={hrefRoteirosEmbarcacao}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group mt-4 sm:mt-auto inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-marinho hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marinho rounded"
                          >
                            <Ship className="h-4 w-4" />
                            Veja outros roteiros desta embarcação
                            <ExternalLink className="h-3.5 w-3.5 opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                      {convidados != null && convidados > 0 && (
                        <div className="text-center p-3 bg-white rounded-xl border border-slate-100">
                          <p className="text-lg font-bold text-marinho">{convidados}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Convidados</p>
                        </div>
                      )}
                      {roteiro.embarcacao.tripulacao && (
                        <div className="text-center p-3 bg-white rounded-xl border border-slate-100">
                          <p className="text-lg font-bold text-marinho">{roteiro.embarcacao.tripulacao}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Tripulação</p>
                        </div>
                      )}
                      {roteiro.embarcacao.quartos && (
                        <div className="text-center p-3 bg-white rounded-xl border border-slate-100">
                          <p className="text-lg font-bold text-marinho">{roteiro.embarcacao.quartos}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Quartos</p>
                        </div>
                      )}
                      {roteiro.embarcacao.banheiros && (
                        <div className="text-center p-3 bg-white rounded-xl border border-slate-100">
                          <p className="text-lg font-bold text-marinho">{roteiro.embarcacao.banheiros}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Banheiros</p>
                        </div>
                      )}
                      {roteiro.embarcacao.comprimento && (
                        <div className="text-center p-3 bg-white rounded-xl border border-slate-100">
                          <p className="text-lg font-bold text-marinho">{formatarComprimento(roteiro.embarcacao.comprimento, roteiro.embarcacao.comprimento_unidade)}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Comprimento</p>
                        </div>
                      )}
                    </div>

                    {/* Segurança, acessórios e comodidades: recolhidos num accordion, por categoria */}
                    <EquipamentosEmbarcacao
                      categorias={[
                        {
                          titulo: 'Equipamentos de Segurança',
                          singular: 'item de segurança',
                          plural: 'itens de segurança',
                          icone: 'seguranca',
                          itens: roteiro.embarcacao.embarcacao_equipamentos_seguranca.flatMap((ee) =>
                            ee.equipamentos_seguranca ? [ee.equipamentos_seguranca.nome] : []),
                        },
                        {
                          titulo: 'Acessórios da Embarcação',
                          singular: 'acessório',
                          plural: 'acessórios',
                          icone: 'acessorios',
                          itens: roteiro.embarcacao.embarcacao_acessorios.flatMap((ea) =>
                            ea.acessorios ? [ea.acessorios.nome] : []),
                        },
                        {
                          titulo: 'Comodidades a bordo',
                          singular: 'comodidade',
                          plural: 'comodidades',
                          icone: 'comodidades',
                          itens: roteiro.embarcacao.embarcacao_comodidades.flatMap((ec) =>
                            ec.comodidade ? [ec.comodidade.nome] : []),
                        },
                      ]}
                    />
                  </div>
                </div>
              )}

              {/* Itinerary — só quando acrescenta algo: paradas, ou saída e chegada diferentes */}
              {mostrarItinerario && (
                <div className="mb-8">
                  <h2 className="text-xl font-bold text-marinho mb-4">Itinerário</h2>
                  <div className="relative pl-6">
                    <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gradient-to-b from-marinho to-turquesa rounded-full" />
                    {roteiro.origem && (
                      <div className="relative mb-6">
                        <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-marinho ring-2 ring-white" />
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Saída</p>
                        <p className="text-sm font-semibold text-grafite">{roteiro.origem}</p>
                      </div>
                    )}
                    {roteiro.roteiro_parada.map((parada, i) => (
                      <div key={i} className="relative mb-6">
                        <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-turquesa/60 ring-2 ring-white" />
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                          Parada {i + 1}
                        </p>
                        <p className="text-sm font-semibold text-grafite">{parada.nome}</p>
                      </div>
                    ))}
                    {roteiro.destino && (
                      <div className="relative">
                        <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-turquesa ring-2 ring-white" />
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Chegada</p>
                        <p className="text-sm font-semibold text-grafite">{roteiro.destino}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Localização */}
              {roteiro.latitude && roteiro.longitude && (
                <div className="mb-8">
                  <h2 className="text-xl font-bold text-marinho mb-4">Localização</h2>

                  <LocalizacaoRoteiro
                    lat={Number(roteiro.latitude)}
                    lng={Number(roteiro.longitude)}
                    endereco={
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                        <MapPin className="h-4 w-4 text-marinho mt-0.5 shrink-0" />
                        <div className="text-sm text-slate-700 leading-relaxed">
                          {roteiro.logradouro && (
                            <p className="font-medium text-grafite">
                              {roteiro.logradouro}
                              {roteiro.logradouro_numero && `, ${roteiro.logradouro_numero}`}
                              {roteiro.complemento && ` — ${roteiro.complemento}`}
                            </p>
                          )}
                          {roteiro.bairro && <p>{roteiro.bairro}</p>}
                          {localidade && <p>{localidade}</p>}
                          {roteiro.cep && (
                            <p className="text-slate-500 mt-0.5">
                              CEP {roteiro.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')}
                            </p>
                          )}
                          {!roteiro.logradouro && !roteiro.bairro && roteiro.origem && (
                            <p className="font-medium text-grafite">{roteiro.origem}</p>
                          )}
                        </div>
                      </div>
                    }
                  />
                </div>
              )}

              {/* Avaliações — sem nenhuma, a seção some (o selo "Novo no Boatzy" aparece no topo) */}
              {totalAvaliacoes > 0 && (
                <div id="avaliacoes" className="scroll-mt-24">
                  <AvaliacoesSection
                    avaliacoes={avaliacoes}
                    emptyLabel="Ainda não há avaliações para este roteiro."
                  />
                </div>
              )}
            </div>

            {/* ── Right sidebar ── */}
            <div className="lg:col-span-1 scroll-mt-24" id="reservar">
              <BookingCard
                roteiroId={roteiro.id}
                roteiroNome={roteiro.nome}
                ehDono={ehDono}
                initialFavorito={isFavorito}
                preco={roteiro.preco_base}
                calendario={calendario}
                initialPessoas={initialPessoas}
                precoDiariaAtivo={roteiro.preco_diaria_ativo}
                precoDiariaValor={roteiro.preco_diaria_valor}
                precoDiariaMinimo={roteiro.preco_diaria_minimo}
                capacidade={capacidadeMaxima(
                  roteiro.quantidade_pessoas,
                  roteiro.embarcacao?.capacidade != null
                    ? roteiro.embarcacao.capacidade - (roteiro.embarcacao.tripulacao ?? 0)
                    : undefined,
                )}
              />
            </div>
          </div>
          </DataReservaProvider>
          </CartProvider>
        </div>
      </section>

    </>
  );
}
