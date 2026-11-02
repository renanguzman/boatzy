import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getRolesFromDb } from '@/lib/roles';
import { ehUuid } from '@/lib/upload-imagem-server';
import { formatarComprimento } from '@/lib/comprimento';
import { fatosDoOperador } from '@/lib/descricao/fatos-operador';
import { gerarDescricao } from '@/lib/descricao/gerar';
import {
  LIMITES_DESCRICAO, podeGerar, type AlvoDescricao, type FatoDescricao, type PedidoDescricao, type RespostaDescricao,
} from '@/lib/descricao/assistente';

/** A escrita leva alguns segundos; com pesquisa na web, um pouco mais (SPEC §98). */
export const maxDuration = 60;

/** Limite por pessoa: protege o custo da IA (memória da instância — basta como freio). */
const JANELA_MS = 10 * 60 * 1000;
const MAX_POR_JANELA = 15;
const pedidosPorUsuario = new Map<string, number[]>();

function dentroDoLimite(userId: string): boolean {
  const agora = Date.now();
  const recentes = (pedidosPorUsuario.get(userId) ?? []).filter((t) => agora - t < JANELA_MS);
  if (recentes.length >= MAX_POR_JANELA) {
    pedidosPorUsuario.set(userId, recentes);
    return false;
  }
  pedidosPorUsuario.set(userId, [...recentes, agora]);
  return true;
}

const responder = (r: RespostaDescricao, status = 200) => NextResponse.json(r, { status });

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function lerPedido(body: unknown): PedidoDescricao | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const alvo: AlvoDescricao | null = b.alvo === 'embarcacao' || b.alvo === 'roteiro' || b.alvo === 'operador' ? b.alvo : null;
  if (!alvo) return null;
  const fatos = (Array.isArray(b.fatos) ? b.fatos : [])
    .slice(0, LIMITES_DESCRICAO.fatos)
    .map((f) => {
      const o = (f ?? {}) as Record<string, unknown>;
      return { rotulo: texto(o.rotulo, 60), valor: texto(o.valor, LIMITES_DESCRICAO.valorFato) };
    })
    .filter((f) => f.rotulo && f.valor);
  const destaques = (Array.isArray(b.destaques) ? b.destaques : [])
    .slice(0, LIMITES_DESCRICAO.destaques)
    .map((d) => texto(d, 80))
    .filter(Boolean);
  return {
    alvo,
    fatos,
    destaques,
    relato: texto(b.relato, LIMITES_DESCRICAO.relato),
    textoAtual: texto(b.textoAtual, LIMITES_DESCRICAO.textoAtual),
    embarcacaoId: typeof b.embarcacaoId === 'string' && ehUuid(b.embarcacaoId) ? b.embarcacaoId : null,
    versaoAnterior: texto(b.versaoAnterior, LIMITES_DESCRICAO.textoAtual) || null,
    // Pesquisa na web só no passeio (sobre os lugares do itinerário).
    pesquisar: alvo === 'roteiro' && b.pesquisar === true,
    // Operador: pessoa ("Sou…") ou empresa ("Somos…").
    voz: alvo === 'operador' && b.voz === 'empresa' ? 'empresa' : 'primeira',
  };
}

/** Roteiro: os dados da embarcação vinculada entram como fatos (do próprio gestor; admin, qualquer uma). */
async function fatosDaEmbarcacao(embarcacaoId: string, userId: string, admin: boolean): Promise<FatoDescricao[]> {
  let consulta = supabaseAdmin
    .from('embarcacao')
    .select('nome, capacidade, comprimento, comprimento_unidade, embarcacao_tipo ( nome ), embarcacao_comodidades ( comodidade ( nome ) )')
    .eq('id', embarcacaoId);
  if (!admin) consulta = consulta.eq('owner_id', userId);
  const { data } = await consulta.maybeSingle();
  if (!data) return [];
  const tipo = (data.embarcacao_tipo as unknown as { nome: string } | null)?.nome;
  const comodidades = ((data.embarcacao_comodidades ?? []) as unknown as { comodidade: { nome: string } | null }[])
    .map((c) => c.comodidade?.nome)
    .filter(Boolean);
  const resumo = [
    data.nome,
    tipo ? tipo.toLowerCase() : null,
    data.comprimento != null ? formatarComprimento(String(data.comprimento), data.comprimento_unidade ?? 'm') : null,
    data.capacidade != null ? `até ${data.capacidade} pessoas` : null,
  ].filter(Boolean).join(', ');
  return [
    { rotulo: 'Embarcação', valor: resumo },
    ...(comodidades.length ? [{ rotulo: 'A bordo da embarcação', valor: comodidades.join(', ') }] : []),
  ];
}

const PEDIR_RELATO: Record<AlvoDescricao, string> = {
  embarcacao: 'Fale ou escreva algo sobre a embarcação, ou toque em pelo menos uma opção.',
  roteiro: 'Fale ou escreva algo sobre o passeio, ou toque em pelo menos uma opção.',
  operador: 'Conte um pouco sobre você e o seu trabalho, ou toque em pelo menos uma opção.',
};

/**
 * POST /api/painel/descricao — escreve a descrição da embarcação ou do passeio, ou a
 * apresentação do operador (SPEC §99), a partir
 * dos fatos do cadastro, do relato e dos destaques. Devolve o texto para o dono revisar.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return responder({ ok: false, error: 'Sua sessão expirou. Entre de novo no painel.' }, 401);
  const papeis = await getRolesFromDb(user.id);
  if (!papeis.includes('gestor') && !papeis.includes('admin')) {
    return responder({ ok: false, error: 'Acesso não autorizado.' }, 403);
  }

  const pedido = lerPedido(await req.json().catch(() => null));
  if (!pedido) return responder({ ok: false, error: 'Pedido inválido.' }, 400);
  if (!podeGerar(pedido.relato, pedido.destaques) && !pedido.textoAtual) {
    return responder({ ok: false, error: PEDIR_RELATO[pedido.alvo] }, 400);
  }
  if (!dentroDoLimite(user.id)) {
    return responder({ ok: false, error: 'Você pediu muitos textos seguidos. Aguarde alguns minutos e tente de novo.' }, 429);
  }

  let fatos: FatoDescricao[];
  if (pedido.alvo === 'roteiro' && pedido.embarcacaoId) {
    fatos = [
      ...pedido.fatos.filter((f) => f.rotulo !== 'Embarcação'),
      ...(await fatosDaEmbarcacao(pedido.embarcacaoId, user.id, papeis.includes('admin'))),
    ];
  } else if (pedido.alvo === 'operador') {
    fatos = await fatosDoOperador(user.id, pedido.fatos.find((f) => f.rotulo === 'Nome')?.valor ?? '');
  } else {
    fatos = pedido.fatos;
  }

  const r = await gerarDescricao(pedido, fatos);
  return responder(r, r.ok ? 200 : r.semIa ? 503 : 502);
}
