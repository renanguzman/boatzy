import { redirect } from 'next/navigation';
import { CalendarDays, Ship, FileCheck2, Users, Tag, Inbox, Undo2, FileWarning, FileClock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { concluirReservasVencidas } from '@/lib/reservas';
import type { ReservaStatus, ReservaTipo } from '@/types/supabase';
import { formatarData, hojeISO, partesNoFuso } from '@/lib/datas';
import { getResumoDocumentos, inscricoesDoGestor, proximosVencimentos } from '@/lib/documentos/server';
import { pendenciaInscricao } from '@/lib/documentos/aprovacao';
import { TIPOS_INSCRICAO, nomeCurtoDocumento } from '@/lib/documentos/tipos';
import { DIAS_FAIXA_TOPO, diasParaVencer, textoPrazo } from '@/lib/documentos/validade';
import { montarPrimeirosPassos, type EmbarcacaoInicio, type RoteiroInicio } from './_components/inicio/passos';
import PrimeirosPassosCard from './_components/inicio/PrimeirosPassosCard';
import {
  Desempenho, ParaFazerAgora, ProximosPasseios, Resumo, type CartaoResumo, type PasseioAgenda, type Tarefa,
} from './_components/inicio/BlocosInicio';

type ReservaInicio = {
  id: string;
  tipo: ReservaTipo;
  status: ReservaStatus;
  item_nome: string;
  data_reserva: string;
  quantidade_pessoas: number;
  total_estimado: number | null;
  solicitado_em: string;
  cliente_id: string;
  roteiro_id: string | null;
  embarcacao_id: string | null;
  cliente: { name: string } | null;
};

const MESES_CURTOS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Início do painel (SPEC §97). Para quem está começando: os primeiros passos até o
 * primeiro passeio no site. Para quem já opera: o que fazer agora, números agrupados,
 * a agenda e o desempenho — sem blocos vazios para quem ainda não tem reservas.
 */
export default async function PainelInicioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  // Transição lazy confirmada → concluída antes de contar/exibir status.
  await concluirReservasVencidas();

  const [
    { data: embarcacoesData }, { data: roteirosData }, { data: reservasData }, { data: anunciosData }, { data: funilData },
    resumoDocs, vencimentos, inscricoes, { data: perfil },
  ] = await Promise.all([
    supabaseAdmin.from('embarcacao').select('id, nome, status, primeira_aprovacao_em, enviado_analise_em').eq('owner_id', user.id),
    supabaseAdmin.from('roteiro').select('id, nome, status, ativo, embarcacao_id, primeira_aprovacao_em, enviado_analise_em').eq('owner_id', user.id),
    supabaseAdmin
      .from('reserva')
      .select(
        `id, tipo, status, item_nome, data_reserva, quantidade_pessoas, total_estimado,
         solicitado_em, cliente_id, roteiro_id, embarcacao_id,
         cliente:users!reserva_cliente_id_fkey ( name )`,
      )
      .eq('owner_id', user.id)
      .order('solicitado_em', { ascending: false }),
    supabaseAdmin.from('anuncio_venda').select('id, status, embarcacao ( nome )').eq('owner_id', user.id),
    // Interessados nos anúncios de venda (1 linha por lead↔anúncio) — RPC vendas_funil.
    supabaseAdmin.rpc('vendas_funil', { p_gestor: user.id }),
    getResumoDocumentos(user.id),
    proximosVencimentos(user.id, 6),
    inscricoesDoGestor(user.id),
    supabaseAdmin.from('users').select('name').eq('id', user.id).maybeSingle(),
  ]);

  const embarcacoes = (embarcacoesData ?? []) as EmbarcacaoInicio[];
  const roteiros = (roteirosData ?? []) as RoteiroInicio[];
  const reservas = (reservasData ?? []) as unknown as ReservaInicio[];
  const anuncios = anunciosData ?? [];
  const interessados = (funilData ?? []).length;
  const hoje = hojeISO();

  // ── Primeiros passos ──
  const passos = montarPrimeirosPassos({ embarcacoes, roteiros, inscricoes });
  const comPassos = !passos.completo;
  // Embarcação/roteiro acompanhados nos passos não se repetem em "Para fazer agora".
  const noPasso = (id: string) => comPassos && (id === passos.embarcacaoId || id === passos.roteiroId);

  // ── Para fazer agora ──
  const tarefas: Tarefa[] = [];

  const pedidos = reservas
    .filter((r) => r.status === 'pendente')
    .sort((a, b) => a.solicitado_em.localeCompare(b.solicitado_em));
  if (pedidos.length > 0) {
    tarefas.push({
      id: 'pedidos', icone: Inbox, tom: 'urgente',
      titulo: pedidos.length === 1 ? '1 pedido de reserva aguardando sua resposta' : `${pedidos.length} pedidos de reserva aguardando sua resposta`,
      detalhe: 'O cliente está esperando. Aceite ou recuse o quanto antes.',
      itens: pedidos.slice(0, 3).map((r) => ({
        id: r.id, titulo: r.item_nome, href: `/painel/agendamentos/${r.id}`, acao: 'Responder',
        sub: `${r.cliente?.name ?? 'Cliente'} · ${formatarData(r.data_reserva)} · ${plural(r.quantidade_pessoas, 'pessoa', 'pessoas')}`,
      })),
      mais: pedidos.length > 3 ? { label: `Ver todos os ${pedidos.length} pedidos`, href: '/painel/agendamentos' } : undefined,
    });
  }

  const devolvidos = [
    ...embarcacoes.filter((e) => e.status === 'retorno' && !noPasso(e.id))
      .map((e) => ({ id: e.id, titulo: e.nome, sub: 'Embarcação', href: `/painel/embarcacoes/${e.id}/editar` })),
    ...roteiros.filter((r) => r.status === 'retorno' && !noPasso(r.id))
      .map((r) => ({ id: r.id, titulo: r.nome, sub: 'Roteiro', href: `/painel/roteiros/${r.id}/editar` })),
    ...anuncios.filter((a) => a.status === 'retorno').map((a) => ({
      id: a.id, titulo: (a.embarcacao as unknown as { nome: string } | null)?.nome ?? 'Anúncio', sub: 'Anúncio de venda',
      href: `/painel/vendas/${a.id}/editar`,
    })),
  ];
  if (devolvidos.length > 0) {
    tarefas.push({
      id: 'devolvidos', icone: Undo2, tom: 'alerta',
      titulo: devolvidos.length === 1 ? '1 cadastro devolvido para ajustes' : `${devolvidos.length} cadastros devolvidos para ajustes`,
      detalhe: 'A equipe Boatzy deixou um recado dizendo o que mudar. Ajuste e reenvie.',
      itens: devolvidos.map((d) => ({ ...d, acao: 'Ajustar' })),
    });
  }

  const semDocumento = embarcacoes.filter(
    (e) => e.status !== 'inativo' && !noPasso(e.id) && pendenciaInscricao(inscricoes.get(e.id)) === 'nao_enviado',
  );
  if (semDocumento.length > 0) {
    tarefas.push({
      id: 'sem-documento', icone: FileWarning, tom: 'alerta',
      titulo: semDocumento.length === 1 ? 'Envie o documento (TIE) da embarcação' : `Envie o documento (TIE) de ${semDocumento.length} embarcações`,
      detalhe: 'Sem ele, a equipe Boatzy não aprova a embarcação.',
      itens: semDocumento.map((e) => ({ id: e.id, titulo: e.nome, href: `/painel/embarcacoes/${e.id}/editar#documentacao`, acao: 'Enviar' })),
    });
  }

  const nomeNoPasso = comPassos ? embarcacoes.find((e) => e.id === passos.embarcacaoId)?.nome : undefined;
  const docsUrgentes = vencimentos.filter(
    (v) => diasParaVencer(v.data_validade, hoje) <= DIAS_FAIXA_TOPO && !(TIPOS_INSCRICAO.includes(v.tipo) && v.alvo === nomeNoPasso),
  );
  if (docsUrgentes.length > 0) {
    tarefas.push({
      id: 'documentos', icone: FileClock, tom: 'urgente',
      titulo: docsUrgentes.length === 1 ? '1 documento vencido ou perto de vencer' : `${docsUrgentes.length} documentos vencidos ou perto de vencer`,
      detalhe: 'Renove para manter suas embarcações e sua equipe regularizadas.',
      itens: docsUrgentes.slice(0, 3).map((v) => ({
        id: v.id, titulo: `${nomeCurtoDocumento(v.tipo, v.titulo)} · ${v.alvo}`, sub: textoPrazo(v.data_validade, hoje),
        href: '/painel/documentos', acao: 'Renovar',
      })),
      mais: docsUrgentes.length > 3 ? { label: 'Ver todos os documentos', href: '/painel/documentos' } : undefined,
    });
  }

  const emAnalise = [...embarcacoes, ...roteiros].filter((p) => p.status === 'em_analise' && !noPasso(p.id)).length
    + anuncios.filter((a) => a.status === 'em_analise').length;
  const aguardandoPagamento = reservas.filter((r) => r.status === 'aguardando_pagamento').length;
  const aguardando = [
    emAnalise > 0 ? `${plural(emAnalise, 'cadastro', 'cadastros')} em análise pela equipe Boatzy` : null,
    aguardandoPagamento > 0
      ? `${plural(aguardandoPagamento, 'reserva aceita', 'reservas aceitas')} esperando o pagamento do cliente`
      : null,
  ].filter((t): t is string => !!t);

  // ── Negócio: só depois do primeiro passeio no site (ou da primeira reserva) ──
  const mostrarNegocio = passos.completo || reservas.length > 0;

  const passeios: PasseioAgenda[] = reservas
    .filter((r) => r.status === 'confirmada' && r.data_reserva >= hoje)
    .sort((a, b) => a.data_reserva.localeCompare(b.data_reserva))
    .slice(0, 5)
    .map((r) => ({
      id: r.id, item_nome: r.item_nome, data_reserva: r.data_reserva, quantidade_pessoas: r.quantidade_pessoas,
      total_estimado: r.total_estimado, cliente: r.cliente?.name ?? 'Cliente',
    }));
  const totalProximos = reservas.filter((r) => r.status === 'confirmada' && r.data_reserva >= hoje).length;

  const roteirosNoSite = roteiros.filter((r) => r.ativo).length;
  const embarcacoesAprovadas = embarcacoes.filter((e) => e.status === 'ativo').length;
  const clientes = new Set(reservas.map((r) => r.cliente_id)).size;
  const anunciosNoSite = anuncios.filter((a) => a.status === 'ativo').length;

  const docsStatus: Pick<CartaoResumo, 'valor' | 'unidade' | 'linha' | 'tomLinha'> =
    resumoDocs.vencidos > 0
      ? { valor: String(resumoDocs.vencidos), unidade: resumoDocs.vencidos === 1 ? 'vencido' : 'vencidos', linha: 'Renove para regularizar', tomLinha: 'perigo' }
      : resumoDocs.venceEmBreve > 0
        ? { valor: String(resumoDocs.venceEmBreve), unidade: 'vencem em breve', linha: vencimentos[0] ? `O próximo: ${formatarData(vencimentos[0].data_validade)}` : undefined, tomLinha: 'alerta' }
        : resumoDocs.pendentes > 0
          ? { valor: String(resumoDocs.pendentes), unidade: resumoDocs.pendentes === 1 ? 'embarcação sem TIE' : 'embarcações sem TIE', linha: 'Envie para aprovar', tomLinha: 'alerta' }
          : { valor: 'Em dia', unidade: '', linha: vencimentos[0] ? `Próximo vencimento: ${formatarData(vencimentos[0].data_validade)}` : 'Nenhum documento vencendo', tomLinha: 'ok' };

  const cartoes: CartaoResumo[] = [
    {
      id: 'reservas', titulo: 'Reservas', icone: CalendarDays, href: '/painel/agendamentos',
      valor: String(totalProximos), unidade: totalProximos === 1 ? 'passeio marcado' : 'passeios marcados',
      ...(pedidos.length > 0
        ? { linha: `${plural(pedidos.length, 'pedido', 'pedidos')} para responder`, tomLinha: 'alerta' as const }
        : { linha: 'Nenhum pedido para responder' }),
    },
    {
      id: 'site', titulo: 'No site', icone: Ship, href: '/painel/roteiros',
      valor: String(roteirosNoSite), unidade: roteirosNoSite === 1 ? 'roteiro' : 'roteiros',
      linha: `${embarcacoesAprovadas} de ${plural(embarcacoes.length, 'embarcação aprovada', 'embarcações aprovadas')}`,
    },
    { id: 'documentos', titulo: 'Documentos', icone: FileCheck2, href: '/painel/documentos', ...docsStatus },
    {
      id: 'clientes', titulo: 'Clientes', icone: Users, href: '/painel/clientes',
      valor: String(clientes), unidade: clientes === 1 ? 'cliente' : 'clientes', linha: 'Já reservaram com você',
    },
    ...(anuncios.length > 0
      ? [{
          id: 'vendas', titulo: 'Venda de barcos', icone: Tag, href: '/painel/vendas/funil',
          valor: String(anunciosNoSite), unidade: anunciosNoSite === 1 ? 'anúncio no site' : 'anúncios no site',
          linha: plural(interessados, 'interessado', 'interessados'),
        }]
      : []),
  ];

  // Pedidos por mês (últimos 6, no horário de Brasília) e o mais procurado.
  const agora = partesNoFuso(new Date());
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(agora.ano, agora.mes - (5 - i), 1));
    return { ano: d.getUTCFullYear(), mes: d.getUTCMonth(), chave: `${d.getUTCFullYear()}-${d.getUTCMonth()}`, label: MESES_CURTOS[d.getUTCMonth()], total: 0 };
  });
  const porItem = new Map<string, { nome: string; total: number }>();
  let naJanela = 0;
  for (const r of reservas) {
    const { ano, mes } = partesNoFuso(new Date(r.solicitado_em));
    const bucket = meses.find((m) => m.ano === ano && m.mes === mes);
    if (!bucket) continue;
    bucket.total += 1;
    naJanela += 1;
    const chave = `${r.tipo}:${r.roteiro_id ?? r.embarcacao_id ?? r.item_nome}`;
    const atual = porItem.get(chave) ?? { nome: r.item_nome, total: 0 };
    atual.total += 1;
    porItem.set(chave, atual);
  }
  const maisProcurado = [...porItem.values()].sort((a, b) => b.total - a.total)[0];
  const destaque = maisProcurado && naJanela > 0
    ? { nome: maisProcurado.nome, total: maisProcurado.total, percentual: Math.round((maisProcurado.total / naJanela) * 100) }
    : null;

  // ── Cabeçalho ──
  const primeiroNome = perfil?.name?.trim().split(/\s+/)[0];
  const subtitulo = comPassos && !mostrarNegocio
    ? 'Siga os passos abaixo para colocar seu primeiro passeio no site.'
    : tarefas.length > 0
      ? `Você tem ${plural(tarefas.length, 'assunto', 'assuntos')} para resolver.`
      : 'Tudo em dia por aqui.';

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:space-y-6 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-xl font-bold text-[#0B2447] sm:text-2xl">{primeiroNome ? `Olá, ${primeiroNome}!` : 'Olá!'}</h1>
        <p className="mt-0.5 text-sm text-slate-500">{subtitulo}</p>
      </header>

      {comPassos && <PrimeirosPassosCard dados={passos} />}

      {(tarefas.length > 0 || aguardando.length > 0 || mostrarNegocio) && (
        <ParaFazerAgora tarefas={tarefas} aguardando={aguardando} />
      )}

      {mostrarNegocio && (
        <>
          <Resumo cartoes={cartoes} />
          <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-5">
            <ProximosPasseios passeios={passeios} className={reservas.length > 0 ? 'lg:col-span-3' : 'lg:col-span-5'} />
            {reservas.length > 0 && <Desempenho meses={meses} destaque={destaque} className="lg:col-span-2" />}
          </div>
        </>
      )}
    </div>
  );
}
