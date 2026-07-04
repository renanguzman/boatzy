import Image from 'next/image';
import { Star } from 'lucide-react';

export type AvaliacaoPublica = {
  id: string;
  nota: number;
  comentario: string | null;
  created_at: string;
  cliente: { name: string; avatar_url: string | null } | null;
};

function Estrelas({ nota, tamanho = 'h-4 w-4' }: { nota: number; tamanho?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${tamanho} ${n <= Math.round(nota) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
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
  const media =
    avaliacoes.length > 0
      ? avaliacoes.reduce((acc, a) => acc + a.nota, 0) / avaliacoes.length
      : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h2 className="text-xl font-bold text-[#0B2447]">Avaliações</h2>
        {avaliacoes.length > 0 && (
          <div className="flex items-center gap-2">
            <Estrelas nota={media} />
            <span className="text-sm font-bold text-[#0B2447]">
              {media.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <span className="text-sm text-slate-400">
              · {avaliacoes.length} {avaliacoes.length === 1 ? 'avaliação' : 'avaliações'}
            </span>
          </div>
        )}
      </div>

      {avaliacoes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 flex flex-col items-center text-center">
          <p className="text-sm text-slate-400 font-medium">{emptyLabel}</p>
          <p className="text-xs text-slate-300 mt-1">
            As avaliações são feitas por clientes após a experiência.
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
                  <p className="text-sm font-semibold text-[#0B2447] truncate">
                    {a.cliente?.name ?? 'Cliente Boatzy'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(a.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                  </p>
                </div>
                <Estrelas nota={a.nota} />
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
