import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Anchor, ArrowLeft, CalendarDays, HandCoins, MapPin, MessageSquare, Receipt, ShieldCheck, ShoppingCart, Ship, Star,
  User, Users, Wallet,
} from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabase';
import { formatCurrencyPrecise } from '@/lib/utils';
import { formatarDataHoraBR } from '@/lib/termos/formato';
import { formatarData } from '@/lib/datas';
import { duracaoTexto } from '@/lib/duracao';
import ComunicacoesReserva from '@/components/comunicacao/ComunicacoesReserva';
import type { PedidoStatus, ReservaModalidadePreco, ReservaStatus } from '@/types/supabase';
import {
  MODALIDADE_LABEL, PEDIDO_STATUS, RESERVA_STATUS, formatarDataCurta, formatarDocumento, formatarTelefone,
} from '../../pedidos/_lib/rotulos';
import CopiarValor from '../../pedidos/[id]/_components/CopiarValor';

/**
 * Detalhe de uma reserva no admin (SPEC §96): todos os dados da reserva — inclusive as que não
 * passaram pelo pagamento online e por isso não têm pedido — e a linha do tempo de comunicações.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const brl = (v: number | string | null | undefined) => (v == null ? '—' : formatCurrencyPrecise(Number(v)));
const dh = (iso: string | null | undefined) => (iso ? formatarDataHoraBR(iso) : '—');

type Pessoa = { id: string; name: string; email: string; phone: string | null; cpf_cnpj: string | null; created_at: string } | null;

type Reserva = {
  id: string;
  tipo: 'roteiro' | 'embarcacao';
  status: ReservaStatus;
  item_nome: string;
  roteiro_id: string | null;
  embarcacao_id: string | null;
  data_reserva: string;
  data_fim_reserva: string | null;
  flexibilidade: number | null;
  quantidade_pessoas: number;
  quantidade_diarias: number | null;
  modalidade_preco: ReservaModalidadePreco;
  preco_base: number | null;
  total_adicionais: number;
  taxa_servico: number | null;
  taxa_percent: number | null;
  total_estimado: number | null;
  cupom_codigo: string | null;
  desconto_valor: number;
  observacao_gestor: string | null;
  pagamento_exigido: boolean;
  solicitado_em: string;
  respondido_em: string | null;
  aceita_em: string | null;
  cancelada_em: string | null;
  expirada_em: string | null;
  roteiro: {
    nome: string;
    origem: string | null;
    destino: string | null;
    horario_saida: string | null;
    duracao_horas: number | null;
    logradouro: string | null;
    logradouro_numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cep: string | null;
    municipios: { nome: string; estados: { uf: string } | null } | null;
    roteiro_parada: { nome: string; ordem: number }[];
  } | null;
  embarcacao: { nome: string } | null;
  cliente: Pessoa;
  owner: Pessoa;
  reserva_adicional: { id: string; descricao: string; valor: number; tipo: string }[];
  reserva_atendente: { equipe_membro: { nome_completo: string; telefone: string | null; is_gestor: boolean } | null }[];
  pedido: { id: string; numero: number; status: PedidoStatus; valor_total: number; pago_em: string | null }[];
  avaliacao: { nota: number; comentario: string | null; status: string } | { nota: number; comentario: string | null; status: string }[] | null;
};

function Card({ titulo, icon: Icon, children }: { titulo: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      <h2 className="flex items-center gap-2 px-5 pt-5 pb-3 text-sm font-bold text-[#0B2447]"><Icon className="w-4 h-4" /> {titulo}</h2>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">{label}</p>
      <div className="mt-0.5 text-sm text-slate-700 break-words">{children ?? '—'}</div>
    </div>
  );
}

function Linha({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-1.5 ${destaque ? 'border-t border-slate-100 mt-1 pt-2.5' : ''}`}>
      <span className={`text-sm ${destaque ? 'font-bold text-[#0B2447]' : 'text-slate-500'}`}>{label}</span>
      <span className={`text-sm whitespace-nowrap ${destaque ? 'font-bold text-[#0B2447]' : 'text-slate-700'}`}>{valor}</span>
    </div>
  );
}

function DadosPessoa({ u, papel }: { u: Pessoa; papel: string }) {
  if (!u) return <p className="text-sm text-slate-400">Usuário não encontrado.</p>;
  return (
    <div className="grid grid-cols-1 gap-2.5">
      <Campo label="Nome">
        <Link href={`/administrator/usuarios?q=${encodeURIComponent(u.email)}`} className="font-semibold text-[#0B3D91] hover:underline">{u.name}</Link>
        <span className="block text-[11px] text-slate-400">{papel} · desde {formatarDataCurta(u.created_at)}</span>
      </Campo>
      <Campo label="E-mail">{u.email}</Campo>
      <Campo label="Celular">{formatarTelefone(u.phone)}</Campo>
      <Campo label="CPF / CNPJ">{formatarDocumento(u.cpf_cnpj)}</Campo>
    </div>
  );
}

export default async function AdminReservaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const { data } = await supabaseAdmin
    .from('reserva')
    .select(
      `id, tipo, status, item_nome, roteiro_id, embarcacao_id, data_reserva, data_fim_reserva, flexibilidade,
       quantidade_pessoas, quantidade_diarias, modalidade_preco, preco_base, total_adicionais, taxa_servico, taxa_percent,
       total_estimado, cupom_codigo, desconto_valor, observacao_gestor, pagamento_exigido, solicitado_em, respondido_em,
       aceita_em, cancelada_em, expirada_em,
       roteiro ( nome, origem, destino, horario_saida, duracao_horas, logradouro, logradouro_numero, complemento, bairro, cep,
                 municipios ( nome, estados ( uf ) ), roteiro_parada ( nome, ordem ) ),
       embarcacao ( nome ),
       cliente:users!reserva_cliente_id_fkey ( id, name, email, phone, cpf_cnpj, created_at ),
       owner:users!reserva_owner_id_fkey ( id, name, email, phone, cpf_cnpj, created_at ),
       reserva_adicional ( id, descricao, valor, tipo ),
       reserva_atendente ( equipe_membro ( nome_completo, telefone, is_gestor ) ),
       pedido ( id, numero, status, valor_total, pago_em ),
       avaliacao ( nota, comentario, status )`,
    )
    .eq('id', id)
    .maybeSingle();
  if (!data) notFound();
  const r = data as unknown as Reserva;

  const [{ data: avulsas }, { data: aceite }] = await Promise.all([
    supabaseAdmin
      .from('pedido_avulso')
      .select('titulo, pedido:pedido_id ( id, numero, status, valor_total )')
      .eq('reserva_id', r.id),
    supabaseAdmin
      .from('termos_uso_aceite')
      .select('id, termo_versao, aceito_em')
      .eq('contexto_tipo', 'reserva')
      .eq('contexto_id', r.id)
      .order('aceito_em', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const cobrancas = ((avulsas ?? []) as unknown as { titulo: string; pedido: { id: string; numero: number; status: PedidoStatus; valor_total: number } | null }[])
    .filter((a) => a.pedido);
  const avaliacao = Array.isArray(r.avaliacao) ? (r.avaliacao[0] ?? null) : r.avaliacao;

  const ro = r.roteiro;
  const localidade = ro?.municipios ? `${ro.municipios.nome}${ro.municipios.estados ? `/${ro.municipios.estados.uf}` : ''}` : null;
  const endereco = ro?.logradouro
    ? [`${ro.logradouro}${ro.logradouro_numero ? `, ${ro.logradouro_numero}` : ''}${ro.complemento ? ` — ${ro.complemento}` : ''}`,
       ro.bairro, localidade, ro.cep ? `CEP ${ro.cep}` : null].filter(Boolean).join(' · ')
    : localidade;
  const paradas = [...(ro?.roteiro_parada ?? [])].sort((a, b) => a.ordem - b.ordem).map((p) => p.nome);
  const atendentes = r.reserva_atendente.map((a) => a.equipe_membro).filter((m): m is NonNullable<typeof m> => !!m);
  const st = RESERVA_STATUS[r.status];

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <Link href="/administrator/reservas" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0B2447]">
        <ArrowLeft className="h-4 w-4" /> Reservas
      </Link>

      <div className="mt-4 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {r.tipo === 'embarcacao' ? <Ship className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
            {r.tipo === 'embarcacao' ? 'Reserva de embarcação' : 'Reserva de roteiro'}
            <span className="font-mono normal-case tracking-normal">· {r.id.slice(0, 8).toUpperCase()}</span>
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#0B2447]">{ro?.nome ?? r.item_nome}</h1>
          <p className="mt-1 text-sm text-slate-500 capitalize">
            {formatarData(r.data_reserva, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            {r.data_fim_reserva && r.data_fim_reserva !== r.data_reserva ? ` → ${formatarDataCurta(r.data_fim_reserva)}` : ''}
            {ro?.horario_saida ? ` · saída às ${ro.horario_saida.slice(0, 5)}` : ''}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card titulo="Passeio" icon={CalendarDays}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Campo label="Modalidade">{MODALIDADE_LABEL[r.modalidade_preco] ?? r.modalidade_preco}</Campo>
              <Campo label="Pessoas"><span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5 text-slate-400" />{r.quantidade_pessoas}</span></Campo>
              {r.quantidade_diarias != null && <Campo label="Diárias">{r.quantidade_diarias}</Campo>}
              {r.flexibilidade ? <Campo label="Flexibilidade">± {r.flexibilidade} dia(s)</Campo> : null}
              <Campo label="Saída">{ro?.horario_saida ? ro.horario_saida.slice(0, 5) : 'Não cadastrada'}</Campo>
              <Campo label="Duração">{duracaoTexto(ro?.duracao_horas) ?? '—'}</Campo>
              {r.embarcacao && <Campo label="Embarcação">{r.embarcacao.nome}</Campo>}
              {(ro?.origem || ro?.destino) && <Campo label="Origem → destino">{ro?.origem ?? '—'}{ro?.destino && ro.destino !== ro.origem ? ` → ${ro.destino}` : ''}</Campo>}
              <Campo label="Pagamento online">{r.pagamento_exigido ? 'Sim (pedido no Boatzy)' : 'Não (combinado com o gestor)'}</Campo>
            </div>
            {endereco && <div className="mt-4"><Campo label="Ponto de embarque">{endereco}</Campo></div>}
            {paradas.length > 0 && <div className="mt-4"><Campo label="Paradas">{paradas.join(' → ')}</Campo></div>}
            <div className="mt-4 flex flex-wrap gap-3">
              {r.roteiro_id && <Link href={`/administrator/roteiros/${r.roteiro_id}/editar`} className="text-xs font-semibold text-[#0B3D91] hover:underline">Roteiro no admin</Link>}
              {r.embarcacao_id && <Link href={`/administrator/embarcacoes/${r.embarcacao_id}/editar`} className="text-xs font-semibold text-[#0B3D91] hover:underline">Embarcação no admin</Link>}
            </div>
            {r.reserva_adicional.length > 0 && (
              <div className="mt-4 rounded-lg bg-slate-50 border border-slate-100 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5"><ShoppingCart className="w-3.5 h-3.5" /> Adicionais</p>
                {r.reserva_adicional.map((a) => (
                  <div key={a.id} className="flex justify-between text-xs text-slate-600">
                    <span>{a.descricao} <span className="text-slate-400 uppercase text-[10px]">{a.tipo}</span></span>
                    <span>{brl(a.valor)}</span>
                  </div>
                ))}
              </div>
            )}
            {atendentes.length > 0 && (
              <div className="mt-4">
                <Campo label="Atendentes">
                  {atendentes.map((m) => `${m.is_gestor ? 'Gestor' : m.nome_completo}${m.telefone ? ` (${formatarTelefone(m.telefone)})` : ''}`).join(', ')}
                </Campo>
              </div>
            )}
            {r.observacao_gestor && (
              <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700"><MessageSquare className="w-3.5 h-3.5" /> Recado do gestor ao cliente</p>
                <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">{r.observacao_gestor}</p>
              </div>
            )}
          </Card>

          <Card titulo="Datas" icon={CalendarDays}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Campo label="Solicitada em">{dh(r.solicitado_em)}</Campo>
              <Campo label="Respondida em">{dh(r.respondido_em)}</Campo>
              <Campo label="Aceita em">{dh(r.aceita_em)}</Campo>
              {r.cancelada_em && <Campo label="Cancelada em">{dh(r.cancelada_em)}</Campo>}
              {r.expirada_em && <Campo label="Expirada em">{dh(r.expirada_em)}</Campo>}
              <Campo label="ID da reserva"><CopiarValor valor={r.id} curto /></Campo>
            </div>
          </Card>

          <ComunicacoesReserva
            reservaId={r.id}
            visao="admin"
            status={r.status}
            dataReserva={r.data_reserva}
            horarioSaida={ro?.horario_saida ?? null}
          />
        </div>

        <div className="space-y-6">
          <Card titulo="Cliente" icon={User}><DadosPessoa u={r.cliente} papel="Cliente" /></Card>
          <Card titulo="Gestor (dono da embarcação)" icon={Anchor}><DadosPessoa u={r.owner} papel="Gestor" /></Card>

          <Card titulo="Valores" icon={Wallet}>
            {r.preco_base == null ? (
              <p className="text-sm text-slate-400">Preço a combinar.</p>
            ) : (
              <>
                <Linha label="Preço base" valor={brl(r.preco_base)} />
                {Number(r.total_adicionais) > 0 && <Linha label="Adicionais" valor={brl(r.total_adicionais)} />}
                {r.taxa_servico != null && <Linha label={`Taxa${r.taxa_percent != null ? ` (${Number(r.taxa_percent).toLocaleString('pt-BR')}%)` : ''}`} valor={brl(r.taxa_servico)} />}
                {Number(r.desconto_valor) > 0 && <Linha label={`Desconto${r.cupom_codigo ? ` (${r.cupom_codigo})` : ''}`} valor={`-${brl(r.desconto_valor)}`} />}
                <Linha label="Total estimado" valor={brl(r.total_estimado)} destaque />
              </>
            )}
          </Card>

          <Card titulo="Pedidos e cobranças" icon={Receipt}>
            {r.pedido.length === 0 && cobrancas.length === 0 ? (
              <p className="text-sm text-slate-400">Sem pedido no Boatzy — pagamento combinado direto com o gestor.</p>
            ) : (
              <div className="space-y-1.5">
                {r.pedido.map((p) => (
                  <Link key={p.id} href={`/administrator/pedidos/${p.id}`} className="flex justify-between gap-2 text-sm text-slate-600 hover:text-[#0B3D91]">
                    <span>Pedido #{p.numero}</span>
                    <span className="shrink-0">{brl(p.valor_total)} · {PEDIDO_STATUS[p.status]?.label ?? p.status}</span>
                  </Link>
                ))}
                {cobrancas.map((c) => (
                  <Link key={c.pedido!.id} href={`/administrator/pedidos/${c.pedido!.id}`} className="flex justify-between gap-2 text-sm text-slate-600 hover:text-[#0B3D91]">
                    <span className="min-w-0 truncate inline-flex items-center gap-1"><HandCoins className="w-3.5 h-3.5 shrink-0" /> #{c.pedido!.numero} · {c.titulo}</span>
                    <span className="shrink-0">{brl(c.pedido!.valor_total)} · {PEDIDO_STATUS[c.pedido!.status]?.label ?? c.pedido!.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {aceite && (
            <Link href={`/administrator/termos/aceites/${aceite.id}`}
              className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5 text-xs text-emerald-800 hover:bg-emerald-50">
              <ShieldCheck className="w-4 h-4" /> Termo aceito (v{aceite.termo_versao}) em {dh(aceite.aceito_em)} · ver evidências
            </Link>
          )}

          {avaliacao && (
            <Card titulo="Avaliação" icon={Star}>
              <p className="text-sm text-slate-700">{'★'.repeat(avaliacao.nota)}{'☆'.repeat(Math.max(0, 5 - avaliacao.nota))} <span className="text-xs text-slate-400">({avaliacao.status})</span></p>
              {avaliacao.comentario && <p className="mt-1 text-sm text-slate-600">{avaliacao.comentario}</p>}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
