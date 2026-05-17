import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Boatzy — Navegue com Elegância | Aluguel de Embarcações",
  description:
    "Boatzy é a melhor plataforma de aluguel de embarcações do Brasil. Encontre iates, lanchas, jet skis e veleiros para sua experiência perfeita no mar.",
  keywords: [
    "aluguel de barcos",
    "iate",
    "lancha",
    "jet ski",
    "veleiro",
    "charter",
    "experiência no mar",
    "Boatzy",
  ],
  openGraph: {
    title: "Boatzy — Navegue com Elegância",
    description: "A melhor plataforma de aluguel de embarcações do Brasil.",
    type: "website",
    locale: "pt_BR",
    siteName: "Boatzy",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-slate-900">
        {children}
      </body>
    </html>
  );
}
