import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Roteiro de Barco para a Ilha do Campeche — Boatzy',
  description:
    'Descubra o "Caribe Brasileiro": roteiro exclusivo de barco para a Ilha do Campeche.',
};

const headingClass = 'text-2xl sm:text-3xl font-bold text-[#0B2447]';
const bulletListClass = 'mt-4 space-y-3 list-disc pl-5';

export default function IlhaDoCampechePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-white">
        {/* Hero */}
        <section className="relative h-[50vh] min-h-[360px] flex items-end">
          <Image
            src="/images/passeios/ilha-do-campeche.jpg"
            alt="Ilha do Campeche"
            fill
            priority
            className="object-cover object-[center_20%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B2447]/90 via-[#0B2447]/30 to-transparent" />
          <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
            <h1 className="text-2xl sm:text-4xl font-bold text-white leading-tight">
              Descubra o &quot;Caribe Brasileiro&quot;: Roteiro Exclusivo de Barco para a Ilha do
              Campeche
            </h1>
          </div>
        </section>

        {/* Conteúdo */}
        <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 text-slate-700 leading-relaxed space-y-8">
          <div className="space-y-4">
            <p>
              Se você está planejando sua viagem para Florianópolis, com certeza já ouviu falar de
              um lugar onde a areia é incrivelmente branca e a água do mar exibe tons de azul e
              verde turquesa que parecem ter saído de um filtro de Instagram. Estamos falando da{' '}
              <em>Ilha do Campeche</em>, carinhosamente — e justamente — apelidada de{' '}
              &quot;Caribe Brasileiro&quot;.
            </p>
            <p>
              Localizada no sul de Florianópolis, de frente para a Praia do Campeche, a ilha é uma
              reserva natural tombada pelo IPHAN (Instituto do Patrimônio Histórico e Artístico
              Nacional), abrigando não apenas uma natureza exuberante, mas também um dos maiores
              acervos de inscrições rupestres do litoral brasileiro.
            </p>
            <p>
              Mas a grande dúvida de quem visita a cidade é:{' '}
              <em>qual é a melhor forma de chegar e aproveitar esse paraíso?</em>
            </p>
          </div>

          <section>
            <h2 className={headingClass}>O problema do acesso tradicional</h2>
            <p className="mt-4">
              O acesso à Ilha do Campeche é limitado para preservar a natureza local. A maioria dos
              turistas acaba optando por transportes tradicionais (como escunas e botes infláveis)
              que partem da Praia da Armação, Barra da Lagoa ou da própria Praia do Campeche.
            </p>
            <p className="mt-4">
              O problema? Esse método costuma envolver acordar de madrugada, enfrentar longas
              filas, dividir o espaço com dezenas de desconhecidos e, o pior de tudo: ficar
              engessado aos horários rígidos de ida e volta estipulados pelas associações de
              barcos.
            </p>
          </section>

          {/* Imagem no meio do artigo */}
          <figure className="relative w-full h-72 sm:h-96 rounded-2xl overflow-hidden">
            <Image
              src="/images/passeios/ilha-do-campeche_01.JPG"
              alt="Barcos ancorados nas águas turquesa da Ilha do Campeche"
              fill
              className="object-cover"
            />
          </figure>

          <section>
            <h2 className={headingClass}>
              A Experiência Premium: Chegando à Ilha do Campeche de Lancha Particular
            </h2>
            <p className="mt-4">
              Para quem deseja transformar um simples passeio em uma lembrança inesquecível de
              luxo e conforto, o <em>aluguel de uma lancha particular</em> é a escolha definitiva.
            </p>
            <p className="mt-4">
              Ao reservar um barco, você deixa de ser apenas um turista e passa a ser o que
              chamamos de <em>Navegador</em>. Como um verdadeiro Navegador, você tem a liberdade de
              ditar o ritmo do seu dia. Imagine embarcar com a sua família ou grupo de amigos em
              uma lancha só para vocês, com uma infraestrutura completa, navegando pelas águas do
              sul da ilha até a chegada triunfal na Ilha do Campeche.
            </p>
            <p className="mt-4">
              Ao invés de desembarcar nas areias lotadas, o seu Comandante ancorará em um ponto
              estratégico de águas calmas. Você terá o seu próprio &quot;deck flutuante&quot; para
              tomar sol, mergulhar com exclusividade e ouvir a sua própria música, longe da
              agitação.
            </p>
          </section>

          <section>
            <h2 className={headingClass}>Por que reservar o seu passeio com o Boatzy?</h2>
            <p className="mt-4">
              Planejar esse roteiro nunca foi tão fácil. O Boatzy foi desenhado para conectar você
              aos melhores barcos de Florianópolis com a mesma facilidade de reservar um hotel. Ao
              escolher a nossa plataforma, você garante:
            </p>
            <ul className={bulletListClass}>
              <li>
                <strong>Transparência total no preço:</strong> O valor que aparece na sua tela é o
                preço final, sem taxas surpresas ou letras miúdas no momento do checkout.
              </li>
              <li>
                <strong>Tudo sobre o barco em um só lugar:</strong> Você tem acesso imediato às
                fotos da embarcação, capacidade máxima, comodidades inclusas e o perfil do dono do
                barco.
              </li>
              <li>
                <strong>Calendário ao vivo:</strong> Você pode visualizar as datas livres no exato
                momento da busca, pois a agenda é atualizada em tempo real.
              </li>
              <li>
                <strong>Personalização:</strong> Na mesma reserva, você pode adicionar serviços
                extras com apenas um clique, como um marinheiro experiente ou equipamentos de
                mergulho.
              </li>
              <li>
                <strong>Segurança financeira:</strong> O pagamento é 100% seguro; o seu dinheiro
                fica protegido pela nossa plataforma e só é repassado ao proprietário após o
                embarque.
              </li>
            </ul>
          </section>

          <section>
            <h2 className={headingClass}>O que fazer durante o seu dia de barco?</h2>
            <p className="mt-4">Ao ancorar na Ilha do Campeche, as opções são variadas:</p>
            <ol className="mt-4 space-y-3 list-decimal pl-5">
              <li>
                <strong>Mergulho com Snorkel:</strong> As águas transparentes e os costões rochosos
                da ilha são perfeitos para observar peixinhos coloridos, tartarugas e a rica vida
                marinha. Muitos barcos no Boatzy já incluem os equipamentos!
              </li>
              <li>
                <strong>Churrasco a bordo:</strong> Diversas lanchas disponíveis na plataforma
                contam com churrasqueira. Leve suas carnes e bebidas favoritas e aproveite um
                almoço premium em alto mar.
              </li>
              <li>
                <strong>Trilhas Guiadas:</strong> Se quiser pisar em terra firme, você pode
                desembarcar na praia e contratar os monitores ambientais locais para fazer trilhas
                pela Mata Atlântica e conhecer as inscrições rupestres milenares.
              </li>
            </ol>
          </section>

          <section>
            <h2 className={headingClass}>Dicas de Ouro para o seu passeio</h2>
            <ul className={bulletListClass}>
              <li>
                <strong>Antecedência é fundamental:</strong> A Ilha do Campeche é o destino número
                um de Floripa no verão. Acesse o Boatzy e garanta o seu barco com semanas de
                antecedência para os meses de dezembro a março.
              </li>
              <li>
                <strong>Condições do vento:</strong> O sul da ilha pode sofrer influência do vento
                Sul. Caso o mar não esteja favorável no dia reservado, não se preocupe! O Boatzy
                oferece regras de <em>cancelamento sem dor de cabeça</em> para imprevistos com o
                clima. Nesses casos, os passeios costumam ser redirecionados para a Baía Norte, que
                é super abrigada e igualmente linda.
              </li>
              <li>
                <strong>Saia cedo:</strong> Para aproveitar o mar mais calmo e garantir os melhores
                pontos de ancoragem (que são limitados pela Marinha), agende sua saída para as 9h
                da manhã.
              </li>
            </ul>
          </section>

          {/* CTA final */}
          <div className="rounded-2xl bg-[#0B2447] text-center px-6 py-10 sm:px-12">
            <p className="text-white text-lg font-semibold italic">
              Pronto para viver o melhor dia do seu verão?
            </p>
            <p className="mt-3 text-slate-300">
              Acesse a busca do Boatzy, escolha a lancha que mais combina com o seu grupo e
              prepare-se para descobrir o Caribe Brasileiro do jeito que você merece. Boa
              navegação!
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
