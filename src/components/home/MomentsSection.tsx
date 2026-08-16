import Link from 'next/link';
import Image from 'next/image';
import { moments } from '@/lib/mock-data';
import { PASSEIOS_DESTAQUE } from '@/lib/passeios';

// Os 4 cards da seção: primeiro os passeios com página própria (conteúdo real,
// definido em `passeios.ts`); o restante dos slots segue preenchido pelos
// "moments" antigos até cada um ser substituído por um passeio definitivo.
const ITENS = [
  ...PASSEIOS_DESTAQUE.map((passeio) => ({
    title: passeio.titulo,
    image: passeio.imagem,
    href: `/passeios/${passeio.slug}`,
  })),
  ...moments.slice(PASSEIOS_DESTAQUE.length).map((moment) => ({
    title: moment.title,
    image: moment.image,
    href: undefined as string | undefined,
  })),
];

export default function MomentsSection() {
  return (
    <section className="py-16 bg-slate-50/50" id="moments-section">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-xs font-semibold text-cyan-600 uppercase tracking-widest mb-1">
            Inspire-se
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-[#0B2447]">
            Coleção de{' '}
            <span className="bg-gradient-to-r from-[#0B3D91] to-cyan-500 bg-clip-text text-transparent">
              experiências
            </span>
          </h2>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {ITENS.map((item, index) => {
            const card = (
              <>
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-700"
                />
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B2447]/85 via-[#0B2447]/25 to-transparent" />

                {/* Content */}
                <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                  <h3 className="text-white font-semibold text-sm md:text-base leading-snug">
                    {item.title}
                  </h3>
                </div>
              </>
            );

            const className =
              'group relative rounded-2xl overflow-hidden h-64 md:h-80' +
              (item.href ? ' cursor-pointer' : '');

            return item.href ? (
              <Link key={index} href={item.href} id={`moment-${index}`} className={className}>
                {card}
              </Link>
            ) : (
              <div key={index} id={`moment-${index}`} className={className}>
                {card}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
