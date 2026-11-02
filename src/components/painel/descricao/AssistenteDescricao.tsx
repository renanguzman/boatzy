'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles, Mic, Square, X, Loader2, ArrowLeft, RefreshCw, Check, AlertCircle, Lightbulb, Info, Globe, ExternalLink,
} from 'lucide-react';
import {
  DESTAQUES, IDEIAS, podeGerar, rascunhoSimples, temLugaresParaPesquisar,
  type AlvoDescricao, type FatoDescricao, type FonteDescricao, type PedidoDescricao, type RespostaDescricao,
} from '@/lib/descricao/assistente';
import { useDitado } from './useDitado';

const TEXTOS: Record<AlvoDescricao, {
  titulo: string; placeholder: string; marcarSo: string;
  /** "Escrevendo sua descrição…" */ escrevendo: string;
  /** Botão da etapa de contar. */ gerar: string;
  /** Aviso ao revisar quando já há texto no campo. */ substitui: string;
  /** Rótulo do botão que abre o assistente. */ nome: string;
}> = {
  embarcacao: {
    titulo: 'Descrição da embarcação',
    placeholder: 'Ex.: lancha muito confortável, ótima para família, tem churrasqueira e som, sempre limpa…',
    marcarSo: 'Marque só o que é verdade nesta embarcação.',
    escrevendo: 'Escrevendo sua descrição…', gerar: 'Gerar descrição', substitui: 'Vai substituir a descrição atual.', nome: 'descrição',
  },
  roteiro: {
    titulo: 'Descrição do passeio',
    placeholder: 'Ex.: saímos às 9h da marina, paramos na Praia do Pontal para banho, a água é bem clara, voltamos no fim da tarde…',
    marcarSo: 'Marque só o que é verdade neste passeio.',
    escrevendo: 'Escrevendo sua descrição…', gerar: 'Gerar descrição', substitui: 'Vai substituir a descrição atual.', nome: 'descrição',
  },
  operador: {
    titulo: 'Sua apresentação',
    placeholder: 'Ex.: sou mestre amador há 20 anos, navego na Lagoa da Conceição, gosto de receber famílias e cuido de cada detalhe da segurança…',
    marcarSo: 'Marque só o que é verdade sobre você e o seu trabalho.',
    escrevendo: 'Escrevendo sua apresentação…', gerar: 'Gerar apresentação', substitui: 'Vai substituir o texto atual.', nome: 'apresentação',
  },
};

type Props = {
  alvo: AlvoDescricao;
  /** Descrição que já está no campo. */
  valorAtual: string;
  /** Fatos do cadastro já preenchidos (calculados pelo formulário). */
  fatos: FatoDescricao[];
  /** Roteiro: embarcação vinculada (o servidor completa os dados dela). */
  embarcacaoId?: string | null;
  /** Dica de dado que falta no cadastro e deixaria o texto melhor. */
  aviso?: string | null;
  onAplicar: (texto: string) => void;
};

/**
 * Assistente de descrição (SPEC §98): o dono fala (ditado) ou digita do jeito dele, toca
 * nas opções que combinam e recebe um texto pronto, escrito só com o que ele informou.
 * Sempre mostra o texto para revisar e só aplica quando ele aprova.
 */
