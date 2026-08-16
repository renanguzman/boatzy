import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Mail, Phone, MapPin } from 'lucide-react';
import { gerarDesafioCaptcha } from '@/lib/contato-captcha';
import ContactForm from './_components/ContactForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Contato — Boatzy',
  description: 'Fale com o time do Boatzy: dúvidas, elogios, parcerias comerciais ou financeiro.',
};

export default function ContactPage() {
  const desafio = gerarDesafioCaptcha();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-slate-50">
        {/* Hero */}
        <section className="bg-[#0B2447] text-white">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Fale com a gente</h1>
            <p className="mt-3 text-slate-300 max-w-xl mx-auto">
              Dúvidas, elogios, oportunidades comerciais ou questões financeiras — escolha o assunto
              e envie sua mensagem. Nossa equipe responde o quanto antes.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            {/* Formulário */}
            <div className="md:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
              <ContactForm desafioInicial={desafio} />
            </div>

            {/* Info lateral */}
            <div className="md:col-span-2 space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#0B3D91]/10 flex items-center justify-center shrink-0">
                    <Mail className="h-5 w-5 text-[#0B3D91]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#0B2447]">E-mail</p>
                    <p className="text-sm text-slate-500 mt-0.5">gabriela@boatzy.app</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#0B3D91]/10 flex items-center justify-center shrink-0">
                    <Phone className="h-5 w-5 text-[#0B3D91]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#0B2447]">Suporte</p>
                    <p className="text-sm text-slate-500 mt-0.5">Respondemos em até 1 dia útil.</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#0B3D91]/10 flex items-center justify-center shrink-0">
                    <MapPin className="h-5 w-5 text-[#0B3D91]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#0B2447]">Boatzy</p>
                    <p className="text-sm text-slate-500 mt-0.5">Navegue com Elegância.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
