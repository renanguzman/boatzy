'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Tag, X, AlertCircle, Clock, ShieldCheck } from 'lucide-react';
import { criarReserva, validarCupom } from '../actions';
import { formatCurrency } from '@/lib/utils';
import TermoAceite from '@/components/termos/TermoAceite';
import type { AceiteTermoCliente, TermoParaAceite } from '@/lib/termos/tipos';
import type { CupomTipoDesconto, ReservaModalidadePreco } from '@/types/supabase';

type Props = {
  tipo: 'roteiro' | 'embarcacao';
  roteiroId?: string;
  embarcacaoId?: string;
  data: string;
  flex: number;
  pessoas: number;
  adicionaisIds: string[];
  /** Modelo de cobrança escolhido (BookingCard) — 'roteiro' sempre para reserva de embarcação. */
  modalidade: ReservaModalidadePreco;
  /** Quantidade de diárias — só relevante quando `modalidade === 'diaria'`. */
  diarias?: number;
  /** Valor unitário do modelo (dia, diária ou pessoa). */
  precoUnitario: number | null;
  /** Multiplicador do subtotal: diárias, pessoas, ou 1 (modelo Roteiro). */
  multiplicador: number;
  /** Rótulo da linha de preço no resumo — "Diária" ou "Pessoa". */
  rotuloLinha: string;
  totalAdicionais: number;
  /** Taxa de serviço efetiva (%) do gestor dono do alvo — resolvida no servidor (ver SPEC §14). */
  taxaPercent: number;
  /** Termo `reserva_cliente` vigente — quando presente, o aceite é obrigatório para enviar. */
  termo: TermoParaAceite | null;
};

type CupomAplicado = {
  codigo: string;
  tipoDesconto: CupomTipoDesconto;
  valor: number;
  descontoValor: number;
};

