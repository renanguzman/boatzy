'use client';

import { useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CreditCard, Loader2, ShieldCheck, Globe } from 'lucide-react';
import { maskCEP, onlyDigits } from '@/lib/validators';
import { useFormatos } from '@/i18n/formatos';
import { rastrear } from '@/lib/analytics';
import { pagarPedidoCartao } from '@/lib/pagamentos/actions-cliente';
import { opcoesPaises } from '@/lib/pagamentos/estrangeiro';
import { UFS } from '@/lib/pagamentos/tomador';
import { valorParcelado, type TabelaJuros } from '@/lib/pagamentos/valores';
import {
  ddiDoPais, ENDERECO_COBRANCA_VAZIO, validarDadosCobranca,
  type CampoCobranca, type EnderecoCobrancaForm,
} from '@/lib/pagamentos/cartao-dados';
import type { PagarComCartaoResultado } from '@/lib/pagamentos/cartao';
import type { TomadorForm } from '@/lib/pagamentos/tomador';

/**
 * Cartão de crédito pela Pagar.me (Stone) — checkout transparente (SPEC §109).
 *
 * O número, a validade e o CVV vão do navegador DIRETO para a Pagar.me
 * (`POST /core/v5/tokens?appId=<chave pública>`), que devolve um token de uso
 * único; só o token chega ao servidor do Boatzy. O domínio do site precisa
 * estar liberado no dashboard da Pagar.me.
 */

/** Titular já validado pelo checkout (CPF, estrangeiro ou terceiro). `null` = corrigir antes. */
export type TitularCartao = {
  cpf?: string;
  estrangeiro: { pais: string; documento: string } | null;
  tomador: TomadorForm | null;
};

type Props = {
  pedidoId: string;
  valorTotal: number;
  opcoesParcelas: number[];
  juros: TabelaJuros;
  publicKey: string;
  /** Valida e devolve o titular escolhido acima do formulário (ou `null`, mostrando o erro lá). */
  prepararTitular: () => TitularCartao | null;
  /** País inicial do endereço de cobrança (estrangeiro → país do documento). */
  paisInicial: string;
  /** Endereço do tomador de terceiro, para pré-preencher. */
  tomadorEndereco: TomadorForm | null;
  telefoneInicial: string | null;
  bloqueado: boolean;
  onResultado: (r: PagarComCartaoResultado) => void;
};

type CampoCartao = 'numeroCartao' | 'nome' | 'validade' | 'cvv';

const URL_TOKENS = 'https://api.pagar.me/core/v5/tokens';

/** Luhn — pega número digitado errado antes de ir à Pagar.me. */
function luhn(numero: string): boolean {
  let soma = 0;
  let dobrar = false;
  for (let i = numero.length - 1; i >= 0; i--) {
    let d = Number(numero[i]);
    if (dobrar) { d *= 2; if (d > 9) d -= 9; }
    soma += d;
    dobrar = !dobrar;
  }
  return soma % 10 === 0;
}

