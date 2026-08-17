import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import FaqContent from './_components/FaqContent';

export const metadata: Metadata = {
  title: 'Central de Ajuda — Boatzy',
  description:
    'Tire suas dúvidas sobre reservas, pagamentos, cadastro de embarcações, avaliações e mais na Central de Ajuda do Boatzy.',
};

export default function HelpPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-slate-50">
        {/* Hero */}
        <section className="bg-[#0B2447] text-white">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Central de Ajuda</h1>
            <p className="mt-3 text-slate-300 max-w-xl mx-auto">
              Reunimos as perguntas mais frequentes sobre reservas, pagamentos, embarcações e
              muito mais. Use a busca abaixo ou navegue pelos temas.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
          <FaqContent />
        </div>
      </main>

      <Footer />
    </div>
  );
}