function formatDesconto(c: CupomAplicado): string {
  return c.tipoDesconto === 'percentual'
    ? `${c.valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
    : formatCurrency(c.valor);
}

function formatContagem(ms: number): string {
  const totalSeg = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSeg / 60);
  const seg = totalSeg % 60;
  return `${min}m ${seg.toString().padStart(2, '0')}s`;
}

export default function ConfirmarReserva({
  tipo, roteiroId, embarcacaoId, data, flex, pessoas, adicionaisIds, modalidade, diarias,
  precoUnitario, multiplicador, rotuloLinha, totalAdicionais, taxaPercent, termo,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);

  // Aceite do termo da reserva (feito no modal do TermoAceite).
  const [aceiteTermo, setAceiteTermo] = useState<AceiteTermoCliente | null>(null);
  const [comprovanteAceite, setComprovanteAceite] = useState<{ evidenciaHash: string; aceitoEm: string } | null>(null);

  // Cupom — pré-visualização em tempo real (não recarrega a página).
  const [cupomInput, setCupomInput] = useState('');
  const [cupomAplicado, setCupomAplicado] = useState<CupomAplicado | null>(null);
  const [validando, setValidando] = useState(false);
  const [erroCupom, setErroCupom] = useState<string | null>(null);
  const [bloqueadoAte, setBloqueadoAte] = useState<Date | null>(null);
  const [agora, setAgora] = useState(() => Date.now());

  // Contagem regressiva do bloqueio por tentativas — atualiza a cada segundo até liberar.
  useEffect(() => {
    if (!bloqueadoAte) return;
    const t = setInterval(() => {
      if (bloqueadoAte.getTime() <= Date.now()) {
        setBloqueadoAte(null);
        setErroCupom(null);
      } else {
        setAgora(Date.now());
      }
    }, 1000);
    return () => clearInterval(t);
  }, [bloqueadoAte]);

  const bloqueado = bloqueadoAte != null && bloqueadoAte.getTime() > agora;

  async function handleAplicarCupom() {
    if (validando || bloqueado || !cupomInput.trim()) return;
    setValidando(true);
    setErroCupom(null);
    const result = await validarCupom({
      tipo, roteiroId, embarcacaoId, adicionaisIds, codigo: cupomInput, modalidade, diarias, pessoas,
    });
    setValidando(false);
    if (result.ok) {
      setCupomAplicado(result.cupom);
      setCupomInput('');
    } else {
      setErroCupom(result.error);
      if (result.bloqueadoAte) setBloqueadoAte(new Date(result.bloqueadoAte));
    }
  }

  function handleRemoverCupom() {
    setCupomAplicado(null);
    setErroCupom(null);
  }

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const result = await criarReserva({
      tipo, roteiroId, embarcacaoId, data, flex, pessoas, adicionaisIds, modalidade, diarias,
      cupomCodigo: cupomAplicado?.codigo,
      aceiteTermo: aceiteTermo ?? undefined,
    });
    setLoading(false);
    if (result.ok) {
      setComprovanteAceite(result.aceite);
      setEnviada(true);
    } else if (result.aceiteCodigo) {
      // Problema no aceite: exige nova leitura. Se o termo mudou (ou foi
      // publicado agora), recarrega a página para exibir a versão vigente.
      setError(result.error);
      setAceiteTermo(null);
      if (result.aceiteCodigo === 'versao_desatualizada' || result.aceiteCodigo === 'aceite_ausente') {
        router.refresh();
      }
    } else {
      setError(result.error);
      // Se o cupom deixou de valer entre a pré-visualização e o envio, não fica "aplicado" na tela.
      setCupomAplicado(null);
    }
  }

  const aguardandoAceite = !!termo && !aceiteTermo;

  if (enviada) {
    return (
      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-emerald-800">Solicitação enviada!</h2>
        <p className="text-sm text-emerald-700 mt-1">
          Sua reserva está <strong>pendente</strong>. O gestor vai analisar e responder em breve.
        </p>
        {comprovanteAceite && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/70 border border-emerald-200 px-3 py-1 text-[11px] text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5" />
            Aceite dos termos registrado em{' '}
            {new Date(comprovanteAceite.aceitoEm).toLocaleString('pt-BR', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
              timeZone: 'America/Sao_Paulo',
            })}{' '}
            · Protocolo <span className="font-mono">{comprovanteAceite.evidenciaHash.slice(0, 12).toUpperCase()}</span>
          </p>
        )}
        <div className="mt-5 flex items-center justify-center gap-3">
          <Link
            href="/buscar"
            className="px-5 py-2.5 bg-[#0B3D91] hover:bg-[#0B2447] text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Explorar outros roteiros
          </Link>
        </div>
      </div>
    );
  }

  const precoLinha = precoUnitario != null ? precoUnitario * multiplicador : null;
  const subtotal = (precoLinha ?? 0) + totalAdicionais;
  const taxaServicoBruta = precoUnitario != null ? Math.round(subtotal * (taxaPercent / 100)) : null;
  const totalBruto = precoUnitario != null && taxaServicoBruta != null ? subtotal + taxaServicoBruta : null;
  const desconto = cupomAplicado?.descontoValor ?? 0;
  const totalFinal = totalBruto != null ? Math.max(0, totalBruto - desconto) : null;

  return (
    <>
      {/* Valores + cupom */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-5">
          {precoUnitario != null ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    {rotuloLinha}
                    {multiplicador > 1 ? ` (${formatCurrency(precoUnitario)} × ${multiplicador})` : ''}
                  </span>
                  <span className="font-medium text-slate-800">{formatCurrency(precoLinha!)}</span>
                </div>
                {totalAdicionais > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Adicionais</span>
                    <span className="font-medium text-slate-800">{formatCurrency(totalAdicionais)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    Taxa de serviço ({taxaPercent.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%)
                  </span>
                  <span className="font-medium text-slate-800">{formatCurrency(taxaServicoBruta!)}</span>
                </div>
                {cupomAplicado && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-emerald-600">Desconto ({cupomAplicado.codigo})</span>
                    <span className="font-medium text-emerald-600">-{formatCurrency(desconto)}</span>
                  </div>
                )}
              </div>

              {/* Cupom de desconto */}
              <div className="pt-4 border-t border-slate-100">
                {cupomAplicado ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5">
                    <div className="flex items-center gap-2 text-sm text-emerald-800 min-w-0">
                      <Tag className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        Cupom <strong className="font-mono">{cupomAplicado.codigo}</strong> aplicado
                        <span className="text-emerald-600"> ({formatDesconto(cupomAplicado)})</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoverCupom}
                      title="Remover cupom"
                      className="text-emerald-600 hover:text-emerald-800 transition shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={cupomInput}
                        onChange={(e) => setCupomInput(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAplicarCupom();
                          }
                        }}
                        disabled={bloqueado || validando}
                        placeholder="Código do cupom"
                        className="flex-1 min-w-0 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-mono uppercase tracking-wide text-slate-800 placeholder:text-slate-400 placeholder:font-sans placeholder:tracking-normal placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition disabled:bg-slate-50 disabled:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={handleAplicarCupom}
                        disabled={bloqueado || validando || !cupomInput.trim()}
                        className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-[#0B2447] transition flex items-center gap-1.5 whitespace-nowrap"
                      >
                        {validando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
                      </button>
                    </div>
                    {bloqueado && bloqueadoAte ? (
                      <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        Muitas tentativas — tente novamente em {formatContagem(bloqueadoAte.getTime() - agora)}.
                      </p>
                    ) : erroCupom ? (
                      <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        {erroCupom}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <span className="text-base font-bold text-[#0B2447]">Total estimado</span>
                <span className="text-xl font-bold text-[#0B2447]">{formatCurrency(totalFinal!)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Preço a combinar com o gestor — o valor será confirmado na resposta da solicitação.
            </p>
          )}
        </div>
      </div>

      {termo && (
        <div className="mt-6">
          <TermoAceite
            key={termo.id}
            termo={termo}
            aceite={aceiteTermo}
            onAceitar={(a) => { setAceiteTermo(a); setError(null); }}
            finalidade="para enviar sua solicitação de reserva"
            disabled={loading}
          />
        </div>
      )}

      <div className="mt-6">
        {error && (
          <p className="mb-3 text-sm font-medium text-red-600 text-center" role="alert">
            {error}
          </p>
        )}
        <button
          onClick={handleConfirm}
          disabled={loading || aguardandoAceite}
          className="w-full bg-[#0B3D91] hover:bg-[#092E6E] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Enviando…
            </>
          ) : (
            'Confirmar solicitação'
          )}
        </button>
        {aguardandoAceite && (
          <p className="mt-2 text-xs font-medium text-slate-500 text-center">
            Leia e aceite os termos acima para enviar a solicitação.
          </p>
        )}
        <p className="mt-2 text-xs text-slate-400 text-center">
          Você não será cobrado agora. A reserva só é efetivada após a confirmação do gestor.
        </p>
      </div>
    </>
  );
}
