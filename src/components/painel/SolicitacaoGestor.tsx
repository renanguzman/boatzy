'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Ship, Hourglass, AlertCircle, Loader2, Send } from 'lucide-react';
import PhoneInput, { type PhoneValue } from '@/components/auth/PhoneInput';
import SignOutLink from '@/components/painel/SignOutLink';
import { getMunicipiosByEstado } from '@/lib/conta-actions';
import { solicitarAcessoGestor } from '@/lib/solicitacao-gestor-actions';
import { isValidCpfOuCnpj, maskCpfCnpj } from '@/lib/validators';
import { formatarData } from '@/lib/datas';
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
};

const inputField =
  'w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3D91]/20 focus:border-[#0B3D91] transition-all disabled:cursor-not-allowed disabled:opacity-60';
const label = 'mb-2 block text-xs font-bold uppercase tracking-wider text-[#0B2447]';

/**
 * Tela do /painel para quem ainda não tem o papel de gestor (SPEC §62):
 * pedido em análise, pedido recusado (com a observação da equipe) ou o
 * formulário para pedir acesso. O papel só vem com a aprovação do admin.
 */
export default function SolicitacaoGestor({ estados, municipiosIniciais, perfil, ultima }: Props) {
  if (ultima?.status === 'pendente') return <EmAnalise solicitacao={ultima} />;
  return (
    <Formulario
      estados={estados}
      municipiosIniciais={municipiosIniciais}
      perfil={perfil}
      recusada={ultima?.status === 'recusada' ? ultima : null}
    />
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#F8F9FB] flex flex-col items-center justify-center px-4 py-10">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8 max-w-lg w-full">
        {children}
      </div>
    </div>
  );
}

function EmAnalise({ solicitacao }: { solicitacao: SolicitacaoGestorResumo }) {
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

function Formulario({ estados, municipiosIniciais, perfil, recusada }: {
  estados: Estado[];
  municipiosIniciais: Municipio[];
  perfil: Props['perfil'];
  recusada: SolicitacaoGestorResumo | null;
}) {
  const router = useRouter();
  const [enviando, startEnvio] = useTransition();

  const telefoneInicial = recusada?.telefone ?? perfil.telefone ?? '';
  const [nome, setNome] = useState(recusada?.nome ?? perfil.nome);
  const [telefone, setTelefone] = useState<PhoneValue>({ e164: telefoneInicial, valid: true });
  const [documento, setDocumento] = useState(maskCpfCnpj(recusada?.documento ?? perfil.documento ?? ''));
  const [estadoId, setEstadoId] = useState(recusada ? String(recusada.estadoId) : '');
  const [municipioId, setMunicipioId] = useState(recusada ? String(recusada.municipioId) : '');
  const [municipios, setMunicipios] = useState<Municipio[]>(municipiosIniciais);
  const [carregandoMunicipios, setCarregandoMunicipios] = useState(false);
  const [qtd, setQtd] = useState(recusada ? String(recusada.qtdEmbarcacoes) : '1');
  const [mensagem, setMensagem] = useState('');
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

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setTentou(true);
    setErro('');
    if (!telefone.e164 || !telefone.valid) return setErro('Informe um celular válido.');
    if (!isValidCpfOuCnpj(documento)) return setErro('Informe um CPF ou CNPJ válido.');
    if (!estadoId || !municipioId) return setErro('Escolha o estado e a cidade onde fica a embarcação.');

    startEnvio(async () => {
      const r = await solicitarAcessoGestor({
        nome,
        telefone: telefone.e164,
        documento,
        estadoId: parseInt(estadoId, 10),
        municipioId: parseInt(municipioId, 10),
        qtdEmbarcacoes: parseInt(qtd, 10) || 0,
        mensagem,
      });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Moldura>
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

      <form onSubmit={enviar} className="mt-6 grid gap-4" noValidate>
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

        {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}

        <button type="submit" disabled={enviando}
          className="w-full inline-flex items-center justify-center gap-2 bg-[#0B2447] hover:bg-[#0B3D91] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Enviar pedido
        </button>
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
