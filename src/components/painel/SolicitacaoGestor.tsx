'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Ship, Hourglass, AlertCircle, Loader2, Send, ArrowRight, ChevronLeft, IdCard, UsersRound, Info } from 'lucide-react';
import PhoneInput, { type PhoneValue } from '@/components/auth/PhoneInput';
import SignOutLink from '@/components/painel/SignOutLink';
import DocumentoEmbutido from '@/components/painel/documentos/DocumentoEmbutido';
import { getMunicipiosByEstado } from '@/lib/conta-actions';
import { solicitarAcessoGestor, type ConducaoSolicitacao } from '@/lib/solicitacao-gestor-actions';
import { isValidCPF, isValidCpfOuCnpj, maskCpfCnpj, onlyDigits } from '@/lib/validators';
import { formatarData } from '@/lib/datas';
import { rastrear } from '@/lib/analytics';
import { enviarArquivoRascunho } from '@/lib/documentos/envio';
import { SIMILARIDADE_SUGESTAO, similaridadeNomes } from '@/lib/documentos/nomes';
import { erroConferencia, payloadDoRascunho, type DocumentoAtual, type DocumentoPayload, type RascunhoDocumento } from '@/lib/documentos/rascunho';
import { TIPOS_DOCUMENTO } from '@/lib/documentos/tipos';
import type { SolicitacaoGestorResumo } from '@/lib/solicitacao-gestor';

type Estado = { id: number; uf: string; nome: string };
type Municipio = { id: number; nome: string };

type Props = {
  estados: Estado[];
  /** Municípios do estado já escolhido (pedido recusado reaberto). */
  municipiosIniciais: Municipio[];
  perfil: { nome: string; telefone: string | null; documento: string | null };
  /** Pedido mais recente do usuário, se houver. */
  ultima: SolicitacaoGestorResumo | null;
  /** Habilitação do próprio solicitante já enviada (pedido anterior). */
  habilitacao: DocumentoAtual | null;
};

const inputField =
  'w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3D91]/20 focus:border-[#0B3D91] transition-all disabled:cursor-not-allowed disabled:opacity-60';
const label = 'mb-2 block text-xs font-bold uppercase tracking-wider text-[#0B2447]';

const PASSOS = ['Seus dados', 'Condução'] as const;

/**
 * Tela do /painel para quem ainda não tem o papel de gestor (SPEC §62):
 * pedido em análise, pedido recusado (com a observação da equipe) ou o
 * formulário para pedir acesso — em 2 etapas: dados e condução (quem conduz
 * envia a própria habilitação, SPEC §95.10). O papel só vem com a aprovação do admin.
 */
export default function SolicitacaoGestor({ estados, municipiosIniciais, perfil, ultima, habilitacao }: Props) {
  if (ultima?.status === 'pendente') return <EmAnalise solicitacao={ultima} habilitacao={habilitacao} />;
  return (
    <Formulario
      estados={estados}
      municipiosIniciais={municipiosIniciais}
      perfil={perfil}
      recusada={ultima?.status === 'recusada' ? ultima : null}
      habilitacaoAtual={habilitacao}
    />
  );
}

