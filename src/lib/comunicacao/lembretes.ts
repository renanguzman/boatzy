import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';
import { hojeISO } from '@/lib/datas';
import { montarLembreteCliente, montarLembreteGestor } from '@/lib/emails/lembrete-passeio';
import { ERRO_SEM_PROVEDOR } from './registrar';
import { agendaLembretes, MARCOS_LEMBRETE, somarDiasISO, type MarcoLembrete } from './agenda';
import { carregarDadosPasseio, carregarExtras, type DadosPasseio, type ExtrasPasseio } from './dados-passeio';
import type { ComunicacaoPapel } from '@/types/supabase';

/**
 * Lembretes do passeio confirmado (SPEC §96) — chamado por `/api/cron/lembretes-passeio`
 * (cron-job.org, a cada 15 min). Para cada reserva `confirmada` de hoje/amanhã cuja janela
 * do marco (D-1 / H-3, ver `agenda.ts`) está aberta, envia ao cliente e ao gestor:
 *   - e-mail (Resend), registrado em `reserva_comunicacao`;
 *   - aviso no sino (`notificacao` tipo `lembrete_passeio` — o trigger registra na linha do tempo);
 *   - WhatsApp: ainda sem integração — o item fica `pendente_integracao` (só o admin vê).
 *
 * Idempotência: a chave 'lembrete:<reserva>:<marco>:<papel>:<canal>' é única. O e-mail é
 * "reservado" (status `agendado`) antes do envio; falha volta como `falhou` e é tentada de novo
 * nas execuções seguintes, até MAX_TENTATIVAS, enquanto a janela estiver aberta. Reserva
 * confirmada depois do início da janela, ou janela que passou sem envio: `dispensado`.
 */

const MAX_TENTATIVAS = 3;
/** Item `agendado` parado há mais que isso (execução interrompida) pode ser retomado. */
const AGENDADO_TRAVADO_MS = 10 * 60_000;
const PAPEIS: ComunicacaoPapel[] = ['cliente', 'gestor'];

type Motivo = 'confirmada_tarde' | 'janela_perdida' | 'sem_contato';

export type ResultadoLembretes = { reservas: number; enviados: number; falhas: number; dispensados: number };

const chave = (reservaId: string, marco: MarcoLembrete, papel: ComunicacaoPapel, canal: 'email' | 'whatsapp') =>
  `lembrete:${reservaId}:${marco}:${papel}:${canal}`;
const tipoLembrete = (marco: MarcoLembrete) => `lembrete_${marco}`;

export async function processarLembretesPasseio(agora: Date = new Date()): Promise<ResultadoLembretes> {
  const hoje = hojeISO();
  const { data, error } = await supabaseAdmin
    .from('reserva')
    .select('id, data_reserva, roteiro ( horario_saida )')
    .eq('status', 'confirmada')
    .gte('data_reserva', hoje)
    .lte('data_reserva', somarDiasISO(hoje, 1));
  if (error) throw new Error(error.message);

  const resultado: ResultadoLembretes = { reservas: 0, enviados: 0, falhas: 0, dispensados: 0 };
  const candidatas = ((data ?? []) as unknown as { id: string; data_reserva: string; roteiro: { horario_saida: string | null } | null }[])
    .filter((r) => {
      const { janelas } = agendaLembretes(r.data_reserva, r.roteiro?.horario_saida);
      return MARCOS_LEMBRETE.some((m) => agora >= janelas[m].inicio);
    });
  if (candidatas.length === 0) return resultado;

  const passeios = await carregarDadosPasseio(candidatas.map((r) => r.id));
  for (const d of passeios) {
    resultado.reservas++;
    try {
      await processarReserva(d, agora, resultado);
    } catch (err) {
      resultado.falhas++;
      console.error('[lembretes]', d.id, err instanceof Error ? err.message : err);
    }
  }
  return resultado;
}

