import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, MapPin, Ship, Users, CalendarDays, ShoppingCart, User, Mail,
  IdCard, Clock, MessageSquare, AlertTriangle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { getDatasReservadasEmbarcacao, getDatasReservadasRoteiro } from '@/lib/reservas';
import ReservaAcoes from './_components/ReservaAcoes';
import AdicionarAoCalendario from './_components/AdicionarAoCalendario';

type ReservaDetalhe = {
  id: string;
  tipo: 'roteiro' | 'embarcacao';
  roteiro_id: string | null;
  embarcacao_id: string | null;
  data_reserva: string;
  flexibilidade: number | null;
  quantidade_pessoas: number;
  item_nome: string;
  preco_base: number | null;
  total_adicionais: number;
  taxa_servico: number | null;
  total_estimado: number | null;
  status: 'pendente' | 'confirmada' | 'recusada' | 'cancelada' | 'concluida';
  observacao_gestor: string | null;
  solicitado_em: string;
  respondido_em: string | null;
  cliente: { name: string; email: string; cpf_cnpj: string | null; avatar_url: string | null } | null;
  roteiro: {
    nome: string;
    embarcacao_id: string | null;
    municipios: { nome: string; estados: { uf: string } | null } | null;
  } | null;
  embarcacao: { nome: string } | null;
  reserva_adicional: { id: string; descricao: string; valor: number; tipo: string }[];
};

const STATUS = {
  pendente: { label: 'Pendente', badge: 'bg-amber-100 text-amber-700' },
  confirmada: { label: 'Confirmada', badge: 'bg-emerald-100 text-emerald-700' },
  recusada: { label: 'Recusada', badge: 'bg-red-100 text-red-600' },
  cancelada: { label: 'Cancelada pelo cliente', badge: 'bg-slate-200 text-slate-600' },
  concluida: { label: 'Concluída', badge: 'bg-sky-100 text-sky-700' },
} as const;

