'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

/** Mantém paridade com SERVICE_FEE_RATE do BookingCard (exibição) e do resumo. */
const SERVICE_FEE_RATE = 0.12;

export type CriarReservaInput = {
  roteiroId: string;
  data: string; // 'yyyy-mm-dd'
  flex?: number;
  pessoas: number;
  adicionaisIds: string[]; // ids de roteiro_catalogo
};

export type CriarReservaResult = { ok: true; reservaId: string } | { ok: false; error: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function criarReserva(input: CriarReservaInput): Promise<CriarReservaResult> {
  // Cliente deve estar logado.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Você precisa estar logado para solicitar uma reserva.' };

  // Validação dos campos obrigatórios.
  if (!input.roteiroId) return { ok: false, error: 'Roteiro inválido.' };
  if (!input.data || !ISO_DATE.test(input.data)) return { ok: false, error: 'Data inválida.' };
  if (!input.pessoas || input.pessoas < 1) return { ok: false, error: 'Informe o número de pessoas.' };

  // Carrega o roteiro no servidor (fonte da verdade de preço/owner/embarcação).
  const { data: roteiro, error: roteiroErr } = await supabaseAdmin
    .from('roteiro')
    .select('id, nome, preco_base, owner_id, embarcacao_id, ativo')
    .eq('id', input.roteiroId)
    .eq('ativo', true)
    .single();

  if (roteiroErr || !roteiro) return { ok: false, error: 'Roteiro não encontrado ou indisponível.' };

  // Reconstrói os adicionais selecionados a partir dos ids (snapshot dos valores atuais).
  let adicionais: { roteiro_catalogo_id: string; descricao: string; valor: number; tipo: 'produto' | 'servico' }[] = [];
  const ids = [...new Set(input.adicionaisIds)].filter(Boolean);
  if (ids.length > 0) {
    const { data: itens } = await supabaseAdmin
      .from('roteiro_catalogo')
      .select('id, valor_customizado, roteiro_id, catalogo ( descricao, valor, tipo )')
      .eq('roteiro_id', roteiro.id)
      .in('id', ids);

    adicionais = (itens ?? [])
      .filter((it) => it.catalogo)
      .map((it) => {
        const cat = it.catalogo as unknown as { descricao: string; valor: number; tipo: 'produto' | 'servico' };
        return {
          roteiro_catalogo_id: it.id,
          descricao: cat.descricao,
          valor: it.valor_customizado ?? cat.valor,
          tipo: cat.tipo,
        };
      });
  }

  // Cálculo (servidor) — mesma fórmula do resumo/BookingCard.
  const precoBase = roteiro.preco_base != null ? Number(roteiro.preco_base) : null;
  const totalAdicionais = adicionais.reduce((sum, a) => sum + Number(a.valor), 0);
  const subtotal = (precoBase ?? 0) + totalAdicionais;
  const taxaServico = precoBase != null ? Math.round(subtotal * SERVICE_FEE_RATE) : null;
  const totalEstimado = precoBase != null && taxaServico != null ? subtotal + taxaServico : null;

  // Cria a reserva como 'pendente'.
  const { data: reserva, error: insertErr } = await supabaseAdmin
    .from('reserva')
    .insert({
      roteiro_id: roteiro.id,
      embarcacao_id: roteiro.embarcacao_id,
      cliente_id: user.id,
      owner_id: roteiro.owner_id,
      data_reserva: input.data,
      flexibilidade: input.flex && input.flex > 0 ? input.flex : null,
      quantidade_pessoas: input.pessoas,
      roteiro_nome: roteiro.nome,
      preco_base: precoBase,
      total_adicionais: totalAdicionais,
      taxa_servico: taxaServico,
      total_estimado: totalEstimado,
      status: 'pendente',
    })
    .select('id')
    .single();

  if (insertErr || !reserva) {
    return { ok: false, error: insertErr?.message ?? 'Não foi possível criar a reserva.' };
  }

  // Snapshot dos adicionais.
  if (adicionais.length > 0) {
    const { error: addErr } = await supabaseAdmin.from('reserva_adicional').insert(
      adicionais.map((a) => ({
        reserva_id: reserva.id,
        roteiro_catalogo_id: a.roteiro_catalogo_id,
        descricao: a.descricao,
        valor: a.valor,
        tipo: a.tipo,
      })),
    );
    if (addErr) {
      // Reverte a reserva para não deixar registro órfão sem os itens escolhidos.
      await supabaseAdmin.from('reserva').delete().eq('id', reserva.id);
      return { ok: false, error: 'Não foi possível registrar os adicionais da reserva.' };
    }
  }

  return { ok: true, reservaId: reserva.id };
}
