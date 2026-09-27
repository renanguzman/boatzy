'use client';

import { ArrowLeft, ArrowRight, Check, Eye, Loader2 } from 'lucide-react';

type Props = {
  atual: number;
  total: number;
  labelAtual: string;
  /** Rótulo da próxima etapa; null na última. */
  proximoLabel: string | null;
  /**
   * `novo`: o botão principal avança e, na última etapa, publica.
   * `editar`: "Salvar alterações" fica disponível em QUALQUER etapa; avançar
   * vira um botão secundário.
   */
  modo: 'novo' | 'editar';
  rotuloSalvar: string;
  onVoltar: () => void;
  onProximo: () => void;
  onPreview: () => void;
  submitting: boolean;
  podeSalvar: boolean;
};

/**
 * Rodapé fixo (sticky) do cadastro em etapas: progresso + Voltar,
 * Pré-visualizar, Próximo e Salvar/Publicar (este é o único `type="submit"`).
 * No celular os botões secundários viram ícones de 48 px.
 */
export default function RodapeEtapas({
  atual, total, labelAtual, proximoLabel, modo, rotuloSalvar,
  onVoltar, onProximo, onPreview, submitting, podeSalvar,
}: Props) {
  const ultima = proximoLabel == null;
  const mostrarSalvar = modo === 'editar' || ultima;
  const pct = Math.round(((atual + 1) / total) * 100);

  const btnIcone = `h-12 w-12 md:h-11 md:w-auto md:px-4 shrink-0 inline-flex items-center justify-center gap-2 rounded-xl
    text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed`;

  return (
    <div className="sticky bottom-0 z-20 -mx-1 px-1 pt-3 pb-4 bg-gradient-to-t from-[#F8F9FB] via-[#F8F9FB] to-[#F8F9FB]/0">
      <div className="flex items-center gap-2 md:gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 md:px-5 shadow-lg shadow-slate-900/5">

        {/* Progresso (desktop) */}
        <div className="hidden md:block w-48 shrink-0 mr-auto">
          <p className="text-xs text-slate-500 truncate">
            Etapa <strong className="text-[#0B2447]">{atual + 1} de {total}</strong> · {labelAtual}
          </p>
          <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-[#0B2447] transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <button type="button" onClick={onVoltar} disabled={atual === 0 || submitting}
          aria-label="Etapa anterior"
          className={`${btnIcone} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}>
          <ArrowLeft className="w-4 h-4" /> <span className="hidden md:inline">Voltar</span>
        </button>

        <button type="button" onClick={onPreview} disabled={submitting}
          aria-label="Pré-visualizar"
          className={`${btnIcone} border border-[#0B2447]/20 bg-white text-[#0B2447] hover:bg-[#0B2447]/5 hover:border-[#0B2447]/40`}>
          <Eye className="w-4 h-4" /> <span className="hidden md:inline">Pré-visualizar</span>
        </button>

        {!ultima && (
          modo === 'novo' ? (
            <button type="button" onClick={onProximo} disabled={submitting}
              className="flex-1 md:flex-none h-12 md:h-11 inline-flex items-center justify-center gap-2 rounded-xl px-5
                bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold shadow-md shadow-[#0B2447]/10 transition disabled:opacity-50">
              <span className="truncate">Próximo: {proximoLabel}</span> <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          ) : (
            <button type="button" onClick={onProximo} disabled={submitting}
              aria-label={`Próxima etapa: ${proximoLabel}`}
              className={`${btnIcone} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
              <span className="hidden md:inline truncate max-w-[10rem]">{proximoLabel}</span> <ArrowRight className="w-4 h-4" />
            </button>
          )
        )}

        {mostrarSalvar && (
          <button type="submit" disabled={submitting || !podeSalvar}
            className="flex-1 md:flex-none h-12 md:h-11 inline-flex items-center justify-center gap-2 rounded-xl px-6
              bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold shadow-md shadow-[#0B2447]/10 transition
              disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
              : <><Check className="w-4 h-4" /> {rotuloSalvar}</>}
          </button>
        )}
      </div>
    </div>
  );
}
