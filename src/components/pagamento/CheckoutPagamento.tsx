'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { QrCode, CreditCard, Loader2, Copy, Check, ShieldCheck, Clock, FlaskConical } from 'lucide-react';
import type { FormaPagamentoCodigo } from '@/types/supabase';
import { rastrear } from '@/lib/analytics';
import { maskCPF } from '@/lib/validators';
import { useFormatos } from '@/i18n/formatos';
import { consultarStatusPedido, pagarPedido } from '@/lib/pagamentos/actions-cliente';
import { TOMADOR_VAZIO, validarTomador, type CampoTomador, type TomadorForm } from '@/lib/pagamentos/tomador';
import TomadorPagamento from './TomadorPagamento';

export type FormaCheckout = { codigo: FormaPagamentoCodigo; nome: string; opcoesParcelas: number[] };

/**
 * Checkout do cliente (Pix / cartão) — usado na página de pagamento da reserva
 * e na da cobrança avulsa (SPEC §34.12/§34.16).
 */
type Props = {
  pedidoId: string;
  /** Página onde o checkout está (volta para as formas após o retorno do cartão). */
  caminho: string;
  valorTotal: number;
  expiraEm: string;
  formas: FormaCheckout[];
  precisaCpf: boolean;
  /** Nome e CPF do cadastro — em nome de quem sai o pagamento por padrão (SPEC §97). */
  titular: { nome: string; documento: string | null };
  /** Tomador de terceiro da cobrança pendente (o checkout reabre com ele). */
  tomadorInicial: TomadorForm | null;
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
  pedidoId, caminho, valorTotal, expiraEm, formas, precisaCpf, titular, tomadorInicial, formaInicial, pixInicial, retornoCartao, sandbox,
}: Props) {
  const router = useRouter();
  const t = useTranslations('Pagamento');
  const f = useFormatos();
  const [forma, setForma] = useState<FormaPagamentoCodigo>(formaInicial ?? formas[0]?.codigo ?? 'pix');
  const [parcelas, setParcelas] = useState(1);
  const [cpf, setCpf] = useState('');
  const [tomador, setTomador] = useState<TomadorForm>(tomadorInicial ?? TOMADOR_VAZIO);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<{ texto: string; campo?: 'cpf' | CampoTomador } | null>(null);
  const proprio = tomador.tipo === 'proprio';
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
      const { status } = await consultarStatusPedido(pedidoId);
      if (status && status !== 'aguardando_pagamento') router.refresh();
    }, 5_000);
    return () => clearInterval(t);
  }, [acompanhando, pedidoId, router]);

  async function pagar(formaEscolhida: FormaPagamentoCodigo) {
    if (proprio && precisaCpf && !cpf) {
      setErro({ texto: t('informeCpf'), campo: 'cpf' });
      return;
    }
    if (!proprio) {
      const v = validarTomador(tomador);
      if (!v.ok) {
        const chave = v.campo === 'documento' ? (tomador.tipo === 'cnpj' ? 'cnpj' : 'cpf') : v.campo;
        setErro({ texto: t(`tomador.erros.${chave}`), campo: v.campo });
        return;
      }
    }
    setCarregando(true);
    setErro(null);
    const r = await pagarPedido({
      pedidoId,
      forma: formaEscolhida,
      parcelas,
      cpf: proprio && precisaCpf ? cpf : undefined,
      tomador: proprio ? null : tomador,
    });
    if (!r.ok) {
      setCarregando(false);
      setErro({ texto: r.error, campo: r.campo });
      return;
    }
    // GA4: forma de pagamento escolhida e cobrança gerada — SPEC §65.
    rastrear('add_payment_info', {
      currency: 'BRL',
      value: valorTotal,
      payment_type: formaEscolhida === 'pix' ? 'pix' : 'cartao_credito',
      parcelas: formaEscolhida === 'cartao_credito' ? parcelas : 1,
    });
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
        <Loader2 className="h-8 w-8 text-marinho animate-spin mx-auto" />
        <h2 className="mt-3 text-lg font-bold text-marinho">{t('confirmando')}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {t('confirmandoTexto')}
        </p>
        <button
          type="button"
          onClick={() => router.replace(caminho)}
          className="mt-4 text-sm font-medium text-marinho hover:underline"
        >
          {t('voltarFormas')}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('totalAPagar')}</p>
          <p className="text-2xl font-bold text-marinho">{f.moedaCentavos(valorTotal)}</p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p className="flex items-center gap-1 justify-end"><Clock className="h-3.5 w-3.5" /> {t('prazo')}</p>
          <p className="font-semibold text-slate-700">{restante > 0 ? formatRestante(restante) : t('encerrado')}</p>
        </div>
      </div>

      {sandbox && (
        <div className="mx-5 mt-5 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">
          <FlaskConical className="h-4 w-4 shrink-0 mt-0.5" />
          {t('sandbox')}
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
                    ativo ? 'border-marinho bg-marinho/5 text-marinho' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {f.nome}
                </button>
              );
            })}
          </div>

          <TomadorPagamento
            titular={titular}
            valor={tomador}
            onChange={setTomador}
            erroCampo={erro?.campo && erro.campo !== 'cpf' ? erro.campo : null}
          />

          {proprio && precisaCpf && (
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">{t('cpfPagador')}</span>
              <input
                inputMode="numeric"
                value={cpf}
                onChange={(e) => setCpf(maskCPF(e.target.value))}
                placeholder="000.000.000-00"
                className={`mt-1 w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-marinho/20 ${
                  erro?.campo === 'cpf' ? 'border-red-300' : 'border-slate-200'
                }`}
              />
              <span className="block mt-1 text-[11px] text-slate-400">{t('cpfAjuda')}</span>
            </label>
          )}

          {forma === 'cartao_credito' && formaAtual && formaAtual.opcoesParcelas.length > 1 && (
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">{t('parcelamento')}</span>
              <select
                value={parcelas}
                onChange={(e) => setParcelas(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-marinho/20 cursor-pointer"
              >
                {formaAtual.opcoesParcelas.map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? t('aVista', { valor: f.moedaCentavos(valorTotal) }) : t('parcelas', { n, valor: f.moedaCentavos(valorTotal / n) })}
                  </option>
                ))}
              </select>
            </label>
          )}

          {forma === 'cartao_credito' && (
            <p className="flex items-start gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-turquesa-escuro shrink-0" />
              {t('cartaoSeguro')}
            </p>
          )}

          {erro && <p className="text-sm text-red-600">{erro.texto}</p>}

          <button
            type="button"
            onClick={() => pagar(forma)}
            disabled={carregando || restante <= 0}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-marinho hover:bg-marinho-escuro disabled:opacity-60 px-4 py-3 text-sm font-semibold text-white transition-colors"
          >
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : forma === 'pix' ? <QrCode className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
            {forma === 'pix' ? t('gerarPix') : t('pagarCartao')}
          </button>
        </div>
      )}

      {/* Pix gerado */}
      {pix && (
        <div className="p-5 space-y-4 text-center">
          <p className="text-sm text-slate-600">{t('abraApp')}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem base64 gerada pelo Asaas */}
          <img
            src={`data:image/png;base64,${pix.imagem}`}
            alt={t('qrAlt')}
            width={220}
            height={220}
            className="mx-auto rounded-xl border border-slate-100"
          />
          <div className="text-left">
            <p className="text-xs font-semibold text-slate-600 mb-1">{t('copiaECola')}</p>
            <div className="flex items-stretch gap-2">
              <input readOnly value={pix.payload} className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600" />
              <button
                type="button"
                onClick={copiar}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 px-3 text-sm font-semibold text-marinho"
              >
                {copiado ? <Check className="h-4 w-4 text-turquesa-escuro" /> : <Copy className="h-4 w-4" />}
                {copiado ? t('copiado') : t('copiar')}
              </button>
            </div>
          </div>
          <p className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('aguardando')}
          </p>
          <button
            type="button"
            onClick={() => { setPix(null); setErro(null); }}
            className="text-sm font-medium text-marinho hover:underline"
          >
            {t('outraForma')}
          </button>
        </div>
      )}
    </div>
  );
}
