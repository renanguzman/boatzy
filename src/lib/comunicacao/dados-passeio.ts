import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { listarCobrancasDaReserva } from '@/lib/pagamentos/avulso';
import { buscarPrevisaoTempo, type PrevisaoTempo } from '@/lib/weather';
import { nomeCurtoDocumento } from '@/lib/documentos/tipos';
import type { DocumentoTipo, PedidoStatus, ReservaStatus } from '@/types/supabase';

/**
 * Tudo o que os lembretes do passeio mostram (SPEC §96): roteiro, ponto de embarque, paradas,
 * embarcação e regras, adicionais, equipe, contatos, pagamento, previsão do tempo e — para o
 * gestor — documentos vencidos até o dia do passeio.
 */

type Um<T> = T | T[] | null;
const um = <T,>(v: Um<T> | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

type EmbarcacaoResumo = { nome: string; regras: string[] | null };

type Linha = {
  id: string;
  cliente_id: string;
  owner_id: string;
  embarcacao_id: string | null;
  status: ReservaStatus;
  data_reserva: string;
  data_fim_reserva: string | null;
  quantidade_pessoas: number;
  item_nome: string;
  total_estimado: number | null;
  observacao_gestor: string | null;
  respondido_em: string | null;
  aceita_em: string | null;
  roteiro: {
    nome: string;
    embarcacao_id: string | null;
    origem: string | null;
    destino: string | null;
    horario_saida: string | null;
    duracao_horas: number | null;
    logradouro: string | null;
    logradouro_numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cep: string | null;
    latitude: number | null;
    longitude: number | null;
    municipios: { nome: string; estados: { uf: string } | null } | null;
    roteiro_parada: { nome: string; ordem: number }[];
    embarcacao: Um<EmbarcacaoResumo>;
  } | null;
  embarcacao: Um<EmbarcacaoResumo>;
  cliente: { name: string | null; email: string | null; phone: string | null; idioma: string | null } | null;
  reserva_adicional: { descricao: string; tipo: string }[];
  reserva_atendente: { equipe_membro: { nome_completo: string; telefone: string | null; is_gestor: boolean } | null }[];
  pedido: Um<{ status: PedidoStatus; pago_em: string | null; valor_total: number; valor_itens: number }>;
};

export type DadosPasseio = {
  id: string;
  clienteId: string;
  ownerId: string;
  status: ReservaStatus;
  item: string;
  dataReserva: string;
  dataFimReserva: string | null;
  pessoas: number;
  horarioSaida: string | null;
  duracaoHoras: number | null;
  origem: string | null;
  destino: string | null;
  /** Endereço do ponto de embarque numa linha (logradouro, nº, complemento, bairro, CEP). */
  endereco: string | null;
  localidade: string | null;
  mapaUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  paradas: string[];
  embarcacaoId: string | null;
  embarcacao: string | null;
  regras: string[];
  adicionais: { descricao: string; tipo: string }[];
  atendentes: { nome: string; telefone: string | null; isGestor: boolean }[];
  observacaoGestor: string | null;
  cliente: { nome: string; email: string | null; telefone: string | null; idioma: string | null };
  gestor: { nome: string; email: string | null; telefone: string | null };
  /** Pago pelo Boatzy (pedido pago) ou combinado direto com o gestor. */
  pagamento: { pagoBoatzy: boolean; valorTotal: number | null; valorGestor: number | null };
  /** Quando a reserva ficou confirmada (pagamento aprovado ou confirmação do gestor). */
  confirmadaEm: string | null;
};

export async function carregarDadosPasseio(reservaIds: string[]): Promise<DadosPasseio[]> {
  if (reservaIds.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from('reserva')
    .select(
      `id, cliente_id, owner_id, embarcacao_id, status, data_reserva, data_fim_reserva, quantidade_pessoas, item_nome,
       total_estimado, observacao_gestor, respondido_em, aceita_em,
       roteiro ( nome, embarcacao_id, origem, destino, horario_saida, duracao_horas, logradouro, logradouro_numero,
                 complemento, bairro, cep, latitude, longitude, municipios ( nome, estados ( uf ) ),
                 roteiro_parada ( nome, ordem ), embarcacao ( nome, regras ) ),
       embarcacao ( nome, regras ),
       cliente:users!reserva_cliente_id_fkey ( name, email, phone, idioma ),
       reserva_adicional ( descricao, tipo ),
       reserva_atendente ( equipe_membro ( nome_completo, telefone, is_gestor ) ),
       pedido ( status, pago_em, valor_total, valor_itens )`,
    )
    .in('id', reservaIds);
  if (error) throw new Error(`carregarDadosPasseio: ${error.message}`);
  const linhas = (data ?? []) as unknown as Linha[];

  const ownerIds = [...new Set(linhas.map((l) => l.owner_id))];
  const { data: gestores } = await supabaseAdmin.from('users').select('id, name, email, phone').in('id', ownerIds);
  const gestorPorId = new Map((gestores ?? []).map((g) => [g.id, g]));

  return linhas.map((l) => {
    const ro = l.roteiro;
    const emb = um(l.embarcacao) ?? um(ro?.embarcacao);
    const localidade = ro?.municipios
      ? `${ro.municipios.nome}${ro.municipios.estados ? `/${ro.municipios.estados.uf}` : ''}`
      : null;
    const endereco = ro?.logradouro
      ? [
          `${ro.logradouro}${ro.logradouro_numero ? `, ${ro.logradouro_numero}` : ''}${ro.complemento ? ` — ${ro.complemento}` : ''}`,
          ro.bairro,
          localidade,
          ro.cep ? `CEP ${ro.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')}` : null,
        ].filter(Boolean).join(' · ')
      : null;
    const pedido = um(l.pedido);
    const pagoBoatzy = pedido?.status === 'pago';
    const g = gestorPorId.get(l.owner_id);
    return {
      id: l.id,
      clienteId: l.cliente_id,
      ownerId: l.owner_id,
      status: l.status,
      item: ro?.nome ?? l.item_nome,
      dataReserva: l.data_reserva,
      dataFimReserva: l.data_fim_reserva,
      pessoas: l.quantidade_pessoas,
      horarioSaida: ro?.horario_saida ?? null,
      duracaoHoras: ro?.duracao_horas ?? null,
      origem: ro?.origem ?? null,
      destino: ro?.destino ?? null,
      endereco,
      localidade,
      mapaUrl: ro?.latitude != null && ro?.longitude != null
        ? `https://www.google.com/maps/search/?api=1&query=${ro.latitude},${ro.longitude}`
        : null,
      latitude: ro?.latitude ?? null,
      longitude: ro?.longitude ?? null,
      paradas: [...(ro?.roteiro_parada ?? [])].sort((a, b) => a.ordem - b.ordem).map((p) => p.nome),
      embarcacaoId: l.embarcacao_id ?? ro?.embarcacao_id ?? null,
      embarcacao: emb?.nome ?? null,
      regras: emb?.regras ?? [],
      adicionais: l.reserva_adicional ?? [],
      atendentes: (l.reserva_atendente ?? [])
        .map((a) => a.equipe_membro)
        .filter((m): m is NonNullable<typeof m> => m != null)
        .sort((a, b) => Number(b.is_gestor) - Number(a.is_gestor))
        .map((m) => ({ nome: m.nome_completo, telefone: m.telefone, isGestor: m.is_gestor })),
      observacaoGestor: l.observacao_gestor,
      cliente: {
        nome: l.cliente?.name?.trim() || 'Cliente',
        email: l.cliente?.email ?? null,
        telefone: l.cliente?.phone ?? null,
        idioma: l.cliente?.idioma ?? null,
      },
      gestor: { nome: g?.name?.trim() || 'Proprietário', email: g?.email ?? null, telefone: g?.phone ?? null },
      pagamento: {
        pagoBoatzy,
        valorTotal: pedido ? Number(pedido.valor_total) : l.total_estimado != null ? Number(l.total_estimado) : null,
        valorGestor: pagoBoatzy && pedido ? Number(pedido.valor_itens) : null,
      },
      confirmadaEm: (pagoBoatzy ? pedido?.pago_em : null) ?? l.aceita_em ?? l.respondido_em,
    };
  });
}

/** Extras buscados só na hora de enviar: previsão do tempo, cobranças em aberto e documentos vencidos. */
export type ExtrasPasseio = {
  previsao: PrevisaoTempo | null;
  cobrancasAbertas: number;
  /** Só para o gestor: documentos da embarcação do passeio e dos condutores vencidos antes do dia do passeio. */
  documentosVencidos: string[];
};

export async function carregarExtras(d: DadosPasseio): Promise<ExtrasPasseio> {
  const [previsao, cobrancas, documentos] = await Promise.all([
    d.latitude != null && d.longitude != null
      ? buscarPrevisaoTempo(d.latitude, d.longitude, d.dataReserva).catch(() => null)
      : Promise.resolve(null),
    listarCobrancasDaReserva(d.id).catch(() => []),
    supabaseAdmin
      .from('documento')
      .select('tipo, titulo, data_validade, embarcacao_nome')
      .eq('owner_id', d.ownerId)
      .is('arquivado_em', null)
      .not('data_validade', 'is', null)
      .lt('data_validade', d.dataReserva)
      .or(d.embarcacaoId ? `escopo.eq.condutor,embarcacao_id.eq.${d.embarcacaoId}` : 'escopo.eq.condutor')
      .then(({ data }) => data ?? []),
  ]);
  return {
    previsao: previsao?.status === 'ok' ? previsao.previsao : null,
    cobrancasAbertas: cobrancas.filter((c) => c.status === 'aguardando_pagamento').length,
    documentosVencidos: documentos.map((doc) =>
      `${nomeCurtoDocumento(doc.tipo as DocumentoTipo, doc.titulo)}${doc.embarcacao_nome ? ` (${doc.embarcacao_nome})` : ''}`),
  };
}
