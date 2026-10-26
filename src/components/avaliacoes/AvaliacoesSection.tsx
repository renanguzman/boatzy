import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import { useFormatos } from '@/i18n/formatos';

export type AvaliacaoPublica = {
  id: string;
  nota: number;
  comentario: string | null;
  created_at: string;
  cliente: { name: string; avatar_url: string | null } | null;
};

function Estrelas({ nota, tamanho = 'h-4 w-4', rotulo }: { nota: number; tamanho?: string; rotulo: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={rotulo}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${tamanho} ${n <= Math.round(nota) ? 'fill-destaque text-destaque' : 'text-slate-300'}`}
        />
      ))}
    </span>
  );
}

/**
 * Seção "Avaliações" das páginas públicas (/roteiros/[id] e /embarcacoes/[id]):
 * média + contagem + lista de comentários. Avaliações nascem apenas de reservas
 * concluídas, via /minhas-reservas (não há formulário aqui).
 */
export default function AvaliacoesSection({
  avaliacoes,
  emptyLabel,
}: {
  avaliacoes: AvaliacaoPublica[];
  emptyLabel: string;
}) {
  const t = useTranslations('Avaliacoes');
  const tCards = useTranslations('Cards');
  const f = useFormatos();
  const nota1 = (n: number) => f.numero(n, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const media =
    avaliacoes.length > 0
      ? avaliacoes.reduce((acc, a) => acc + a.nota, 0) / avaliacoes.length
      : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h2 className="text-xl font-bold text-marinho">{t('titulo')}</h2>
        {avaliacoes.length > 0 && (
          <div className="flex items-center gap-2">
            <Estrelas nota={media} rotulo={t('nota', { nota: nota1(media) })} />
            <span className="text-sm font-bold text-marinho">
              {nota1(media)}
            </span>
            <span className="text-sm text-slate-400">
              · {tCards('avaliacoes', { count: avaliacoes.length })}
            </span>
          </div>
        )}
      </div>

      {avaliacoes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 flex flex-col items-center text-center">
          <p className="text-sm text-slate-400 font-medium">{emptyLabel}</p>
          <p className="text-xs text-slate-300 mt-1">
            {t('explicacao')}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {avaliacoes.map((a) => (
            <article key={a.id} className="rounded-2xl border border-slate-100 bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10 shrink-0 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center">
                  {a.cliente?.avatar_url ? (
                    <Image
                      src={a.cliente.avatar_url}
                      alt={a.cliente.name}
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  ) : (
                    <span className="text-sm font-bold text-slate-400">
                      {(a.cliente?.name ?? '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-marinho truncate">
                    {a.cliente?.name ?? t('clienteBoatzy')}
                  </p>
                  <p className="text-xs text-slate-400">
                    {f.data(a.created_at, { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <Estrelas nota={a.nota} rotulo={t('nota', { nota: a.nota })} />
              </div>
              {a.comentario && (
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">{a.comentario}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
