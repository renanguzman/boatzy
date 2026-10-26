'use client';

import { useState } from 'react';
import { useTranslations, type Messages } from 'next-intl';
import {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudLightning,
  CloudSnow,
  Wind,
  Droplets,
  Sunrise,
  Sunset,
  Info,
  ExternalLink,
  ChevronDown,
  ThermometerSun,
  CloudOff,
  Hourglass,
} from 'lucide-react';
import type { ResultadoPrevisao, PaletaClima } from '@/lib/weather';
import { useFormatos, type Formatos } from '@/i18n/formatos';

type Props = {
  resultado: ResultadoPrevisao;
  /** Nome do local exibido no cabeçalho, ex.: "Florianópolis, SC". */
  localidade: string | null;
  /** Data já formatada, ex.: "12 de setembro de 2026". */
  dataLabel: string;
};

// Ícone por código WMO — lookup estático (não uma função), para que o ícone
// escolhido seja sempre uma referência estável de componente entre renders.
const CODIGO_ICONE: Record<number, typeof Sun> = {
  0: Sun,
  1: CloudSun,
  2: CloudSun,
  3: Cloud,
  45: CloudFog,
  48: CloudFog,
  51: CloudDrizzle,
  53: CloudDrizzle,
  55: CloudDrizzle,
  56: CloudDrizzle,
  57: CloudDrizzle,
  61: CloudRain,
  63: CloudRain,
  65: CloudRain,
  66: CloudRain,
  67: CloudRain,
  80: CloudRain,
  81: CloudRain,
  82: CloudRain,
  71: CloudSnow,
  73: CloudSnow,
  75: CloudSnow,
  77: CloudSnow,
  85: CloudSnow,
  86: CloudSnow,
  95: CloudLightning,
  96: CloudLightning,
  99: CloudLightning,
};

const ESTILO_PALETA: Record<PaletaClima, { faixa: string; texto: string; badge: string }> = {
  ensolarado: {
    faixa: 'from-amber-100 via-sky-50 to-white',
    texto: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-700',
  },
  nublado: {
    faixa: 'from-slate-200 via-slate-100 to-white',
    texto: 'text-slate-500',
    badge: 'bg-slate-200 text-slate-600',
  },
  chuvoso: {
    faixa: 'from-sky-100 via-blue-50 to-white',
    texto: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-700',
  },
  tempestuoso: {
    faixa: 'from-indigo-200 via-indigo-100 to-white',
    texto: 'text-indigo-600',
    badge: 'bg-indigo-100 text-indigo-700',
  },
};

type CodigoClima = keyof Messages['Clima']['codigos'];

/** Condição pelo código WMO, no idioma do site (`Clima.codigos`). */
function useCondicao() {
  const t = useTranslations('Clima');
  return (codigo: number) =>
    String(codigo) in CODIGO_ICONE ? t(`codigos.${String(codigo) as CodigoClima}`) : t('condicaoIndisponivel');
}

function nivelIndiceUv(uv: number): 'baixo' | 'moderado' | 'alto' | 'muitoAlto' | 'extremo' {
  if (uv < 3) return 'baixo';
  if (uv < 6) return 'moderado';
  if (uv < 8) return 'alto';
  if (uv < 11) return 'muitoAlto';
  return 'extremo';
}

/**
 * Unidades no costume do idioma: en-US em °F, mph e polegadas; pt-BR e es no sistema
 * métrico (a API responde em °C, km/h e mm).
 */
function unidades(f: Formatos) {
  const imperial = f.idioma === 'en-US';
  return {
    temperatura: (c: number) => (imperial ? `${Math.round((c * 9) / 5 + 32)}°F` : `${c}°`),
    vento: (kmh: number) => (imperial ? `${Math.round(kmh * 0.621371)} mph` : `${kmh} km/h`),
    chuva: (mm: number) => (imperial ? `${f.numero(mm / 25.4, { maximumFractionDigits: 2 })} in` : `${f.numero(mm)} mm`),
  };
}

