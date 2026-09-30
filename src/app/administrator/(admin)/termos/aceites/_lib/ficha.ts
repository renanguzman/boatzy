/**
 * Ficha de evidências de um aceite: estrutura única (seções de rótulo/valor)
 * usada tanto pela tela de detalhe quanto pelo comprovante em PDF — as duas
 * saídas nunca divergem. Módulo puro (serializável para o cliente).
 */
import type { Database } from '@/types/supabase';
import type { GeoGpsStatus } from '@/lib/termos/tipos';
import { termoIdentificadorLabel } from '@/lib/termos/identificadores';
import { formatarDataHoraBR, protocoloAceite } from '@/lib/termos/formato';

type AceiteRow = Database['public']['Tables']['termos_uso_aceite']['Row'];

export type FichaLinha = { rotulo: string; valor: string; mono?: boolean; link?: string; destaque?: 'ok' | 'alerta' };
export type FichaSecao = { titulo: string; linhas: FichaLinha[] };

export type ComprovanteAceite = {
  protocolo: string;
  evidenciaHash: string;
  secoes: FichaSecao[];
  termo: { titulo: string; versao: number; conteudo: string } | null;
  geradoPor: string;
};

export type ContextoReserva = {
  item_nome: string;
  data_reserva: string;
  status: string;
} | null;

export type Integridade = {
  /** Problemas da cadeia que envolvem este aceite (vazio = íntegro). */
  problemasDesteAceite: string[];
  /** Total de problemas na cadeia inteira. */
  problemasNaCadeia: number;
  /** SHA-256 do texto atual do termo confere com o hash gravado no aceite. */
  textoConfere: boolean | null;
  verificadoEm: string;
};

const GPS_LABEL: Record<GeoGpsStatus, string> = {
  concedida: 'Permitida pelo usuário',
  negada: 'Recusada pelo usuário',
  indisponivel: 'Indisponível no dispositivo',
  tempo_esgotado: 'Sem resposta (tempo esgotado)',
  erro: 'Erro ao obter',
  nao_solicitada: 'Não solicitada',
};

const CONFIRMACAO_LABEL: Record<string, string> = { nome: 'Nome completo', cpf: 'CPF', cnpj: 'CNPJ' };
const CONTEXTO_LABEL: Record<string, string> = { reserva: 'Reserva', embarcacao: 'Cadastro de embarcação' };
const DISPOSITIVO_LABEL: Record<string, string> = {
  desktop: 'Computador', smartphone: 'Smartphone', tablet: 'Tablet', desconhecido: 'Desconhecido',
};
const RESERVA_STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente', aguardando_pagamento: 'Aguardando pagamento', confirmada: 'Confirmada', recusada: 'Recusada',
  cancelada: 'Cancelada', concluida: 'Concluída', expirada: 'Pagamento expirado',
};

const v = (x: string | number | null | undefined): string => (x === null || x === undefined || x === '' ? '—' : String(x));
const simNao = (b: boolean | null | undefined): string => (b === null || b === undefined ? '—' : b ? 'Sim' : 'Não');

