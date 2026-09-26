/**
 * Coleta das evidências do lado do navegador para o aceite de termos.
 * Só roda no cliente (usa window/navigator). O dispositivo, IP e horário
 * oficial são capturados no servidor — aqui entra apenas o que só o
 * navegador sabe.
 */
import type { EvidenciasCliente, GeoGps } from './tipos';

/** Ambiente do navegador: tela, idioma, fuso e relógio local. */
export function coletarAmbienteNavegador(): Pick<
  EvidenciasCliente,
  'telaResolucao' | 'idioma' | 'fusoHorario' | 'clienteDataHora'
> {
  let fusoHorario: string | null = null;
  try {
    fusoHorario = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch { /* navegador sem Intl completo */ }

  return {
    telaResolucao: `${window.screen.width}x${window.screen.height}@${window.devicePixelRatio || 1}x`,
    idioma: navigator.language ?? null,
    fusoHorario,
    clienteDataHora: new Date().toISOString(),
  };
}

/**
 * Pede a localização precisa (GPS). Nunca rejeita: recusa, indisponibilidade
 * e demora viram status registrados como evidência — o aceite não depende disso.
 */
export function solicitarGeolocalizacao(timeoutMs = 10_000): Promise<GeoGps> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({ status: 'indisponivel' });
  }

  return new Promise((resolve) => {
    let resolvido = false;
    const concluir = (g: GeoGps) => {
      if (resolvido) return;
      resolvido = true;
      clearTimeout(timer);
      resolve(g);
    };

    // Alguns navegadores nunca respondem se o usuário ignora o pedido de permissão.
    const timer = setTimeout(() => concluir({ status: 'tempo_esgotado' }), timeoutMs + 1_000);

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        concluir({
          status: 'concedida',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          precisaoM: pos.coords.accuracy,
        }),
      (err) =>
        concluir({
          status:
            err.code === err.PERMISSION_DENIED ? 'negada'
            : err.code === err.TIMEOUT ? 'tempo_esgotado'
            : err.code === err.POSITION_UNAVAILABLE ? 'indisponivel'
            : 'erro',
        }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}
