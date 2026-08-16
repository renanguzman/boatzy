import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Compass, Ship, Sparkles, Waves, ShieldCheck, ArrowRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Sobre o Boatzy — aluguel de embarcações sem complicação',
  description:
    'O Boatzy nasceu em Florianópolis para profissionalizar o aluguel de embarcações no Brasil: reserva online, preço claro e segurança para os dois lados.',
};

const headingClass = 'text-2xl sm:text-3xl md:text-4xl font-bold text-[#0B2447] leading-tight';
const proseClass = 'mt-6 space-y-5 text-slate-600 leading-relaxed text-base sm:text-lg';

const PRINCIPIOS = [
  {
    icon: Sparkles,
    titulo: 'Simplicidade',
    texto:
      'Reservar uma embarcação deve ser tão simples quanto reservar uma estadia. Se o usuário precisa de uma ligação para entender, o produto falhou.',
  },
  {
    icon: Waves,
    titulo: 'Acesso',
    texto:
      'O mar não é privilégio de quem tem barco. A plataforma foi construída para atender do passeio de uma hora ao fim de semana a bordo, com opções para diferentes públicos e orçamentos.',
  },
  {
    icon: ShieldCheck,
    titulo: 'Confiança',
    texto:
      'Proprietários verificados, pagamento protegido e suporte disponível. Em um marketplace, confiança não é diferencial — é o produto.',
  },
];