async function processarReserva(d: DadosPasseio, agora: Date, resultado: ResultadoLembretes) {
  if (d.status !== 'confirmada') return; // cancelada entre a consulta e o envio
  const { janelas } = agendaLembretes(d.dataReserva, d.horarioSaida);
  let extras: ExtrasPasseio | null = null;

  for (const marco of MARCOS_LEMBRETE) {
    const { inicio, fim } = janelas[marco];
    if (agora < inicio) continue;

    const motivo: Motivo | null =
      d.confirmadaEm && new Date(d.confirmadaEm) >= inicio ? 'confirmada_tarde'
        : agora >= fim ? 'janela_perdida'
          : null;
    if (motivo) {
      resultado.dispensados += await dispensar(d.id, marco, motivo, inicio);
      continue;
    }

    extras ??= await carregarExtras(d);
    for (const papel of PAPEIS) {
      await avisarNoSino(d, marco, papel);
      await registrarWhatsappPendente(d, marco, papel, inicio);
      const r = await enviarEmailLembrete(d, marco, papel, extras, inicio);
      if (r === 'enviado') resultado.enviados++;
      else if (r === 'falhou') resultado.falhas++;
      else if (r === 'dispensado') resultado.dispensados++;
    }
  }
}

/** Grava "não enviado" uma única vez por papel (a chave do e-mail ocupa o lugar do envio). */
async function dispensar(reservaId: string, marco: MarcoLembrete, motivo: Motivo, inicio: Date): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('reserva_comunicacao')
    .upsert(
      PAPEIS.map((papel) => ({
        reserva_id: reservaId,
        tipo: tipoLembrete(marco),
        papel,
        canal: 'email' as const,
        status: 'dispensado' as const,
        erro: motivo,
        chave: chave(reservaId, marco, papel, 'email'),
        agendado_para: inicio.toISOString(),
      })),
      { onConflict: 'chave', ignoreDuplicates: true },
    )
    .select('id');
  if (error) console.error('[lembretes] dispensar', reservaId, error.message);
  return data?.length ?? 0;
}

async function avisarNoSino(d: DadosPasseio, marco: MarcoLembrete, papel: ComunicacaoPapel) {
  const hora = d.horarioSaida?.slice(0, 5) ?? null;
  const dataBR = d.dataReserva.split('-').reverse().join('/');
  const linha = papel === 'cliente'
    ? {
        user_id: d.clienteId,
        publico: 'cliente' as const,
        titulo: marco === 'd1' ? 'Seu passeio é amanhã' : hora ? `Falta pouco: seu passeio sai às ${hora}` : 'Seu passeio é hoje',
        mensagem: `${d.item} — ${dataBR}. Confira o ponto de embarque e os detalhes da reserva.`,
        link: `/minhas-reservas/${d.id}`,
        chave: `lembrete:${d.id}:${marco}`,
        dados: { item: d.item, data: d.dataReserva, horario: hora, marco },
      }
    : {
        user_id: d.ownerId,
        publico: 'gestor' as const,
        titulo: marco === 'd1' ? `Passeio amanhã: ${d.item}` : hora ? `Passeio em 3 horas: ${d.item}` : `Passeio hoje: ${d.item}`,
        mensagem: `${d.cliente.nome} · ${d.pessoas} pessoa${d.pessoas === 1 ? '' : 's'}${hora ? ` · saída às ${hora}` : ' · sem horário de saída cadastrado'}.`,
        link: `/painel/agendamentos/${d.id}`,
        chave: `gestor:lembrete:${d.id}:${marco}`,
        dados: null,
      };
  const { error } = await supabaseAdmin.from('notificacao').insert({ ...linha, tipo: 'lembrete_passeio', reserva_id: d.id });
  // 23505 = aviso já enviado nesta janela.
  if (error && error.code !== '23505') console.error('[lembretes] aviso', d.id, papel, error.message);
}

/** Pendência: integração com WhatsApp (PRD §6.15). O item fica registrado para o admin acompanhar. */
async function registrarWhatsappPendente(d: DadosPasseio, marco: MarcoLembrete, papel: ComunicacaoPapel, inicio: Date) {
  const { error } = await supabaseAdmin.from('reserva_comunicacao').upsert(
    {
      reserva_id: d.id,
      tipo: tipoLembrete(marco),
      papel,
      canal: 'whatsapp',
      status: 'pendente_integracao',
      destino: (papel === 'cliente' ? d.cliente.telefone : d.gestor.telefone) ?? null,
      resumo: 'Envio por WhatsApp aguardando a integração.',
      chave: chave(d.id, marco, papel, 'whatsapp'),
      agendado_para: inicio.toISOString(),
    },
    { onConflict: 'chave', ignoreDuplicates: true },
  );
  if (error) console.error('[lembretes] whatsapp', d.id, papel, error.message);
}

