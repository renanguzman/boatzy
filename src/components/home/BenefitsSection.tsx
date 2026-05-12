import Image from 'next/image';
import { CheckCircle, Gift, Crown } from 'lucide-react';

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
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B2447]/95 via-[#0B2447]/80 to-[#0B2447]/40" />
          </div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 p-8 md:p-12 lg:p-16">
            {/* Content */}
            <div className="flex flex-col justify-center">
              <p className="text-xs font-semibold text-cyan-300 uppercase tracking-widest mb-2">
                Membro Exclusivo
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
                Clube de Vantagens{' '}
                <span className="bg-gradient-to-r from-cyan-300 to-teal-300 bg-clip-text text-transparent">
                  Boatzy
                </span>
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed mb-8 max-w-md">
                Entre para o nosso clube de vantagens e tenha acesso a descontos exclusivos, 
                embarcações premium e experiências únicas que você não encontra em nenhum outro lugar.
              </p>

              {/* Benefits List */}
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle className="h-3.5 w-3.5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Descontos Exclusivos</p>
                    <p className="text-slate-400 text-xs">Até 30% off em embarcações selecionadas</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Gift className="h-3.5 w-3.5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Experiências VIP</p>
                    <p className="text-slate-400 text-xs">Acesso a eventos e experiências exclusivas</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Crown className="h-3.5 w-3.5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Prioridade de Reserva</p>
                    <p className="text-slate-400 text-xs">Reserve antes de todos os outros usuários</p>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <button
                className="self-start bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white font-semibold text-sm px-8 py-3 rounded-xl transition-all hover:shadow-lg hover:shadow-cyan-500/25 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                id="benefits-cta"
              >
                Assine Agora
              </button>
            </div>

            {/* Right Image */}
            <div className="hidden lg:flex items-center justify-center">
              <div className="relative w-full h-80 rounded-2xl overflow-hidden">
                <Image
                  src="/images/charter-2.png"
                  alt="Luxury yacht experience"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B2447]/40 to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
