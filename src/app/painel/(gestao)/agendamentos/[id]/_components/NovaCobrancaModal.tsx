'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Loader2, MessageCircle, Plus, Trash2, X } from 'lucide-react';
import type { FormaPagamentoCodigo, PedidoItemOrigem, PedidoItemTipo } from '@/types/supabase';
import { calcularValoresAvulso, opcoesParcelas, totalItemAvulso, VALOR_MINIMO_COBRANCA } from '@/lib/pagamentos/valores';
import { formatCurrencyPrecise } from '@/lib/utils';
import { emitirCobrancaAvulsa, registrarCompartilhamentoCobranca } from '../../cobrancas-actions';
import { rastrear } from '@/lib/analytics';
import { linkWhatsAppCobranca } from './compartilhar';

export type ItemCatalogo = { id: string; descricao: string; valor: number; tipo: 'produto' | 'servico' };
export type OpcaoForma = { codigo: FormaPagamentoCodigo; nome: string; parcelasMax: number; valorMinimoParcela: number | null };

type Linha = {
  chave: number;
  origem: PedidoItemOrigem;
  catalogoId: string | null;
  tipo: PedidoItemTipo;
  descricao: string;
  quantidade: string;
  valorUnitario: string;
};

const TIPOS_LIVRES: { valor: PedidoItemTipo; rotulo: string }[] = [
  { valor: 'taxa', rotulo: 'Taxa' },
  { valor: 'produto', rotulo: 'Produto' },
  { valor: 'servico', rotulo: 'Serviço' },
  { valor: 'outro', rotulo: 'Outro' },
];

const PRAZOS_HORAS = [24, 48, 72, 120, 168, 240, 360];

function rotuloPrazo(h: number): string {
  return h < 48 ? `${h} horas` : `${h / 24} dias`;
}

/** Aceita "1.234,56", "1234.56" ou "12". */
function lerNumero(v: string): number | null {
  const limpo = v.trim().replace(/\s/g, '').replace(/^R\$/, '');
  if (!limpo) return null;
  const n = Number(limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo);
  return Number.isFinite(n) ? n : null;
}

const paraCampo = (n: number) => n.toFixed(2).replace('.', ',');

type Props = {
  reservaId: string;
  catalogo: ItemCatalogo[];
  formas: OpcaoForma[];
  taxaPercent: number;
  prazoPadraoHoras: number;
  prazoMaxDias: number;
  baseUrl: string;
  clienteTelefone: string | null;
  itemNome: string;
  onClose: () => void;
};