/**
 * Reserva a chave do e-mail e envia. Devolve o que aconteceu nesta execução, ou null se não era
 * para enviar agora (já enviado, em andamento em outra execução ou tentativas esgotadas).
 */
async function enviarEmailLembrete(
  d: DadosPasseio,
  marco: MarcoLembrete,
  papel: ComunicacaoPapel,
  extras: ExtrasPasseio,
  inicio: Date,
): Promise<'enviado' | 'falhou' | 'dispensado' | null> {
  const k = chave(d.id, marco, papel, 'email');
  const para = papel === 'cliente' ? d.cliente.email : d.gestor.email;

  const item = await reservar(k, {
    reserva_id: d.id,
    tipo: tipoLembrete(marco),
    papel,
    canal: 'email',
    destino: para,
    agendado_para: inicio.toISOString(),
  });
  if (!item) return null;

  if (!para) {
    await supabaseAdmin.from('reserva_comunicacao')
      .update({ status: 'dispensado', erro: 'sem_contato', tentativas: MAX_TENTATIVAS })
      .eq('id', item.id);
    return 'dispensado';
  }

  let assunto: string | null = null;
  try {
    const email = papel === 'cliente'
      ? await montarLembreteCliente(d, marco, extras)
      : montarLembreteGestor(d, marco, extras);
    assunto = email.assunto;
    const r = await sendEmail({ to: para, subject: email.assunto, html: email.html });
    await supabaseAdmin.from('reserva_comunicacao').update({
      status: r.ok ? 'enviado' : 'falhou',
      assunto,
      destino: para,
      provedor_id: r.ok ? (r.id ?? null) : null,
      erro: r.ok ? null : r.error === 'no_provider' ? ERRO_SEM_PROVEDOR : r.error,
      tentativas: item.tentativas + 1,
      enviado_em: r.ok ? new Date().toISOString() : null,
    }).eq('id', item.id);
    return r.ok ? 'enviado' : 'falhou';
  } catch (err) {
    await supabaseAdmin.from('reserva_comunicacao').update({
      status: 'falhou',
      assunto,
      erro: err instanceof Error ? err.message.slice(0, 300) : 'erro',
      tentativas: item.tentativas + 1,
    }).eq('id', item.id);
    return 'falhou';
  }
}

type ItemReservado = { id: string; tentativas: number };

/**
 * Cria o item `agendado` com a chave; se já existe, só o retoma quando falhou (com tentativas
 * sobrando) ou ficou travado em `agendado`. A troca de status é condicional — duas execuções
 * simultâneas não enviam o mesmo e-mail.
 */
async function reservar(
  k: string,
  base: { reserva_id: string; tipo: string; papel: ComunicacaoPapel; canal: 'email'; destino: string | null; agendado_para: string },
): Promise<ItemReservado | null> {
  const { data: novo, error } = await supabaseAdmin
    .from('reserva_comunicacao')
    .insert({ ...base, status: 'agendado', chave: k })
    .select('id, tentativas')
    .maybeSingle();
  if (novo) return novo;
  if (error && error.code !== '23505') throw new Error(error.message);

  const { data: atual } = await supabaseAdmin
    .from('reserva_comunicacao')
    .select('id, status, tentativas, atualizado_em')
    .eq('chave', k)
    .maybeSingle();
  if (!atual || atual.tentativas >= MAX_TENTATIVAS) return null;
  const travado = atual.status === 'agendado' && Date.now() - new Date(atual.atualizado_em).getTime() > AGENDADO_TRAVADO_MS;
  if (atual.status !== 'falhou' && !travado) return null;

  const { data: retomado } = await supabaseAdmin
    .from('reserva_comunicacao')
    .update({ status: 'agendado', erro: null })
    .eq('id', atual.id)
    .eq('status', atual.status)
    .eq('atualizado_em', atual.atualizado_em)
    .select('id, tentativas')
    .maybeSingle();
  return retomado ?? null;
}
