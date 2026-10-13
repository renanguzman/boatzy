import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import GaleriaRoteiro from '../../../roteiros/[id]/_components/GaleriaRoteiro';
import EmbarcacaoInfoSection, { type EmbarcacaoInfo } from './EmbarcacaoInfoSection';
import RoteirosCarousel, { type RoteiroCarouselItem } from '@/components/ui/RoteirosCarousel';
import { ordenarImagens } from '@/lib/galeria';

/** Dados que a página da embarcação exibe — vindos do banco ou do formulário (prévia). */
export type EmbarcacaoDetalheDados = EmbarcacaoInfo & {
  id: string;
  embarcacao_imagens: { id: string; url_imagem: string; titulo: string | null; principal: boolean; ordem: number }[];
};

/**
 * Conteúdo da página pública da embarcação (galeria → informações → roteiros
 * dela), sem Header/Footer. A embarcação não é reservada diretamente: preço e
 * disponibilidade vivem nos roteiros.
 *
 * Usado por `/embarcacoes/[id]/roteiros` (dados do banco) e pela
 * pré-visualização do painel (dados do formulário ainda não salvo).
 */
export default function EmbarcacaoDetalheView({
  embarcacao,
  roteiros,
  voltarHref,
  ehDono,
}: {
  embarcacao: EmbarcacaoDetalheDados;
  roteiros: RoteiroCarouselItem[];
  voltarHref: string;
  /** Dono vendo a própria embarcação: sem CTA de chat (não conversa consigo mesmo). */
  ehDono: boolean;
}) {
  return (
    <>
      <GaleriaRoteiro images={ordenarImagens(embarcacao.embarcacao_imagens)} nome={embarcacao.nome} voltarHref={voltarHref} />

      <section className="pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <EmbarcacaoInfoSection embarcacao={embarcacao} />

            {!ehDono && (
              <Link
                href={`/embarcacoes/${embarcacao.id}/chat`}
                className="mb-10 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#0B3D91] hover:bg-[#092E6E] text-white text-sm font-semibold transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                Converse com o dono
              </Link>
            )}
          </div>

          <div className="mt-4">
            <RoteirosCarousel title="Roteiros desta embarcação" items={roteiros} />
          </div>
        </div>
      </section>
    </>
  );
}
