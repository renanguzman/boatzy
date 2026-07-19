// Lista de países (DDI) usada no seletor do campo de celular do cadastro.
// `flag` é o emoji da bandeira (regional indicators) — renderiza no macOS/iOS/Android;
// em alguns navegadores desktop (Windows) o fallback é o código ISO em letras, o que
// continua legível. `dial` é o código de discagem (DDI). `mask` define o formato do
// número nacional; quando ausente, cai no formato genérico internacional.

export type Country = {
  code: string; // ISO 3166-1 alpha-2
  name: string; // Nome em pt-BR
  dial: string; // DDI, com "+"
  flag: string; // Emoji da bandeira
  mask?: string; // Máscara do número nacional; "#" = dígito
};

// Brasil primeiro (padrão). Depois, os DDIs mais comuns para o público do Boatzy.
export const COUNTRIES: Country[] = [
  { code: 'BR', name: 'Brasil', dial: '+55', flag: '🇧🇷', mask: '(##) #####-####' },
  { code: 'PT', name: 'Portugal', dial: '+351', flag: '🇵🇹', mask: '### ### ###' },
  { code: 'US', name: 'Estados Unidos', dial: '+1', flag: '🇺🇸', mask: '(###) ###-####' },
  { code: 'AR', name: 'Argentina', dial: '+54', flag: '🇦🇷', mask: '(##) ####-####' },
  { code: 'UY', name: 'Uruguai', dial: '+598', flag: '🇺🇾', mask: '#### ####' },
  { code: 'PY', name: 'Paraguai', dial: '+595', flag: '🇵🇾', mask: '(###) ######' },
  { code: 'CL', name: 'Chile', dial: '+56', flag: '🇨🇱', mask: '# #### ####' },
  { code: 'CO', name: 'Colômbia', dial: '+57', flag: '🇨🇴', mask: '### #######' },
  { code: 'MX', name: 'México', dial: '+52', flag: '🇲🇽', mask: '(###) ### ####' },
  { code: 'ES', name: 'Espanha', dial: '+34', flag: '🇪🇸', mask: '### ### ###' },
  { code: 'IT', name: 'Itália', dial: '+39', flag: '🇮🇹', mask: '### ### ####' },
  { code: 'FR', name: 'França', dial: '+33', flag: '🇫🇷', mask: '# ## ## ## ##' },
  { code: 'DE', name: 'Alemanha', dial: '+49', flag: '🇩🇪' },
  { code: 'GB', name: 'Reino Unido', dial: '+44', flag: '🇬🇧', mask: '#### ######' },
  { code: 'CA', name: 'Canadá', dial: '+1', flag: '🇨🇦', mask: '(###) ###-####' },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // Brasil

export function findCountryByCode(code: string): Country {
  return COUNTRIES.find((c) => c.code === code) ?? DEFAULT_COUNTRY;
}
