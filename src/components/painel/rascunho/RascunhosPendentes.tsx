'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { History, ImageIcon } from 'lucide-react';
import { apagarRascunho, listarRascunhos, type RascunhoListado } from '@/lib/rascunhos/armazenamento';
import { quandoRascunho } from './quando';

type Props = {
  usuarioId: string;
  entidade: 'embarcacao' | 'roteiro';
};

const ROTA = { embarcacao: '/painel/embarcacoes', roteiro: '/painel/roteiros' } as const;
const NOME = { embarcacao: 'embarcação', roteiro: 'roteiro' } as const;

/**
 * Listagens de embarcações/roteiros: cadastros não concluídos e edições não salvas
 * guardados NESTE aparelho pelo rascunho automático (SPEC §107.4) — "Continuar" leva
 * ao formulário, que restaura o rascunho.
 */
export default function RascunhosPendentes({ usuarioId, entidade }: Props) {
  const [itens, setItens] = useState<RascunhoListado[]>([]);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    listarRascunhos(`${usuarioId}:${entidade}:`).then(lista => {
      // Envio interrompido depois de criar: o formulário avisa e apaga ao abrir.
      if (!cancelado) setItens(lista.filter(r => !r.criadoId));
    }).catch(() => {});
    return () => { cancelado = true; };
  }, [usuarioId, entidade]);

  if (itens.length === 0) return null;

  async function descartar(chave: string) {
    setConfirmando(null);
    setItens(prev => prev.filter(r => r.chave !== chave));
    await apagarRascunho(chave);
  }

  return (
    <div className="mb-6 space-y-3">
      {itens.map(r => {
        const alvo = r.chave.split(':')[2];
        const novo = alvo === 'novo';
        const href = novo ? `${ROTA[entidade]}/novo` : `${ROTA[entidade]}/${alvo}/editar`;
        const titulo = r.resumo.titulo || `${NOME[entidade].charAt(0).toUpperCase()}${NOME[entidade].slice(1)} sem nome`;
        return (
          <div key={r.chave}
            className="flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3.5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <History className="mt-0.5 h-5 w-5 shrink-0 text-[#0B2447]" />
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-[#0B2447]">
                  {novo ? 'Cadastro não concluído' : 'Alterações não salvas'}: <span className="break-words">{titulo}</span>
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-slate-600">
                  <span>Guardado neste aparelho {quandoRascunho(r.atualizadoEm)}</span>
                  {r.resumo.fotos > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <ImageIcon className="h-3.5 w-3.5" /> {r.resumo.fotos} foto{r.resumo.fotos > 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              {confirmando === r.chave ? (
                <>
                  <span className="text-sm text-slate-600">Apagar o rascunho?</span>
                  <button type="button" onClick={() => void descartar(r.chave)}
                    className="inline-flex h-10 items-center rounded-xl border border-red-200 bg-white px-3.5 text-sm font-semibold text-red-700 hover:bg-red-50">
                    Sim, apagar
                  </button>
                  <button type="button" onClick={() => setConfirmando(null)}
                    className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setConfirmando(r.chave)}
                    className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-semibold text-slate-500 hover:text-slate-700">
                    Descartar
                  </button>
                  <Link href={href}
                    className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-[#0B2447] px-4 text-sm font-semibold text-white hover:bg-[#0B3D91] sm:flex-none">
                    Continuar
                  </Link>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