function Moldura({ children, largura = 'max-w-lg' }: { children: React.ReactNode; largura?: string }) {
  return (
    <div className="min-h-dvh bg-[#F8F9FB] flex flex-col items-center justify-center px-4 py-10">
      <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8 w-full ${largura}`}>
        {children}
      </div>
    </div>
  );
}

function EmAnalise({ solicitacao, habilitacao }: { solicitacao: SolicitacaoGestorResumo; habilitacao: DocumentoAtual | null }) {
  return (
    <Moldura>
      <div className="text-center">
        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Hourglass className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold text-[#0B2447] mb-2">Pedido em análise</h1>
        <p className="text-sm text-slate-500">
          Recebemos seu pedido de acesso de gestor em {formatarData(solicitacao.criadoEm)}. A equipe Boatzy
          vai analisar seus dados e você recebe a resposta por e-mail.
        </p>
      </div>

      <dl className="mt-6 rounded-xl border border-slate-100 divide-y divide-slate-100 text-sm">
        <div className="flex justify-between gap-4 px-4 py-3">
          <dt className="text-slate-500">Nome</dt>
          <dd className="font-semibold text-[#0B2447] text-right">{solicitacao.nome}</dd>
        </div>
        <div className="flex justify-between gap-4 px-4 py-3">
          <dt className="text-slate-500">Cidade da embarcação</dt>
          <dd className="font-semibold text-[#0B2447] text-right">
            {solicitacao.municipio}{solicitacao.uf ? `/${solicitacao.uf}` : ''}
          </dd>
        </div>
        <div className="flex justify-between gap-4 px-4 py-3">
          <dt className="text-slate-500">Embarcações</dt>
          <dd className="font-semibold text-[#0B2447]">{solicitacao.qtdEmbarcacoes}</dd>
        </div>
        {habilitacao && (
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-slate-500">Sua habilitação</dt>
            <dd className="font-semibold text-[#0B2447] text-right">
              {TIPOS_DOCUMENTO[habilitacao.tipo].sigla}
              {habilitacao.data_validade ? ` · válida até ${formatarData(habilitacao.data_validade)}` : ''}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-6 flex flex-col gap-3">
        <Link
          href="/"
          className="w-full text-center bg-slate-100 hover:bg-slate-200 text-[#0B2447] font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          Voltar ao site
        </Link>
        <SignOutLink redirectUrl="/painel/login" />
      </div>
    </Moldura>
  );
}

function Formulario({ estados, municipiosIniciais, perfil, recusada, habilitacaoAtual }: {
  estados: Estado[];
  municipiosIniciais: Municipio[];
  perfil: Props['perfil'];
  recusada: SolicitacaoGestorResumo | null;
  habilitacaoAtual: DocumentoAtual | null;
}) {
  const router = useRouter();
  const [enviando, startEnvio] = useTransition();

  const telefoneInicial = recusada?.telefone ?? perfil.telefone ?? '';
  const [passo, setPasso] = useState<0 | 1>(0);
  const [nome, setNome] = useState(recusada?.nome ?? perfil.nome);
  const [telefone, setTelefone] = useState<PhoneValue>({ e164: telefoneInicial, valid: true });
  const [documento, setDocumento] = useState(maskCpfCnpj(recusada?.documento ?? perfil.documento ?? ''));
  const [estadoId, setEstadoId] = useState(recusada ? String(recusada.estadoId) : '');
  const [municipioId, setMunicipioId] = useState(recusada ? String(recusada.municipioId) : '');
  const [municipios, setMunicipios] = useState<Municipio[]>(municipiosIniciais);
  const [carregandoMunicipios, setCarregandoMunicipios] = useState(false);
  const [qtd, setQtd] = useState(recusada ? String(recusada.qtdEmbarcacoes) : '1');
  const [mensagem, setMensagem] = useState('');
  const [conducao, setConducao] = useState<ConducaoSolicitacao | null>(habilitacaoAtual ? 'proprio' : null);
  const [habilitacao, setHabilitacao] = useState<RascunhoDocumento | null>(null);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [tentou, setTentou] = useState(false);

  async function trocarEstado(valor: string) {
    setEstadoId(valor);
    setMunicipioId('');
    setMunicipios([]);
    if (!valor) return;
    setCarregandoMunicipios(true);
    setMunicipios(await getMunicipiosByEstado(parseInt(valor, 10)));
    setCarregandoMunicipios(false);
  }

  const documentoInvalido = tentou && !isValidCpfOuCnpj(documento);
  const telefoneInvalido = tentou && (!telefone.e164 || !telefone.valid);

  function erroDosDados(): string | null {
    if (nome.trim().length < 2) return 'Informe seu nome completo.';
    if (!telefone.e164 || !telefone.valid) return 'Informe um celular válido.';
    if (!isValidCpfOuCnpj(documento)) return 'Informe um CPF ou CNPJ válido.';
    if (!estadoId || !municipioId) return 'Escolha o estado e a cidade onde fica a embarcação.';
    return null;
  }

  // Conferência da habilitação com o passo 1 (nome e, se for CPF, o documento).
  const nomeNaCarteira = habilitacao?.campos.titular.trim() ?? '';
  const cpfNaCarteira = habilitacao?.campos.cpf ?? '';
  const nomeDiverge = nomeNaCarteira.length >= 3 && similaridadeNomes(nomeNaCarteira, nome) < SIMILARIDADE_SUGESTAO;
  const cpfDiverge =
    isValidCPF(cpfNaCarteira) && onlyDigits(documento).length === 11 && onlyDigits(cpfNaCarteira) !== onlyDigits(documento);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setTentou(true);
    setErro('');
    const erroDados = erroDosDados();
    if (erroDados) {
      setPasso(0);
      return setErro(erroDados);
    }
    if (passo === 0) {
      setPasso(1);
      return;
    }
    if (!conducao) return setErro('Conte quem vai conduzir a embarcação nos passeios.');
    if (conducao === 'proprio') {
      if (!habilitacao && !habilitacaoAtual) return setErro('Envie a foto ou o PDF da sua habilitação náutica.');
      const erroDoc = habilitacao ? erroConferencia(habilitacao.tipo, 'condutor', habilitacao.campos) : null;
      if (erroDoc) return setErro(erroDoc);
    }

    startEnvio(async () => {
      let payloadHabilitacao: DocumentoPayload | null = null;
      if (conducao === 'proprio' && habilitacao) {
        const env = await enviarArquivoRascunho(habilitacao, (pct) => setProgresso(`Enviando a habilitação… ${pct}%`));
        setProgresso(null);
        if (!env.ok) {
          setErro(env.erro);
          return;
        }
        payloadHabilitacao = payloadDoRascunho(habilitacao, env.arquivo, null);
      }
      const r = await solicitarAcessoGestor({
        nome,
        telefone: telefone.e164,
        documento,
        estadoId: parseInt(estadoId, 10),
        municipioId: parseInt(municipioId, 10),
        qtdEmbarcacoes: parseInt(qtd, 10) || 0,
        mensagem,
        conducao,
        habilitacao: payloadHabilitacao,
      });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      // GA4: lead de gestor (dono de embarcação) — SPEC §65.
      rastrear('solicitar_acesso_gestor', { qtd_embarcacoes: parseInt(qtd, 10) || 0, conducao });
      router.refresh();
    });
  }

  return (
    <Moldura largura="max-w-xl">
      <div className="text-center">
        <div className="w-16 h-16 bg-[#0B3D91]/5 rounded-full flex items-center justify-center mx-auto mb-4">
          <Ship className="w-8 h-8 text-[#0B3D91]" />
        </div>
        <h1 className="text-2xl font-bold text-[#0B2447] mb-2">Peça acesso ao painel de gestor</h1>
        <p className="text-sm text-slate-500">
          Para anunciar embarcações e roteiros no Boatzy, a equipe precisa aprovar sua conta como gestor.
          Preencha os dados abaixo e você recebe a resposta por e-mail.
        </p>
      </div>

      {recusada && (
        <div className="mt-6 flex gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700">
              Seu pedido anterior não foi aprovado{recusada.decididoEm ? ` (${formatarData(recusada.decididoEm)})` : ''}.
            </p>
            {recusada.observacao && <p className="mt-1 text-red-700/90">Observação da equipe: {recusada.observacao}</p>}
            <p className="mt-1 text-red-700/80">Revise os dados e envie um novo pedido.</p>
          </div>
        </div>
      )}

      {/* Etapas */}
      <ol className="mt-6 grid grid-cols-2 gap-2" aria-label="Etapas do pedido">
        {PASSOS.map((p, i) => (
          <li key={p}>
            <button
              type="button"
              onClick={() => i < passo && setPasso(0)}
              disabled={i >= passo || enviando}
              aria-current={i === passo ? 'step' : undefined}
              className="w-full text-left disabled:cursor-default"
            >
              <span className={`block h-1.5 rounded-full ${i <= passo ? 'bg-[#0B2447]' : 'bg-slate-200'}`} />
              <span className={`mt-1.5 block text-xs font-semibold ${i === passo ? 'text-[#0B2447]' : 'text-slate-400'}`}>
                {i + 1}. {p}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <form onSubmit={enviar} className="mt-5 grid gap-4" noValidate>
        <div hidden={passo !== 0} className="grid gap-4">
          <div>
            <label htmlFor="sg-nome" className={label}>Nome completo</label>
            <input id="sg-nome" value={nome} onChange={(e) => setNome(e.target.value)} required
              maxLength={200} disabled={enviando} className={inputField} />
          </div>

          <div>
            <span className={label}>Celular</span>
            <PhoneInput onChange={setTelefone} initialE164={telefoneInicial || undefined}
              invalid={telefoneInvalido} disabled={enviando} />
          </div>

          <div>
            <label htmlFor="sg-documento" className={label}>CPF ou CNPJ</label>
            <input id="sg-documento" inputMode="numeric" value={documento}
              onChange={(e) => setDocumento(maskCpfCnpj(e.target.value))}
              placeholder="000.000.000-00" disabled={enviando}
              className={`${inputField} ${documentoInvalido ? 'border-red-300' : ''}`} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sg-estado" className={label}>Estado da embarcação</label>
              <select id="sg-estado" value={estadoId} onChange={(e) => trocarEstado(e.target.value)}
                disabled={enviando} className={inputField}>
                <option value="">Selecione</option>
                {estados.map((e) => <option key={e.id} value={e.id}>{e.nome} ({e.uf})</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="sg-municipio" className={label}>Cidade</label>
              <select id="sg-municipio" value={municipioId} onChange={(e) => setMunicipioId(e.target.value)}
                disabled={enviando || !estadoId || carregandoMunicipios} className={inputField}>
                <option value="">{carregandoMunicipios ? 'Carregando…' : 'Selecione'}</option>
                {municipios.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="sg-qtd" className={label}>Quantas embarcações você tem?</label>
            <input id="sg-qtd" type="number" min={1} max={999} value={qtd}
              onChange={(e) => setQtd(e.target.value)} disabled={enviando} className={inputField} />
          </div>

          <div>
            <label htmlFor="sg-mensagem" className={label}>Mensagem para a equipe (opcional)</label>
            <textarea id="sg-mensagem" rows={3} maxLength={1000} value={mensagem}
              onChange={(e) => setMensagem(e.target.value)} disabled={enviando}
              placeholder="Ex.: tipo de embarcação, passeios que você faz, site ou Instagram."
              className={inputField} />
          </div>
        </div>

        <div hidden={passo !== 1} className="grid gap-4">
          <div>
            <span className={label}>Quem vai conduzir a embarcação nos passeios?</span>
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
              <OpcaoConducao
                ativa={conducao === 'proprio'}
                onClick={() => { setConducao('proprio'); setErro(''); }}
                icone={IdCard}
                titulo="Eu mesmo conduzo"
                texto="Tenho habilitação náutica (Arrais, Mestre, Capitão-Amador…)."
                desabilitada={enviando}
              />
              <OpcaoConducao
                ativa={conducao === 'equipe'}
                onClick={() => { setConducao('equipe'); setErro(''); }}
                icone={UsersRound}
                titulo="Um marinheiro ou capitão"
                texto="Outra pessoa conduz — você a cadastra na Equipe depois da aprovação."
                desabilitada={enviando}
              />
            </div>
          </div>

          {conducao === 'proprio' && (
            <DocumentoEmbutido
              escopo="condutor"
              tipos={['cha', 'cir']}
              titulo="Sua habilitação náutica"
              descricao="A equipe Boatzy confere na análise do pedido. Depois, avisamos antes de vencer. Fica privada — nunca aparece no site."
              selo="obrigatorio"
              atual={habilitacaoAtual}
              valor={habilitacao}
              onChange={(r) => { setHabilitacao(r); setErro(''); }}
              pessoasConhecidas={nome.trim() ? [nome.trim()] : []}
              desabilitado={enviando}
              avisos={(nomeDiverge || cpfDiverge) && (
                <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {nomeDiverge && cpfDiverge
                      ? 'O nome e o CPF da carteira são diferentes dos seus dados.'
                      : nomeDiverge
                        ? `O nome na carteira (${nomeNaCarteira}) é diferente do informado na etapa 1.`
                        : 'O CPF da carteira é diferente do informado na etapa 1.'}{' '}
                    A habilitação precisa ser sua — se outra pessoa conduz, escolha “Um marinheiro ou capitão”.
                  </span>
                </p>
              )}
            />
          )}

          {conducao === 'equipe' && (
            <p className="flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Depois da aprovação, cadastre quem conduz em <strong>Equipe</strong>, com a CHA ou a CIR — acompanhamos a validade
                e avisamos antes de vencer. Se você também pilotar, pode enviar a sua habilitação por lá.
              </span>
            </p>
          )}
        </div>

        {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}

        {passo === 0 ? (
          <button type="submit" disabled={enviando}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#0B2447] hover:bg-[#0B3D91] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
            Continuar <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button type="button" onClick={() => { setErro(''); setPasso(0); }} disabled={enviando}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
              <ChevronLeft className="w-4 h-4" /> Voltar
            </button>
            <button type="submit" disabled={enviando}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-[#0B2447] hover:bg-[#0B3D91] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {progresso ?? 'Enviar pedido'}
            </button>
          </div>
        )}
      </form>

      <div className="mt-4 flex flex-col gap-3">
        <Link href="/"
          className="w-full text-center bg-slate-100 hover:bg-slate-200 text-[#0B2447] font-semibold py-3 rounded-xl transition-colors text-sm">
          Voltar ao site
        </Link>
        <SignOutLink redirectUrl="/painel/login" />
      </div>
    </Moldura>
  );
}

function OpcaoConducao({
  ativa, onClick, icone: Icone, titulo, texto, desabilitada,
}: { ativa: boolean; onClick: () => void; icone: typeof IdCard; titulo: string; texto: string; desabilitada: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={ativa}
      onClick={onClick}
      disabled={desabilitada}
      className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors disabled:opacity-60 ${
        ativa ? 'border-teal-500 bg-teal-50/50' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${ativa ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
        <Icone className="h-[18px] w-[18px]" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-slate-800">{titulo}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{texto}</span>
      </span>
    </button>
  );
}
