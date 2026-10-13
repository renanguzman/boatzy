import { STATUS_INFO, type StatusPublicacaoQualquer } from '@/lib/publicacao/config';

/** Badge do status de publicação (embarcação, roteiro ou anúncio). */
export default function StatusPublicacaoBadge({ status, className = '' }: {
  status: StatusPublicacaoQualquer; className?: string;
}) {
  const info = STATUS_INFO[status] ?? STATUS_INFO.inativo;
  return (
    <span
      title={info.descricao}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${info.badge} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${info.dot}`} />
      {info.label}
    </span>
  );
}
