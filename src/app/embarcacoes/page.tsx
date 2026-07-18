import { redirect } from 'next/navigation';

// A listagem de embarcações mora em /buscar?tipo=embarcacao (aba
// "Embarcações"). Esta rota apenas redireciona preservando os filtros
// compatíveis. O detalhe /embarcacoes/[id] segue ativo (links diretos e
// fluxo de reserva direta de embarcação).

type SearchParams = {
  municipio?: string;
  local?: string;
  lat?: string;
  lng?: string;
  data?: string;
  flex?: string;
  pessoas?: string;
  pagina?: string;
};

const PARAMS_COMPATIVEIS = ['municipio', 'local', 'lat', 'lng', 'data', 'flex', 'pessoas', 'pagina'] as const;

export default async function EmbarcacoesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  const sp = new URLSearchParams();
  sp.set('tipo', 'embarcacao');
  for (const key of PARAMS_COMPATIVEIS) {
    const value = params[key];
    if (value) sp.set(key, value);
  }

  redirect(`/buscar?${sp.toString()}`);
}
