import { MapPin } from 'lucide-react';
import GaleriaRoteiro from '../../../roteiros/[id]/_components/GaleriaRoteiro';
import LocalizacaoMap from '../../../roteiros/[id]/_components/LocalizacaoMap';
import EmbarcacaoBookingCard from './EmbarcacaoBookingCard';
import EmbarcacaoInfoSection from './EmbarcacaoInfoSection';
import AvaliacoesSection, { type AvaliacaoPublica } from '@/components/avaliacoes/AvaliacoesSection';
import { ordenarImagens } from '@/lib/galeria';

/** Dados que a página da embarcação exibe — vindos do banco ou do formulário (prévia). */
export type EmbarcacaoDetalheDados = {
  id: string;
  nome: string;
  descricao: string | null;
  capacidade: number | null;
  comprimento: number | null;
  comprimento_unidade: string | null;
  quartos: number | null;
  suites: number | null;
  banheiros: number | null;
  tripulacao: number | null;
  modalidade_capitao: string;
  preco_base: number | null;
  disponibilidade_dias_semana: number[] | null;
  latitude: number | null;
  longitude: number | null;
  cep: string | null;
  bairro: string | null;
  logradouro: string | null;
  logradouro_numero: string | null;
  complemento: string | null;
  embarcacao_tipo: { nome: string } | null;
  municipios: { nome: string; estados: { uf: string; nome: string } | null } | null;
  embarcacao_comodidades: { comodidade: { nome: string } | null }[];
  embarcacao_imagens: { id: string; url_imagem: string; titulo: string | null; principal: boolean; ordem: number }[];
};

const modalidadeLabel: Record<string, string> = {
  com_capitao: 'Com Capitão',
  sem_capitao: 'Sem Capitão',
  opcional: 'Capitão Opcional',
};

/**
 * Conteúdo da página pública da embarcação (galeria → informações →
 * localização → avaliações | card de reserva), sem Header/Footer.
 *
 * Único ponto de verdade do layout: usado por `/embarcacoes/[id]` (dados do
 * banco) e pela pré-visualização do painel (`/preview/embarcacao`, dados do
 * formulário ainda não salvo). Sem hooks nem imports de servidor, para
 * renderizar nos dois lados.
 */
export default function EmbarcacaoDetalheView({
  embarcacao,
  avaliacoes,
  ehDono,
  datasBloqueadas,
  initialData,
  initialFlex,
  initialPessoas,
}: {
  embarcacao: EmbarcacaoDetalheDados;
  avaliacoes: AvaliacaoPublica[];
  ehDono: boolean;
  /** Bloqueios manuais + datas com reserva confirmada (ISO yyyy-mm-dd). */
  datasBloqueadas: string[];
  initialData?: string;
  initialFlex?: number;
  initialPessoas?: number;
}) {
  const localidade = embarcacao.municipios
    ? embarcacao.municipios.estados
      ? `${embarcacao.municipios.nome}, ${embarcacao.municipios.estados.uf}`
      : embarcacao.municipios.nome
    : null;

  return (
    <>
      <GaleriaRoteiro images={ordenarImagens(embarcacao.embarcacao_imagens)} nome={embarcacao.nome} voltarHref="/embarcacoes" />

      {/* Content */}
      <section className="pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

            {/* ── Left column ── */}
            <div className="lg:col-span-2">
              <EmbarcacaoInfoSection embarcacao={embarcacao} />

              {/* Localização */}
              {embarcacao.latitude && embarcacao.longitude && (
                <div className="mb-10">
                  <h2 className="text-xl font-bold text-[#0B2447] mb-4">Localização</h2>

                  <LocalizacaoMap lat={Number(embarcacao.latitude)} lng={Number(embarcacao.longitude)} />

                  <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <MapPin className="h-4 w-4 text-[#0B3D91] mt-0.5 shrink-0" />
                    <div className="text-sm text-slate-700 leading-relaxed">
                      {embarcacao.logradouro && (
                        <p className="font-medium text-slate-800">
                          {embarcacao.logradouro}
                          {embarcacao.logradouro_numero && `, ${embarcacao.logradouro_numero}`}
                          {embarcacao.complemento && ` — ${embarcacao.complemento}`}
                        </p>
                      )}
                      {embarcacao.bairro && <p>{embarcacao.bairro}</p>}
                      {localidade && <p>{localidade}</p>}
                      {embarcacao.cep && (
                        <p className="text-slate-500 mt-0.5">
                          CEP {embarcacao.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Avaliações */}
              <AvaliacoesSection
                avaliacoes={avaliacoes}
                emptyLabel="Ainda não há avaliações para esta embarcação."
              />
            </div>

            {/* ── Right sidebar ── */}
            <div className="lg:col-span-1">
              <EmbarcacaoBookingCard
                embarcacaoId={embarcacao.id}
                ehDono={ehDono}
                preco={embarcacao.preco_base}
                modalidadeLabel={modalidadeLabel[embarcacao.modalidade_capitao] ?? embarcacao.modalidade_capitao}
                diasOperacao={embarcacao.disponibilidade_dias_semana}
                datasBloqueadas={datasBloqueadas}
                initialData={initialData}
                initialFlex={initialFlex}
                initialPessoas={initialPessoas}
                capacidade={embarcacao.capacidade}
              />
            </div>
          </div>
        </div>
      </section>

    </>
  );
}
