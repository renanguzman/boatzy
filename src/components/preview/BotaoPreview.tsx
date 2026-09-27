'use client';

import { Eye } from 'lucide-react';

/** Botão "Pré-visualizar" dos formulários de publicação do painel. */
export default function BotaoPreview({ onClick, disabled, className = '' }: {
  onClick: () => void; disabled?: boolean; className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-[#0B2447]/20 bg-white px-4 py-2.5
        text-sm font-semibold text-[#0B2447] hover:bg-[#0B2447]/5 hover:border-[#0B2447]/40 transition
        disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <Eye className="h-4 w-4" /> Pré-visualizar
    </button>
  );
}
