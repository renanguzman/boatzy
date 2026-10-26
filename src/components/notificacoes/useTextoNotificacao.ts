import { useTranslations } from 'next-intl';
import { useFormatos } from '@/i18n/formatos';
import { tituloNotificacao, type Notificacao } from '@/lib/notificacoes/apresentacao';

/** Valores gravados pelos triggers em `notificacao.dados` (migration 20261026b). */
type DadosNotificacao = {
  item?: string | null;
  /** Data do passeio, 'AAAA-MM-DD'. */
  data?: string | null;
  /** Prazo de pagamento (instante ISO). */
  prazo?: string | null;
  numero?: number | null;
  parcial?: boolean | null;
  recado?: string | null;
  remetente?: string | null;
};

function lerDados(n: Notificacao): DadosNotificacao | null {
  return n.dados && typeof n.dados === 'object' && !Array.isArray(n.dados) ? (n.dados as DadosNotificacao) : null;
}

/**
 * Título, mensagem e "quando" de uma notificação no idioma do site (SPEC §94.10). Com `dados`
 * (notificações do cliente), monta o texto a partir do tipo; sem eles (avisos antigos e os do
 * gestor no painel), usa o texto gravado em pt-BR.
 */
export function useTextoNotificacao() {
  const t = useTranslations('Notificacoes');
  const f = useFormatos();

  function texto(n: Notificacao): { titulo: string; mensagem: string } {
    const d = lerDados(n);
    if (!d) return { titulo: tituloNotificacao(n), mensagem: n.mensagem };

    const item = d.item || t('seuPasseio');
    const data = d.data ? f.data(d.data) : '—';
    const prazo = d.prazo
      ? t('dataHora', { data: f.data(d.prazo, { day: '2-digit', month: '2-digit' }), hora: f.hora(d.prazo) })
      : t('oPrazo');
    const numero = String(d.numero ?? '');

    switch (n.tipo) {
      case 'reserva_confirmada':
        return { titulo: t('textos.reserva_confirmada.titulo'), mensagem: t('textos.reserva_confirmada.mensagem', { item, data }) };
      case 'reserva_recusada':
        return {
          titulo: t('textos.reserva_recusada.titulo'),
          mensagem: t('textos.reserva_recusada.mensagem', { item, data })
            + (d.recado ? t('textos.reserva_recusada.recado', { recado: d.recado }) : ''),
        };
      case 'reserva_cancelada':
        return { titulo: t('textos.reserva_cancelada.titulo'), mensagem: t('textos.reserva_cancelada.mensagem', { item, data }) };
      case 'reserva_expirada':
        return { titulo: t('textos.reserva_expirada.titulo'), mensagem: t('textos.reserva_expirada.mensagem', { item, data }) };
      case 'reserva_concluida':
        return { titulo: t('textos.reserva_concluida.titulo'), mensagem: t('textos.reserva_concluida.mensagem', { item }) };
      case 'aguardando_pagamento':
        return { titulo: t('textos.aguardando_pagamento.titulo'), mensagem: t('textos.aguardando_pagamento.mensagem', { item, data, prazo }) };
      case 'pagamento_aprovado':
        return { titulo: t('textos.pagamento_aprovado.titulo'), mensagem: t('textos.pagamento_aprovado.mensagem', { item, data, numero }) };
      case 'pagamento_recusado':
        return { titulo: t('textos.pagamento_recusado.titulo'), mensagem: t('textos.pagamento_recusado.mensagem', { item, prazo }) };
      case 'reembolso':
        return {
          titulo: t('textos.reembolso.titulo', { parcial: d.parcial ? 'sim' : 'nao' }),
          mensagem: t('textos.reembolso.mensagem', { item, numero }),
        };
      case 'mensagem':
        // A mensagem é o próprio texto do chat (não se traduz).
        return {
          titulo: t('textos.mensagem.titulo', { count: n.quantidade, remetente: d.remetente || t('donoEmbarcacao') }),
          mensagem: n.mensagem,
        };
      default:
        return { titulo: tituloNotificacao(n), mensagem: n.mensagem };
    }
  }

  /** "agora", "há 5 min", "há 3 h", "há 2d" ou a data (dd/mm) após uma semana. */
  function quando(iso: string): string {
    const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMin < 1) return t('tempo.agora');
    if (diffMin < 60) return t('tempo.minutos', { n: diffMin });
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return t('tempo.horas', { n: diffH });
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return t('tempo.dias', { n: diffD });
    return f.data(iso, { day: '2-digit', month: '2-digit' });
  }

  return { texto, quando };
}
