import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'O Refúgio Exclusivo dos Barcos: A Magia da Praia do Tinguá — Boatzy',
  description:
    'Descubra por que a Praia do Tinguá, em Governador Celso Ramos, é o destino mais desejado e o ponto de encontro perfeito para lanchas no verão catarinense.',
};

const headingClass = 'text-2xl sm:text-3xl font-bold text-[#0B2447]';
const bulletListClass = 'mt-4 space-y-3 list-disc pl-5';

export default function PraiaDoTinguaPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-white">
        {/* Hero */}
        <section className="relative h-[50vh] min-h-[360px] flex items-end">
          <Image
            src="/images/passeios/praia-do-tingua.png"
            alt="Vista aérea da Praia do Tinguá, em Governador Celso Ramos, cercada de lanchas"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B2447]/90 via-[#0B2447]/30 to-transparent" />
          <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
            <h1 className="text-2xl sm:text-4xl font-bold text-white leading-tight">
              O Refúgio Exclusivo dos Barcos: A Magia da Praia do Tinguá
            </h1>
          </div>
        </section>

        {/* Conteúdo */}
        <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 text-slate-700 leading-relaxed space-y-8">
          <p>
            Se você procura o ponto de encontro mais cobiçado e vibrante do verão catarinense,
            prepare-se para conhecer a Praia do Tinguá. Localizada estrategicamente no município
            de Governador Celso Ramos, a poucos minutos de navegação ao norte da Ilha de Santa
            Catarina, essa enseada é o cenário perfeito para quem deseja unir natureza deslumbrante
            e muita diversão na água.
          </p>

          <section>
            <h2 className={headingClass}>O &quot;Clube Privado&quot; ao Ar Livre</h2>
            <p className="mt-4">
              O que torna a Praia do Tinguá tão especial é a sua geografia. Com um acesso por via
              terrestre extremamente difícil e restrito, ela funciona, na prática, como uma praia
              &quot;exclusiva&quot; para quem chega pelo mar. Durante a alta temporada, a enseada
              se transforma em um verdadeiro desfile de lanchas e iates, atraindo embarcações não
              apenas de Florianópolis, mas de toda a região costeira.
            </p>
            <p className="mt-4">
              A grande vantagem deste destino é a sua proteção natural fenomenal contra os ventos
              fortes dos quadrantes Norte e Nordeste. O resultado? Um mar incrivelmente liso,
              semelhante a uma enorme piscina natural de águas calmas e transparentes. É o local
              perfeito para ancorar com total segurança, estender o seu tapete flutuante na água,
              ligar o sistema de som do barco e curtir o dia com os amigos sob o sol.
            </p>
          </section>

          {/* Imagem no meio do artigo */}
          <figure className="relative w-full h-72 sm:h-96 rounded-2xl overflow-hidden">
            <Image
              src="/images/passeios/praia-do-tingua-01.png"
              alt="Barcos ancorados em águas calmas ao amanhecer na Praia do Tinguá"
              fill
              className="object-cover"
            />
          </figure>

          <section>
            <h2 className={headingClass}>Gastronomia e Estrutura à Beira-Mar</h2>
            <p className="mt-4">
              Além do clima de festa e relaxamento nos barcos, a Praia do Tinguá oferece
              excelentes opções de comodidade. Você pode combinar com o seu Comandante uma parada
              estratégica nos restaurantes localizados na areia, que costumam oferecer serviço de
              trapiche para facilitar o desembarque. Há também embarcações de apoio que circulam
              pela baía vendendo gelo, drinks e petiscos entregues diretamente no deck da sua
              lancha.
            </p>
          </section>

          <section>
            <h2 className={headingClass}>Assuma o Leme: Seja um Navegador</h2>
            <p className="mt-4">
              Ao alugar um barco particular, você deixa de ser apenas um turista e assume o papel
              de um verdadeiro Navegador. Você tem total liberdade para ditar o ritmo do passeio:
              seja para chegar cedinho e garantir o melhor ponto de ancoragem, fazer um belo
              churrasco a bordo na hora do almoço (basta buscar no Boatzy por barcos com
              churrasqueira inclusa) ou simplesmente brindar no final da tarde com o seu grupo.
            </p>
          </section>

          <section>
            <h2 className={headingClass}>Por que escolher o Boatzy?</h2>
            <p className="mt-4">
              O Boatzy foi desenhado para facilitar a sua conexão com o mar. Planejar a sua ida ao
              Tinguá pela nossa plataforma garante:
            </p>
            <ul className={bulletListClass}>
              <li>
                <strong>Transparência total no preço:</strong>{' '}
                O valor da tela é o preço final. Sem taxas surpresas ou letras miúdas na hora de
                pagar.
              </li>
              <li>
                <strong>Tudo sobre o barco em um só lugar:</strong>{' '}
                Acesso imediato a fotos, capacidade, comodidades e perfil do dono. Tudo na mão,
                sem precisar de mensagens extras.
              </li>
              <li>
                <strong>Calendário ao vivo:</strong>{' '}
                Veja as datas livres na hora da busca. A agenda é atualizada em tempo real direto
                pelos proprietários.
              </li>
              <li>
                <strong>Personalize seu passeio:</strong>{' '}
                Adicione serviços como marinheiro, bebidas e equipamentos de mergulho com apenas
                um clique, na mesma reserva.
              </li>
              <li>
                <strong>Cancelamento sem dor de cabeça:</strong>{' '}
                Regras de cancelamento claras antes do pagamento — inclusive para imprevistos com
                o clima.
              </li>
              <li>
                <strong>Pagamento 100% seguro:</strong>{' '}
                Seu dinheiro fica protegido pela nossa plataforma e só é repassado ao proprietário
                após a realização do embarque.
              </li>
            </ul>
          </section>

          {/* CTA final */}
          <div className="rounded-2xl bg-[#0B2447] text-center px-6 py-10 sm:px-12">
            <p className="text-white text-lg font-semibold italic">
              Pronto para viver o auge do verão catarinense?
            </p>
            <p className="mt-3 text-slate-300">
              Acesse a busca do Boatzy, reserve a lancha ideal para a sua tripulação e prepare-se
              para um dia inesquecível na Praia do Tinguá!
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
