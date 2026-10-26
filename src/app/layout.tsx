import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import { LOCALE_OPEN_GRAPH, isIdioma, IDIOMA_PADRAO } from "@/i18n/config";
import { carregarDadosCatalogo } from "@/i18n/catalogo-servidor";
import { CatalogoProvider } from "@/i18n/CatalogoProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadados.raiz");
  const locale = await getLocale();
  return {
    title: t("titulo"),
    description: t("descricao"),
    keywords: t("palavrasChave").split(",").map((k) => k.trim()),
    openGraph: {
      title: t("ogTitulo"),
      description: t("ogDescricao"),
      type: "website",
      locale: LOCALE_OPEN_GRAPH[locale],
      siteName: "Boatzy",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Idioma da requisição (cookie / navegador; painel e admin sempre pt-BR) — src/i18n/request.ts.
  const locale = await getLocale();
  // Nomes de tipos/comodidades/acessórios/equipamentos no idioma (vazio em pt-BR) — SPEC §94.12.
  const catalogo = await carregarDadosCatalogo(isIdioma(locale) ? locale : IDIOMA_PADRAO);
  return (
    <html lang={locale} className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-grafite">
        <NextIntlClientProvider>
          <CatalogoProvider dados={catalogo}>{children}</CatalogoProvider>
        </NextIntlClientProvider>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
