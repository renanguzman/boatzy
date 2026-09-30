'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode, CreditCard, Loader2, Copy, Check, ShieldCheck, Clock, FlaskConical } from 'lucide-react';
import type { FormaPagamentoCodigo } from '@/types/supabase';
import { maskCPF } from '@/lib/validators';
import { formatCurrencyPrecise } from '@/lib/utils';
import { consultarStatusPedido, pagarReserva } from '../actions';

export type FormaCheckout = { codigo: FormaPagamentoCodigo; nome: string; opcoesParcelas: number[] };

type Props = {
  reservaId: string;
  valorTotal: number;
  expiraEm: string;
  formas: FormaCheckout[];
  precisaCpf: boolean;
  formaInicial: FormaPagamentoCodigo | null;
  /** QR do Pix já gerado (recarregar a página não cria outra cobrança). */
  pixInicial: Pix | null;
  retornoCartao: boolean;
  sandbox: boolean;
};

export type Pix = { imagem: string; payload: string; expiraEm: string | null };

const ICONE: Record<FormaPagamentoCodigo, React.ElementType> = { pix: QrCode, cartao_credito: CreditCard };

function formatRestante(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}min` : `${m}min`;
}

export default function CheckoutPagamento({
  reservaId, valorTotal, expiraEm, formas, precisaCpf, formaInicial, pixInicial, retornoCartao, sandbox,
}: Props) {
  const router = useRouter();
  const [forma, setForma] = useState<FormaPagamentoCodigo>(formaInicial ?? formas[0]?.codigo ?? 'pix');
  const [parcelas, setParcelas] = useState(1);
  const [cpf, setCpf] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<{ texto: string; campo?: 'cpf' } | null>(null);
  const [pix, setPix] = useState<Pix | null>(pixInicial);
  const [copiado, setCopiado] = useState(false);
  const [restante, setRestante] = useState(() => new Date(expiraEm).getTime() - Date.now());

  const formaAtual = formas.find((f) => f.codigo === forma);
  const acompanhando = !!pix || retornoCartao;

  // Contagem regressiva do prazo.
  useEffect(() => {
    const t = setInterval(() => setRestante(new Date(expiraEm).getTime() - Date.now()), 30_000);
    return () => clearInterval(t);
  }, [expiraEm]);

  // Acompanha o pedido (lendo o nosso banco — a confirmação vem pelo webhook).
  useEffect(() => {
    if (!acompanhando) return;
    const t = setInterval(async () => {
      const { status } = await consultarStatusPedido(reservaId);
      if (status && status !== 'aguardando_pagamento') router.refresh();
    }, 5_000);
    return () => clearInterval(t);
  }, [acompanhando, reservaId, router]);

  async function pagar(formaEscolhida: FormaPagamentoCodigo) {
    if (precisaCpf && !cpf) {
      setErro({ texto: 'Informe seu CPF para pagar.', campo: 'cpf' });
      return;
    }
    setCarregando(true);
    setErro(null);
    const r = await pagarReserva({ reservaId, forma: formaEscolhida, parcelas, cpf: precisaCpf ? cpf : undefined });
    if (!r.ok) {
      setCarregando(false);
      setErro({ texto: r.error, campo: r.campo });
      return;
    }
    if (r.forma === 'pix') {
      setPix(r.pix);
      setCarregando(false);
    } else {
      window.location.assign(r.faturaUrl); // página segura do Asaas
    }
  }

  async function copiar() {
    if (!pix) return;
    await navigator.clipboard.writeText(pix.payload);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  if (retornoCartao && !pix) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 text-center">
        <Loader2 className="h-8 w-8 text-[#0B3D91] animate-spin mx-auto" />
        <h2 className="mt-3 text-lg font-bold text-[#0B2447]">Confirmando seu pagamento…</h2>
        <p className="mt-1 text-sm text-slate-500">
          Assim que o Asaas confirmar, esta página é atualizada sozinha. Pode levar alguns instantes.
        </p>
        <button
          type="button"
          onClick={() => router.replace(`/reservas/${reservaId}/pagar`)}
          className="mt-4 text-sm font-medium text-[#0B3D91] hover:underline"
        >
          Voltar às formas de pagamento
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total a pagar</p>
          <p className="text-2xl font-bold text-[#0B2447]">{formatCurrencyPrecise(valorTotal)}</p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p className="flex items-center gap-1 justify-end"><Clock className="h-3.5 w-3.5" /> Prazo para pagar</p>
          <p className="font-semibold text-slate-700">{restante > 0 ? formatRestante(restante) : 'encerrado'}</p>
        </div>
      </div>

      {sandbox && (
        <div className="mx-5 mt-5 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">
          <FlaskConical className="h-4 w-4 shrink-0 mt-0.5" />
          Ambiente de testes (sandbox): o Pix não pode ser pago por um banco real — confirme a cobrança no painel do Asaas.
          No cartão, use 4444 4444 4444 4444, CVV 123 e validade futura.
        </div>
      )}

      {/* Formas de pagamento */}
      {!pix && (
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {formas.map((f) => {
              const Icon = ICONE[f.codigo] ?? CreditCard;
              const ativo = f.codigo === forma;
              return (
                <button
                  key={f.codigo}
                  type="button"
                  onClick={() => { setForma(f.codigo); setErro(null); }}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                    ativo ? 'border-[#0B3D91] bg-[#0B3D91]/5 text-[#0B2447]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {f.nome}
                </button>
              );
            })}
          </div>

          {precisaCpf && (
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">CPF do pagador</span>
              <input
                inputMode="numeric"
                value={cpf}
                onChange={(e) => setCpf(maskCPF(e.target.value))}
                placeholder="000.000.000-00"
                className={`mt-1 w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 ${
                  erro?.campo === 'cpf' ? 'border-red-300' : 'border-slate-200'
                }`}
              />
              <span className="block mt-1 text-[11px] text-slate-400">Exigido para emitir a cobrança. Fica salvo no seu cadastro.</span>
            </label>
          )}

          {forma === 'cartao_credito' && formaAtual && formaAtual.opcoesParcelas.length > 1 && (
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Parcelamento</span>
              <select
                value={parcelas}
                onChange={(e) => setParcelas(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 cursor-pointer"
              >
                {formaAtual.opcoesParcelas.map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? `À vista — ${formatCurrencyPrecise(valorTotal)}` : `${n}x de ${formatCurrencyPrecise(valorTotal / n)}`}
                  </option>
                ))}
              </select>
            </label>
          )}

          {forma === 'cartao_credito' && (
            <p className="flex items-start gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              Você vai digitar os dados do cartão no ambiente seguro do Asaas, nosso parceiro de pagamentos.
              O Boatzy não recebe nem guarda o número do cartão.
            </p>
          )}

          {erro && <p className="text-sm text-red-600">{erro.texto}</p>}

          <button
            type="button"
            onClick={() => pagar(forma)}
            disabled={carregando || restante <= 0}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B3D91] hover:bg-[#0B2447] disabled:opacity-60 px-4 py-3 text-sm font-semibold text-white transition-colors"
          >
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : forma === 'pix' ? <QrCode className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
            {forma === 'pix' ? 'Gerar QR Code Pix' : 'Pagar com cartão'}
          </button>
        </div>
      )}

      {/* Pix gerado */}
      {pix && (
        <div className="p-5 space-y-4 text-center">
          <p className="text-sm text-slate-600">Abra o app do seu banco, escolha pagar com Pix e escaneie o código:</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem base64 gerada pelo Asaas */}
          <img
            src={`data:image/png;base64,${pix.imagem}`}
            alt="QR Code Pix"
            width={220}
            height={220}
            className="mx-auto rounded-xl border border-slate-100"
          />
          <div className="text-left">
            <p className="text-xs font-semibold text-slate-600 mb-1">Ou use o Pix copia e cola</p>
            <div className="flex items-stretch gap-2">
              <input readOnly value={pix.payload} className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600" />
              <button
                type="button"
                onClick={copiar}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 px-3 text-sm font-semibold text-[#0B2447]"
              >
                {copiado ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
          <p className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Aguardando o pagamento — a página atualiza sozinha.
          </p>
          <button
            type="button"
            onClick={() => { setPix(null); setErro(null); }}
            className="text-sm font-medium text-[#0B3D91] hover:underline"
          >
            Escolher outra forma de pagamento
          </button>
        </div>
      )}
    </div>
  );
}
