import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import PreviewReceptor from '../_components/PreviewReceptor';

export const metadata: Metadata = {
  title: 'Pré-visualização — Roteiro',
  robots: { index: false, follow: false },
};

/**
 * Página pública "de mentira" aberta num iframe pelo formulário do painel:
 * Header/Footer reais + a mesma view de `/roteiros/[id]`, com os dados do
 * formulário ainda não salvo. Protegida pelo proxy (rota /painel).
 */
export default function PreviewRoteiroPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <PreviewReceptor tipo="roteiro" />
      <Footer />
    </div>
  );
}
