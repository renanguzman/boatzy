'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Phone } from 'lucide-react';
import { COUNTRIES, DEFAULT_COUNTRY, type Country } from '@/lib/countries';
import { applyPhoneMask, maskDigitCount, onlyDigits } from '@/lib/validators';

export type PhoneValue = {
  /** Número completo em E.164, ex.: +5511912345678 (vazio se sem dígitos). */
  e164: string;
  /** True quando o número tem a quantidade de dígitos esperada para o país. */
  valid: boolean;
};

type PhoneInputProps = {
  onChange: (value: PhoneValue) => void;
  disabled?: boolean;
  /** Marca o campo como inválido visualmente (após tentativa de envio). */
  invalid?: boolean;
  /** Valor inicial em E.164 (ex.: +5511912345678) — usado para pré-preencher. */
  initialE164?: string;
};

// Máscara genérica quando o país não define uma (até 15 dígitos E.164).
const GENERIC_MASK = '### ### ### ####';

/** Deduz país + dígitos nacionais a partir de um E.164. */
function parseE164(e164: string): { country: Country; digits: string } {
  const trimmed = (e164 ?? '').trim();
  if (trimmed.startsWith('+')) {
    // Casa o DDI mais longo primeiro (evita ambiguidade entre +5 e +55 etc.).
    const byLength = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
    const match = byLength.find((c) => trimmed.startsWith(c.dial));
    if (match) {
      return { country: match, digits: onlyDigits(trimmed.slice(match.dial.length)) };
    }
  }
  return { country: DEFAULT_COUNTRY, digits: '' };
}

function computeValue(country: Country, digits: string): PhoneValue {
  const mask = country.mask ?? GENERIC_MASK;
  const expected = country.mask ? maskDigitCount(mask) : 0;
  const valid = country.mask
    ? digits.length === expected
    : digits.length >= 8 && digits.length <= 15;
  return {
    e164: digits ? `${country.dial}${digits}` : '',
    valid,
  };
}

export default function PhoneInput({ onChange, disabled, invalid, initialE164 }: PhoneInputProps) {
  const initial = useMemo(() => parseE164(initialE164 ?? ''), [initialE164]);
  const [country, setCountry] = useState<Country>(initial.country);
  const [digits, setDigits] = useState(initial.digits); // apenas dígitos do número nacional
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const mask = country.mask ?? GENERIC_MASK;
  const display = applyPhoneMask(digits, mask);

  // Notifica o pai a cada mudança de país ou número.
  useEffect(() => {
    onChange(computeValue(country, digits));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, digits]);

  // Fecha o dropdown ao clicar fora.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [search]);

  function handleDigits(raw: string) {
    const limit = country.mask ? maskDigitCount(mask) : 15;
    setDigits(onlyDigits(raw).slice(0, limit));
  }

  function selectCountry(c: Country) {
    setCountry(c);
    setOpen(false);
    setSearch('');
  }

  return (
    <div className="relative" ref={containerRef}>
      <div
        className={`flex items-stretch rounded-xl border bg-slate-50/50 transition-all focus-within:ring-2 focus-within:ring-[#0B3D91]/20 focus-within:border-[#0B3D91] ${
          invalid ? 'border-red-300' : 'border-slate-200'
        }`}
      >
        {/* Seletor de país */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={disabled}
          className="flex items-center gap-1.5 pl-3.5 pr-2.5 border-r border-slate-200 text-sm text-slate-700 hover:bg-slate-100/60 rounded-l-xl transition-colors disabled:opacity-60"
          aria-label="Selecionar país"
        >
          <span className="text-lg leading-none">{country.flag}</span>
          <span className="tabular-nums text-slate-500">{country.dial}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {/* Número nacional */}
        <div className="relative flex-1">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="tel"
            inputMode="numeric"
            value={display}
            onChange={(e) => handleDigits(e.target.value)}
            placeholder={mask.replace(/#/g, '9')}
            disabled={disabled}
            required
            className="w-full pl-9 pr-4 py-3.5 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none rounded-r-xl"
          />
        </div>
      </div>

      {/* Dropdown de países */}
      {open && (
        <div className="absolute z-20 mt-2 w-full max-h-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar país ou DDI"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3D91]/20 focus:border-[#0B3D91]"
              />
            </div>
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-sm text-slate-400 text-center">Nenhum país encontrado</li>
            )}
            {filtered.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  onClick={() => selectCountry(c)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-slate-50 transition-colors ${
                    c.code === country.code ? 'bg-slate-50 font-medium' : ''
                  }`}
                >
                  <span className="text-lg leading-none">{c.flag}</span>
                  <span className="flex-1 text-slate-700">{c.name}</span>
                  <span className="tabular-nums text-slate-400">{c.dial}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
