import { Tag, ShieldCheck, CalendarX2, CalendarClock } from 'lucide-react';

// Mesmos 4 conceitos (e ícones) mais relevantes do BenefitsSection ("Por que
// reservar com o Boatzy"), priorizados aqui como selos rápidos de confiança
// logo abaixo do hero — antes mesmo do usuário começar a busca.
const features = [
  {
    icon: Tag,
    title: 'Transparência no preço',
    description: 'O valor da tela é o preço final',
  },
  {
    icon: ShieldCheck,
    title: 'Pagamento protegido',
    description: 'Só repassado ao dono após o passeio',
  },
  {
    icon: CalendarX2,
    title: 'Cancelamento sem dor de cabeça',
    description: 'Regras claras, inclusive por clima',
  },
  {
    icon: CalendarClock,
    title: 'Calendário ao vivo',
    description: 'Disponibilidade real, sempre atualizada',
  },
];

export default function TrustBadges() {
  return (
    <section className="bg-white py-10 border-b border-slate-100" id="trust-badges">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="flex flex-col items-center text-center gap-3 group"
            >
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#0B3D91]/10 to-cyan-500/10 flex items-center justify-center group-hover:from-[#0B3D91]/20 group-hover:to-cyan-500/20 transition-colors">
                <feature.icon className="h-5 w-5 text-[#0B3D91]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  {feature.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
