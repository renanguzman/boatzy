'use client';

import { useEffect, useState } from 'react';
import { Copy, Loader2, AlertCircle, X } from 'lucide-react';
import type { LocalizacaoCopia } from '@/lib/copia-cadastro';

export type OpcaoCopia = { id: string; nome: string };

type Resultado<T> = { ok: true; dados: T } | { ok: false; error: string };

/**
 * "Copiar de outro cadastro" numa etapa dos forms do painel (embarcação e
 * roteiro): o gestor escolhe outro cadastro dele, vê numa modal tudo que será
 * copiado e só então os dados entram no form (`onCopiar`). Copia apenas a
 * etapa em questão. Não renderiza nada se não houver outros cadastros.
 */
export default function CopiarDeOutroCadastro<T extends { nome: string }>({
  opcoes, chamada, rotuloSelect, titulo, buscar, resumo, onCopiar,
}: {
  opcoes: OpcaoCopia[];
  /** Texto da faixa, ex.: "Tem outra embarcação parecida? Copie os detalhes dela…". */
  chamada: string;
  /** Primeira opção do select, ex.: "Copiar de outra embarcação…". */
  rotuloSelect: string;
  /** Título da modal, completado com o nome da origem: "Copiar detalhes de “X”?". */
  titulo: string;
  buscar: (id: string) => Promise<Resultado<T>>;
  resumo: (dados: T) => React.ReactNode;
  onCopiar: (dados: T) => void;
}) {
  const [selecionada, setSelecionada] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<T | null>(null);

  useEffect(() => {
    if (!dados) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setDados(null); setSelecionada(''); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dados]);

  if (opcoes.length === 0) return null;

  async function selecionar(id: string) {
    setSelecionada(id);
    setErro(null);
    if (!id) return;
    setCarregando(true);
    const res = await buscar(id);
    setCarregando(false);
    if (!res.ok) { setErro(res.error); setSelecionada(''); return; }
    setDados(res.dados);
  }

  function fechar() {
    setDados(null);
    setSelecionada('');
  }

  function confirmar() {
    if (dados) onCopiar(dados);
    fechar();
  }

  return (
    <>
      <div className="rounded-2xl border border-dashed border-[#0B2447]/25 bg-[#0B2447]/[0.03] px-4 py-3.5 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <Copy className="mt-0.5 h-4 w-4 shrink-0 text-[#0B2447]" />
            <p className="text-sm text-slate-600">{chamada}</p>
          </div>
          <div className="relative w-full sm:w-64 shrink-0">
            <select
              aria-label={rotuloSelect}
              className="w-full appearance-none cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 py-2.5
                pr-9 text-sm text-slate-800 transition focus:border-[#0B2447]/40 focus:outline-none
                focus:ring-2 focus:ring-[#0B2447]/20 disabled:opacity-60"
              value={selecionada}
              disabled={carregando}
              onChange={e => selecionar(e.target.value)}
            >
              <option value="">{rotuloSelect}</option>
              {opcoes.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
            {carregando && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#0B2447]" />
            )}
          </div>
        </div>
        {erro && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {erro}
          </p>
        )}
      </div>

      {dados && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={fechar} />
          <div role="dialog" aria-modal="true" aria-labelledby="copiar-dados-titulo"
            className="relative flex w-full max-w-lg max-h-[90dvh] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
            <div className="flex items-start gap-3 border-b border-slate-100 p-5 sm:p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B2447]/5">
                <Copy className="h-5 w-5 text-[#0B2447]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="copiar-dados-titulo" className="text-base font-bold text-[#0B2447]">
                  {titulo} de “{dados.nome}”?
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  Estes dados vão <strong>substituir</strong> o que estiver preenchido nesta etapa.
                  Você pode ajustar tudo depois.
                </p>
              </div>
              <button type="button" onClick={fechar} aria-label="Fechar"
                className="-mr-1 -mt-1 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
              {resumo(dados)}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-4 sm:px-6">
              <button type="button" onClick={fechar}
                className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700">
                Cancelar
              </button>
              <button type="button" onClick={confirmar}
                className="rounded-xl bg-[#0B2447] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0B2447]/90">
                Copiar dados
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Blocos do resumo do que será copiado ─────────────────────────────────────

function Vazio({ texto = 'Não informado' }: { texto?: string }) {
  return <span className="text-slate-400">{texto}</span>;
}

export function LinhaResumo({ label, valor }: { label: string; valor: string | null | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-slate-800 break-words">{valor || <Vazio />}</dd>
    </div>
  );
}

export function GrupoResumo({ titulo, itens, vazio }: { titulo: string; itens: string[]; vazio?: string }) {
  return (
    <div className="py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {titulo} {itens.length > 0 && <span className="font-normal normal-case tracking-normal">({itens.length})</span>}
      </p>
      {itens.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {itens.map((i, idx) => (
            <li key={`${idx}-${i}`} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">{i}</li>
          ))}
        </ul>
      ) : <p className="text-sm"><Vazio texto={vazio} /></p>}
    </div>
  );
}

export function ResumoLocalizacao({ d }: { d: LocalizacaoCopia }) {
  const temMapa = !!d.latitude && !!d.longitude;
  return (
    <dl className="divide-y divide-slate-100">
      <LinhaResumo label="CEP" valor={d.cep} />
      <LinhaResumo label="Estado" valor={d.estado} />
      <LinhaResumo label="Município" valor={d.municipio} />
      <LinhaResumo label="Bairro" valor={d.bairro} />
      <LinhaResumo label="Logradouro" valor={d.logradouro} />
      <LinhaResumo label="Número" valor={d.logradouro_numero} />
      <LinhaResumo label="Complemento" valor={d.complemento} />
      <LinhaResumo label="Ponto no mapa"
        valor={temMapa ? `${parseFloat(d.latitude).toFixed(5)}, ${parseFloat(d.longitude).toFixed(5)}` : null} />
    </dl>
  );
}
