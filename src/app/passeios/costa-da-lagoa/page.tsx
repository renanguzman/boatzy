import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'O Segredo da Costa da Lagoa: Navegando pelas Águas de Florianópolis — Boatzy',
  description:
    'Roteiro de barco pela Lagoa da Conceição até a Costa da Lagoa: gastronomia, cachoeiras e a melhor forma de aproveitar as águas calmas de Florianópolis.',
};

const headingClass = 'text-2xl sm:text-3xl font-bold text-[#0B2447]';
const bulletListClass = 'mt-4 space-y-3 list-disc pl-5';

export default function CostaDaLagoaPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-white">
        {/* Hero */}
        <section className="relative h-[50vh] min-h-[360px] flex items-end">
          <Image
            src="/images/passeios/costa-da-lagoa.png"
            alt="Píer ao pôr do sol na Lagoa da Conceição"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B2447]/90 via-[#0B2447]/30 to-transparent" />
          <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
            <h1 className="text-2xl sm:text-4xl font-bold text-white leading-tight">
              O Segredo da Costa da Lagoa: Navegando pelas Águas de Florianópolis
            </h1>
          </div>
        </section>

        {/* Conteúdo */}
        <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 text-slate-700 leading-relaxed space-y-8">
          <p>
            Nem só de mar aberto vive a cultura náutica de Florianópolis. A Lagoa da Conceição
            oferece uma das experiências de navegação mais charmosas e seguras da região, perfeita
            para quem prefere águas sem ondas e cercadas por morros cobertos de Mata Atlântica. Se
            você procura um roteiro que una tranquilidade, águas calmas e uma imersão na cultura
            local da ilha, este é o destino definitivo.
          </p>

          <section>
            <h2 className={headingClass}>A Magia e a Gastronomia da Costa da Lagoa</h2>
            <p className="mt-4">
              O grande destaque de navegar pela região central da ilha é fazer a travessia até a
              Costa da Lagoa, uma comunidade tradicional onde os carros não chegam. Durante a
              navegação, o trajeto é deslumbrante, revelando cachoeiras escondidas e mansões
              cinematográficas.
            </p>
            <p className="mt-4">
              Como o acesso a essa vila é feito exclusivamente pela água (ou por longas trilhas), a
              preservação e a paz do local são inigualáveis. O grande atrativo da região é a
              gastronomia farta e focada em frutos do mar. Ao longo da costa, os restaurantes
              contam com píeres particulares (conhecidos pelos locais através de números) para que
              você possa atracar com facilidade, descer e saborear a mais autêntica culinária da
              ilha.
            </p>
          </section>

          <section>
            <h2 className={headingClass}>Sugestões de Restaurantes para Ancorar</h2>
            <ul className={bulletListClass}>
              <li>
                <strong>Restaurante Cabral (Ponto 19):</strong> Um dos mais tradicionais e
                renomados da região, famoso pelo seu grande deck de madeira à beira da lagoa. É o
                queridinho das lanchas pela sua excelente infraestrutura de atracação. Destaque
                para a isca de linguado, moqueca e caipirinhas caprichadas.
              </li>
              <li>
                <strong>Ponto 16 (O Point da Cachoeira):</strong> Se você quer conciliar
                gastronomia e natureza, o Ponto 16 concentra vários restaurantes deliciosos um ao
                lado do outro. O grande diferencial deste ponto é que, logo atrás dos restaurantes,
                há o acesso para uma trilha curta e fácil que leva até uma bela cachoeira.
              </li>
              <li>
                <strong>Restaurante Coração de Mãe &amp; Sabor da Costa:</strong>{' '}
                Outras opções muito elogiadas para quem busca a clássica &quot;sequência de camarão&quot; e
                peixes grelhados super frescos, em um ambiente rústico e acolhedor com vista para
                as águas tranquilas.
              </li>
            </ul>
          </section>

          <section>
            <h2 className={headingClass}>O Passeio Ideal para Grupos e Esportes Aquáticos</h2>
            <p className="mt-4">
              As águas protegidas dos ventos fortes tornam a Lagoa perfeita para esportes
              aquáticos. É um roteiro muito procurado e ideal para grupos animados, aniversários e
              confraternizações. Ao planejar o seu aluguel de barco na Lagoa da Conceição, verifique
              na plataforma Boatzy os barcos que oferecem pranchas de Stand Up Paddle ou Wakeboard
              inclusas.
            </p>
          </section>

          <section>
            <h2 className={headingClass}>A Experiência de ser um Navegador</h2>
            <p className="mt-4">
              Fazer o trajeto até os restaurantes da Costa da Lagoa utilizando os barcos públicos
              (&quot;baleeiras&quot;) costuma envolver filas e horários estritos. No entanto, ao
              alugar uma lancha ou pontoon particular, você assume o controle e se torna um
              verdadeiro Navegador. Você decide a hora de sair, onde parar para dar um mergulho
              refrescante e em qual píer atracar para o almoço.
            </p>
          </section>

          {/* Imagem no meio do artigo */}
          <figure className="relative w-full h-72 sm:h-96 rounded-2xl overflow-hidden">
            <Image
              src="/images/passeios/costa-da-lagoa-01.png"
              alt="Vista aérea do canal e do píer de barcos na Lagoa da Conceição"
              fill
              className="object-cover"
            />
          </figure>

          <section>
            <h2 className={headingClass}>Por que reservar o seu passeio com o Boatzy?</h2>
            <p className="mt-4">
              O Boatzy foi desenhado para facilitar a sua conexão com o mar. Reservar a sua
              embarcação conosco garante uma experiência premium do início ao fim:
            </p>
            <ul className={bulletListClass}>
              <li>
                <strong>Transparência total no preço:</strong> O valor da tela é o preço final.
                Sem taxas surpresas ou letras miúdas na hora de pagar.
              </li>
              <li>
                <strong>Tudo sobre o barco em um só lugar:</strong> Acesso imediato a fotos,
                capacidade, comodidades e perfil do dono.
              </li>
              <li>
                <strong>Calendário ao vivo:</strong> Veja as datas livres na hora da busca. A
                agenda é atualizada em tempo real direto pelos proprietários.
              </li>
              <li>
                <strong>Personalize seu passeio:</strong> Adicione serviços como marinheiro,
                bebidas e equipamentos de mergulho com apenas um clique, na mesma reserva.
              </li>
              <li>
                <strong>Cancelamento sem dor de cabeça:</strong> Regras de cancelamento claras
                antes do pagamento — inclusive para imprevistos com o clima.
              </li>
              <li>
                <strong>Pagamento 100% seguro:</strong> Seu dinheiro fica protegido pela nossa
                plataforma e só é repassado ao proprietário após a realização do embarque.
              </li>
            </ul>
          </section>

          {/* CTA final */}
          <div className="rounded-2xl bg-[#0B2447] text-center px-6 py-10 sm:px-12">
            <p className="text-white text-lg font-semibold italic">
              Pronto para desbravar os segredos da Lagoa?
            </p>
            <p className="mt-3 text-slate-300">
              Acesse a busca do Boatzy, encontre o barco perfeito para o seu grupo e prepare-se
              para um dia inesquecível de gastronomia e diversão!
            </p>
            <Link
              href="/buscar"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white hover:bg-slate-100 text-[#0B2447] text-sm font-semibold px-6 py-3 transition-colors"
            >
              Buscar embarcações
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
