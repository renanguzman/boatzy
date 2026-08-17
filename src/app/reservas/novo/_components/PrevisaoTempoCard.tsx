'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import type { ResultadoPrevisao, PaletaClima } from '@/lib/weather';

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

function labelIndiceUv(uv: number): string {
  if (uv < 3) return 'Baixo';
  if (uv < 6) return 'Moderado';
  if (uv < 8) return 'Alto';
  if (uv < 11) return 'Muito alto';
  return 'Extremo';
}

/** Rodapé de fonte/disclaimer — igual nos três estados (ok/fora-do-alcance/indisponível). */
function RodapeFonte() {
  return (
    <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3.5">
      <div className="flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <p>
          Previsão meteorológica sujeita a alterações e fornecida apenas para fins informativos —
          o Boatzy não se responsabiliza pela exatidão destes dados nem pelas condições reais no
          dia do passeio.{' '}
          <a
            href="https://open-meteo.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-[#0B3D91] underline underline-offset-2 transition-colors"
          >
            Fonte: Open-Meteo.com
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

  // Data fora do alcance da previsão diária gratuita (~16 dias) — estado neutro, sem alarmar.
  if (resultado.status === 'fora-do-alcance') {
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
            <p className="text-sm font-semibold text-[#0B2447]">Previsão do tempo ainda não disponível</p>
            <p className="text-xs text-slate-400 mt-0.5">{dataLabel}</p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
          />
        </button>

        <div className={`grid transition-all duration-200 ease-in-out ${aberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <p className="px-5 sm:px-6 pb-5 -mt-2 text-sm text-slate-500 leading-relaxed">
              A data do passeio ({dataLabel}) está além do alcance confiável de previsão
              meteorológica (cerca de 16 dias). Volte a esta página mais perto da data para
              conferir as condições esperadas{localidade ? ` em ${localidade}` : ''}.
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
            <p className="text-sm font-semibold text-[#0B2447]">Previsão do tempo indisponível</p>
            <p className="text-xs text-slate-400 mt-0.5">{dataLabel}</p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
          />
        </button>

        <div className={`grid transition-all duration-200 ease-in-out ${aberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <p className="px-5 sm:px-6 pb-5 -mt-2 text-sm text-slate-500 leading-relaxed">
              Não foi possível carregar a previsão meteorológica agora. Isso não afeta sua
              solicitação de reserva.
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
            Previsão do tempo para o passeio
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
              <span className="text-3xl font-bold text-[#0B2447]">{previsao.temperaturaMax}°</span>
              <span className="text-base text-slate-400">/ {previsao.temperaturaMin}°</span>
            </div>
            <p className="text-sm font-medium text-slate-600 truncate">
              {previsao.condicao.label}
              {localidade ? ` · ${localidade}` : ''}
            </p>
            {previsao.sensacaoMax != null && (
              <p className="text-xs text-slate-400 mt-0.5">
                Sensação térmica de até {previsao.sensacaoMax}°
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
              <Wind className="h-4 w-4 text-[#0B3D91] mx-auto mb-1.5" />
              <p className="text-sm font-bold text-[#0B2447]">{previsao.ventoMaxKmh} km/h</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
                Rajadas até {previsao.rajadaMaxKmh}
              </p>
            </div>
            <div className="p-4 text-center">
              <Droplets className="h-4 w-4 text-[#0B3D91] mx-auto mb-1.5" />
              <p className="text-sm font-bold text-[#0B2447]">
                {previsao.chanceChuvaPercent != null ? `${previsao.chanceChuvaPercent}%` : '—'}
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Chance de chuva</p>
            </div>
            <div className="p-4 text-center">
              <CloudRain className="h-4 w-4 text-[#0B3D91] mx-auto mb-1.5" />
              <p className="text-sm font-bold text-[#0B2447]">{previsao.precipitacaoMm} mm</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Volume esperado</p>
            </div>
            <div className="p-4 text-center">
              <ThermometerSun className="h-4 w-4 text-[#0B3D91] mx-auto mb-1.5" />
              <p className="text-sm font-bold text-[#0B2447]">
                {previsao.indiceUvMax != null ? labelIndiceUv(previsao.indiceUvMax) : '—'}
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Índice UV</p>
            </div>
          </div>

          {/* Nascer/pôr do sol */}
          {(previsao.nascerDoSol || previsao.porDoSol) && (
            <div className="flex items-center justify-center gap-6 py-3 border-t border-slate-100 text-xs text-slate-500">
              {previsao.nascerDoSol && (
                <span className="flex items-center gap-1.5">
                  <Sunrise className="h-3.5 w-3.5 text-amber-500" />
                  Nascer do sol {previsao.nascerDoSol}
                </span>
              )}
              {previsao.porDoSol && (
                <span className="flex items-center gap-1.5">
                  <Sunset className="h-3.5 w-3.5 text-orange-500" />
                  Pôr do sol {previsao.porDoSol}
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
                className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-[#0B3D91] hover:bg-slate-50 transition-colors"
              >
                Ver previsão hora a hora
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
                          <p className="text-[10px] font-semibold text-slate-500">{item.hora}</p>
                          <IconeHora className="h-4 w-4 text-[#0B3D91] mx-auto my-1.5" />
                          <p className="text-xs font-bold text-[#0B2447]">{item.temperatura}°</p>
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
