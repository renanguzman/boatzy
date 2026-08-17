import 'server-only';

/**
 * Previsão do tempo para a página de confirmação de reserva (`/reservas/novo`),
 * via API pública e gratuita do Open-Meteo (sem chave/autenticação) —
 * https://open-meteo.com. Só um complemento informativo do fluxo de reserva:
 * nunca deve lançar nem travar a página — qualquer falha vira um dos status
 * de `ResultadoPrevisao` para a UI decidir o que mostrar.
 */

export type PaletaClima = 'ensolarado' | 'nublado' | 'chuvoso' | 'tempestuoso';

export type CondicaoClima = {
  codigo: number;
  label: string;
  paleta: PaletaClima;
};

export type PrevisaoHoraria = {
  hora: string; // 'HH:mm'
  temperatura: number;
  condicao: CondicaoClima;
  chanceChuva: number | null;
};

export type PrevisaoTempo = {
  temperaturaMax: number;
  temperaturaMin: number;
  sensacaoMax: number | null;
  condicao: CondicaoClima;
  ventoMaxKmh: number;
  rajadaMaxKmh: number;
  chanceChuvaPercent: number | null;
  precipitacaoMm: number;
  indiceUvMax: number | null;
  nascerDoSol: string | null;
  porDoSol: string | null;
  horaria: PrevisaoHoraria[];
};

export type ResultadoPrevisao =
  | { status: 'ok'; previsao: PrevisaoTempo }
  /** Data além do alcance da previsão diária gratuita do Open-Meteo (~16 dias). */
  | { status: 'fora-do-alcance' }
  /** Falha de rede/API — não é motivo para quebrar a página de reserva. */
  | { status: 'indisponivel' };

// Tradução dos "WMO Weather interpretation codes" usados pelo Open-Meteo.
const TABELA_CODIGOS: Record<number, { label: string; paleta: PaletaClima }> = {
  0: { label: 'Céu limpo', paleta: 'ensolarado' },
  1: { label: 'Predomínio de sol', paleta: 'ensolarado' },
  2: { label: 'Parcialmente nublado', paleta: 'nublado' },
  3: { label: 'Nublado', paleta: 'nublado' },
  45: { label: 'Neblina', paleta: 'nublado' },
  48: { label: 'Neblina com geada', paleta: 'nublado' },
  51: { label: 'Garoa fraca', paleta: 'chuvoso' },
  53: { label: 'Garoa moderada', paleta: 'chuvoso' },
  55: { label: 'Garoa forte', paleta: 'chuvoso' },
  56: { label: 'Garoa congelante fraca', paleta: 'chuvoso' },
  57: { label: 'Garoa congelante forte', paleta: 'chuvoso' },
  61: { label: 'Chuva fraca', paleta: 'chuvoso' },
  63: { label: 'Chuva moderada', paleta: 'chuvoso' },
  65: { label: 'Chuva forte', paleta: 'chuvoso' },
  66: { label: 'Chuva congelante fraca', paleta: 'chuvoso' },
  67: { label: 'Chuva congelante forte', paleta: 'chuvoso' },
  71: { label: 'Neve fraca', paleta: 'chuvoso' },
  73: { label: 'Neve moderada', paleta: 'chuvoso' },
  75: { label: 'Neve forte', paleta: 'chuvoso' },
  77: { label: 'Grãos de neve', paleta: 'chuvoso' },
  80: { label: 'Pancadas de chuva fracas', paleta: 'chuvoso' },
  81: { label: 'Pancadas de chuva moderadas', paleta: 'chuvoso' },
  82: { label: 'Pancadas de chuva fortes', paleta: 'chuvoso' },
  85: { label: 'Pancadas de neve fracas', paleta: 'chuvoso' },
  86: { label: 'Pancadas de neve fortes', paleta: 'chuvoso' },
  95: { label: 'Trovoada', paleta: 'tempestuoso' },
  96: { label: 'Trovoada com granizo fraco', paleta: 'tempestuoso' },
  99: { label: 'Trovoada com granizo forte', paleta: 'tempestuoso' },
};

