import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Textos do site vêm de messages/ (SPEC §94.3): nenhum texto solto no JSX das
  // áreas já traduzidas. A lista de pastas cresce a cada fase da internacionalização.
  // Liberados: pontuação/símbolos e nomes de marca (não se traduzem).
  {
    files: [
      "src/app/page.tsx",
      "src/app/buscar/**/*.tsx",
      "src/app/roteiros/**/*.tsx",
      "src/app/embarcacoes/**/*.tsx",
      "src/app/reservas/**/*.tsx",
      "src/app/entrar/**/*.tsx",
      "src/app/recuperar-senha/**/*.tsx",
      "src/app/redefinir-senha/**/*.tsx",
      "src/app/experiencias/**/*.tsx",
      "src/components/layout/**/*.tsx",
      "src/components/home/**/*.tsx",
      "src/components/ui/**/*.tsx",
      "src/components/busca/**/*.tsx",
      "src/components/chat/**/*.tsx",
      "src/components/boat/**/*.tsx",
      "src/components/avaliacoes/**/*.tsx",
      "src/components/termos/**/*.tsx",
      "src/components/auth/**/*.tsx",
      "src/app/minha-conta/**/*.tsx",
      "src/app/minhas-reservas/**/*.tsx",
      "src/app/minhas-conversas/**/*.tsx",
      "src/app/favoritos/**/*.tsx",
      "src/app/vendas/**/*.tsx",
      "src/app/passeios/**/*.tsx",
      "src/app/sobre/**/*.tsx",
      "src/app/help/**/*.tsx",
      "src/app/contact/**/*.tsx",
      "src/app/terms/**/*.tsx",
      "src/app/privacy/**/*.tsx",
      "src/app/not-found.tsx",
      "src/app/error.tsx",
      "src/components/legal/**/*.tsx",
      "src/app/notificacoes/**/*.tsx",
      "src/components/notificacoes/**/*.tsx",
    ],
    rules: {
      "react/jsx-no-literals": ["error", {
        allowedStrings: [
          "·", "—", "–", "-", "/", "|", "+", "×", "%", "→", "‹", "›", "…", ",", ":", "(", ")", "°",
          "Boatzy", "Pix", "WhatsApp", "Facebook", "Instagram", "YouTube", "Google Maps", "Waze",
        ],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
