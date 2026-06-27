import Image from 'next/image';
import Link from 'next/link';
import {
  Star,
  Users,
  Bed,
  Ruler,
  Shield,
  BadgeCheck,
  ChevronLeft,
  Heart,
  Share2,
  Camera,
  Award,
  Headphones,
  ShieldCheck,
} from 'lucide-react';
import { topRatedBoats, featuredCharters, sampleReviews } from '@/lib/mock-data';
import { formatCurrency } from '@/lib/utils';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function BoatDetailPage({ params }: any) {
  const { id } = await params;
  const allBoats = [...topRatedBoats, ...featuredCharters];
  const boat = allBoats.find((b) => b.id === id) || allBoats[0];

  const packages = [
    { name: 'Marinheiro Profissional', price: 250, icon: '⚓', description: 'Tripulação adicional' },
    { name: 'Churrasco Gourmet', price: 180, icon: '🔥', description: 'Chef especializado a bordo' },
    { name: 'Músico ao Vivo', price: 450, icon: '🎵', description: 'Artista durante o passeio' },
    { name: 'Kit Watersports', price: 320, icon: '🏄', description: 'Jet ski, caiaque e SUP' },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Image Gallery */}
      <section className="relative" id="boat-gallery">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 h-[300px] md:h-[450px]">
            {/* Main Image */}
            <div className="lg:col-span-2 relative rounded-2xl overflow-hidden">
              <Image
                src={boat.images[0]}
                alt={boat.name}
                fill
                className="object-cover"
                priority
              />
              <button className="absolute top-4 left-4 h-10 w-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors">
                <Link href="/">
                  <ChevronLeft className="h-5 w-5 text-slate-700" />
                </Link>
              </button>
            </div>

            {/* Side Images */}
            <div className="hidden lg:grid grid-rows-2 gap-3">
              <div className="relative rounded-2xl overflow-hidden">
                <Image
                  src="/images/yacht-card-2.png"
                  alt="Interior view"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="relative rounded-2xl overflow-hidden">
                <Image
                  src="/images/yacht-card-3.png"
                  alt="Deck view"
                  fill
                  className="object-cover"
                />
                <button className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm text-slate-800 text-xs font-medium px-4 py-2 rounded-lg flex items-center gap-1.5 hover:bg-white transition-colors">
                  <Camera className="h-3.5 w-3.5" />
                  Ver todas fotos
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="pb-16" id="boat-content">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Content */}
            <div className="lg:col-span-2">
              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {boat.badges?.map((badge, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 bg-[#0B3D91]/10 text-[#0B3D91] text-xs font-semibold px-3 py-1.5 rounded-full"
                  >
                    <Award className="h-3 w-3" />
                    {badge}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {boat.rating} ({boat.reviewCount} reviews)
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full">
                  <BadgeCheck className="h-3 w-3" />
                  Embarcação Verificada
                </span>
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-4xl font-bold text-[#0B2447] mb-3">
                The {boat.name}
              </h1>
              <p className="text-slate-600 text-sm leading-relaxed mb-8 max-w-2xl">
                {boat.description} Uma obra-prima da construção naval, esta embarcação de {boat.length} metros
                oferece estabilidade e elegância incomparáveis para exploração costeira.
              </p>

              {/* Specs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 py-6 border-y border-slate-100">
                {boat.length && (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Ruler className="h-4 w-4 text-[#0B3D91]" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Comprimento</p>
                      <p className="text-sm font-semibold text-slate-800">{boat.length} Metros</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    <Users className="h-4 w-4 text-[#0B3D91]" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Capacidade</p>
                    <p className="text-sm font-semibold text-slate-800">{boat.capacity} Pessoas</p>
                  </div>
                </div>
                {boat.cabins && (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Bed className="h-4 w-4 text-[#0B3D91]" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Cabines</p>
                      <p className="text-sm font-semibold text-slate-800">{boat.cabins} Cabines</p>
                    </div>
                  </div>
                )}
                {boat.crew && (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Shield className="h-4 w-4 text-[#0B3D91]" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Tripulação</p>
                      <p className="text-sm font-semibold text-slate-800">{boat.crew} Profissionais</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Additional Packages */}
              <div className="mb-10">
                <h2 className="text-xl font-bold text-[#0B2447] mb-4">
                  Pacotes Adicionais
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {packages.map((pkg, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-[#0B3D91]/30 hover:bg-slate-50/50 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{pkg.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-slate-800 group-hover:text-[#0B3D91] transition-colors">
                            {pkg.name}
                          </p>
                          <p className="text-xs text-slate-500">{pkg.description}</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-[#0B3D91] bg-[#0B3D91]/10 px-3 py-1 rounded-lg">
                        {formatCurrency(pkg.price)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reviews */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-[#0B2447]">
                      Avaliações dos Hóspedes
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-slate-800">
                        {boat.rating} / 5
                      </span>
                      <span className="text-sm text-slate-500">
                        Baseado em {boat.reviewCount} avaliações
                      </span>
                    </div>
                  </div>
                  <button className="text-sm font-medium text-[#0B3D91] border border-[#0B3D91]/20 px-4 py-2 rounded-lg hover:bg-[#0B3D91]/5 transition-colors">
                    Escreva uma Review
                  </button>
                </div>

                <div className="space-y-4">
                  {sampleReviews.map((review) => (
                    <div
                      key={review.id}
                      className="p-5 rounded-xl border border-slate-100 bg-slate-50/50"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-[#0B3D91] flex items-center justify-center text-white text-sm font-semibold">
                            {review.userName
                              .split(' ')
                              .map((n) => n[0])
                              .join('')}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {review.userName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {new Date(review.createdAt).toLocaleDateString('pt-BR', {
                                month: 'long',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[...Array(review.rating)].map((_, i) => (
                            <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {review.comment}
                      </p>
                    </div>
                  ))}
                </div>

                <button className="w-full mt-4 py-3 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                  Mostrar todas as {boat.reviewCount} avaliações
                </button>
              </div>
            </div>

            {/* Right Sidebar - Booking Card */}
            <div className="lg:col-span-1">
              <div className="sticky top-20 space-y-4">
                {/* Price Card */}
                <div className="rounded-2xl border border-slate-200 p-6 shadow-sm" id="booking-card">
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-3xl font-bold text-[#0B2447]">
                      {formatCurrency(boat.pricePerDay)}
                    </span>
                    <span className="text-sm text-slate-500">/dia</span>
                  </div>

                  {/* Date Range */}
                  <div className="mb-3">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
                      Período
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Out 12 — Out 15"
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0B3D91] focus:ring-1 focus:ring-[#0B3D91] outline-none transition-colors"
                        readOnly
                      />
                    </div>
                  </div>

                  {/* Guests */}
                  <div className="mb-6">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
                      Hóspedes
                    </label>
                    <select className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:border-[#0B3D91] focus:ring-1 focus:ring-[#0B3D91] outline-none bg-white transition-colors appearance-none cursor-pointer">
                      {[...Array(boat.capacity)].map((_, i) => (
                        <option key={i} value={i + 1}>
                          {i + 1} {i === 0 ? 'hóspede' : 'hóspedes'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Price Breakdown */}
                  <div className="space-y-2 py-4 border-t border-slate-100">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Diária x 3</span>
                      <span className="text-slate-800 font-medium">
                        {formatCurrency(boat.pricePerDay * 3)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Taxa de serviço & tripulação</span>
                      <span className="text-slate-800 font-medium">
                        {formatCurrency(Math.round(boat.pricePerDay * 0.15))}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-4 border-t border-slate-200">
                    <span className="text-base font-bold text-[#0B2447]">Total</span>
                    <span className="text-xl font-bold text-[#0B2447]">
                      {formatCurrency(boat.pricePerDay * 3 + Math.round(boat.pricePerDay * 0.15))}
                    </span>
                  </div>

                  {/* CTA */}
                  <button
                    className="w-full bg-[#0B3D91] hover:bg-[#092E6E] text-white font-semibold py-3.5 rounded-xl transition-all hover:shadow-lg hover:shadow-[#0B3D91]/25 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                    id="reserve-button"
                  >
                    Reservar Experiência →
                  </button>

                  {/* Trust */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Garantia de Pagamento Seguro</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Headphones className="h-3.5 w-3.5 text-cyan-500" />
                      <span>Suporte 24/7 durante sua experiência</span>
                    </div>
                  </div>
                </div>

                {/* Why Book Card */}
                <div className="rounded-2xl bg-gradient-to-br from-[#0B3D91] to-[#0B2447] p-6 text-white">
                  <h3 className="text-base font-bold mb-4">
                    Por que reservar no Boatzy?
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-5 w-5 rounded-full bg-emerald-400/20 flex items-center justify-center shrink-0">
                        <div className="h-2 w-2 rounded-full bg-emerald-400" />
                      </div>
                      <span className="text-sm text-slate-200">Inspeções verificadas</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="h-5 w-5 rounded-full bg-emerald-400/20 flex items-center justify-center shrink-0">
                        <div className="h-2 w-2 rounded-full bg-emerald-400" />
                      </div>
                      <span className="text-sm text-slate-200">Antecedentes da tripulação</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="h-5 w-5 rounded-full bg-emerald-400/20 flex items-center justify-center shrink-0">
                        <div className="h-2 w-2 rounded-full bg-emerald-400" />
                      </div>
                      <span className="text-sm text-slate-200">Programa de fidelidade exclusivo</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                    <Heart className="h-4 w-4" />
                    Favoritar
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                    <Share2 className="h-4 w-4" />
                    Compartilhar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