function condicaoDoCodigo(codigo: number): CondicaoClima {
  const entry = TABELA_CODIGOS[codigo];
  return entry
    ? { codigo, ...entry }
    : { codigo, label: 'Condição indisponível', paleta: 'nublado' };
}

// Janela de previsão diária confiável da API gratuita do Open-Meteo.
const DIAS_MAX_PREVISAO = 16;

/**
 * Busca a previsão do tempo para uma coordenada e data específicas.
 * `dataISO` no formato 'yyyy-mm-dd'.
 */
export async function buscarPrevisaoTempo(
  lat: number,
  lng: number,
  dataISO: string,
): Promise<ResultadoPrevisao> {
  const hojeISO = new Date().toISOString().slice(0, 10);
  const diffDias = Math.round(
    (new Date(`${dataISO}T12:00:00`).getTime() - new Date(`${hojeISO}T12:00:00`).getTime()) /
      86_400_000,
  );

  if (diffDias < 0 || diffDias > DIAS_MAX_PREVISAO) {
    return { status: 'fora-do-alcance' };
  }

  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', lat.toFixed(4));
    url.searchParams.set('longitude', lng.toFixed(4));
    url.searchParams.set(
      'daily',
      [
        'weathercode',
        'temperature_2m_max',
        'temperature_2m_min',
        'apparent_temperature_max',
        'precipitation_sum',
        'precipitation_probability_max',
        'windspeed_10m_max',
        'windgusts_10m_max',
        'uv_index_max',
        'sunrise',
        'sunset',
      ].join(','),
    );
    url.searchParams.set(
      'hourly',
      ['temperature_2m', 'weathercode', 'precipitation_probability'].join(','),
    );
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('start_date', dataISO);
    url.searchParams.set('end_date', dataISO);

    // Cache curto (30 min) — não precisa ser tempo real e evita bater na API
    // a cada carregamento da página de confirmação.
    const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
    if (!res.ok) return { status: 'indisponivel' };

    const json = await res.json();
    if (json.error || !json.daily?.time?.length) return { status: 'indisponivel' };

    const d = json.daily;
    const h = json.hourly;

    const horaria: PrevisaoHoraria[] = (h?.time ?? [])
      .map((iso: string, i: number) => ({
        hora: iso.slice(11, 16),
        temperatura: Math.round(h.temperature_2m[i]),
        condicao: condicaoDoCodigo(h.weathercode[i]),
        chanceChuva: h.precipitation_probability?.[i] ?? null,
      }))
      // Só o intervalo relevante para um passeio de barco (6h–20h).
      .filter((item: PrevisaoHoraria) => item.hora >= '06:00' && item.hora <= '20:00');

    const previsao: PrevisaoTempo = {
      temperaturaMax: Math.round(d.temperature_2m_max[0]),
      temperaturaMin: Math.round(d.temperature_2m_min[0]),
      sensacaoMax:
        d.apparent_temperature_max?.[0] != null ? Math.round(d.apparent_temperature_max[0]) : null,
      condicao: condicaoDoCodigo(d.weathercode[0]),
      ventoMaxKmh: Math.round(d.windspeed_10m_max[0]),
      rajadaMaxKmh: Math.round(d.windgusts_10m_max[0]),
      chanceChuvaPercent: d.precipitation_probability_max?.[0] ?? null,
      precipitacaoMm: d.precipitation_sum?.[0] ?? 0,
      indiceUvMax: d.uv_index_max?.[0] ?? null,
      nascerDoSol: d.sunrise?.[0] ? d.sunrise[0].slice(11, 16) : null,
      porDoSol: d.sunset?.[0] ? d.sunset[0].slice(11, 16) : null,
      horaria,
    };

    return { status: 'ok', previsao };
  } catch (error) {
    console.error('[weather] falha ao buscar previsão no Open-Meteo:', error);
    return { status: 'indisponivel' };
  }
}
