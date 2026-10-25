'use client';

import { useId, useRef, useState } from 'react';
import { Ban, X } from 'lucide-react';
import {
  MAX_CARACTERES_REGRA, MAX_REGRAS, normalizarRegra, normalizarRegras, separarRegras,
} from '@/lib/embarcacao-regras';

type Props = {
  value: string[];
  onChange: (regras: string[]) => void;
};

/**
 * Campo de tags das regras da embarcação (step Detalhes do cadastro/edição). Cada regra vira uma
 * tag ao pressionar Enter ou digitar ponto e vírgula; colar um texto com ";" ou quebras de linha
 * cria várias de uma vez; Backspace com o campo vazio remove a última; sair do campo guarda o que
 * estava digitado. As tags usam o mesmo vermelho da exibição no site.
 */
export default function RegrasInput({ value, onChange }: Props) {
  const [texto, setTexto] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const idAjuda = useId();
  const cheio = value.length >= MAX_REGRAS;

  function adicionar(novas: string[]) {
    if (novas.length === 0) return;
    onChange(normalizarRegras([...value, ...novas]));
  }

  function confirmarTexto() {
    const regra = normalizarRegra(texto);
    if (regra) adicionar([regra]);
    setTexto('');
  }

  function remover(indice: number) {
    onChange(value.filter((_, i) => i !== indice));
    inputRef.current?.focus();
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 transition
          focus-within:ring-2 focus-within:ring-marinho/20 focus-within:border-marinho/40 cursor-text"
      >
        {value.map((regra, i) => (
          <span
            key={`${regra}-${i}`}
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 py-1 pl-2.5 pr-1 text-sm font-medium text-red-700"
          >
            <Ban className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 break-words">{regra}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remover(i); }}
              aria-label={`Remover regra: ${regra}`}
              className="ml-0.5 rounded-md p-0.5 text-red-400 transition-colors hover:bg-red-100 hover:text-red-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={texto}
          disabled={cheio}
          maxLength={MAX_CARACTERES_REGRA * 4}
          aria-describedby={idAjuda}
          placeholder={cheio ? `Limite de ${MAX_REGRAS} regras atingido` : value.length === 0 ? 'Ex.: Proibido fumar a bordo' : 'Adicionar outra regra…'}
          onChange={(e) => {
            const v = e.target.value;
            // Ponto e vírgula fecha a regra na hora; o que vier depois continua sendo digitado.
            if (v.includes(';')) {
              const partes = v.split(';');
              adicionar(partes.slice(0, -1).map(normalizarRegra).filter(Boolean));
              setTexto(partes[partes.length - 1].trimStart());
            } else {
              setTexto(v);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              confirmarTexto();
            } else if (e.key === 'Backspace' && texto === '' && value.length > 0) {
              e.preventDefault();
              remover(value.length - 1);
            }
          }}
          onPaste={(e) => {
            const colado = e.clipboardData.getData('text');
            if (!/[;\n]/.test(colado)) return;
            e.preventDefault();
            adicionar(separarRegras(texto + colado));
            setTexto('');
          }}
          onBlur={confirmarTexto}
          className="min-w-[12rem] flex-1 bg-transparent px-1 py-1 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed"
        />
      </div>
      <p id={idAjuda} className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-slate-400">
        <span>Digite uma regra e pressione <strong className="font-semibold text-slate-500">Enter</strong> ou <strong className="font-semibold text-slate-500">;</strong> para separar. Clique no × para remover.</span>
        <span className="tabular-nums">{value.length}/{MAX_REGRAS}</span>
      </p>
    </div>
  );
}