export default function SobrePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-white">
        {/* Hero */}
        <section className="relative min-h-[60vh] flex items-center">
          <Image
            src="/images/hero-yacht.png"
            alt="Iate navegando ao entardecer"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B2447]/95 via-[#0B2447]/75 to-[#0B2447]/40" />
          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
            <div className="max-w-2xl">
              <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
                Tornar o mar acessível.
              </h1>
              <p className="mt-6 text-lg text-slate-200 leading-relaxed">
                O Boatzy é a plataforma que conecta quem quer navegar a quem tem embarcação.
                Reserva online, preço claro e segurança para os dois lados — do jetski de uma hora
                ao iate de fim de semana.
              </p>
            </div>
          </div>
        </section>

        {/* Seção 1 */}
        <section className="py-16 md:py-24 bg-white">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h2 className={headingClass}>
              Nasceu em Florianópolis, onde o mar faz parte da rotina.
            </h2>
            <div className={proseClass}>
              <p>
                Florianópolis vive em torno da água. São marinas, rampas, trapiches e uma
                temporada náutica que movimenta a cidade inteira. Mesmo assim, alugar uma
                embarcação aqui sempre dependeu de conhecer alguém.
              </p>
              <p>
                O mercado funcionava, mas funcionava de forma informal: preço combinado por
                mensagem, disponibilidade confirmada na base do &quot;deixa eu ver&quot;,
                pagamento sem garantia para nenhuma das partes e nenhuma referência sobre quem
                estava do outro lado.
              </p>
              <p>
                Para quem queria navegar, isso significava não saber por onde começar. Para quem
                tinha embarcação, significava administrar a locação nas brechas do dia — e ver o
                barco parado na maior parte do ano.
              </p>
              <p>
                Enquanto reservar uma hospedagem, um carro ou um voo virou questão de minutos,
                alugar uma embarcação continuou sendo uma negociação.
              </p>
              <p>
                O Boatzy existe para fechar essa distância: trazer ao mercado náutico o padrão que
                o cliente já espera de qualquer serviço digital — transparência, praticidade e
                segurança.
              </p>
            </div>
          </div>
        </section>

        {/* Seção 2 */}
        <section className="py-16 md:py-24 bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className={`${headingClass} text-center`}>Dois lados, uma plataforma.</h2>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
                <div className="h-12 w-12 rounded-xl bg-[#0B3D91]/10 flex items-center justify-center mb-5">
                  <Compass className="h-6 w-6 text-[#0B3D91]" />
                </div>
                <h3 className="text-lg font-bold text-[#0B2447] mb-3">Para quem quer navegar</h3>
                <p className="text-slate-600 leading-relaxed">
                  Você compara embarcações, vê o preço final, conhece o proprietário e lê a
                  avaliação de quem já foi — tudo antes de decidir. Reserva pela plataforma, com
                  pagamento protegido, e aparece na hora combinada. O resto do dia é seu.
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
                <div className="h-12 w-12 rounded-xl bg-[#0B3D91]/10 flex items-center justify-center mb-5">
                  <Ship className="h-6 w-6 text-[#0B3D91]" />
                </div>
                <h3 className="text-lg font-bold text-[#0B2447] mb-3">Para quem tem embarcação</h3>
                <p className="text-slate-600 leading-relaxed">
                  Seu barco rendendo, sem dor de cabeça. Você define preço e disponibilidade, e
                  decide quem sobe a bordo. O Boatzy cuida da divulgação, da reserva, do pagamento
                  e do relacionamento com o cliente. Nada de negociar por mensagem em três grupos
                  diferentes.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Seção 3 */}
        <section className="py-16 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative rounded-3xl overflow-hidden">
              <div className="absolute inset-0">
                <Image src="/images/benefits-bg.png" alt="" fill className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-[#0B2447]/95 via-[#0B2447]/92 to-[#0B2447]/95" />
              </div>

              <div className="relative z-10 p-8 md:p-12 lg:p-16">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white text-center mb-12">
                  O que nos guia.
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {PRINCIPIOS.map(({ icon: Icon, titulo, texto }) => (
                    <div
                      key={titulo}
                      className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6"
                    >
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center mb-4">
                        <Icon className="h-5 w-5 text-cyan-300" />
                      </div>
                      <p className="text-white text-base font-semibold mb-2">{titulo}</p>
                      <p className="text-slate-300 text-sm leading-relaxed">{texto}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Seção 4 */}
        <section className="py-16 md:py-24 bg-white">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h2 className={headingClass}>
              Começamos por Florianópolis. Não pretendemos parar aqui.
            </h2>
            <div className={proseClass}>
              <p>
                A escolha do primeiro mercado foi deliberada. Um marketplace náutico se sustenta
                na qualidade da oferta, e qualidade se constrói perto — conhecendo as marinas, as
                embarcações e os proprietários um a um.
              </p>
              <p>
                A plataforma, no entanto, foi desenhada desde o início para escalar. O modelo de
                verificação, o fluxo de reserva e a estrutura de pagamento funcionam da mesma
                forma em qualquer cidade litorânea, e a expansão pelo Brasil já está no plano.
              </p>
              <p className="font-semibold text-[#0B2447]">
                O objetivo é simples de enunciar e exigente de executar: tornar o Boatzy a forma
                padrão de alugar uma embarcação no Brasil.
              </p>
            </div>
          </div>
        </section>

        {/* Chamada final */}
        <section className="py-16 md:py-24 bg-[#0B2447]">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-12">Vem com a gente.</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8 flex flex-col">
                <p className="text-white text-lg font-medium leading-snug flex-1">
                  O próximo dia bom já tem data. Falta o barco.
                </p>
                <Link
                  href="/buscar"
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-slate-100 text-[#0B2447] text-sm font-semibold px-6 py-3 transition-colors"
                >
                  Ver embarcações
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8 flex flex-col">
                <p className="text-white text-lg font-medium leading-snug flex-1">
                  Sua embarcação pode trabalhar nos dias em que fica parada.
                </p>
                <Link
                  href="/painel"
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white text-sm font-semibold px-6 py-3 transition-all"
                >
                  Quero anunciar
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <p className="mt-12 text-sm text-slate-400">
              Dúvidas, sugestões ou parcerias:{' '}
              <a href="mailto:adm@boatzy.app" className="text-slate-300 underline hover:text-white">
                adm@boatzy.app
              </a>
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
