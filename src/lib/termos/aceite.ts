import 'server-only';

import { isIP } from 'node:net';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import { confereConfirmacao, definirConfirmacao } from './confirmacao';
import { identificarDispositivo } from './dispositivo';
import type { TermoIdentificador } from './identificadores';
import type {
  AceiteContexto,
  AceiteErroCodigo,
  EvidenciasCliente,
  GeoGpsStatus,
  TermoParaAceite,
} from './tipos';

type AceiteInsert = Database['public']['Tables']['termos_uso_aceite']['Insert'];

const GPS_STATUS: GeoGpsStatus[] = ['concedida', 'negada', 'indisponivel', 'tempo_esgotado', 'erro', 'nao_solicitada'];

// Janela plausível para o horário em que o termo foi aberto (evita valores absurdos).
const LEITURA_MAX_MS = 24 * 60 * 60 * 1000;

// ─── Sanitização de dados vindos do navegador ─────────────────────────────

function texto(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function numeroEntre(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
}

function dataIso(v: unknown): Date | null {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ─── Evidências de servidor ───────────────────────────────────────────────

async function evidenciasServidor() {
  const h = await headers();

  const cadeia = h.get('x-forwarded-for');
  const candidato = cadeia?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || null;
  const ip = candidato && isIP(candidato) ? candidato : null;

  const userAgent = texto(h.get('user-agent'), 1000);
  const dispositivo = identificarDispositivo(userAgent, h.get('sec-ch-ua-mobile'));

  // Geolocalização aproximada pelo IP — headers injetados pela Vercel (ausentes em localhost).
  let cidade = h.get('x-vercel-ip-city');
  try {
    cidade = cidade ? decodeURIComponent(cidade) : null;
  } catch { /* mantém o valor bruto */ }
  const lat = Number(h.get('x-vercel-ip-latitude'));
  const lng = Number(h.get('x-vercel-ip-longitude'));

  // session_id do JWT do Supabase Auth: amarra o aceite à sessão autenticada.
  let sessaoId: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    sessaoId = typeof data?.claims?.session_id === 'string' ? data.claims.session_id : null;
  } catch { /* sem sessão legível — segue sem o id */ }

  return {
    ip,
    ip_cadeia: texto(cadeia, 500),
    user_agent: userAgent,
    sessao_id: sessaoId,
    origem_url: texto(h.get('referer'), 1000),
    dispositivo_tipo: dispositivo.tipo,
    sistema_operacional: dispositivo.sistemaOperacional,
    navegador: dispositivo.navegador,
    geo_ip_cidade: texto(cidade, 120),
    geo_ip_regiao: texto(h.get('x-vercel-ip-country-region'), 20),
    geo_ip_pais: texto(h.get('x-vercel-ip-country'), 10),
    geo_ip_latitude: h.get('x-vercel-ip-latitude') ? numeroEntre(lat, -90, 90) : null,
    geo_ip_longitude: h.get('x-vercel-ip-longitude') ? numeroEntre(lng, -180, 180) : null,
  };
}

// ─── Leitura do termo vigente ─────────────────────────────────────────────

async function buscarVigente(identificador: string) {
  const { data } = await supabaseAdmin
    .from('termos_uso_plataforma')
    .select('id, identificador, versao, titulo, conteudo, conteudo_hash, publicado_em, exige_rolagem_completa, exige_confirmacao_digitada')
    .eq('identificador', identificador)
    .eq('status', 'publicado')
    .maybeSingle();
  return data;
}

async function buscarUsuario(userId: string) {
  const { data } = await supabaseAdmin
    .from('users')
    .select('name, cpf_cnpj')
    .eq('id', userId)
    .maybeSingle();
  return data;
}

/**
 * Versão vigente de um termo, pronta para exibição ao usuário, já com a
 * confirmação digitada que será exigida DESTE usuário (CPF/CNPJ ou nome).
 * Retorna null se não houver versão publicada.
 */
export async function obterTermoParaAceite(
  identificador: TermoIdentificador,
  userId: string,
): Promise<TermoParaAceite | null> {
  const [termo, usuario] = await Promise.all([buscarVigente(identificador), buscarUsuario(userId)]);
  if (!termo || !termo.conteudo_hash || !termo.publicado_em) return null;

  return {
    id: termo.id,
    identificador: termo.identificador,
    versao: termo.versao,
    titulo: termo.titulo,
    conteudo: termo.conteudo,
    conteudoHash: termo.conteudo_hash,
    publicadoEm: termo.publicado_em,
    exigeRolagemCompleta: termo.exige_rolagem_completa,
    confirmacao: termo.exige_confirmacao_digitada && usuario ? definirConfirmacao(usuario) : null,
  };
}

// ─── Validação + gravação ─────────────────────────────────────────────────

export type RegistrarAceiteInput = {
  identificador: TermoIdentificador;
  /** Versão que o usuário leu (id retornado por obterTermoParaAceite). */
  termoId: string;
  userId: string;
  contexto: AceiteContexto;
  evidencias: EvidenciasCliente;
};

type Falha = { ok: false; codigo: AceiteErroCodigo; error: string };

/** Aceite validado e pronto para gravar — sem o id do contexto, que pode não existir ainda. */
export type AceitePreparado = { ok: true; registro: Omit<AceiteInsert, 'contexto_id'> };

export type AceiteRegistrado = { ok: true; aceiteId: string; evidenciaHash: string; aceitoEm: string };

/**
 * Valida o aceite e monta o registro, SEM gravar. Permite validar antes de
 * criar a entidade da ação (ex.: a reserva) e só gravar depois, já com o id dela.
 *
 * Recusa: termo sem versão vigente, versão lida ≠ vigente (o termo mudou
 * durante a leitura), leitura incompleta quando exigida, e confirmação
 * digitada ausente ou que não confere com o cadastro.
 */
export async function validarAceite(input: RegistrarAceiteInput): Promise<AceitePreparado | Falha> {
  const [termo, usuario] = await Promise.all([buscarVigente(input.identificador), buscarUsuario(input.userId)]);

  if (!termo) {
    return { ok: false, codigo: 'termo_indisponivel', error: 'Este termo não está disponível no momento. Tente novamente mais tarde.' };
  }
  if (termo.id !== input.termoId) {
    return {
      ok: false,
      codigo: 'versao_desatualizada',
      error: 'O termo foi atualizado enquanto você o lia. Leia a nova versão para prosseguir.',
    };
  }
  if (!usuario) return { ok: false, codigo: 'usuario_invalido', error: 'Usuário não encontrado.' };

  const ev = input.evidencias;
  const rolouAteFim = ev.rolouAteFim === true;
  if (termo.exige_rolagem_completa && !rolouAteFim) {
    return { ok: false, codigo: 'leitura_incompleta', error: 'Leia o termo até o final para prosseguir.' };
  }

  let confirmacao: Pick<AceiteInsert, 'confirmacao_tipo' | 'confirmacao_valor' | 'confirmacao_confere'> = {
    confirmacao_tipo: null,
    confirmacao_valor: null,
    confirmacao_confere: null,
  };
  if (termo.exige_confirmacao_digitada) {
    const exigida = definirConfirmacao(usuario);
    if (exigida) {
      const digitado = texto(ev.confirmacaoValor, 200);
      if (!digitado || !confereConfirmacao(exigida.tipo, digitado, usuario)) {
        return {
          ok: false,
          codigo: 'confirmacao_invalida',
          error: `A confirmação não confere. Digite ${exigida.rotulo}.`,
        };
      }
      confirmacao = { confirmacao_tipo: exigida.tipo, confirmacao_valor: digitado, confirmacao_confere: true };
    }
  }

  // GPS: coordenadas só valem com status "concedida" e dentro dos limites.
  const gpsStatus: GeoGpsStatus = GPS_STATUS.includes(ev.geo?.status) ? ev.geo.status : 'nao_solicitada';
  const gpsLat = numeroEntre(ev.geo?.latitude, -90, 90);
  const gpsLng = numeroEntre(ev.geo?.longitude, -180, 180);
  const gpsOk = gpsStatus === 'concedida' && gpsLat !== null && gpsLng !== null;

  // Tempo de leitura: início informado pelo navegador, fim pelo relógio do servidor.
  const agora = Date.now();
  const abertoEm = dataIso(ev.termoAbertoEm);
  const abertoValido = abertoEm && abertoEm.getTime() <= agora && agora - abertoEm.getTime() <= LEITURA_MAX_MS;

  const servidor = await evidenciasServidor();

  return {
    ok: true,
    registro: {
      termo_id: termo.id,
      user_id: input.userId,
      contexto_tipo: input.contexto.tipo,
      ...servidor,
      tela_resolucao: texto(ev.telaResolucao, 40),
      idioma: texto(ev.idioma, 40),
      fuso_horario: texto(ev.fusoHorario, 60),
      cliente_data_hora: dataIso(ev.clienteDataHora)?.toISOString() ?? null,
      geo_gps_status: gpsOk ? 'concedida' : gpsStatus === 'concedida' ? 'erro' : gpsStatus,
      geo_gps_latitude: gpsOk ? gpsLat : null,
      geo_gps_longitude: gpsOk ? gpsLng : null,
      geo_gps_precisao_m: gpsOk ? numeroEntre(ev.geo.precisaoM, 0, 1e7) : null,
      ...confirmacao,
      termo_aberto_em: abertoValido ? abertoEm.toISOString() : null,
      tempo_leitura_seg: abertoValido ? Math.round((agora - abertoEm.getTime()) / 1000) : null,
      rolou_ate_fim: rolouAteFim,
    },
  };
}

/** Grava um aceite já validado. Snapshots, data/hora e hash são preenchidos pelo banco. */
export async function gravarAceite(
  preparado: AceitePreparado,
  contextoId?: string | null,
): Promise<AceiteRegistrado | Falha> {
  const { data, error } = await supabaseAdmin
    .from('termos_uso_aceite')
    .insert({ ...preparado.registro, contexto_id: contextoId ?? null })
    .select('id, evidencia_hash, aceito_em')
    .single();

  if (error || !data) {
    console.error('[termos] falha ao gravar aceite', error);
    return { ok: false, codigo: 'erro', error: 'Não foi possível registrar o aceite do termo. Tente novamente.' };
  }
  return { ok: true, aceiteId: data.id, evidenciaHash: data.evidencia_hash, aceitoEm: data.aceito_em };
}

/** Valida e grava numa chamada — para quando o id do contexto já é conhecido. */
export async function registrarAceite(input: RegistrarAceiteInput): Promise<AceiteRegistrado | Falha> {
  const preparado = await validarAceite(input);
  if (!preparado.ok) return preparado;
  return gravarAceite(preparado, input.contexto.id);
}
