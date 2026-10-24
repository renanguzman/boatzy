import Link from 'next/link';
import { ReceiptText, ShieldCheck, CloudSunRain, CalendarCheck2, ArrowRight } from 'lucide-react';
import MontagemAoRolar from '@/components/ui/MontagemAoRolar';

// Quatro garantias, texto curto: o ícone ilustra o assunto de cada uma.
const BENEFICIOS = [
  {
    icon: ReceiptText,
    titulo: 'Preço final, sem surpresa',
    descricao: 'O valor que você vê na tela é o que você paga. Sem taxas escondidas.',
  },
  {
    icon: ShieldCheck,
    titulo: 'Pagamento protegido',
    descricao: 'Seu dinheiro só é repassado ao dono do barco depois do passeio.',
  },
  {
    icon: CloudSunRain,
    titulo: 'Cancelamento sem drama',
    descricao: 'Regras claras antes de pagar, inclusive para dias de mau tempo.',
  },
  {
    icon: CalendarCheck2,
    titulo: 'Agenda de verdade',
    descricao: 'Datas atualizadas pelos donos. Viu livre, pode reservar.',
  },
];

// Estados inicial → montado das peças (transições disparadas por MontagemAoRolar).
const ENTRA_DA_ESQUERDA =
  'opacity-0 -translate-x-8 group-data-[montado=true]/montagem:opacity-100 group-data-[montado=true]/montagem:translate-x-0';
const SOBE =
  'opacity-0 translate-y-6 group-data-[montado=true]/montagem:opacity-100 group-data-[montado=true]/montagem:translate-y-0';
const TRANSICAO = 'transition-all duration-700 ease-out motion-reduce:transition-none';

export default function BenefitsSection() {
  return (
    <section className="py-16 bg-white overflow-hidden" id="benefits-section">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <MontagemAoRolar>
          {/* Bloco do título (o card se encaixa sobre a parte de baixo dele) */}
          <div className={`relative rounded-3xl bg-gradient-to-br from-turquesa/10 to-marinho/[0.06] px-6 pt-8 pb-20 md:px-10 md:pt-10 md:pb-24 lg:w-[46%] ${TRANSICAO} ${ENTRA_DA_ESQUERDA}`}>
            <p className="text-xs font-semibold text-turquesa-escuro uppercase tracking-widest mb-2">
              Por que reservar com o Boatzy
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-marinho leading-tight">
              Navegue com{' '}
              <span className="bg-gradient-to-r from-marinho to-turquesa bg-clip-text text-transparent">
                tranquilidade
              </span>
            </h2>
            <Link
              href="/buscar"
              className="group mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-marinho hover:text-turquesa-escuro transition-colors"
              id="benefits-cta"
            >
              Encontre seu roteiro
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Card das garantias */}
          <div
            className={`relative -mt-12 md:-mt-14 mx-2 md:mx-0 lg:ml-[12%] rounded-3xl bg-white ring-1 ring-slate-100 shadow-[0_24px_60px_-24px_rgba(11,36,71,0.28)] p-6 md:p-10 delay-150 ${TRANSICAO} ${SOBE}`}
          >
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-10">
              {BENEFICIOS.map(({ icon: Icone, titulo, descricao }, i) => (
                <li key={titulo} className={`flex gap-4 sm:block ${TRANSICAO} ${SOBE}`} style={{ transitionDelay: `${350 + i * 110}ms` }}>
                  {/* Ícone de traço sobre um círculo de destaque: centralizado nele
                      com o mesmo leve deslocamento em todos (não depende do desenho) */}
                  <div className="relative h-11 w-11 shrink-0 sm:mb-4 flex items-center justify-center">
                    <span
                      aria-hidden
                      className="absolute inset-1 translate-x-1 translate-y-1 rounded-full bg-gradient-to-br from-turquesa/35 to-turquesa/15 scale-0 group-data-[montado=true]/montagem:scale-100 transition-transform duration-500 ease-out motion-reduce:transition-none"
                      style={{ transitionDelay: `${500 + i * 110}ms` }}
                    />
                    <Icone aria-hidden className="relative h-8 w-8 text-marinho" strokeWidth={1.6} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-marinho leading-snug">{titulo}</h3>
                    <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{descricao}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </MontagemAoRolar>
      </div>
    </section>
  );
}