function documento(doc: string | null): string {
  const d = (doc ?? '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return v(doc);
}

function coordenadas(lat: number | null, lng: number | null): { valor: string; link?: string } {
  if (lat === null || lng === null) return { valor: '—' };
  return {
    valor: `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`,
    link: `https://www.google.com/maps?q=${lat},${lng}`,
  };
}

function duracao(seg: number | null): string {
  if (seg === null) return '—';
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return m > 0 ? `${m} min ${s.toString().padStart(2, '0')} s` : `${s} s`;
}

export function montarFicha(params: {
  aceite: AceiteRow;
  termo: { titulo: string; versao: number; conteudo: string; publicado_em: string | null } | null;
  reserva: ContextoReserva;
  integridade: Integridade;
}): FichaSecao[] {
  const { aceite: a, termo, reserva, integridade } = params;
  const gpsCoord = coordenadas(a.geo_gps_latitude, a.geo_gps_longitude);
  const ipCoord = coordenadas(a.geo_ip_latitude, a.geo_ip_longitude);
  const localIp = [a.geo_ip_cidade, a.geo_ip_regiao, a.geo_ip_pais].filter(Boolean).join(' / ');

  const contexto: FichaLinha[] = [
    { rotulo: 'Tipo', valor: CONTEXTO_LABEL[a.contexto_tipo] ?? a.contexto_tipo },
    { rotulo: 'Identificador', valor: v(a.contexto_id), mono: true },
  ];
  if (a.contexto_tipo === 'reserva') {
    if (reserva) {
      contexto.push(
        { rotulo: 'Item reservado', valor: reserva.item_nome },
        { rotulo: 'Data da reserva', valor: reserva.data_reserva.split('-').reverse().join('/') },
        { rotulo: 'Situação atual', valor: RESERVA_STATUS_LABEL[reserva.status] ?? reserva.status },
      );
    } else if (a.contexto_id) {
      contexto.push({ rotulo: 'Situação atual', valor: 'Reserva não encontrada (desfeita após o aceite)', destaque: 'alerta' });
    }
  }

  const cadeiaOk = integridade.problemasDesteAceite.length === 0;

  return [
    {
      titulo: 'Termo aceito',
      linhas: [
        { rotulo: 'Termo', valor: termoIdentificadorLabel(a.termo_identificador) },
        { rotulo: 'Título', valor: v(termo?.titulo) },
        { rotulo: 'Versão', valor: String(a.termo_versao) },
        { rotulo: 'Vigente desde', valor: formatarDataHoraBR(termo?.publicado_em) },
        { rotulo: 'Hash do conteúdo (SHA-256)', valor: a.termo_conteudo_hash, mono: true },
      ],
    },
    {
      titulo: 'Titular do aceite',
      linhas: [
        { rotulo: 'Nome', valor: v(a.usuario_nome) },
        { rotulo: 'E-mail', valor: v(a.usuario_email) },
        { rotulo: 'CPF/CNPJ', valor: documento(a.usuario_cpf_cnpj) },
        { rotulo: 'ID do usuário', valor: a.user_id, mono: true },
      ],
    },
    { titulo: 'Ação vinculada', linhas: contexto },
    {
      titulo: 'Data, hora e sessão',
      linhas: [
        { rotulo: 'Aceito em (Brasília)', valor: formatarDataHoraBR(a.aceito_em, { segundos: true }) },
        { rotulo: 'Aceito em (UTC)', valor: new Date(a.aceito_em).toISOString(), mono: true },
        { rotulo: 'Relógio do dispositivo', valor: a.cliente_data_hora ? new Date(a.cliente_data_hora).toISOString() : '—', mono: true },
        { rotulo: 'Fuso do dispositivo', valor: v(a.fuso_horario) },
        { rotulo: 'Sessão autenticada', valor: v(a.sessao_id), mono: true },
        { rotulo: 'Página de origem', valor: v(a.origem_url), mono: true },
      ],
    },
    {
      titulo: 'Rede e dispositivo',
      linhas: [
        { rotulo: 'Endereço IP', valor: v(a.ip), mono: true },
        { rotulo: 'Cadeia de IPs (proxy)', valor: v(a.ip_cadeia), mono: true },
        { rotulo: 'Dispositivo', valor: DISPOSITIVO_LABEL[a.dispositivo_tipo ?? ''] ?? '—' },
        { rotulo: 'Sistema operacional', valor: v(a.sistema_operacional) },
        { rotulo: 'Navegador', valor: v(a.navegador) },
        { rotulo: 'Resolução de tela', valor: v(a.tela_resolucao) },
        { rotulo: 'Idioma', valor: v(a.idioma) },
        { rotulo: 'User-agent', valor: v(a.user_agent), mono: true },
      ],
    },
    {
      titulo: 'Localização',
      linhas: [
        { rotulo: 'Pelo IP', valor: localIp || '—' },
        { rotulo: 'Coordenadas pelo IP', valor: ipCoord.valor, mono: true, link: ipCoord.link },
        { rotulo: 'GPS', valor: GPS_LABEL[a.geo_gps_status] ?? a.geo_gps_status },
        { rotulo: 'Coordenadas GPS', valor: gpsCoord.valor, mono: true, link: gpsCoord.link },
        { rotulo: 'Precisão do GPS', valor: a.geo_gps_precisao_m !== null ? `${Math.round(Number(a.geo_gps_precisao_m))} m` : '—' },
      ],
    },
    {
      titulo: 'Leitura e confirmação',
      linhas: [
        { rotulo: 'Termo aberto em', valor: formatarDataHoraBR(a.termo_aberto_em, { segundos: true }) },
        { rotulo: 'Tempo até o aceite', valor: duracao(a.tempo_leitura_seg) },
        { rotulo: 'Leu até o fim', valor: simNao(a.rolou_ate_fim) },
        { rotulo: 'Confirmação exigida', valor: a.confirmacao_tipo ? CONFIRMACAO_LABEL[a.confirmacao_tipo] : 'Não exigida' },
        { rotulo: 'Valor digitado', valor: v(a.confirmacao_valor) },
        {
          rotulo: 'Confere com o cadastro',
          valor: simNao(a.confirmacao_confere),
          destaque: a.confirmacao_confere === true ? 'ok' : a.confirmacao_confere === false ? 'alerta' : undefined,
        },
      ],
    },
    {
      titulo: 'Integridade do registro',
      linhas: [
        { rotulo: 'Sequência na cadeia', valor: `#${a.sequencia}` },
        { rotulo: 'Hash deste registro', valor: a.evidencia_hash, mono: true },
        { rotulo: 'Hash do registro anterior', valor: a.hash_anterior ?? '— (primeiro registro da cadeia)', mono: true },
        {
          rotulo: 'Verificação da cadeia',
          valor: cadeiaOk
            ? `Íntegro — hash confere e elo com o anterior válido (verificado em ${formatarDataHoraBR(integridade.verificadoEm, { segundos: true })})`
            : `PROBLEMA: ${integridade.problemasDesteAceite.join('; ')}`,
          destaque: cadeiaOk ? 'ok' : 'alerta',
        },
        {
          rotulo: 'Texto do termo',
          valor:
            integridade.textoConfere === null ? '—'
            : integridade.textoConfere ? 'Confere com o hash gravado no aceite'
            : 'NÃO confere com o hash gravado no aceite',
          destaque: integridade.textoConfere === false ? 'alerta' : integridade.textoConfere ? 'ok' : undefined,
        },
      ],
    },
  ];
}

export function montarComprovante(params: {
  aceite: AceiteRow;
  secoes: FichaSecao[];
  termo: { titulo: string; versao: number; conteudo: string } | null;
  geradoPor: string;
}): ComprovanteAceite {
  return {
    protocolo: protocoloAceite(params.aceite.evidencia_hash),
    evidenciaHash: params.aceite.evidencia_hash,
    secoes: params.secoes,
    termo: params.termo,
    geradoPor: params.geradoPor,
  };
}
