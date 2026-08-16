import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'O Destino Mais Badalado do Litoral: Roteiro Náutico para o Caixa D\'Aço — Boatzy',
  description:
    'Descubra como aproveitar a famosa enseada do Caixa D\'Aço alugando uma lancha. O roteiro perfeito de festa e natureza (onde foi gravado "Ai Se Eu Te Pego") saindo de Floripa ou BC.',
};

const headingClass = 'text-2xl sm:text-3xl font-bold text-[#0B2447]';
const bulletListClass = 'mt-4 space-y-3 list-disc pl-5';

export default function CaixaDAcoPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-white">
        {/* Hero */}
        <section className="relative h-[50vh] min-h-[360px] flex items-end">
          <Image
            src="/images/passeios/caixa-d-aco.png"
            alt="Vista aérea da enseada do Caixa D'Aço, em Porto Belo"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B2447]/90 via-[#0B2447]/30 to-transparent" />
          <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
            <h1 className="text-2xl sm:text-4xl font-bold text-white leading-tight">
              O Destino Mais Badalado do Litoral: Roteiro Náutico para o Caixa D&apos;Aço
            </h1>
          </div>
        </section>

        {/* Conteúdo */}
        <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 text-slate-700 leading-relaxed space-y-8">
          <div className="space-y-4">
            <p>
              Se existe um lugar no litoral de Santa Catarina onde o agito se encontra
              perfeitamente com a natureza intocada, esse lugar é a enseada do Caixa D&apos;Aço,
              localizada no município de Porto Belo.
            </p>
            <p>
              Cercada por uma Mata Atlântica exuberante e protegida dos ventos fortes, a baía de
              águas calmas e esmeraldas atrai embarcações de todos os tamanhos. Por estar
              estrategicamente posicionada, é um dos destinos mais cobiçados tanto para quem parte
              das marinas de Florianópolis quanto de Balneário Camboriú.
            </p>
          </div>

          <section>
            <h2 className={headingClass}>
              A Magia dos Bares Flutuantes (E o cenário de &quot;Ai Se Eu Te Pego&quot;)
            </h2>
            <p className="mt-4">
              O grande charme do Caixa D&apos;Aço são os famosos &quot;bares flutuantes&quot;. É o
              cenário ideal para quem busca diversão, música, bons drinks e a oportunidade de
              socializar com dezenas de outros barcos que ancoram lado a lado durante a alta
              temporada.
            </p>
            <p className="mt-4">
              A energia e o visual da enseada são tão únicos que o local foi escolhido como
              cenário para a gravação do clipe <em>&quot;Ai Se Eu Te Pego&quot;</em>, do cantor
              Michel Teló, gravado exatamente em um desses bares flutuantes e que se tornou um hit
              global!
            </p>
          </section>

          {/* Imagem no meio do artigo */}
          <figure className="relative w-full h-72 sm:h-96 rounded-2xl overflow-hidden">
            <Image
              src="/images/passeios/caixa-d-aco-02.png"
              alt="Bar flutuante com banda ao vivo e banhistas no Caixa D'Aço"
              fill
              className="object-cover"
            />
          </figure>

          <section>
            <h2 className={headingClass}>A Experiência VIP: O Caixa D&apos;Aço de Lancha</h2>
            <p className="mt-4">
              A verdadeira experiência do Caixa D&apos;Aço só acontece na água. Ao alugar uma
              lancha particular, você deixa de ser apenas um espectador e se torna um verdadeiro{' '}
              <em>Navegador</em>.
            </p>
            <p className="mt-4">
              Chegar de lancha permite que você ancore com segurança bem próximo à estrutura dos
              bares flutuantes, pedindo porções de frutos do mar e bebidas exclusivas que são
              entregues diretamente no deck do seu barco. Você tem a liberdade de curtir a festa
              no seu próprio ritmo, com a sua própria playlist tocando no sistema de som da
              embarcação, e mergulhar nas águas refrescantes a qualquer momento.
            </p>
            <ul className={bulletListClass}>
              <li>
                <strong>Dica de Ouro:</strong>{' '}
                O trajeto a partir de Floripa ou Balneário Camboriú já é um espetáculo à parte,
                passando por praias paradisíacas. Saia cedo para garantir o melhor ponto de
                ancoragem no Caixa D&apos;Aço, pois a enseada costuma lotar nos finais de semana de
                sol.
              </li>
              <li>
                <strong>Ideal para:</strong> Despedidas de solteiro(a), grupos de amigos animados,
                confraternizações e quem busca ver e ser visto.
              </li>
            </ul>
          </section>

          {/* Imagem no meio do artigo */}
          <figure className="relative w-full h-72 sm:h-96 rounded-2xl overflow-hidden">
            <Image
              src="/images/passeios/caixa-d-aco-01.png"
              alt="Dezenas de barcos ancorados lado a lado na enseada do Caixa D'Aço"
              fill
              className="object-cover"
            />
          </figure>

          <section>
            <h2 className={headingClass}>Por que escolher o Boatzy para essa aventura?</h2>
            <p className="mt-4">
              Planejar o seu roteiro para o Caixa D&apos;Aço precisa ser tão relaxante quanto o
              passeio em si. Ao utilizar a plataforma Boatzy, você garante a melhor experiência de
              reserva do mercado:
            </p>
            <ul className={bulletListClass}>
              <li>
                <strong>Transparência total no preço:</strong> O valor da tela é o preço final.
                Sem taxas surpresas ou letras miúdas na hora de pagar.
              </li>
              <li>
                <strong>Tudo sobre o barco em um só lugar:</strong> Acesso imediato a fotos,
                capacidade, comodidades e perfil do dono. Tudo na mão, sem precisar de mensagens
                extras.
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
              Pronto para viver o auge do verão catarinense?
            </p>
            <p className="mt-3 text-slate-300">
              Acesse a busca do Boatzy, reserve a lancha ideal para a sua tripulação e prepare-se
              para um dia inesquecível no Caixa D&apos;Aço!
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
