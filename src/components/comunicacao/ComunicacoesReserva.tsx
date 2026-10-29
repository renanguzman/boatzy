import { getTranslations } from 'next-intl/server';
import { Bell, CalendarClock, ChevronDown, Mail, MessageCircle, Send, type LucideIcon } from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabase';
import { getFormatos } from '@/i18n/formatos-servidor';
import { agendaLembretes, MARCOS_LEMBRETE } from '@/lib/comunicacao/agenda';
import { mascararDestino } from '@/lib/comunicacao/formato';
import type { ComunicacaoCanal, ComunicacaoPapel, ComunicacaoStatus, Database, ReservaStatus } from '@/types/supabase';

/**
 * Linha do tempo das comunicações automáticas da reserva (SPEC §96) — mesma seção no detalhe do
 * cliente, do gestor e do admin. Quem chama já conferiu o acesso à reserva.
 * - cliente/gestor: destino mascarado; itens de WhatsApp (pendentes de integração) ficam ocultos;
 * - admin: destino completo, erro técnico, id do Resend e tentativas.
 * Reserva confirmada mostra também os lembretes que ainda vão sair ("Previsto para…").
 * `recolhivel`: começa fechada (accordion) com o total de registros no título — usado no painel do gestor e na reserva do cliente.
 */

type Visao = 'cliente' | 'gestor' | 'admin';
type Linha = Database['public']['Tables']['reserva_comunicacao']['Row'];

const ICONE_CANAL: Record<ComunicacaoCanal, LucideIcon> = { email: Mail, notificacao: Bell, whatsapp: MessageCircle };

const COR_STATUS: Record<ComunicacaoStatus, string> = {
  enviado: 'bg-emerald-50 text-emerald-700',
  falhou: 'bg-rose-50 text-rose-600',
  dispensado: 'bg-slate-100 text-slate-500',
  agendado: 'bg-amber-50 text-amber-700',
  pendente_integracao: 'bg-violet-50 text-violet-700',
};

const MOTIVOS = ['confirmada_tarde', 'janela_perdida', 'sem_contato'] as const;

export default async function ComunicacoesReserva({
  reservaId,
  visao,
  status,
  dataReserva,
  horarioSaida,
  recolhivel = false,
}: {
  reservaId: string;
  visao: Visao;
  status: ReservaStatus;
  dataReserva: string;
  horarioSaida: string | null;
  recolhivel?: boolean;
}) {
  const [t, f, { data }] = await Promise.all([
    getTranslations('Comunicacoes'),
    getFormatos(),
    supabaseAdmin
      .from('reserva_comunicacao')
      .select('*')
      .eq('reserva_id', reservaId)
      .order('criado_em', { ascending: true }),
  ]);
  const linhas = ((data ?? []) as Linha[]).filter((l) => visao === 'admin' || l.canal !== 'whatsapp');

  const rotuloTipo = (tipo: string) => {
    const chave = `tipos.${tipo}` as 'tipos.outro';
    return t.has(chave) ? t(chave) : t('tipos.outro');
  };
  const rotuloPara = (papel: ComunicacaoPapel) =>
    papel === visao ? t('paraVoce') : papel === 'cliente' ? t('paraCliente') : t('paraProprietario');

  // Lembretes ainda por vir: marco cuja janela não fechou e sem nenhum envio registrado.
  const agora = new Date();
  const previstos = status === 'confirmada'
    ? (() => {
        const { janelas } = agendaLembretes(dataReserva, horarioSaida);
        return MARCOS_LEMBRETE
          .filter((m) => agora < janelas[m].fim && !linhas.some((l) => l.tipo === `lembrete_${m}`))
          .map((m) => ({ tipo: `lembrete_${m}`, em: janelas[m].inicio.toISOString() }));
      })()
    : [];

  const total = linhas.length + previstos.length;
  const titulo = (
    <h2 className="flex items-center gap-1.5 text-base font-bold text-marinho">
      <Send className="h-4 w-4" /> {t('titulo')}
      {recolhivel && (
        <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600" aria-label={t('contador', { n: total })}>
          {total}
        </span>
      )}
    </h2>
  );
  const subtitulo = <p className="mt-0.5 text-xs text-slate-400">{t('subtitulo')}</p>;

  const conteudo = total === 0 ? (
      <p className="mt-4 text-sm text-slate-400">{t('vazio')}</p>
    ) : (
      <ol className="mt-4 space-y-0">
        {linhas.map((l, i) => {
          const Icone = ICONE_CANAL[l.canal];
          const destino = visao === 'admin' ? l.destino : mascararDestino(l.destino);
          const quando = l.enviado_em ?? l.atualizado_em ?? l.criado_em;
          const motivo = l.status === 'dispensado' && MOTIVOS.includes(l.erro as (typeof MOTIVOS)[number])
            ? t(`motivo.${l.erro as (typeof MOTIVOS)[number]}`)
            : null;
          const ultimo = i === linhas.length - 1 && previstos.length === 0;
          return (
            <li key={l.id} className="relative flex gap-3 pb-4 last:pb-0">
              {!ultimo && <span aria-hidden className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200" />}
              <span className="relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500">
                <Icone className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <p className="text-sm font-semibold text-slate-700">{rotuloTipo(l.tipo)}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${COR_STATUS[l.status]}`}>
                    {t(`status.${l.status}`)}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {t(`canal.${l.canal}`)} · {rotuloPara(l.papel)}
                  {destino && <span className="text-slate-400"> · <span className="break-all">{destino}</span></span>}
                </p>
                {l.assunto && <p className="mt-0.5 text-xs text-slate-400 break-words">“{l.assunto}”</p>}
                {motivo && <p className="mt-0.5 text-xs text-slate-400">{motivo}</p>}
                {visao === 'admin' && (l.erro && !motivo || l.provedor_id || l.tentativas > 1) && (
                  <p className="mt-0.5 font-mono text-[11px] text-slate-400 break-all">
                    {[l.erro && !motivo ? `erro: ${l.erro}` : null, l.provedor_id ? `resend: ${l.provedor_id}` : null,
                      l.tentativas > 1 ? `tentativas: ${l.tentativas}` : null].filter(Boolean).join(' · ')}
                  </p>
                )}
                <p className="mt-0.5 text-[11px] text-slate-400">{f.dataHora(quando)}</p>
              </div>
            </li>
          );
        })}
        {previstos.map((p, i) => (
          <li key={p.tipo} className="relative flex gap-3 pb-4 last:pb-0">
            {i < previstos.length - 1 && <span aria-hidden className="absolute left-[15px] top-8 bottom-0 w-px border-l border-dashed border-slate-200" />}
            <span className="relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white text-slate-400">
              <CalendarClock className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-semibold text-slate-500">{rotuloTipo(p.tipo)}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${COR_STATUS.agendado}`}>
                  {t('status.agendado')}
                </span>
              </div>
              <p className="text-xs text-slate-400">{t('previsto', { data: f.dataHora(p.em) })}</p>
            </div>
          </li>
        ))}
      </ol>
    );

  if (recolhivel) {
    return (
      <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            {titulo}
            {subtitulo}
          </div>
          <ChevronDown className="mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        {conteudo}
      </details>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5">
      {titulo}
      {subtitulo}
      {conteudo}
    </section>
  );
}
