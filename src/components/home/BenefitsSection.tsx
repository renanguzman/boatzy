import Link from 'next/link';
import Image from 'next/image';
import { Tag, Images, CalendarClock, SlidersHorizontal, CalendarX2, ShieldCheck, ArrowRight } from 'lucide-react';

const BENEFICIOS = [
  {
    icon: Tag,
    titulo: 'Transparência no preço',
    descricao: 'O valor da tela é o preço final. Sem taxas surpresas ou letras miúdas na hora de pagar.',
  },
  {
    icon: Images,
    titulo: 'Tudo sobre o barco em um só lugar',
    descricao: 'Acesso imediato a fotos, capacidade, comodidades e perfil do dono — sem precisar de mensagens extras.',
  },
  {
    icon: CalendarClock,
    titulo: 'Calendário ao vivo',
    descricao: 'Veja as datas livres na hora da busca. A agenda é atualizada em tempo real direto pelos proprietários.',
  },
  {
    icon: SlidersHorizontal,
    titulo: 'Personalize seu passeio',
    descricao: 'Adicione serviços como bebidas, gelo e equipamentos de mergulho com um clique, na mesma reserva.',
  },
  {
    icon: CalendarX2,
    titulo: 'Cancelamento sem dor de cabeça',
    descricao: 'Regras de cancelamento claras antes do pagamento — inclusive para imprevistos com o clima.',
  },
  {
    icon: ShieldCheck,
    titulo: 'Pagamento protegido',
    descricao: 'Seu dinheiro fica protegido pela plataforma e só é repassado ao proprietário após o passeio.',
  },
];

export default function BenefitsSection() {
  return (
    <section className="py-16 bg-white" id="benefits-section">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl overflow-hidden">
          {/* Background */}
          <div className="absolute inset-0">
            <Image
              src="/images/benefits-bg.png"
              alt=""
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0B2447]/95 via-[#0B2447]/92 to-[#0B2447]/95" />
          </div>

          <div className="relative z-10 p-8 md:p-12 lg:p-16">
            {/* Header */}
            <div className="max-w-2xl mx-auto text-center mb-10 md:mb-12">
              <p className="text-xs font-semibold text-cyan-300 uppercase tracking-widest mb-2">
                Por que reservar com o Boatzy
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
                Alugar um barco{' '}
                <span className="bg-gradient-to-r from-cyan-300 to-teal-300 bg-clip-text text-transparent">
                  nunca foi tão simples
                </span>
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                Da busca ao desembarque, cada etapa foi pensada para ser clara, rápida e sem surpresas.
              </p>
            </div>

            {/* Benefits Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mb-10">
              {BENEFICIOS.map(({ icon: Icon, titulo, descricao }) => (
                <div
                  key={titulo}
                  className="group rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 hover:bg-white/10 hover:border-cyan-300/30 transition-all"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-12 w-12 shrink-0 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center group-hover:from-cyan-500/30 group-hover:to-teal-500/30 transition-colors">
                      <Icon className="h-6 w-6 text-cyan-300" />
                    </div>
                    <p className="text-white text-lg font-semibold leading-snug">{titulo}</p>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">{descricao}</p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="flex justify-center">
              <Link
                href="/buscar"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white font-semibold text-sm px-8 py-3 rounded-xl transition-all hover:shadow-lg hover:shadow-cyan-500/25 hover:scale-[1.02] active:scale-[0.98]"
                id="benefits-cta"
              >
                Buscar embarcações
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
