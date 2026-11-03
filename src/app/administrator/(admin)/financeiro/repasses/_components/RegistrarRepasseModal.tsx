'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle, Loader2, Paperclip, X } from 'lucide-react';
import { FUSO_HORARIO } from '@/lib/datas';
import { formatCurrencyPrecise } from '@/lib/utils';
import { resumoDestino } from '@/lib/recebimento-tipos';
import { METODO_REPASSE, METODOS_REPASSE } from '@/lib/repasses/rotulos';
import { enviarComprovante, validarComprovante } from '@/lib/repasses/envio';
import type { Database, RepasseMetodo } from '@/types/supabase';
import { registrarRepasse } from '../actions';

type Recebimento = Database['public']['Tables']['gestor_recebimento']['Row'];

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40';
const labelCls = 'mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400';

/** "AAAA-MM-DDTHH:mm" de agora no horário de Brasília (valor do input datetime-local). */
function agoraEmBrasilia(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: FUSO_HORARIO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date()).replace(' ', 'T');
}

export default function RegistrarRepasseModal({
  gestor, recebimento, pedidoIds, valorTotal, onFechar,
}: {
  gestor: { id: string; nome: string };
  recebimento: Recebimento;
  pedidoIds: string[];
  valorTotal: number;
  onFechar: () => void;
}) {
  const router = useRouter();
  const [metodo, setMetodo] = useState<RepasseMetodo>(recebimento.tipo === 'pix' ? 'pix' : 'ted');
  const [pagoEm, setPagoEm] = useState(agoraEmBrasilia);
  const [referencia, setReferencia] = useState('');
  const [observacao, setObservacao] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<{ numero: number; valor: number } | null>(null);
  const [pendente, iniciar] = useTransition();
  const inputArquivo = useRef<HTMLInputElement>(null);

  // O id do repasse é definido aqui para o comprovante subir já na pasta certa.
  const repasseId = useMemo(() => crypto.randomUUID(), []);
  const ocupado = pendente || progresso !== null;

  function escolherArquivo(file?: File) {
    if (inputArquivo.current) inputArquivo.current.value = '';
    if (!file) return;
    const motivo = validarComprovante(file);
    if (motivo) { setErro(motivo); return; }
    setErro(null);
    setArquivo(file);
  }

  function confirmar() {
    setErro(null);
    if (!pagoEm) { setErro('Informe a data e a hora do pagamento.'); return; }
    iniciar(async () => {
      let comprovante: { key: string; nome: string } | null = null;
      if (arquivo) {
        setProgresso(0);
        const up = await enviarComprovante(arquivo, gestor.id, repasseId, setProgresso);
        setProgresso(null);
        if (!up.ok) { setErro(up.erro); return; }
        comprovante = up.comprovante;
      }
      const res = await registrarRepasse({
        repasseId, gestorId: gestor.id, pedidoIds, metodo,
        pagoEm: `${pagoEm}:00-03:00`, // horário de Brasília (UTC−3, sem horário de verão)
        referencia, observacao, comprovante,
      });
      if (!res.ok) { setErro(res.error); return; }
      setFeito({ numero: res.numero, valor: res.valorTotal });
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-repasse">
      <div className="absolute inset-0 bg-[#0B2447]/50 backdrop-blur-[2px]" onClick={ocupado ? undefined : onFechar} />
      <div className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <button type="button" onClick={onFechar} disabled={ocupado} aria-label="Fechar" className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 disabled:opacity-40">
          <X className="h-4 w-4" />
        </button>

        {feito ? (
          <div className="py-4 text-center">
            <CheckCircle className="mx-auto h-10 w-10 text-emerald-500" />
            <h2 className="mt-3 text-lg font-bold text-[#0B2447]">Repasse #{feito.numero} registrado</h2>
            <p className="mt-1 text-sm text-slate-500">
              {formatCurrencyPrecise(feito.valor)} para {gestor.nome}. O gestor foi avisado por e-mail e no painel.
            </p>
            <button type="button" onClick={onFechar} className="mt-5 rounded-xl bg-[#0B2447] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B3D91]">
              Fechar
            </button>
          </div>
        ) : (
          <>
            <h2 id="titulo-repasse" className="text-lg font-bold text-[#0B2447]">Registrar repasse</h2>
            <p className="mt-1 text-sm text-slate-500">
              Registre o pagamento que você <strong>já fez</strong> ao gestor. Isso não movimenta dinheiro: grava o repasse e o lançamento contábil.
            </p>

            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
              <p className="font-semibold text-[#0B2447]">{gestor.nome}</p>
              <p className="mt-0.5 break-words text-slate-600">{resumoDestino(recebimento)}</p>
              <p className="text-xs text-slate-500">Titular: {recebimento.titular_nome}</p>
              <p className="mt-3 flex items-baseline justify-between border-t border-slate-200 pt-3">
                <span className="text-xs text-slate-500">{pedidoIds.length === 1 ? '1 pedido' : `${pedidoIds.length} pedidos`}</span>
                <span className="text-xl font-bold text-[#0B2447]">{formatCurrencyPrecise(valorTotal)}</span>
              </p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="rp-metodo" className={labelCls}>Meio</label>
                <select id="rp-metodo" value={metodo} onChange={(e) => setMetodo(e.target.value as RepasseMetodo)} className={inputCls}>
                  {METODOS_REPASSE.map((m) => <option key={m} value={m}>{METODO_REPASSE[m]}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="rp-data" className={labelCls}>Pago em (horário de Brasília)</label>
                <input id="rp-data" type="datetime-local" value={pagoEm} max={agoraEmBrasilia()} onChange={(e) => setPagoEm(e.target.value)} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="rp-ref" className={labelCls}>Referência bancária (opcional)</label>
                <input id="rp-ref" value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={120} placeholder="ID da transação / código E2E do Pix" className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="rp-obs" className={labelCls}>Observação (opcional)</label>
                <textarea id="rp-obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={500} rows={2} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <span className={labelCls}>Comprovante (opcional — pode anexar depois)</span>
                <input ref={inputArquivo} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" id="rp-arquivo" onChange={(e) => escolherArquivo(e.target.files?.[0])} />
                {arquivo ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-slate-700"><Paperclip className="h-4 w-4 shrink-0 text-slate-400" /><span className="truncate">{arquivo.name}</span></span>
                    <button type="button" onClick={() => setArquivo(null)} disabled={ocupado} className="shrink-0 text-xs font-semibold text-slate-400 hover:text-red-600">Remover</button>
                  </div>
                ) : (
                  <label htmlFor="rp-arquivo" className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3.5 py-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50">
                    <Paperclip className="h-4 w-4" /> Anexar foto ou PDF
                  </label>
                )}
                {progresso !== null && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={progresso} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full bg-[#0B3D91] transition-all" style={{ width: `${progresso}%` }} />
                  </div>
                )}
              </div>
            </div>

            {erro && (
              <p role="alert" className="mt-4 flex items-start gap-2 text-sm font-medium text-red-600">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {erro}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onFechar} disabled={ocupado} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" onClick={confirmar} disabled={ocupado} className="inline-flex items-center gap-2 rounded-xl bg-[#0B2447] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B3D91] disabled:opacity-60">
                {ocupado && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar repasse de {formatCurrencyPrecise(valorTotal)}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
