'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Hourglass, ShieldCheck, ChevronDown } from 'lucide-react';
import type { Passo, PrimeirosPassos } from './passos';

const CHAVE_OCULTO = 'boatzy:inicio:primeiros-passos-oculto';
const EVENTO = 'boatzy:primeiros-passos';

function assinar(cb: () => void) {
  window.addEventListener('storage', cb);
  window.addEventListener(EVENTO, cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener(EVENTO, cb);
  };
}

function lerOculto(): boolean {
  try {
    return localStorage.getItem(CHAVE_OCULTO) === '1';
  } catch {
    return false;
  }
}

function gravarOculto(oculto: boolean) {
  try {
    if (oculto) localStorage.setItem(CHAVE_OCULTO, '1');
    else localStorage.removeItem(CHAVE_OCULTO);
  } catch {
    /* storage bloqueado */
  }
  window.dispatchEvent(new Event(EVENTO));
}

/**
 * Passo a passo do dono até o primeiro passeio no site (SPEC §97). Destaca o próximo
 * passo com um botão principal; o que depende da equipe Boatzy aparece como "aguardando".
 * Pode ser recolhido (ex.: quem só anuncia embarcação à venda) e reaberto.
 */
export default function PrimeirosPassosCard({ dados }: { dados: PrimeirosPassos }) {
  const oculto = useSyncExternalStore(assinar, lerOculto, () => false);
  const { passos, concluidos, noSite } = dados;
  const proximo = passos.find((p) => p.estado === 'fazer') ?? null;
  const total = passos.length;

  if (oculto) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-[#0B2447]">Primeiros passos</span> · {concluidos} de {total} concluídos
          {proximo && <span className="hidden sm:inline"> · Próximo: {proximo.titulo.toLowerCase()}</span>}
        </p>
        <button type="button" onClick={() => gravarOculto(false)} className="inline-flex items-center gap-1 text-sm font-semibold text-[#0B3D91] hover:underline">
          Mostrar <ChevronDown className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <section aria-labelledby="primeiros-passos" className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">Primeiros passos</p>
            <h2 id="primeiros-passos" className="mt-0.5 text-lg font-bold text-[#0B2447]">
              {noSite ? 'Falta pouco: apresente-se e informe onde receber' : 'Coloque seu primeiro passeio no site e prepare-se para receber'}
            </h2>
          </div>
          <button type="button" onClick={() => gravarOculto(true)} className="shrink-0 text-xs font-semibold text-slate-400 hover:text-slate-600">
            Ocultar
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={concluidos}>
            <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${(concluidos / total) * 100}%` }} />
          </div>
          <span className="shrink-0 text-xs font-semibold text-slate-500">{concluidos} de {total}</span>
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />
          {noSite
            ? 'Seu passeio já está no ar. Agora é a sua vez: a equipe Boatzy aprova o seu perfil antes de ele aparecer para os clientes, e os dados de recebimento liberam os seus repasses.'
            : 'Por segurança dos passageiros, a equipe Boatzy aprova cada embarcação, cada roteiro e o seu perfil antes de irem para o site. A embarcação só é aprovada com o documento (TIE). Para receber, informe também onde depositar os repasses.'}
        </p>
      </div>

      <ol className="px-4 py-2 sm:px-6">
        {passos.map((p, i) => (
          <LinhaPasso key={p.id} passo={p} numero={i + 1} ultimo={i === total - 1} principal={p === proximo} />
        ))}
      </ol>
    </section>
  );
}

function LinhaPasso({ passo, numero, ultimo, principal }: { passo: Passo; numero: number; ultimo: boolean; principal: boolean }) {
  const { estado } = passo;
  const marcador =
    estado === 'feito' ? 'bg-teal-500 text-white'
    : estado === 'aguardando' ? 'bg-amber-100 text-amber-700'
    : estado === 'fazer' && passo.alerta ? 'bg-orange-500 text-white'
    : principal ? 'bg-[#0B2447] text-white'
    : estado === 'fazer' ? 'border-2 border-[#0B2447] text-[#0B2447]'
    : 'border-2 border-slate-200 text-slate-400';
  const corSituacao =
    passo.alerta ? 'text-orange-700'
    : estado === 'aguardando' ? 'text-amber-700'
    : estado === 'feito' ? 'text-teal-700'
    : 'text-slate-400';
  const mostrarDescricao = estado === 'fazer' || estado === 'aguardando';

  return (
    <li className="relative flex gap-3 py-3 sm:gap-4">
      {!ultimo && <span aria-hidden className="absolute left-[15px] top-12 bottom-0 w-px bg-slate-200" />}
      <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${marcador}`}>
        {estado === 'feito' ? <Check className="h-4 w-4" strokeWidth={3} />
          : estado === 'aguardando' ? <Hourglass className="h-4 w-4" />
          : numero}
      </span>
      <div className={`min-w-0 flex-1 ${principal ? 'rounded-xl border border-[#0B2447]/10 bg-slate-50/80 p-3 sm:p-4 -mt-1' : 'pt-1'}`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className={`text-sm ${estado === 'feito' || estado === 'depois' ? 'font-medium text-slate-500' : 'font-bold text-[#0B2447]'}`}>
            {passo.titulo}
          </h3>
          {principal && (
            <span className="rounded-full bg-[#0B2447] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Próximo passo</span>
          )}
          {passo.situacao && <span className={`text-xs font-medium ${corSituacao}`}>· {passo.situacao}</span>}
        </div>
        {mostrarDescricao && <p className="mt-1 text-sm text-slate-600">{passo.descricao}</p>}
        {passo.acao && (
          <Link
            href={passo.acao.href}
            className={`mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              principal
                ? passo.alerta ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-[#0B2447] text-white hover:bg-[#0B3D91]'
                : 'border border-slate-200 bg-white text-[#0B2447] hover:bg-slate-50'
            }`}
          >
            {passo.acao.label} <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </li>
  );
}
