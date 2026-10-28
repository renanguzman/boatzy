import { formatarData } from '@/lib/datas';
import { situacaoValidade, textoPrazo, VISUAL_SITUACAO, type SituacaoValidade } from '@/lib/documentos/validade';

/**
 * Selo da situação do documento (Vencido / Vence em breve / Em dia / Sem validade / Pendente) —
 * SPEC §95.3. Recebe a validade do documento ou a situação já calculada.
 */
export function SeloValidade(props: { validade: string | null } | { situacao: SituacaoValidade | 'pendente' }) {
  const situacao = 'situacao' in props ? props.situacao : situacaoValidade(props.validade);
  const v = VISUAL_SITUACAO[situacao];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${v.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${v.ponto}`} />
      {v.rotulo}
    </span>
  );
}

/** "Válido até 14/09/2027 · vence em 320 dias". */
export function PrazoValidade({ validade }: { validade: string | null }) {
  if (!validade) return <span className="text-xs text-slate-400">Sem data de validade</span>;
  const situacao = situacaoValidade(validade);
  const cor = situacao === 'vencido' ? 'text-red-600' : situacao === 'vence_em_breve' ? 'text-amber-700' : 'text-slate-500';
  return (
    <span className="text-xs text-slate-500">
      {situacao === 'vencido' ? 'Venceu em' : 'Válido até'} <strong className="font-semibold text-slate-700">{formatarData(validade)}</strong>
      <span className={`ml-1 ${cor}`}>· {textoPrazo(validade)}</span>
    </span>
  );
}