function formatData(iso: string, flex: number | null): string {
  const label = new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  return flex && flex > 0 ? `${label} (± ${flex} dia${flex > 1 ? 's' : ''})` : label;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default async function ReservaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  const { data } = await supabaseAdmin
    .from('reserva')
    .select(
      `id, tipo, roteiro_id, embarcacao_id, data_reserva, flexibilidade, quantidade_pessoas, item_nome,
       preco_base, total_adicionais, taxa_servico, total_estimado,
       status, observacao_gestor, solicitado_em, respondido_em,
       cliente:users!reserva_cliente_id_fkey ( name, email, cpf_cnpj, avatar_url ),
       roteiro ( nome, embarcacao_id, municipios ( nome, estados ( uf ) ) ),
       embarcacao ( nome ),
       reserva_adicional ( id, descricao, valor, tipo )`,
    )
    .eq('id', id)
    .eq('owner_id', user.id)
    .single();

  if (!data) notFound();

  const r = data as unknown as ReservaDetalhe;
  const s = STATUS[r.status];

  // Pendente cuja data já foi tomada por outra reserva confirmada (mesma
  // embarcação ou mesmo roteiro) — aviso visual; a ação de recusar continua
  // manual, o gestor decide.
  let temConflito = false;
  if (r.status === 'pendente') {
    const datasIndisponiveis =
      r.tipo === 'embarcacao'
        ? await getDatasReservadasEmbarcacao(r.embarcacao_id!)
        : await getDatasReservadasRoteiro({
            roteiroId: r.roteiro_id!,
            embarcacaoId: r.roteiro?.embarcacao_id ?? null,
          });
    temConflito = datasIndisponiveis.includes(r.data_reserva);
  }
  const TipoIcon = r.tipo === 'embarcacao' ? Ship : MapPin;
  const localidade = r.roteiro?.municipios
    ? r.roteiro.municipios.estados
      ? `${r.roteiro.municipios.nome}, ${r.roteiro.municipios.estados.uf}`
      : r.roteiro.municipios.nome
    : null;

  // Dados para o lembrete no Google Calendar (evento de dia inteiro).
  const itemNome = r.roteiro?.nome ?? r.item_nome;
  const clienteNome = r.cliente?.name ?? 'Cliente';
  const tituloEvento = `${itemNome} — ${clienteNome}`;
  const detalhesEvento = [
    r.tipo === 'embarcacao' ? 'Reserva de embarcação · Boatzy' : 'Reserva de roteiro · Boatzy',
    '',
    `Cliente: ${clienteNome}${r.cliente?.email ? ` (${r.cliente.email})` : ''}`,
    `Pessoas: ${r.quantidade_pessoas}`,
    r.embarcacao ? `Embarcação: ${r.embarcacao.nome}` : null,
    r.reserva_adicional.length > 0
      ? `Adicionais: ${r.reserva_adicional.map((a) => a.descricao).join(', ')}`
      : null,
    r.total_estimado != null ? `Total estimado: ${formatCurrency(r.total_estimado)}` : null,
  ]
    .filter((l) => l !== null)
    .join('\n');

  return (
    <div className="p-8 max-w-4xl">
      <Link
        href="/painel/agendamentos"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0B2447] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao calendário
      </Link>

      {/* Header */}
      <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <TipoIcon className="h-3.5 w-3.5" />
            {r.tipo === 'embarcacao' ? 'Reserva de embarcação' : 'Reserva de roteiro'}
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#0B2447]">{r.roteiro?.nome ?? r.item_nome}</h1>
          {localidade && (
            <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <MapPin className="h-4 w-4" /> {localidade}
            </div>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${s.badge}`}>{s.label}</span>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-5">
          {/* Cliente */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="text-sm font-bold text-[#0B2447] mb-4">Cliente</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2.5 text-slate-700">
                <User className="h-4 w-4 text-slate-400 shrink-0" />
                {r.cliente?.name ?? '—'}
              </div>
              <div className="flex items-center gap-2.5 text-slate-700">
                <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                {r.cliente?.email ?? '—'}
              </div>
              {r.cliente?.cpf_cnpj && (
                <div className="flex items-center gap-2.5 text-slate-700">
                  <IdCard className="h-4 w-4 text-slate-400 shrink-0" />
                  {r.cliente.cpf_cnpj}
                </div>
              )}
            </div>
          </section>

          {/* Pedido */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="text-sm font-bold text-[#0B2447] mb-4">Detalhes do pedido</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-2.5">
                <CalendarDays className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Data</p>
                  <p className="text-slate-700 capitalize">{formatData(r.data_reserva, r.flexibilidade)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Users className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Pessoas</p>
                  <p className="text-slate-700">{r.quantidade_pessoas}</p>
                </div>
              </div>
              {r.embarcacao && (
                <div className="flex items-start gap-2.5">
                  <Ship className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Embarcação</p>
                    <p className="text-slate-700">{r.embarcacao.nome}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2.5">
                <Clock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Solicitada em</p>
                  <p className="text-slate-700">{formatDateTime(r.solicitado_em)}</p>
                </div>
              </div>
            </div>

            {/* Adicionais */}
            {r.reserva_adicional.length > 0 && (
              <div className="mt-5 rounded-xl bg-slate-50 border border-slate-100 p-3.5">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <ShoppingCart className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-600">Adicionais</span>
                </div>
                <div className="space-y-1.5">
                  {r.reserva_adicional.map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">
                        {a.descricao}
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-slate-400">{a.tipo}</span>
                      </span>
                      <span className="font-medium text-slate-700">{formatCurrency(a.valor)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Observação já registrada */}
          {r.observacao_gestor && (
            <section className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
              <div className="flex items-center gap-1.5 mb-2">
                <MessageSquare className="h-4 w-4 text-indigo-500" />
                <span className="text-sm font-semibold text-indigo-700">Observação enviada ao cliente</span>
              </div>
              <p className="text-sm text-slate-600">{r.observacao_gestor}</p>
              {r.respondido_em && (
                <p className="mt-2 text-xs text-slate-400">Respondida em {formatDateTime(r.respondido_em)}</p>
              )}
            </section>
          )}
        </div>

        {/* Sidebar: valores + ações */}
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="text-sm font-bold text-[#0B2447] mb-4">Valores</h2>
            {r.preco_base != null ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Diária</span>
                  <span className="font-medium text-slate-700">{formatCurrency(r.preco_base)}</span>
                </div>
                {r.total_adicionais > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Adicionais</span>
                    <span className="font-medium text-slate-700">{formatCurrency(r.total_adicionais)}</span>
                  </div>
                )}
                {r.taxa_servico != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Taxa de serviço</span>
                    <span className="font-medium text-slate-700">{formatCurrency(r.taxa_servico)}</span>
                  </div>
                )}
                {r.total_estimado != null && (
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-1">
                    <span className="font-bold text-[#0B2447]">Total estimado</span>
                    <span className="text-lg font-bold text-[#0B2447]">{formatCurrency(r.total_estimado)}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Preço a combinar.</p>
            )}
          </section>

          {temConflito && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Esta data já tem outra reserva confirmada para
                {r.tipo === 'embarcacao' ? ' esta embarcação' : ' este roteiro (ou a embarcação vinculada a ele)'}.
                Confirmar esta solicitação vai falhar — considere recusá-la.
              </p>
            </div>
          )}

          <ReservaAcoes reservaId={r.id} status={r.status} />

          <AdicionarAoCalendario
            titulo={tituloEvento}
            dataReserva={r.data_reserva}
            detalhes={detalhesEvento}
            local={localidade}
          />
        </div>
      </div>
    </div>
  );
}
