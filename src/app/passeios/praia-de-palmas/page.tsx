import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Águas de Padrão Internacional: Navegando pela Praia e Ilha de Palmas — Boatzy',
  description:
    'Explore a Ilha de Palmas de barco. Um roteiro focado em natureza preservada e mergulho em águas cristalinas na mesma baía da Praia de Palmas, com padrão Bandeira Azul.',
};

const headingClass = 'text-2xl sm:text-3xl font-bold text-[#0B2447]';
const bulletListClass = 'mt-4 space-y-3 list-disc pl-5';

export default function PraiaDePalmasPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-white">
        {/* Hero */}
        <section className="relative h-[50vh] min-h-[360px] flex items-end">
          <Image
            src="/images/passeios/praia-de-palmas.png"
            alt="Vista aérea da Praia de Palmas, em Governador Celso Ramos"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B2447]/90 via-[#0B2447]/30 to-transparent" />
          <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
            <h1 className="text-2xl sm:text-4xl font-bold text-white leading-tight">
              Águas de Padrão Internacional: Navegando pela Praia e Ilha de Palmas
            </h1>
          </div>
        </section>

        {/* Conteúdo */}
        <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 text-slate-700 leading-relaxed space-y-8">
          <p>
            Para quem deseja fugir do trânsito intenso e mergulhar em um cenário de natureza
            intocada, a Ilha de Palmas, em Governador Celso Ramos, é a experiência definitiva.
            Localizada bem de frente para a extensa e famosa Praia de Palmas, a ilha é um
            verdadeiro santuário ecológico no litoral catarinense e parada obrigatória para quem
            busca excelência náutica.
          </p>

          <section>
            <h2 className={headingClass}>O Selo Bandeira Azul e as Águas Cristalinas</h2>
            <p className="mt-4">
              Um detalhe fascinante sobre essa região é a excepcional qualidade do seu mar. A
              Praia de Palmas, logo em frente à ilha, já ostentou o rigoroso selo internacional
              &quot;Bandeira Azul&quot;. Essa é uma das certificações ambientais mais cobiçadas do
              mundo, atestando a altíssima pureza, segurança e a balneabilidade da água.
            </p>
            <p className="mt-4">
              Na prática, navegar e ancorar ao redor da Ilha de Palmas significa mergulhar nessas
              exatas águas cristalinas, compartilhando a mesma baía de padrão internacional. É uma
              garantia de que o seu banho de mar será feito em um dos ambientes mais preservados
              de todo o Sul do Brasil.
            </p>
          </section>

          <section>
            <h2 className={headingClass}>A Verdadeira Experiência de um Navegador</h2>
            <p className="mt-4">
              Sair da posição de turista e se tornar um Navegador ao alugar um barco particular
              permite que você explore os recantos mais escondidos desta ilha desabitada. Você
              foge da lotação das areias e ganha o seu próprio deck flutuante privativo. É o local
              perfeito para praticar snorkel, observar a rica vida marinha entre os costões
              rochosos e curtir a tranquilidade ouvindo apenas o som do mar.
            </p>
          </section>

          <section>
            <h2 className={headingClass}>Por que escolher o Boatzy?</h2>
            <p className="mt-4">
              Planejar o seu roteiro para a Ilha de Palmas precisa ser tão relaxante quanto o
              passeio em si. Ao utilizar a plataforma Boatzy, você garante a melhor experiência de
              reserva do mercado:
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
              Pronto para desbravar águas de padrão internacional?
            </p>
            <p className="mt-3 text-slate-300">
              Acesse a busca do Boatzy, encontre o barco perfeito para o seu grupo e prepare-se
              para um dia inesquecível de conexão com a natureza!
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
