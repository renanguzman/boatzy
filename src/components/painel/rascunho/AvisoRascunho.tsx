'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, History, X } from 'lucide-react';
import type { Rascunho } from '@/lib/rascunhos/useRascunhoCadastro';
import { quandoRascunho } from './quando';

type Props = {
  rascunho: Rascunho;
  modo: 'novo' | 'editar';
  /** "embarcação" / "roteiro" — com o artigo certo em `artigo`. */
  entidade: string;
  artigo: 'a' | 'o';
  /** Cadastro novo já criado por um envio interrompido: link para a edição. */
  hrefCriado?: (id: string) => string;
};

/**
 * Aviso do rascunho automático no topo do cadastro (SPEC §107.4): rascunho
 * restaurado ("Começar do zero"/"Descartar alterações", com confirmação), conflito
 * com o servidor na edição e cadastro já criado por um envio que não terminou.
 */
export default function AvisoRascunho({ rascunho, modo, entidade, artigo, hrefCriado }: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const { aviso } = rascunho;
  if (!aviso) return null;

  const btnSec = 'inline-flex h-10 items-center justify-center rounded-xl border px-3.5 text-sm font-semibold transition';
  const fechar = (
    <button type="button" onClick={rascunho.fecharAviso} aria-label="Fechar aviso"
      className="-mr-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/60 hover:text-slate-600">
      <X className="h-4 w-4" />
    </button>
  );

  if (aviso.tipo === 'criado') {
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3.5">
        <History className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
        <div className="min-w-0 flex-1 text-sm text-teal-900">
          <p className="font-semibold">{artigo === 'a' ? 'Sua' : 'Seu'} {entidade} já foi enviad{artigo} para análise.</p>
          <p className="mt-0.5">
            O envio de {quandoRascunho(aviso.em)} foi interrompido antes de terminar. Confira os dados e as fotos na edição.
          </p>
          {hrefCriado && (
            <Link href={hrefCriado(aviso.id)} className={`${btnSec} mt-3 border-teal-300 bg-white text-teal-800 hover:bg-teal-100/50`}>
              Abrir a edição
            </Link>
          )}
        </div>
        {fechar}
      </div>
    );
  }

  if (aviso.tipo === 'conflito') {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1 text-sm text-amber-900">
          <p className="font-semibold">Você tem alterações não salvas de {quandoRascunho(aviso.em)}.</p>
          <p className="mt-0.5">
            Mas {artigo} {entidade} foi alterad{artigo} depois disso (em outro aparelho ou pela equipe Boatzy).
            Usar as suas alterações pode desfazer o que mudou.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={rascunho.usarRascunho}
              className={`${btnSec} border-amber-300 bg-white text-amber-900 hover:bg-amber-100/60`}>
              Usar minhas alterações
            </button>
            <button type="button" onClick={rascunho.descartar}
              className={`${btnSec} border-transparent text-amber-800 underline-offset-2 hover:underline`}>
              Descartar e ver a versão atual
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Restaurado
  const perdidos = aviso.perdidos;
  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3.5">
      <History className="mt-0.5 h-5 w-5 shrink-0 text-[#0B2447]" />
      <div className="min-w-0 flex-1 text-sm text-slate-700">
        <p className="font-semibold text-[#0B2447]">
          {modo === 'novo'
            ? `Continuamos de onde você parou (${quandoRascunho(aviso.em)}).`
            : `Recuperamos alterações que você ainda não tinha salvado (${quandoRascunho(aviso.em)}).`}
        </p>
        <p className="mt-0.5">
          {modo === 'novo'
            ? 'O que você preenche fica guardado neste aparelho até o envio.'
            : 'Revise e toque em "Salvar alterações" para gravar.'}
        </p>
        {perdidos > 0 && (
          <p className="mt-1.5 flex items-start gap-1.5 text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {perdidos === 1
              ? '1 foto ou documento não pôde ser recuperado — adicione de novo.'
              : `${perdidos} fotos ou documentos não puderam ser recuperados — adicione de novo.`}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {confirmando ? (
            <>
              <span className="text-sm text-slate-600">
                {modo === 'novo' ? 'Apagar tudo o que foi preenchido?' : 'Voltar aos dados salvos?'}
              </span>
              <button type="button" onClick={() => { setConfirmando(false); rascunho.descartar(); }}
                className={`${btnSec} border-red-200 bg-white text-red-700 hover:bg-red-50`}>
                {modo === 'novo' ? 'Sim, apagar' : 'Sim, descartar'}
              </button>
              <button type="button" onClick={() => setConfirmando(false)}
                className={`${btnSec} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}>
                Cancelar
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmando(true)}
              className={`${btnSec} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}>
              {modo === 'novo' ? 'Começar do zero' : 'Descartar alterações'}
            </button>
          )}
        </div>
      </div>
      {fechar}
    </div>
  );
}
