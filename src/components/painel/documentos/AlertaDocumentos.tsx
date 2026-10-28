'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertOctagon, Clock, ChevronRight, X } from 'lucide-react';
import { DIAS_FAIXA_TOPO } from '@/lib/documentos/validade';

const CHAVE = 'boatzy:alerta-documentos-fechado';

/**
 * Faixa no topo de todas as telas do painel quando há documento vencido ou
 * vencendo em até 30 dias (SPEC §95.6). Pode ser fechada; volta na próxima
 * sessão ou quando a situação muda (outra contagem).
 */
export default function AlertaDocumentos({ vencidos, urgentes }: { vencidos: number; urgentes: number }) {
  const pathname = usePathname();
  const assinatura = `${vencidos}:${urgentes}`;
  const [fechado, setFechado] = useState(true);

  useEffect(() => {
    let salvo: string | null = null;
    try {
      salvo = sessionStorage.getItem(CHAVE);
    } catch {
      // armazenamento bloqueado: mostra a faixa
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê o navegador só depois de montar (SSR)
    setFechado(salvo === assinatura);
  }, [assinatura]);

  if (urgentes === 0 || fechado || pathname.startsWith('/painel/documentos')) return null;

  function fechar() {
    setFechado(true);
    try {
      sessionStorage.setItem(CHAVE, assinatura);
    } catch {
      // sem armazenamento: fecha só até recarregar
    }
  }

  const aVencer = urgentes - vencidos;
  const grave = vencidos > 0;
  const partes = [
    vencidos > 0 && `${vencidos} documento${vencidos === 1 ? '' : 's'} vencido${vencidos === 1 ? '' : 's'}`,
    aVencer > 0 && `${aVencer} ${vencidos > 0 ? '' : `documento${aVencer === 1 ? '' : 's'} `}vence${aVencer === 1 ? '' : 'm'} nos próximos ${DIAS_FAIXA_TOPO} dias`,
  ].filter(Boolean);

  return (
    <div
      role="status"
      className={`flex items-center gap-3 border-b px-4 py-2.5 text-sm sm:px-6 lg:px-8 ${
        grave ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'
      }`}
    >
      {grave ? <AlertOctagon className="h-4 w-4 shrink-0" /> : <Clock className="h-4 w-4 shrink-0" />}
      <p className="min-w-0 flex-1">
        <span className="font-semibold">{partes.join(' e ')}.</span>{' '}
        <span className="hidden sm:inline">Mantenha a embarcação e a habilitação em dia.</span>
      </p>
      <Link
        href={`/painel/documentos?situacao=${grave ? 'vencido' : 'vence_em_breve'}`}
        className={`inline-flex shrink-0 items-center gap-0.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-white ${
          grave ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
        }`}
      >
        Ver <span className="hidden sm:inline">documentos</span> <ChevronRight className="h-3.5 w-3.5" />
      </Link>
      <button type="button" onClick={fechar} aria-label="Fechar aviso" className="shrink-0 rounded-lg p-1 opacity-60 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
