import {
  MapPin,
  Users,
  Clock,
  Navigation,
  Anchor,
  BadgeCheck,
  Award,
  CheckCircle2,
} from 'lucide-react';
import BookingCard from './BookingCard';
import EmbarcacaoFotosModal from './EmbarcacaoFotosModal';
import { CartProvider } from './CartContext';
import LocalizacaoMap from './LocalizacaoMap';
import GaleriaRoteiro from './GaleriaRoteiro';
import AvaliacoesSection, { type AvaliacaoPublica } from '@/components/avaliacoes/AvaliacoesSection';
import type { PrecoPessoaModoCapacidade } from '@/types/supabase';
import { formatarComprimento } from '@/lib/comprimento';
import { ordenarImagens } from '@/lib/galeria';

/** Dados que a página do roteiro exibe — vindos do banco ou do formulário (prévia). */
export type RoteiroDetalheDados = {
  id: string;
  nome: string;
  descricao: string;
  origem: string | null;
  destino: string | null;
  duracao: string | null;
  quantidade_pessoas: number | null;
  preco_base: number | null;
  preco_diaria_ativo: boolean;
  preco_diaria_valor: number | null;
  preco_diaria_minimo: number;
  preco_pessoa_ativo: boolean;
  preco_pessoa_valor: number | null;
  preco_pessoa_capacidade_minima: number | null;
  preco_pessoa_capacidade_maxima: number | null;
  preco_pessoa_modo_capacidade: PrecoPessoaModoCapacidade;
  disponibilidade_dias_semana: number[] | null;
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
    nome: string;
    capacidade: number | null;
    comprimento: number | null;
    comprimento_unidade: string | null;
    quartos: number | null;
    tripulacao: number | null;
    modalidade_capitao: string;
    embarcacao_tipo: { nome: string } | null;
    embarcacao_comodidades: { comodidade: { nome: string } | null }[];
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
  datasBloqueadas,
  vagasPessoaOcupadas,
  initialData,
  initialFlex,
  initialPessoas,
}: {
  roteiro: RoteiroDetalheDados;
  avaliacoes: AvaliacaoPublica[];
  ehDono: boolean;
  isFavorito: boolean;
  /** Bloqueios manuais + datas exclusivamente ocupadas (ISO yyyy-mm-dd). */
  datasBloqueadas: string[];
  /** Vagas já ocupadas por data no modelo Por Pessoa (capacidade compartilhada). */
  vagasPessoaOcupadas: Record<string, number>;
  initialData?: string;
  initialFlex?: number;
  initialPessoas?: number;
}) {
  // Ordem da galeria definida pelo gestor
  const images = ordenarImagens(roteiro.roteiro_imagens);

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
      <GaleriaRoteiro images={images} nome={roteiro.nome} />

      {/* Content */}
      <section className="pb-16" id="roteiro-content">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <CartProvider addons={catalogAddons}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

            {/* ── Left column ── */}
            <div className="lg:col-span-2">
              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 bg-cyan-50 px-3 py-1.5 rounded-full">
                  <Award className="h-3 w-3" />
                  Novo
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full">
                  <BadgeCheck className="h-3 w-3" />
                  Roteiro Verificado
                </span>
                {roteiro.embarcacao && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0B3D91] bg-[#0B3D91]/10 px-3 py-1.5 rounded-full">
                    <Anchor className="h-3 w-3" />
                    {roteiro.embarcacao.embarcacao_tipo?.nome ?? 'Embarcação'} incluída
                  </span>
                )}
              </div>

              {/* Title & location */}
              <h1 className="text-3xl md:text-4xl font-bold text-[#0B2447] mb-2">
                {roteiro.nome}
              </h1>
              {localidade && (
                <div className="flex items-center gap-1.5 text-slate-500 text-sm mb-6">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {localidade}
                </div>
              )}

              {/* Description */}
              <p className="text-slate-600 text-sm leading-relaxed mb-8 max-w-2xl">
                {roteiro.descricao}
              </p>

              {/* Specs row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-slate-100 mb-10">
                {roteiro.duracao && (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4 text-[#0B3D91]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Duração</p>
                      <p className="text-sm font-semibold text-slate-800 truncate">{roteiro.duracao}</p>
                    </div>
                  </div>
                )}
                {roteiro.quantidade_pessoas && (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <Users className="h-4 w-4 text-[#0B3D91]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Capacidade</p>
                      <p className="text-sm font-semibold text-slate-800 truncate">{roteiro.quantidade_pessoas} pessoas</p>
                    </div>
                  </div>
                )}
                {(roteiro.origem || roteiro.destino) && (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <Navigation className="h-4 w-4 text-[#0B3D91]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Rota</p>
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {roteiro.origem && roteiro.destino
                          ? `${roteiro.origem} → ${roteiro.destino}`
                          : roteiro.origem ?? roteiro.destino}
                      </p>
                    </div>
                  </div>
                )}
                {roteiro.embarcacao && (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <Anchor className="h-4 w-4 text-[#0B3D91]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Embarcação</p>
                      <p className="text-sm font-semibold text-slate-800 truncate">{roteiro.embarcacao.nome}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Embarcação details */}
              {roteiro.embarcacao && (
                <div className="mb-10">
                  <h2 className="text-xl font-bold text-[#0B2447] mb-4">
                    Sobre a Embarcação
                  </h2>
                  <div className="rounded-2xl border border-slate-100 p-5 bg-slate-50/50">
                    <div className="flex items-center gap-3 mb-4 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-[#0B3D91]/10 flex items-center justify-center shrink-0">
                        <Anchor className="h-5 w-5 text-[#0B3D91]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <EmbarcacaoFotosModal embarcacao={roteiro.embarcacao} />
                        {roteiro.embarcacao.embarcacao_tipo && (
                          <p className="text-xs text-slate-500 mt-0.5">{roteiro.embarcacao.embarcacao_tipo.nome}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs font-medium bg-[#0B3D91]/10 text-[#0B3D91] px-3 py-1 rounded-full whitespace-nowrap">
                        {modalidadeLabel[roteiro.embarcacao.modalidade_capitao] ?? roteiro.embarcacao.modalidade_capitao}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {roteiro.embarcacao.capacidade && (
                        <div className="text-center p-3 bg-white rounded-xl border border-slate-100">
                          <p className="text-lg font-bold text-[#0B2447]">{roteiro.embarcacao.capacidade}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Pessoas</p>
                        </div>
                      )}
                      {roteiro.embarcacao.comprimento && (
                        <div className="text-center p-3 bg-white rounded-xl border border-slate-100">
                          <p className="text-lg font-bold text-[#0B2447]">{formatarComprimento(roteiro.embarcacao.comprimento, roteiro.embarcacao.comprimento_unidade)}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Comprimento</p>
                        </div>
                      )}
                      {roteiro.embarcacao.quartos && (
                        <div className="text-center p-3 bg-white rounded-xl border border-slate-100">
                          <p className="text-lg font-bold text-[#0B2447]">{roteiro.embarcacao.quartos}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Quartos</p>
                        </div>
                      )}
                      {roteiro.embarcacao.tripulacao && (
                        <div className="text-center p-3 bg-white rounded-xl border border-slate-100">
                          <p className="text-lg font-bold text-[#0B2447]">{roteiro.embarcacao.tripulacao}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Tripulação</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Comodidades da embarcação */}
              {roteiro.embarcacao && roteiro.embarcacao.embarcacao_comodidades.length > 0 && (
                <div className="mb-10">
                  <h2 className="text-xl font-bold text-[#0B2447] mb-4">Comodidades a bordo</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {roteiro.embarcacao.embarcacao_comodidades.map((ec, i) =>
                      ec.comodidade ? (
                        <div
                          key={i}
                          className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 bg-slate-50/60"
                        >
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span className="text-sm text-slate-700 leading-tight">{ec.comodidade.nome}</span>
                        </div>
                      ) : null,
                    )}
                  </div>
                </div>
              )}

              {/* Itinerary */}
              {(roteiro.origem || roteiro.destino || roteiro.roteiro_parada.length > 0) && (
                <div className="mb-10">
                  <h2 className="text-xl font-bold text-[#0B2447] mb-4">Itinerário</h2>
                  <div className="relative pl-6">
                    <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gradient-to-b from-[#0B3D91] to-cyan-400 rounded-full" />
                    {roteiro.origem && (
                      <div className="relative mb-6">
                        <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-[#0B3D91] ring-2 ring-white" />
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Saída</p>
                        <p className="text-sm font-semibold text-slate-800">{roteiro.origem}</p>
                      </div>
                    )}
                    {roteiro.roteiro_parada.map((parada, i) => (
                      <div key={i} className="relative mb-6">
                        <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-[#5B8DEF] ring-2 ring-white" />
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                          Parada {i + 1}
                        </p>
                        <p className="text-sm font-semibold text-slate-800">{parada.nome}</p>
                      </div>
                    ))}
                    {roteiro.destino && (
                      <div className="relative">
                        <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-cyan-400 ring-2 ring-white" />
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Chegada</p>
                        <p className="text-sm font-semibold text-slate-800">{roteiro.destino}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Localização */}
              {roteiro.latitude && roteiro.longitude && (
                <div className="mb-10">
                  <h2 className="text-xl font-bold text-[#0B2447] mb-4">Localização</h2>

                  <LocalizacaoMap lat={Number(roteiro.latitude)} lng={Number(roteiro.longitude)} />

                  {/* Endereço textual */}
                  <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <MapPin className="h-4 w-4 text-[#0B3D91] mt-0.5 shrink-0" />
                    <div className="text-sm text-slate-700 leading-relaxed">
                      {roteiro.logradouro && (
                        <p className="font-medium text-slate-800">
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
                        <p className="font-medium text-slate-800">{roteiro.origem}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Avaliações */}
              <AvaliacoesSection
                avaliacoes={avaliacoes}
                emptyLabel="Ainda não há avaliações para este roteiro."
              />
            </div>

            {/* ── Right sidebar ── */}
            <div className="lg:col-span-1">
              <BookingCard
                roteiroId={roteiro.id}
                roteiroNome={roteiro.nome}
                ehDono={ehDono}
                initialFavorito={isFavorito}
                preco={roteiro.preco_base}
                diasOperacao={roteiro.disponibilidade_dias_semana}
                datasBloqueadas={datasBloqueadas}
                initialData={initialData}
                initialFlex={initialFlex}
                initialPessoas={initialPessoas}
                precoDiariaAtivo={roteiro.preco_diaria_ativo}
                precoDiariaValor={roteiro.preco_diaria_valor}
                precoDiariaMinimo={roteiro.preco_diaria_minimo}
                precoPessoaAtivo={roteiro.preco_pessoa_ativo}
                precoPessoaValor={roteiro.preco_pessoa_valor}
                precoPessoaCapacidadeMinima={roteiro.preco_pessoa_capacidade_minima}
                precoPessoaCapacidadeMaxima={roteiro.preco_pessoa_capacidade_maxima}
                precoPessoaModoCapacidade={roteiro.preco_pessoa_modo_capacidade}
                vagasPessoaOcupadas={vagasPessoaOcupadas}
              />
            </div>
          </div>
          </CartProvider>
        </div>
      </section>

    </>
  );
}
