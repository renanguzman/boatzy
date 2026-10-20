'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Clock, AlertCircle } from 'lucide-react';
import type { LocalResult } from '@/app/api/buscar/locais/route';

/**
 * Destino da busca. `place` = município (a busca pega roteiros com ponto de
 * saída e embarcações localizadas nele ou num raio ao redor); `geo` = "Próximo
 * de mim" (coordenada do usuário + raio).
 */
export type LocationValue =
  | { type: 'geo'; lat: number; lng: number; label: string }
  | { type: 'place'; id: number; nome: string; uf: string };

export const ROTULO_PROXIMO_DE_MIM = 'Próximo de mim';

const MSG_GEO_NEGADA =
  'Não temos acesso à sua localização. Para buscar perto de você, permita o acesso à localização '
  + 'para o Boatzy no navegador (ícone ao lado do endereço do site) e tente de novo.';
const MSG_GEO_FALHOU = 'Não foi possível obter sua localização agora. Tente de novo ou digite o destino.';

type Props = {
  value: LocationValue | null;
  onChange: (value: LocationValue | null) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  compact?: boolean;
  /** Oculta o rótulo interno (quando o campo já tem título por fora, como na lateral de filtros). */
  semRotulo?: boolean;
};

const RECENT_KEY = 'boatzy_recent_locations';

/** Só destinos (municípios): a localização do usuário muda, não vale guardar. */
function getRecent(): LocationValue[] {
  if (typeof window === 'undefined') return [];
  try {
    const salvos: LocationValue[] = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return salvos.filter((r) => r.type === 'place');
  } catch {
    return [];
  }
}

function saveRecent(value: LocationValue) {
  if (value.type !== 'place') return;
  try {
    const prev = getRecent().filter((r) => r.type !== 'place' || r.id !== value.id);
    localStorage.setItem(RECENT_KEY, JSON.stringify([value, ...prev].slice(0, 4)));
  } catch {
    // ignore
  }
}

function locationLabel(v: LocationValue) {
  return v.type === 'geo' ? v.label : `${v.nome}, ${v.uf}`;
}

export default function LocationPicker({ value, onChange, isOpen, onOpen, onClose, compact, semRotulo }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocalResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoErro, setGeoErro] = useState<string | null>(null);
  const [recent, setRecent] = useState<LocationValue[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Enter apertado antes de as sugestões chegarem: escolhe a 1ª quando chegarem.
  const escolherAoCarregarRef = useRef(false);
  const selecionarRef = useRef<(r: LocalResult) => void>(() => {});

  useEffect(() => {
    if (isOpen) {
      setRecent(getRecent());
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setSuggestions([]);
      setGeoErro(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      debounceRef.current = null;
      setLoading(true);
      try {
        const res = await fetch(`/api/buscar/locais?q=${encodeURIComponent(query)}`);
        const data: unknown = await res.json();
        const lista = res.ok && Array.isArray(data) ? (data as LocalResult[]) : [];
        setSuggestions(lista);
        if (escolherAoCarregarRef.current && lista.length > 0) selecionarRef.current(lista[0]);
        escolherAoCarregarRef.current = false;
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  function handleSelectPlace(r: LocalResult) {
    const v: LocationValue = { type: 'place', id: r.id, nome: r.nome, uf: r.uf };
    saveRecent(v);
    onChange(v);
    onClose();
  }
  useEffect(() => {
    selecionarRef.current = handleSelectPlace;
  });

  function handleSelectRecent(v: LocationValue) {
    saveRecent(v);
    onChange(v);
    onClose();
  }

  // "Próximo de mim": busca pela coordenada do usuário (com raio) — não pelo
  // município mais próximo, que podia estar longe. Na primeira vez o navegador
  // pede a permissão; negada ou bloqueada, explica como liberar.
  function handleGeo() {
    setGeoErro(null);
    if (!navigator.geolocation || !window.isSecureContext) {
      setGeoErro(MSG_GEO_FALHOU);
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        const v: LocationValue = {
          type: 'geo',
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
          label: ROTULO_PROXIMO_DE_MIM,
        };
        onChange(v);
        onClose();
      },
      (erro) => {
        setGeoLoading(false);
        setGeoErro(erro.code === erro.PERMISSION_DENIED ? MSG_GEO_NEGADA : MSG_GEO_FALHOU);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 },
    );
  }

  // Enter escolhe a primeira sugestão (antes o texto digitado era descartado).
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0 && !loading && !debounceRef.current) handleSelectPlace(suggestions[0]);
      else if (query.trim().length >= 2) escolherAoCarregarRef.current = true;
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  const showSuggestions = query.trim().length > 0;
  const showRecent = !showSuggestions && recent.length > 0;

  return (
    <div className="relative flex-1 min-w-0">
      {/* Field trigger */}
      <button
        type="button"
        onClick={onOpen}
        className={`w-full text-left rounded-2xl transition-all ${
          compact ? 'px-3 py-2' : 'px-4 py-3'
        } ${isOpen ? 'ring-2 ring-slate-800 bg-white shadow-md' : 'hover:bg-slate-50'}`}
      >
        {!semRotulo && (
          <span className={`block font-bold text-slate-500 uppercase tracking-wider mb-0.5 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
            Destino
          </span>
        )}
        {value ? (
          <span className={`font-medium text-slate-800 truncate block ${compact ? 'text-xs' : 'text-sm'}`}>
            {locationLabel(value)}
          </span>
        ) : (
          <span className={`text-slate-400 ${compact ? 'text-xs' : 'text-sm'}`}>Para onde?</span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-slate-100">
            <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Cidade de saída do passeio"
              className="flex-1 text-sm text-slate-800 outline-none placeholder:text-slate-400 bg-transparent"
            />
            {loading && (
              <div className="h-4 w-4 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {/* Near me */}
            <button
              type="button"
              onClick={handleGeo}
              disabled={geoLoading}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
            >
              <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                {geoLoading ? (
                  <div className="h-4 w-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                ) : (
                  <Navigation className="h-4 w-4 text-slate-600" />
                )}
              </div>
              <span className="text-sm font-medium text-slate-800">{ROTULO_PROXIMO_DE_MIM}</span>
            </button>
            {geoErro && (
              <p role="alert" className="mx-4 mb-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                {geoErro}
              </p>
            )}

            {/* Recent searches (só destinos; a localização do usuário muda) */}
            {showRecent && (
              <>
                <div className="px-4 py-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Buscas recentes
                  </span>
                </div>
                {recent.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectRecent(r)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4 text-slate-500" />
                    </div>
                    <span className="text-sm text-slate-700">{locationLabel(r)}</span>
                  </button>
                ))}
              </>
            )}

            {/* Suggestions from API */}
            {showSuggestions && query.trim().length < 2 && (
              <p className="px-4 py-4 text-sm text-slate-400 text-center">Digite ao menos 2 letras</p>
            )}
            {showSuggestions && query.trim().length >= 2 && suggestions.length === 0 && !loading && (
              <p className="px-4 py-4 text-sm text-slate-400 text-center">
                Nenhum destino encontrado
              </p>
            )}
            {showSuggestions &&
              suggestions.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelectPlace(r)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <MapPin className="h-4 w-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{r.nome}</p>
                    <p className="text-xs text-slate-500">
                      {r.estado}
                      {r.temOfertas && <span className="text-emerald-600 font-medium"> · Com passeios no Boatzy</span>}
                    </p>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