const maskNumero = (v: string) => onlyDigits(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
const maskValidade = (v: string) => {
  const d = onlyDigits(v).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

function classeInput(erro: boolean) {
  return `mt-1 w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-marinho/20 ${
    erro ? 'border-red-300' : 'border-slate-200'
  }`;
}

function Campo({ rotulo, children, className = '' }: { rotulo: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-semibold text-slate-600">{rotulo}</span>
      {children}
    </label>
  );
}

export default function CartaoPagarme({
  pedidoId, valorTotal, opcoesParcelas, juros, publicKey, prepararTitular, paisInicial, tomadorEndereco,
  telefoneInicial, bloqueado, onResultado,
}: Props) {
  const t = useTranslations('Pagamento.cartao');
  const f = useFormatos();
  const idioma = useLocale();
  const paises = useMemo(() => opcoesPaises(idioma), [idioma]);

  const [numero, setNumero] = useState('');
  const [nome, setNome] = useState('');
  const [validade, setValidade] = useState('');
  const [cvv, setCvv] = useState('');
  const [parcelas, setParcelas] = useState(1);
  const [endereco, setEndereco] = useState<EnderecoCobrancaForm>(() => {
    if (tomadorEndereco) {
      return {
        pais: 'BR', cep: tomadorEndereco.cep, logradouro: tomadorEndereco.logradouro, numero: tomadorEndereco.numero,
        complemento: tomadorEndereco.complemento, bairro: tomadorEndereco.bairro, cidade: tomadorEndereco.cidade,
        estado: tomadorEndereco.uf,
      };
    }
    return { ...ENDERECO_COBRANCA_VAZIO, pais: paisInicial || 'BR' };
  });
  const [ddi, setDdi] = useState(() => ddiDoPais(paisInicial || 'BR'));
  const [telefone, setTelefone] = useState(() => (telefoneInicial ? onlyDigits(telefoneInicial) : ''));
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<{ texto: string; campo?: CampoCartao | CampoCobranca } | null>(null);
  const [cepBuscando, setCepBuscando] = useState(false);
  const ultimoCep = useRef<string | null>(null);

  const br = endereco.pais === 'BR';
  const set = (campo: keyof EnderecoCobrancaForm, v: string) => setEndereco((e) => ({ ...e, [campo]: v }));

  function trocarPais(pais: string) {
    setEndereco((e) => ({ ...e, pais, estado: '', cep: '' }));
    setDdi(ddiDoPais(pais));
  }

  async function digitarCep(texto: string) {
    if (!br) { set('cep', texto.toUpperCase().slice(0, 12)); return; }
    const mascarado = maskCEP(texto);
    set('cep', mascarado);
    const cep = onlyDigits(mascarado);
    if (cep.length !== 8 || ultimoCep.current === cep) return;
    ultimoCep.current = cep;
    setCepBuscando(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = res.ok ? ((await res.json()) as Record<string, unknown>) : null;
      const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
      if (data && !data.erro && ultimoCep.current === cep) {
        const uf = txt(data.uf).toUpperCase();
        setEndereco((e) => ({
          ...e,
          logradouro: txt(data.logradouro) || e.logradouro,
          bairro: txt(data.bairro) || e.bairro,
          cidade: txt(data.localidade) || e.cidade,
          estado: (UFS as readonly string[]).includes(uf) ? uf : e.estado,
        }));
      }
    } catch {
      // Sem ViaCEP o cliente preenche à mão.
    } finally {
      setCepBuscando(false);
    }
  }

  function validarCartao(): { campo: CampoCartao } | { mes: number; ano: number } {
    const n = onlyDigits(numero);
    if (n.length < 13 || n.length > 19 || !luhn(n)) return { campo: 'numeroCartao' };
    if (nome.trim().length < 2) return { campo: 'nome' };
    const [mm, aa] = validade.split('/');
    const mes = Number(mm);
    const ano = 2000 + Number(aa);
    const agora = new Date();
    if (!mes || mes > 12 || !aa || aa.length !== 2 || ano < agora.getFullYear() || (ano === agora.getFullYear() && mes < agora.getMonth() + 1)) {
      return { campo: 'validade' };
    }
    if (!/^\d{3,4}$/.test(cvv)) return { campo: 'cvv' };
    return { mes, ano };
  }

  async function tokenizar(mes: number, ano: number): Promise<string | null> {
    try {
      const res = await fetch(`${URL_TOKENS}?appId=${encodeURIComponent(publicKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'card',
          card: { number: onlyDigits(numero), holder_name: nome.trim().toUpperCase(), exp_month: mes, exp_year: ano, cvv },
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { id?: unknown };
      return typeof data.id === 'string' ? data.id : null;
    } catch {
      return null;
    }
  }

  async function pagar() {
    setErro(null);
    const titular = prepararTitular();
    if (!titular) return;
    const cartao = validarCartao();
    if ('campo' in cartao) { setErro({ texto: t(`erros.${cartao.campo}`), campo: cartao.campo }); return; }
    const cobranca = validarDadosCobranca({ endereco, telefone: { ddi, numero: telefone } });
    if (!cobranca.ok) { setErro({ texto: t(`erros.${cobranca.campo}`), campo: cobranca.campo }); return; }

    setCarregando(true);
    const token = await tokenizar(cartao.mes, cartao.ano);
    if (!token) {
      setCarregando(false);
      setErro({ texto: t('erros.tokenizar'), campo: 'numeroCartao' });
      return;
    }
    const r = await pagarPedidoCartao({
      pedidoId, cardToken: token, parcelas, endereco, telefone: { ddi, numero: telefone },
      cpf: titular.cpf, estrangeiro: titular.estrangeiro, tomador: titular.tomador,
    });
    setCarregando(false);
    if (r.ok) {
      rastrear('add_payment_info', {
        currency: 'BRL', value: valorTotal, payment_type: 'cartao_credito', parcelas, gateway: 'pagarme',
        juros: valorParcelado(valorTotal, parcelas, juros).juros,
      });
    } else {
      // Recusa: limpa os dados sensíveis para o cliente tentar de novo (outro cartão ou corrigido).
      if (r.motivo) { setCvv(''); }
      const campo = r.campo?.startsWith('cobranca.') ? (r.campo.slice(9) as CampoCobranca) : undefined;
      setErro({ texto: r.error, campo });
    }
    onResultado(r);
  }

  const escolhido = valorParcelado(valorTotal, parcelas, juros);
  const erroEm = (c: CampoCartao | CampoCobranca) => erro?.campo === c;

  return (
    <div className="space-y-5">
      {/* Dados do cartão */}
      <div className="space-y-3">
        <Campo rotulo={t('numero')}>
          <div className="relative">
            <input inputMode="numeric" autoComplete="cc-number" value={numero} onChange={(e) => setNumero(maskNumero(e.target.value))}
              placeholder="0000 0000 0000 0000" className={classeInput(erroEm('numeroCartao'))} />
            <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5 h-4 w-4 text-slate-300" />
          </div>
        </Campo>
        <Campo rotulo={t('nome')}>
          <input autoComplete="cc-name" value={nome} onChange={(e) => setNome(e.target.value.slice(0, 64))}
            placeholder={t('nomePlaceholder')} className={`${classeInput(erroEm('nome'))} uppercase`} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo={t('validade')}>
            <input inputMode="numeric" autoComplete="cc-exp" value={validade} onChange={(e) => setValidade(maskValidade(e.target.value))}
              placeholder="MM/AA" className={classeInput(erroEm('validade'))} />
          </Campo>
          <Campo rotulo={t('cvv')}>
            <input inputMode="numeric" autoComplete="cc-csc" value={cvv} onChange={(e) => setCvv(onlyDigits(e.target.value).slice(0, 4))}
              placeholder="123" className={classeInput(erroEm('cvv'))} />
          </Campo>
        </div>
        {opcoesParcelas.length > 1 && (
          <Campo rotulo={t('parcelas')}>
            <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-marinho/20 cursor-pointer">
              {opcoesParcelas.map((n) => {
                const v = valorParcelado(valorTotal, n, juros);
                return (
                  <option key={n} value={n}>
                    {n === 1
                      ? t('aVista', { valor: f.moedaCentavos(valorTotal) })
                      : v.juros > 0
                        ? t('parcelaComJuros', { n, valor: f.moedaCentavos(v.parcela), total: f.moedaCentavos(v.total) })
                        : t('parcelaSemJuros', { n, valor: f.moedaCentavos(v.parcela) })}
                  </option>
                );
              })}
            </select>
            {escolhido.juros > 0 && (
              <span className="block mt-1 text-[11px] text-slate-500">
                {t('jurosInfo', {
                  aVista: f.moedaCentavos(valorTotal), total: f.moedaCentavos(escolhido.total),
                  juros: f.moedaCentavos(escolhido.juros), percentual: f.numero(escolhido.percentual),
                })}
              </span>
            )}
          </Campo>
        )}
      </div>

      {/* Endereço de cobrança e celular (antifraude) */}
      <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('cobrancaTitulo')}</p>
        <Campo rotulo={t('pais')}>
          <select value={endereco.pais} onChange={(e) => trocarPais(e.target.value)}
            className={`${classeInput(erroEm('pais'))} bg-white cursor-pointer`}>
            <option value="BR">{new Intl.DisplayNames([idioma], { type: 'region' }).of('BR')}</option>
            {paises.map((p) => <option key={p.codigo} value={p.codigo}>{p.nome}</option>)}
          </select>
        </Campo>
        <div className="grid grid-cols-3 gap-3">
          <Campo rotulo={br ? t('cep') : t('codigoPostal')}>
            <div className="relative">
              <input inputMode={br ? 'numeric' : 'text'} autoComplete="postal-code" value={endereco.cep}
                onChange={(e) => digitarCep(e.target.value)} placeholder={br ? '00000-000' : ''} className={classeInput(erroEm('cep'))} />
              {cepBuscando && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5 h-4 w-4 animate-spin text-slate-400" />}
            </div>
          </Campo>
          <Campo rotulo={t('logradouro')} className="col-span-2">
            <input autoComplete="address-line1" value={endereco.logradouro} onChange={(e) => set('logradouro', e.target.value)}
              className={classeInput(erroEm('logradouro'))} />
          </Campo>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Campo rotulo={t('numeroEndereco')}>
            <input value={endereco.numero} onChange={(e) => set('numero', e.target.value)} className={classeInput(erroEm('numero'))} />
          </Campo>
          <Campo rotulo={t('complemento')} className="col-span-2">
            <input autoComplete="address-line2" value={endereco.complemento} onChange={(e) => set('complemento', e.target.value)}
              className={classeInput(false)} />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo={br ? t('bairro') : t('bairroOpcional')}>
            <input value={endereco.bairro} onChange={(e) => set('bairro', e.target.value)} className={classeInput(erroEm('bairro'))} />
          </Campo>
          <Campo rotulo={t('cidade')}>
            <input autoComplete="address-level2" value={endereco.cidade} onChange={(e) => set('cidade', e.target.value)}
              className={classeInput(erroEm('cidade'))} />
          </Campo>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Campo rotulo={br ? t('uf') : t('estado')}>
            {br ? (
              <select value={endereco.estado} onChange={(e) => set('estado', e.target.value)}
                className={`${classeInput(erroEm('estado'))} bg-white cursor-pointer`}>
                <option value="">—</option>
                {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            ) : (
              <input autoComplete="address-level1" value={endereco.estado} onChange={(e) => set('estado', e.target.value)}
                className={classeInput(erroEm('estado'))} />
            )}
          </Campo>
          <Campo rotulo={t('celular')} className="col-span-2">
            <div className="flex gap-2">
              <div className="relative w-20 shrink-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 mt-0.5 text-sm text-slate-400">+</span>
                <input inputMode="numeric" value={ddi} onChange={(e) => setDdi(onlyDigits(e.target.value).slice(0, 3))}
                  aria-label={t('ddi')} className={`${classeInput(erroEm('telefone'))} pl-6`} />
              </div>
              <input inputMode="tel" autoComplete="tel-national" value={telefone}
                onChange={(e) => setTelefone(onlyDigits(e.target.value).slice(0, 13))}
                placeholder={br ? '48999999999' : ''} className={classeInput(erroEm('telefone'))} />
            </div>
          </Campo>
        </div>
      </div>

      {!br && (
        <p className="flex items-start gap-2 text-xs text-slate-500">
          <Globe className="h-4 w-4 text-turquesa-escuro shrink-0" />
          {t('avisoReais')}
        </p>
      )}
      <p className="flex items-start gap-2 text-xs text-slate-500">
        <ShieldCheck className="h-4 w-4 text-turquesa-escuro shrink-0" />
        {t('seguro')}
      </p>

      {erro && <p className="text-sm text-red-600">{erro.texto}</p>}

      <button
        type="button"
        onClick={pagar}
        disabled={carregando || bloqueado}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-marinho hover:bg-marinho-escuro disabled:opacity-60 px-4 py-3 text-sm font-semibold text-white transition-colors"
      >
        {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {carregando ? t('processando') : t('pagar', { valor: f.moedaCentavos(escolhido.total) })}
      </button>
    </div>
  );
}