export default function AssistenteDescricao({ alvo, valorAtual, fatos, embarcacaoId, aviso, onAplicar }: Props) {
  const [aberto, setAberto] = useState(false);
  const [etapa, setEtapa] = useState<'contar' | 'revisar'>('contar');
  const [relato, setRelato] = useState('');
  const [destaques, setDestaques] = useState<string[]>([]);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<{ texto: string; semIa: boolean } | null>(null);
  const [resultado, setResultado] = useState<{ texto: string; sugestoes: string[]; fontes: FonteDescricao[]; semIa: boolean } | null>(null);
  /** Passeio: pesquisar na web sobre os lugares do itinerário (ligado por padrão). */
  const [querPesquisar, setQuerPesquisar] = useState(true);
  const [texto, setTexto] = useState('');
  /** Operador: escrever como pessoa ("Sou…") ou como empresa ("Somos…"). */
  const [voz, setVoz] = useState<'primeira' | 'empresa'>('primeira');
  const relatoRef = useRef<HTMLTextAreaElement>(null);
  const t = TEXTOS[alvo];

  const ditado = useDitado((trecho) => {
    const limpo = trecho.trim();
    if (limpo) setRelato((r) => (r.trim() ? `${r.trimEnd()} ${limpo}` : limpo));
  });

  const temTextoAtual = valorAtual.trim().length > 0;
  const podePesquisar = alvo === 'roteiro' && temLugaresParaPesquisar(fatos);
  const pesquisar = podePesquisar && querPesquisar;
  const pode = podeGerar(relato, destaques) || temTextoAtual;

  function fechar() {
    ditado.parar();
    setAberto(false);
    setErro(null);
  }

  // Esc fecha; a página por trás não rola enquanto o assistente está aberto.
  useEffect(() => {
    if (!aberto) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !gerando && fechar();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fechar só lê setters estáveis
  }, [aberto, gerando]);

  function alternarDestaque(d: string) {
    setDestaques((atual) => (atual.includes(d) ? atual.filter((x) => x !== d) : [...atual, d]));
  }

  async function gerar(versaoAnterior?: string) {
    if (!pode || gerando) return;
    ditado.parar();
    setErro(null);
    setGerando(true);
    const pedido: PedidoDescricao = {
      alvo, fatos, relato, destaques, textoAtual: valorAtual, embarcacaoId: embarcacaoId ?? null,
      versaoAnterior: versaoAnterior ?? null, pesquisar,
      ...(alvo === 'operador' ? { voz } : {}),
    };
    let r: RespostaDescricao;
    try {
      const res = await fetch('/api/painel/descricao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pedido),
      });
      r = (await res.json().catch(() => null)) ?? { ok: false, error: 'Não conseguimos escrever agora.', semIa: true };
    } catch {
      r = { ok: false, error: 'Sem conexão. Verifique a internet e tente de novo.' };
    }
    setGerando(false);
    if (!r.ok) {
      setErro({ texto: r.error, semIa: !!r.semIa });
      return;
    }
    setResultado({ texto: r.texto, sugestoes: r.sugestoes, fontes: r.fontes ?? [], semIa: false });
    setTexto(r.texto);
    setEtapa('revisar');
  }

  function usarRascunhoSimples() {
    const rascunho = rascunhoSimples({ alvo, fatos, relato: relato || valorAtual, destaques, voz });
    setErro(null);
    setResultado({ texto: rascunho, sugestoes: [], fontes: [], semIa: true });
    setTexto(rascunho);
    setEtapa('revisar');
  }

  function responderSugestao(pergunta: string) {
    setRelato((r) => `${r.trimEnd()}${r.trim() ? '\n' : ''}${pergunta} `);
    setEtapa('contar');
    requestAnimationFrame(() => {
      const el = relatoRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }

  function aplicar() {
    const final = texto.trim();
    if (!final) return;
    onAplicar(final);
    setAberto(false);
    setEtapa('contar');
    setResultado(null);
  }

  const palavras = texto.trim() ? texto.trim().split(/\s+/).length : 0;

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button
          type="button"
          onClick={() => { setAberto(true); setEtapa(resultado && etapa === 'revisar' ? 'revisar' : 'contar'); }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-50 px-3.5 py-2 text-sm font-semibold text-teal-800 ring-1 ring-teal-200 transition-colors hover:bg-teal-100"
        >
          <Sparkles className="h-4 w-4" /> {temTextoAtual ? 'Melhorar com ajuda' : 'Escrever com ajuda'}
        </button>
        <span className="text-xs text-slate-400">Fale ou toque em opções — a gente escreve e você aprova.</span>
      </div>

      {aberto && createPortal(
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="assistente-titulo">
          <div className="absolute inset-0 bg-[#0B2447]/50 backdrop-blur-[2px]" onClick={() => !gerando && fechar()} />
          <div className="relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">
            {/* Cabeçalho */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-6">
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-teal-700">
                  <Sparkles className="h-3.5 w-3.5" /> Escrever com ajuda
                </p>
                <h2 id="assistente-titulo" className="text-base font-bold text-[#0B2447]">
                  {etapa === 'contar' ? t.titulo : 'Confira o texto'}
                </h2>
              </div>
              <button type="button" onClick={fechar} disabled={gerando} aria-label="Fechar"
                className="-mr-1 rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-[#0B2447] disabled:opacity-40">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Corpo */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
              {gerando ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                  <p className="text-sm font-semibold text-[#0B2447]">
                    {pesquisar ? 'Pesquisando sobre os lugares e escrevendo…' : t.escrevendo}
                  </p>
                  <p className="text-xs text-slate-500">
                    {pesquisar
                      ? 'Usamos o que você contou, o cadastro e informações públicas dos lugares. Pode levar até meio minuto.'
                      : 'Usamos só o que você contou e o que está no cadastro. Leva alguns segundos.'}
                  </p>
                </div>
              ) : etapa === 'contar' ? (
                <div className="space-y-6">
                  {alvo === 'operador' && (
                    <section>
                      <h3 className="text-sm font-bold text-[#0B2447]">Como você quer se apresentar?</h3>
                      <div role="radiogroup" aria-label="Voz do texto" className="mt-2 grid grid-cols-2 gap-2">
                        {([['primeira', 'Como pessoa', '“Sou… atuo… conduzo…”'], ['empresa', 'Como empresa', '“Somos… atuamos…”']] as const).map(([valor, rotulo, exemplo]) => (
                          <button key={valor} type="button" role="radio" aria-checked={voz === valor} onClick={() => setVoz(valor)}
                            className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                              voz === valor ? 'border-teal-400 bg-teal-50' : 'border-slate-200 hover:bg-slate-50'
                            }`}>
                            <span className={`block text-sm font-semibold ${voz === valor ? 'text-teal-800' : 'text-slate-700'}`}>{rotulo}</span>
                            <span className="block text-xs text-slate-500">{exemplo}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  <section>
                    <h3 className="text-sm font-bold text-[#0B2447]">1. Conte do seu jeito</h3>
                    <p className="mt-0.5 text-xs text-slate-500">Fale ou escreva como se explicasse para um cliente. Não se preocupe com erros — a gente arruma.</p>
                    {temTextoAtual && (
                      <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Vamos partir do texto que você já escreveu. Conte só o que quiser acrescentar.
                      </p>
                    )}
                    <textarea
                      ref={relatoRef}
                      value={ditado.parcial ? `${relato}${relato ? ' ' : ''}${ditado.parcial}` : relato}
                      onChange={(e) => setRelato(e.target.value)}
                      readOnly={ditado.ouvindo}
                      rows={5}
                      maxLength={4000}
                      placeholder={t.placeholder}
                      className={`mt-3 w-full resize-none rounded-xl border px-3.5 py-3 text-base text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 sm:text-sm ${
                        ditado.ouvindo ? 'border-red-300 bg-red-50/30' : 'border-slate-200 focus:border-teal-500/50'
                      }`}
                    />
                    {ditado.suportado ? (
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        {ditado.ouvindo ? (
                          <button type="button" onClick={ditado.parar}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700">
                            <Square className="h-4 w-4 fill-current" /> Parar
                          </button>
                        ) : (
                          <button type="button" onClick={ditado.iniciar}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#0B2447] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0B3D91]">
                            <Mic className="h-4 w-4" /> {relato.trim() ? 'Falar mais' : 'Toque para falar'}
                          </button>
                        )}
                        {ditado.ouvindo && (
                          <span className="flex items-center gap-2 text-sm text-red-700">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                            </span>
                            Ouvindo… fale à vontade
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">Dica: no celular, toque no 🎤 do teclado para falar em vez de digitar.</p>
                    )}
                    {ditado.erro && <p className="mt-2 text-xs text-red-600">{ditado.erro}</p>}
                    <div className="mt-3 rounded-xl bg-amber-50/60 px-3 py-2.5">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900"><Lightbulb className="h-3.5 w-3.5" /> Ideias do que contar</p>
                      <ul className="mt-1 space-y-0.5 text-xs text-amber-900/80">
                        {IDEIAS[alvo].map((i) => <li key={i}>• {i}</li>)}
                      </ul>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-bold text-[#0B2447]">2. Toque no que combina</h3>
                    <p className="mt-0.5 text-xs text-slate-500">{t.marcarSo}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {DESTAQUES[alvo].map((d) => {
                        const marcado = destaques.includes(d);
                        return (
                          <button key={d} type="button" aria-pressed={marcado} onClick={() => alternarDestaque(d)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm transition-colors ${
                              marcado ? 'border-teal-400 bg-teal-50 font-semibold text-teal-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}>
                            {marcado && <Check className="h-3.5 w-3.5" />} {d}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-bold text-[#0B2447]">Também vamos usar o que você já preencheu</h3>
                    {fatos.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {fatos.map((f) => (
                          <li key={f.rotulo} className="max-w-full truncate rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600" title={`${f.rotulo}: ${f.valor}`}>
                            <span className="text-slate-400">{f.rotulo}:</span> {f.valor}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">Ainda não há outros dados preenchidos.</p>
                    )}
                    {aviso && <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {aviso}</p>}
                  </section>

                  {podePesquisar && (
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                      <input type="checkbox" checked={querPesquisar} onChange={(e) => setQuerPesquisar(e.target.checked)}
                        className="mt-1 h-4 w-4 accent-teal-600" />
                      <span>
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-[#0B2447]">
                          <Globe className="h-4 w-4 text-teal-600" /> Pesquisar sobre os lugares do roteiro
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          Buscamos na internet o que torna as praias e ilhas do itinerário especiais, para o texto ficar mais rico. Você vê as fontes antes de usar.
                        </span>
                      </span>
                    </label>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Leia e ajuste o que quiser. O texto só vai para o campo quando você tocar em <strong>Usar este texto</strong>.
                  </p>
                  {resultado?.semIa && (
                    <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Rascunho simples, montado com os dados do cadastro. Revise com atenção e complete com o seu jeito.
                    </p>
                  )}
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    rows={11}
                    className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-base leading-relaxed text-slate-800 focus:border-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 sm:text-sm"
                  />
                  <p className="-mt-2 text-right text-xs text-slate-400">{palavras} palavras</p>
                  {resultado && resultado.fontes.length > 0 && (
                    <details className="rounded-xl border border-slate-200 p-3">
                      <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <Globe className="h-3.5 w-3.5 text-teal-600" /> Pesquisamos em {resultado.fontes.length} {resultado.fontes.length === 1 ? 'página' : 'páginas'} — confira as informações sobre os lugares
                      </summary>
                      <ul className="mt-2 space-y-1.5">
                        {resultado.fontes.map((f) => (
                          <li key={f.url}>
                            <a href={f.url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex max-w-full items-center gap-1 text-xs text-teal-700 hover:underline">
                              <ExternalLink className="h-3 w-3 shrink-0" /> <span className="truncate">{f.titulo}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {resultado && resultado.sugestoes.length > 0 && (
                    <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3">
                      <p className="text-xs font-semibold text-teal-900">Para ficar ainda melhor, conte também:</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {resultado.sugestoes.map((s) => (
                          <button key={s} type="button" onClick={() => responderSugestao(s)}
                            className="rounded-full border border-teal-200 bg-white px-3 py-1.5 text-left text-xs font-medium text-teal-800 hover:bg-teal-50">
                            {s}
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-[11px] text-teal-800/70">Toque numa pergunta para responder e gerar de novo.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Rodapé */}
            {!gerando && (
              <div className="space-y-2 border-t border-slate-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
                {erro && (
                  <div className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 sm:flex-row sm:items-center">
                    <p className="flex flex-1 items-start gap-1.5 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {erro.texto}</p>
                    {erro.semIa && (
                      <button type="button" onClick={usarRascunhoSimples} className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50">
                        Montar um rascunho simples
                      </button>
                    )}
                  </div>
                )}
                {etapa === 'contar' ? (
                  <>
                    <button type="button" onClick={() => void gerar()} disabled={!pode}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40">
                      <Sparkles className="h-4 w-4" /> {t.gerar}
                    </button>
                    {!pode && <p className="text-center text-xs text-slate-400">Fale ou escreva algo, ou toque em pelo menos uma opção.</p>}
                  </>
                ) : (
                  <>
                    {temTextoAtual && <p className="text-center text-xs text-slate-400">{t.substitui}</p>}
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                      <button type="button" onClick={() => setEtapa('contar')}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-50 sm:py-2.5">
                        <ArrowLeft className="h-4 w-4" /> Voltar
                      </button>
                      {!resultado?.semIa && (
                        <button type="button" onClick={() => void gerar(texto)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-[#0B2447] hover:bg-slate-50 sm:py-2.5">
                          <RefreshCw className="h-4 w-4" /> Outra versão
                        </button>
                      )}
                      <button type="button" onClick={aplicar} disabled={!texto.trim()}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0B2447] px-5 py-3.5 text-sm font-semibold text-white hover:bg-[#0B3D91] disabled:opacity-40 sm:py-2.5">
                        <Check className="h-4 w-4" /> Usar este texto
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
