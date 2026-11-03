'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Ban, Loader2, Paperclip } from 'lucide-react';
import { enviarComprovante, validarComprovante } from '@/lib/repasses/envio';
import { anexarComprovante, cancelarRepasse } from '../../actions';

/** Anexar/trocar o comprovante e cancelar o repasse (com motivo). */
export default function AcoesRepasse({
  repasseId, gestorId, temComprovante, cancelado,
}: { repasseId: string; gestorId: string; temComprovante: boolean; cancelado: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [pendente, iniciar] = useTransition();
  const ocupado = pendente || progresso !== null;

  function anexar(file?: File) {
    if (input.current) input.current.value = '';
    if (!file) return;
    const problema = validarComprovante(file);
    if (problema) { setErro(problema); return; }
    setErro(null);
    iniciar(async () => {
      setProgresso(0);
      const up = await enviarComprovante(file, gestorId, repasseId, setProgresso);
      setProgresso(null);
      if (!up.ok) { setErro(up.erro); return; }
      const res = await anexarComprovante({ repasseId, key: up.comprovante.key, nome: up.comprovante.nome });
      if (!res.ok) { setErro(res.error); return; }
      router.refresh();
    });
  }

  function cancelar() {
    setErro(null);
    iniciar(async () => {
      const res = await cancelarRepasse({ repasseId, motivo });
      if (!res.ok) { setErro(res.error); return; }
      setConfirmando(false);
      router.refresh();
    });
  }

  if (cancelado) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" id="anexo-comprovante" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => anexar(e.target.files?.[0])} />
        <label
          htmlFor="anexo-comprovante"
          className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 ${ocupado ? 'pointer-events-none opacity-60' : ''}`}
        >
          {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          {temComprovante ? 'Trocar comprovante' : 'Anexar comprovante'}
        </label>
        <button
          type="button"
          onClick={() => { setConfirmando(true); setErro(null); }}
          disabled={ocupado || confirmando}
          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          <Ban className="h-4 w-4" /> Cancelar repasse
        </button>
      </div>

      {progresso !== null && (
        <div className="h-1.5 max-w-xs overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={progresso} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-[#0B3D91] transition-all" style={{ width: `${progresso}%` }} />
        </div>
      )}

      {confirmando && (
        <div className="max-w-lg rounded-xl border border-red-100 bg-red-50/50 p-4">
          <p className="text-sm font-semibold text-red-700">Cancelar este repasse?</p>
          <p className="mt-1 text-xs text-slate-600">
            Os pedidos voltam para “A repassar” e é feito o lançamento contábil inverso. Use quando o pagamento foi devolvido ou registrado por engano.
          </p>
          <label htmlFor="motivo-cancelamento" className="mt-3 block text-[11px] font-bold uppercase tracking-wider text-slate-400">Motivo (obrigatório)</label>
          <textarea
            id="motivo-cancelamento"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            maxLength={300}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmando(false)} disabled={ocupado} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Voltar</button>
            <button type="button" onClick={cancelar} disabled={ocupado || motivo.trim().length < 5} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              {pendente && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar cancelamento
            </button>
          </div>
        </div>
      )}

      {erro && (
        <p role="alert" className="flex items-start gap-2 text-sm font-medium text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {erro}
        </p>
      )}
    </div>
  );
}