export default function NovaCobrancaModal(props: Props) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [criada, setCriada] = useState<{ pedidoId: string; numero: number } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [proximaChave, setProximaChave] = useState(1);
  const [editarTotal, setEditarTotal] = useState(false);
  const [totalEditado, setTotalEditado] = useState('');
  const [motivoAjuste, setMotivoAjuste] = useState('');
  const [formasSel, setFormasSel] = useState<FormaPagamentoCodigo[]>(props.formas.map((f) => f.codigo));
  const [parcelas, setParcelas] = useState(1);
  const prazos = PRAZOS_HORAS.filter((h) => h <= props.prazoMaxDias * 24);
  const [prazoHoras, setPrazoHoras] = useState(
    prazos.includes(props.prazoPadraoHoras) ? props.prazoPadraoHoras : (prazos[prazos.length - 1] ?? 24),
  );

  const itensValidos = linhas.map((l) => ({ quantidade: lerNumero(l.quantidade) ?? 0, valorUnitario: lerNumero(l.valorUnitario) ?? 0 }));
  const valorFinal = editarTotal ? lerNumero(totalEditado) : null;
  const valores = calcularValoresAvulso({ itens: itensValidos, valorFinal, taxaPercent: props.taxaPercent });

  const cartao = props.formas.find((f) => f.codigo === 'cartao_credito');
  const opcoesParc = cartao ? opcoesParcelas(valores.valorTotal, cartao.parcelasMax, cartao.valorMinimoParcela) : [1];
  const parcelasEfetivas = opcoesParc.includes(parcelas) ? parcelas : opcoesParc[opcoesParc.length - 1];

  function adicionarLinha(base: Omit<Linha, 'chave'>) {
    setLinhas((ls) => [...ls, { ...base, chave: proximaChave }]);
    setProximaChave((c) => c + 1);
  }

  function adicionarDoCatalogo(id: string) {
    const item = props.catalogo.find((c) => c.id === id);
    if (!item) return;
    adicionarLinha({
      origem: 'catalogo', catalogoId: item.id, tipo: item.tipo, descricao: item.descricao,
      quantidade: '1', valorUnitario: paraCampo(Number(item.valor)),
    });
    if (!titulo.trim()) setTitulo(item.descricao);
  }

  function atualizar(chave: number, campos: Partial<Linha>) {
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...campos } : l)));
  }

  function alternarForma(codigo: FormaPagamentoCodigo) {
    setFormasSel((fs) => (fs.includes(codigo) ? fs.filter((f) => f !== codigo) : [...fs, codigo]));
  }

  function validar(): string | null {
    if (titulo.trim().length < 2) return 'Informe um título para a cobrança.';
    if (!linhas.length) return 'Adicione ao menos um item.';
    for (const l of linhas) {
      if (!l.descricao.trim()) return 'Todo item precisa de uma descrição.';
      const q = lerNumero(l.quantidade);
      const v = lerNumero(l.valorUnitario);
      if (q == null || q <= 0) return `Quantidade inválida em "${l.descricao}".`;
      if (v == null || v < 0) return `Valor inválido em "${l.descricao}".`;
    }
    if (editarTotal) {
      if (valorFinal == null || valorFinal <= 0) return 'Informe o valor final da cobrança.';
      if (valores.valorAjuste !== 0 && !motivoAjuste.trim()) return 'Informe o motivo da alteração do valor.';
    }
    if (valores.valorTotal < VALOR_MINIMO_COBRANCA) return `O cliente precisa pagar pelo menos ${formatCurrencyPrecise(VALOR_MINIMO_COBRANCA)}.`;
    if (!formasSel.length) return 'Selecione ao menos uma forma de pagamento.';
    return null;
  }

  function enviar() {
    const problema = validar();
    if (problema) {
      setErro(problema);
      return;
    }
    setErro(null);
    startTransition(async () => {
      const r = await emitirCobrancaAvulsa({
        reservaId: props.reservaId,
        titulo,
        mensagem,
        itens: linhas.map((l) => ({
          origem: l.origem,
          catalogoId: l.catalogoId,
          tipo: l.tipo,
          descricao: l.descricao,
          quantidade: lerNumero(l.quantidade) ?? 0,
          valorUnitario: lerNumero(l.valorUnitario) ?? 0,
        })),
        valorFinal: editarTotal ? valorFinal : null,
        motivoAjuste: editarTotal ? motivoAjuste : null,
        formas: formasSel,
        parcelasMax: formasSel.includes('cartao_credito') ? parcelasEfetivas : 1,
        prazoHoras,
      });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      rastrear('cobranca_avulsa_criada', { value: valores.valorTotal, currency: 'BRL', itens: linhas.length });
      setCriada({ pedidoId: r.pedidoId, numero: r.numero });
      router.refresh();
    });
  }

  const link = criada ? `${props.baseUrl}/cobrancas/${criada.pedidoId}` : '';

  async function copiar() {
    if (!criada) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt('Copie o link da cobrança:', link);
    }
    void registrarCompartilhamentoCobranca(criada.pedidoId, 'copiar');
  }

  const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-[#0B2447] focus:outline-none focus:ring-1 focus:ring-[#0B2447]';
  const catalogoDisponivel = props.catalogo.filter((c) => !linhas.some((l) => l.catalogoId === c.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={pendente ? undefined : props.onClose}>
      <div
        className="w-full max-w-2xl max-h-[92dvh] overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nova-cobranca-titulo"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 id="nova-cobranca-titulo" className="text-sm font-bold text-[#0B2447] tracking-wide uppercase">
            {criada ? 'Cobrança gerada' : 'Nova cobrança'}
          </h3>
          <button type="button" onClick={props.onClose} disabled={pendente} aria-label="Fechar" className="-m-2 p-2 text-slate-400 hover:text-slate-600 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {criada ? (
          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <Check className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-sm text-emerald-800">
                <p className="font-semibold">Cobrança #{criada.numero} enviada ao cliente.</p>
                <p className="mt-1">Ele recebeu um e-mail e um aviso no site. Você também pode mandar o link direto:</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{link}</span>
            </div>
            <p className="text-xs text-slate-500">
              O link só abre para o cliente desta reserva, com o login dele no Boatzy.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="button" onClick={copiar} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B2447] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B3D91] transition">
                {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiado ? 'Link copiado' : 'Copiar link'}
              </button>
              <a
                href={linkWhatsAppCobranca({ telefone: props.clienteTelefone, link, titulo, itemNome: props.itemNome })}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void registrarCompartilhamentoCobranca(criada.pedidoId, 'whatsapp')}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition"
              >
                <MessageCircle className="h-4 w-4" /> Enviar no WhatsApp
              </a>
            </div>
            <button type="button" onClick={props.onClose} className="w-full text-sm text-slate-500 hover:text-slate-700 py-1">
              Fechar
            </button>
          </div>
        ) : (
          <div className="p-4 sm:p-6 space-y-5">
            <p className="text-xs text-slate-500">
              Cobre do cliente um produto, serviço ou taxa que não estava na reserva. Depois de gerada, a cobrança
              não pode ser alterada — para mudar algo, cancele e gere outra.
            </p>

            {/* Título */}
            <div>
              <label htmlFor="cobranca-titulo" className="block text-sm font-medium text-slate-700 mb-1.5">
                Título<span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                id="cobranca-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={120}
                placeholder="Ex.: Consumo a bordo, Taxa de limpeza extra"
                className={inputCls}
              />
            </div>

            {/* Itens */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-medium text-slate-700">Itens<span className="text-red-500 ml-0.5">*</span></span>
              </div>

              {linhas.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
                  Adicione itens do seu catálogo ou um item com descrição livre.
                </p>
              )}

              <div className="space-y-2.5">
                {linhas.map((l, idx) => {
                  const total = totalItemAvulso(itensValidos[idx]);
                  return (
                    <div key={l.chave} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0 space-y-2">
                          {l.origem === 'catalogo' ? (
                            <p className="text-sm font-medium text-slate-700">
                              {l.descricao}
                              <span className="ml-2 text-[10px] uppercase tracking-wider text-slate-400">
                                catálogo · {l.tipo === 'servico' ? 'serviço' : 'produto'}
                              </span>
                            </p>
                          ) : (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <select
                                value={l.tipo}
                                onChange={(e) => atualizar(l.chave, { tipo: e.target.value as PedidoItemTipo })}
                                aria-label="Tipo do item"
                                className={`${inputCls} sm:w-32`}
                              >
                                {TIPOS_LIVRES.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
                              </select>
                              <input
                                value={l.descricao}
                                onChange={(e) => atualizar(l.chave, { descricao: e.target.value })}
                                maxLength={200}
                                placeholder="Descrição"
                                aria-label="Descrição do item"
                                className={inputCls}
                              />
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-2 items-end">
                            <label className="text-[11px] text-slate-500">
                              Qtd.
                              <input
                                value={l.quantidade}
                                onChange={(e) => atualizar(l.chave, { quantidade: e.target.value })}
                                inputMode="decimal"
                                className={`${inputCls} mt-0.5`}
                              />
                            </label>
                            <label className="text-[11px] text-slate-500">
                              Valor unit. (R$)
                              <input
                                value={l.valorUnitario}
                                onChange={(e) => atualizar(l.chave, { valorUnitario: e.target.value })}
                                inputMode="decimal"
                                placeholder="0,00"
                                className={`${inputCls} mt-0.5`}
                              />
                            </label>
                            <div className="text-right pb-2">
                              <p className="text-[11px] text-slate-400">Subtotal</p>
                              <p className="text-sm font-semibold text-slate-700">{formatCurrencyPrecise(total)}</p>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
                          aria-label="Remover item"
                          className="-m-1 p-1.5 text-slate-400 hover:text-red-500 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2.5 flex flex-col sm:flex-row gap-2">
                {catalogoDisponivel.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => adicionarDoCatalogo(e.target.value)}
                    aria-label="Adicionar item do catálogo"
                    className={`${inputCls} sm:flex-1`}
                  >
                    <option value="">+ Adicionar do catálogo…</option>
                    {catalogoDisponivel.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.descricao} — {formatCurrencyPrecise(Number(c.valor))}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => adicionarLinha({ origem: 'livre', catalogoId: null, tipo: 'taxa', descricao: '', quantidade: '1', valorUnitario: '' })}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  <Plus className="h-4 w-4" /> Item com descrição livre
                </button>
              </div>
            </div>

            {/* Valor */}
            <div className="rounded-xl border border-slate-200 p-3.5 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Soma dos itens</span>
                <span className="font-semibold text-slate-700">{formatCurrencyPrecise(valores.valorCalculado)}</span>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={editarTotal}
                  onChange={(e) => {
                    setEditarTotal(e.target.checked);
                    if (e.target.checked && !totalEditado) setTotalEditado(paraCampo(valores.valorCalculado));
                  }}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Editar o valor final (desconto ou acréscimo)
              </label>
              {editarTotal && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="text-[11px] text-slate-500">
                    Valor final que você recebe (R$)
                    <input value={totalEditado} onChange={(e) => setTotalEditado(e.target.value)} inputMode="decimal" className={`${inputCls} mt-0.5`} />
                  </label>
                  <label className="text-[11px] text-slate-500">
                    Motivo{valores.valorAjuste !== 0 && <span className="text-red-500 ml-0.5">*</span>}
                    <input
                      value={motivoAjuste}
                      onChange={(e) => setMotivoAjuste(e.target.value)}
                      maxLength={300}
                      placeholder="Ex.: desconto de cortesia"
                      className={`${inputCls} mt-0.5`}
                    />
                  </label>
                </div>
              )}
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-xs space-y-1">
                {valores.valorAjuste !== 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Ajuste</span>
                    <span>{valores.valorAjuste > 0 ? '+' : ''}{formatCurrencyPrecise(valores.valorAjuste)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500"><span>Você recebe</span><span className="font-semibold text-slate-700">{formatCurrencyPrecise(valores.valorItens)}</span></div>
                <div className="flex justify-between text-slate-500"><span>Taxa de serviço (paga pelo cliente)</span><span>{formatCurrencyPrecise(valores.valorComissao)}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-[#0B2447]"><span>Cliente paga</span><span>{formatCurrencyPrecise(valores.valorTotal)}</span></div>
              </div>
            </div>

            {/* Pagamento */}
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-2">Formas de pagamento permitidas<span className="text-red-500 ml-0.5">*</span></span>
              {props.formas.length === 0 ? (
                <p className="text-sm text-red-600">Nenhuma forma de pagamento está ativa no momento. Fale com o suporte do Boatzy.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {props.formas.map((f) => (
                    <label
                      key={f.codigo}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition ${formasSel.includes(f.codigo) ? 'border-[#0B2447] bg-[#0B2447]/5 text-[#0B2447]' : 'border-slate-200 text-slate-600'}`}
                    >
                      <input type="checkbox" checked={formasSel.includes(f.codigo)} onChange={() => alternarForma(f.codigo)} className="h-4 w-4 rounded border-slate-300" />
                      {f.codigo === 'cartao_credito' ? 'Cartão de crédito' : f.codigo === 'pix' ? 'Pix' : f.nome}
                    </label>
                  ))}
                </div>
              )}
              {formasSel.includes('cartao_credito') && cartao && (
                opcoesParc.length > 1 ? (
                  <label className="mt-3 block text-[11px] text-slate-500 sm:w-64">
                    No cartão, em até
                    <select value={parcelasEfetivas} onChange={(e) => setParcelas(Number(e.target.value))} className={`${inputCls} mt-0.5`}>
                      {opcoesParc.map((n) => (
                        <option key={n} value={n}>{n === 1 ? '1x (à vista)' : `${n}x de ${formatCurrencyPrecise(valores.valorTotal / n)}`}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">
                    {cartao.parcelasMax > 1 ? 'Para este valor, o cartão é só à vista.' : 'O cartão é só à vista (limite da plataforma).'}
                  </p>
                )
              )}
            </div>

            {/* Prazo + mensagem */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="text-sm font-medium text-slate-700">
                Prazo para pagar
                <select value={prazoHoras} onChange={(e) => setPrazoHoras(Number(e.target.value))} className={`${inputCls} mt-1.5 font-normal`}>
                  {prazos.map((h) => <option key={h} value={h}>{rotuloPrazo(h)}</option>)}
                </select>
              </label>
              <label className="sm:col-span-2 text-sm font-medium text-slate-700">
                Recado ao cliente <span className="font-normal text-slate-400">(opcional)</span>
                <textarea
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  maxLength={1000}
                  rows={2}
                  placeholder="Ex.: Referente ao consumo do bar durante o passeio."
                  className={`${inputCls} mt-1.5 font-normal resize-none`}
                />
              </label>
            </div>

            {erro && <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700" role="alert">{erro}</p>}

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button type="button" onClick={props.onClose} disabled={pendente} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700">
                Cancelar
              </button>
              <button
                type="button"
                onClick={enviar}
                disabled={pendente || props.formas.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B2447] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B3D91] disabled:opacity-60 transition"
              >
                {pendente && <Loader2 className="h-4 w-4 animate-spin" />}
                Gerar cobrança de {formatCurrencyPrecise(valores.valorTotal)}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
