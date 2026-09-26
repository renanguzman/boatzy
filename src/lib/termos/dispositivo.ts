/**
 * Identificação do dispositivo a partir do user-agent capturado NO SERVIDOR
 * (o cliente não informa o próprio dispositivo — evita evidência forjada).
 * Heurística simples e suficiente para prova; o user-agent bruto também é guardado.
 * Módulo puro.
 */
import type { DispositivoTipo } from './tipos';

export type DispositivoInfo = {
  tipo: DispositivoTipo;
  sistemaOperacional: string | null;
  navegador: string | null;
};

function versao(ua: string, re: RegExp): string {
  const m = ua.match(re);
  return m?.[1] ? ` ${m[1].replace(/_/g, '.')}` : '';
}

/** @param chMobile valor do client hint `Sec-CH-UA-Mobile` (`?1` = mobile), quando enviado. */
export function identificarDispositivo(ua: string | null, chMobile?: string | null): DispositivoInfo {
  if (!ua) return { tipo: 'desconhecido', sistemaOperacional: null, navegador: null };

  let sistemaOperacional: string | null = null;
  if (/iPad/.test(ua)) sistemaOperacional = `iPadOS${versao(ua, /OS (\d+[_.]\d+)/)}`;
  else if (/iPhone|iPod/.test(ua)) sistemaOperacional = `iOS${versao(ua, /OS (\d+[_.]\d+)/)}`;
  else if (/Android/.test(ua)) sistemaOperacional = `Android${versao(ua, /Android (\d+(?:\.\d+)?)/)}`;
  else if (/Windows NT/.test(ua)) sistemaOperacional = 'Windows';
  else if (/CrOS/.test(ua)) sistemaOperacional = 'ChromeOS';
  else if (/Mac OS X/.test(ua)) sistemaOperacional = `macOS${versao(ua, /Mac OS X (\d+[_.]\d+)/)}`;
  else if (/Linux/.test(ua)) sistemaOperacional = 'Linux';

  let navegador: string | null = null;
  if (/Edg\//.test(ua)) navegador = `Edge${versao(ua, /Edg\/(\d+)/)}`;
  else if (/OPR\//.test(ua)) navegador = `Opera${versao(ua, /OPR\/(\d+)/)}`;
  else if (/SamsungBrowser\//.test(ua)) navegador = `Samsung Internet${versao(ua, /SamsungBrowser\/(\d+)/)}`;
  else if (/CriOS\//.test(ua)) navegador = `Chrome${versao(ua, /CriOS\/(\d+)/)}`;
  else if (/FxiOS\//.test(ua)) navegador = `Firefox${versao(ua, /FxiOS\/(\d+)/)}`;
  else if (/Firefox\//.test(ua)) navegador = `Firefox${versao(ua, /Firefox\/(\d+)/)}`;
  else if (/Chrome\//.test(ua)) navegador = `Chrome${versao(ua, /Chrome\/(\d+)/)}`;
  else if (/Safari\//.test(ua)) navegador = `Safari${versao(ua, /Version\/(\d+(?:\.\d+)?)/)}`;

  let tipo: DispositivoTipo;
  if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) tipo = 'tablet';
  else if (chMobile === '?1' || /Mobi|iPhone|iPod|Android/.test(ua)) tipo = 'smartphone';
  else if (sistemaOperacional) tipo = 'desktop';
  else tipo = 'desconhecido';

  return { tipo, sistemaOperacional, navegador };
}
