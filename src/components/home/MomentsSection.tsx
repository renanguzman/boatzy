import Image from 'next/image';
import { moments } from '@/lib/mock-data';

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
            Curation of{' '}
            <span className="bg-gradient-to-r from-[#0B3D91] to-cyan-500 bg-clip-text text-transparent">
              Moments
            </span>
          </h2>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {moments.map((moment, index) => (
            <div
              key={index}
              className="group relative rounded-2xl overflow-hidden cursor-pointer h-64 md:h-80"
              id={`moment-${index}`}
            >
              <Image
                src={moment.image}
                alt={moment.title}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-700"
              />
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B2447]/80 via-[#0B2447]/20 to-transparent" />

              {/* Content */}
              <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                <h3 className="text-white font-semibold text-sm md:text-base mb-1">
                  {moment.title}
                </h3>
                <p className="text-slate-300 text-xs line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {moment.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