/** Rodapé de fonte/disclaimer — igual nos três estados (ok/fora-do-alcance/indisponível). */
function RodapeFonte() {
  const t = useTranslations('Clima');
  return (
    <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3.5">
      <div className="flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <p>
          {t('aviso')}{' '}
          <a
            href="https://open-meteo.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-marinho underline underline-offset-2 transition-colors"
          >
            {t('fonte')}
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </div>
    </div>
  );
}

export default function PrevisaoTempoCard({ resultado, localidade, dataLabel }: Props) {
  // A div inteira começa colapsada — só o cabeçalho compacto fica visível até
  // o cliente clicar, para não ocupar espaço logo no início da página.
  const [aberto, setAberto] = useState(false);
  const [mostrarHoras, setMostrarHoras] = useState(false);
  const t = useTranslations('Clima');
  const f = useFormatos();
  const condicao = useCondicao();
  const u = unidades(f);

  // Data além dos 15 dias da previsão — é espera, não erro: ampulheta em tom
  // da marca (o ícone de nuvem cortada dava a sensação de falha no site).
  if (resultado.status === 'fora-do-alcance') {
    return (
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="w-full flex items-center gap-4 p-5 sm:p-6 text-left hover:bg-slate-50/60 transition-colors"
        >
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-sky-50 to-cyan-50 ring-1 ring-sky-100 flex items-center justify-center shrink-0">
            <Hourglass className="h-5 w-5 text-marinho" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-marinho leading-snug">
              {t('foraAlcance.titulo')}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{dataLabel}</p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
          />
        </button>

        <div className={`grid transition-all duration-200 ease-in-out ${aberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            {/* Sem margem negativa: dentro do overflow-hidden ela cortava a 1ª linha. */}
            <p className="px-5 sm:px-6 pb-5 text-sm text-slate-500 leading-relaxed">
              {t('foraAlcance.texto', { data: dataLabel, temLocal: localidade ? 'sim' : 'nao', local: localidade ?? '' })}
            </p>
            <RodapeFonte />
          </div>
        </div>
      </div>
    );
  }

  // Falha de rede/API — não é motivo para esconder a seção, mas o tom é discreto.
  if (resultado.status === 'indisponivel') {
    return (
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="w-full flex items-center gap-4 p-5 sm:p-6 text-left hover:bg-slate-50/60 transition-colors"
        >
          <div className="h-11 w-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <CloudOff className="h-5 w-5 text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-marinho">{t('indisponivel.titulo')}</p>
            <p className="text-xs text-slate-400 mt-0.5">{dataLabel}</p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
          />
        </button>

        <div className={`grid transition-all duration-200 ease-in-out ${aberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <p className="px-5 sm:px-6 pb-5 text-sm text-slate-500 leading-relaxed">
              {t('indisponivel.texto')}
            </p>
            <RodapeFonte />
          </div>
        </div>
      </div>
    );
  }

  const { previsao } = resultado;
  const Icone = CODIGO_ICONE[previsao.condicao.codigo] ?? Cloud;
  const paleta = ESTILO_PALETA[previsao.condicao.paleta];

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Cabeçalho — sempre visível, clicável para expandir/recolher a div inteira */}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className={`w-full text-left bg-gradient-to-br ${paleta.faixa} p-5 sm:p-6 hover:brightness-[0.98] transition-[filter]`}
      >
        <div className="flex items-center justify-between gap-2 mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {t('titulo')}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${paleta.badge}`}>
              {dataLabel}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-white/80 shadow-sm flex items-center justify-center shrink-0">
            <Icone className={`h-9 w-9 ${paleta.texto}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-marinho">{u.temperatura(previsao.temperaturaMax)}</span>
              <span className="text-base text-slate-400">/ {u.temperatura(previsao.temperaturaMin)}</span>
            </div>
            <p className="text-sm font-medium text-slate-600 truncate">
              {condicao(previsao.condicao.codigo)}
              {localidade ? ` · ${localidade}` : ''}
            </p>
            {previsao.sensacaoMax != null && (
              <p className="text-xs text-slate-400 mt-0.5">
                {t('sensacao', { temp: u.temperatura(previsao.sensacaoMax) })}
              </p>
            )}
          </div>
        </div>
      </button>

      {/* Corpo (estatísticas, sol, hora a hora, fonte) — recolhido por padrão */}
      <div className={`grid transition-all duration-200 ease-in-out ${aberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          {/* Estatísticas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 border-t border-slate-100">
            <div className="p-4 text-center">
              <Wind className="h-4 w-4 text-marinho mx-auto mb-1.5" />
              <p className="text-sm font-bold text-marinho">{u.vento(previsao.ventoMaxKmh)}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
                {t('rajadas', { valor: u.vento(previsao.rajadaMaxKmh) })}
              </p>
            </div>
            <div className="p-4 text-center">
              <Droplets className="h-4 w-4 text-marinho mx-auto mb-1.5" />
              <p className="text-sm font-bold text-marinho">
                {previsao.chanceChuvaPercent != null ? `${previsao.chanceChuvaPercent}%` : '—'}
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{t('chanceChuva')}</p>
            </div>
            <div className="p-4 text-center">
              <CloudRain className="h-4 w-4 text-marinho mx-auto mb-1.5" />
              <p className="text-sm font-bold text-marinho">{u.chuva(previsao.precipitacaoMm)}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{t('volume')}</p>
            </div>
            <div className="p-4 text-center">
              <ThermometerSun className="h-4 w-4 text-marinho mx-auto mb-1.5" />
              <p className="text-sm font-bold text-marinho">
                {previsao.indiceUvMax != null ? t(`uv.${nivelIndiceUv(previsao.indiceUvMax)}`) : '—'}
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{t('uvTitulo')}</p>
            </div>
          </div>

          {/* Nascer/pôr do sol */}
          {(previsao.nascerDoSol || previsao.porDoSol) && (
            <div className="flex items-center justify-center gap-6 py-3 border-t border-slate-100 text-xs text-slate-500">
              {previsao.nascerDoSol && (
                <span className="flex items-center gap-1.5">
                  <Sunrise className="h-3.5 w-3.5 text-amber-500" />
                  {t('nascer', { hora: f.horario(previsao.nascerDoSol) })}
                </span>
              )}
              {previsao.porDoSol && (
                <span className="flex items-center gap-1.5">
                  <Sunset className="h-3.5 w-3.5 text-orange-500" />
                  {t('por', { hora: f.horario(previsao.porDoSol) })}
                </span>
              )}
            </div>
          )}

          {/* Previsão hora a hora — interativo (accordion aninhado) */}
          {previsao.horaria.length > 0 && (
            <div className="border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMostrarHoras((v) => !v)}
                aria-expanded={mostrarHoras}
                className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-marinho hover:bg-slate-50 transition-colors"
              >
                {t('horaAHora')}
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${mostrarHoras ? 'rotate-180' : ''}`}
                />
              </button>

              <div className={`grid transition-all duration-200 ease-in-out ${mostrarHoras ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <div className="flex gap-2 px-5 pb-4 overflow-x-auto">
                    {previsao.horaria.map((item) => {
                      const IconeHora = CODIGO_ICONE[item.condicao.codigo] ?? Cloud;
                      return (
                        <div
                          key={item.hora}
                          className="shrink-0 min-w-[64px] rounded-xl border border-slate-100 bg-slate-50/60 px-2.5 py-3 text-center"
                        >
                          <p className="text-[10px] font-semibold text-slate-500">{f.horario(item.hora)}</p>
                          <IconeHora className="h-4 w-4 text-marinho mx-auto my-1.5" />
                          <p className="text-xs font-bold text-marinho">{u.temperatura(item.temperatura)}</p>
                          {item.chanceChuva != null && item.chanceChuva > 0 && (
                            <p className="text-[9px] text-blue-500 mt-0.5">{item.chanceChuva}%</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          <RodapeFonte />
        </div>
      </div>
    </div>
  );
}
