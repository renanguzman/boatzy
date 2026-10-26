'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Star } from 'lucide-react';
import { criarAvaliacao } from '../actions';
import { useFormatos } from '@/i18n/formatos';

type AvaliacaoExistente = {
  nota: number;
  comentario: string | null;
  created_at: string;
  status: 'pendente' | 'aprovada';
};

type Props = {
  reservaId: string;
  avaliacao: AvaliacaoExistente | null;
};

function Estrelas({ nota, tamanho = 'h-4 w-4' }: { nota: number; tamanho?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${tamanho} ${n <= nota ? 'fill-destaque text-destaque' : 'text-slate-300'}`}
        />
      ))}
    </span>
  );
}

/**
 * Bloco de avaliação exibido no card de reserva CONCLUÍDA em /minhas-reservas:
 * mostra a avaliação já enviada, ou o formulário (estrelas + comentário).
 */
export default function AvaliacaoReserva({ reservaId, avaliacao }: Props) {
  const router = useRouter();
  const t = useTranslations('MinhasReservas.avaliacao');
  const tErros = useTranslations('MinhasReservas.erros');
  const f = useFormatos();
  const [pending, startTransition] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [nota, setNota] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  if (avaliacao) {
    return (
      <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3.5">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-sm font-semibold text-amber-700">{t('sua')}</span>
          <Estrelas nota={avaliacao.nota} />
          {avaliacao.status === 'pendente' && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
              {t('aguardandoAprovacao')}
            </span>
          )}
        </div>
        {avaliacao.comentario && <p className="text-sm text-slate-600">{avaliacao.comentario}</p>}
        <p className="mt-1.5 text-xs text-slate-400">
          {t('enviadaEm', { data: f.data(avaliacao.created_at) })}
        </p>
      </div>
    );
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-marinho hover:bg-marinho-escuro text-white px-4 py-2 text-sm font-semibold transition-colors"
      >
        <Star className="h-4 w-4" />
        {t('avaliar')}
      </button>
    );
  }

  function submeter() {
    setErro(null);
    if (nota < 1) {
      setErro(tErros('nota'));
      return;
    }
    startTransition(async () => {
      const res = await criarAvaliacao(reservaId, nota, comentario);
      if (!res.ok) {
        setErro(res.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-marinho mb-2">{t('comoFoi')}</p>

      <div className="flex items-center gap-1 mb-3" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setNota(n)}
            onMouseEnter={() => setHover(n)}
            aria-label={t('estrelas', { count: n })}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <Star
              className={`h-7 w-7 transition-colors ${
                n <= (hover || nota) ? 'fill-destaque text-destaque' : 'text-slate-300'
              }`}
            />
          </button>
        ))}
        {nota > 0 && (
          <span className="ml-2 text-xs font-medium text-slate-500">{t('deCinco', { nota })}</span>
        )}
      </div>

      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder={t('placeholder')}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-marinho/30 resize-none"
      />

      {erro && <p className="mt-2 text-xs font-medium text-red-600">{erro}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={submeter}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-marinho hover:bg-marinho-escuro disabled:opacity-60 text-white px-4 py-2 text-sm font-semibold transition-colors"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t('enviar')}
        </button>
        <button
          type="button"
          onClick={() => { setAberto(false); setErro(null); }}
          disabled={pending}
          className="rounded-xl border border-slate-300 text-slate-600 hover:bg-white px-4 py-2 text-sm font-semibold transition-colors"
        >
          {t('agoraNao')}
        </button>
      </div>
    </div>
  );
}
