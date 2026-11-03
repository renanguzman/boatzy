'use client';

import { useState, useTransition } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Loader2, Pencil, ShieldCheck } from 'lucide-react';
import { formatarData } from '@/lib/datas';
import { maskCpfCnpj, onlyDigits } from '@/lib/validators';
import {
  BANCOS, ROTULO_TIPO_CONTA, TIPOS_CHAVE_PIX, nomeDoBanco, resumoDestino, validarRecebimento,
  type EntradaRecebimento, type ErrosRecebimento,
} from '@/lib/recebimento-tipos';
import type { Database, PixTipoChave, RecebimentoTipo, TipoConta } from '@/types/supabase';
import { salvarRecebimento } from '../actions';

type Recebimento = Database['public']['Tables']['gestor_recebimento']['Row'];

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none aria-[invalid=true]:border-red-400';
const labelCls = 'mb-1 block text-xs font-semibold text-slate-600';

type Props = {
  ativo: Recebimento | null;
  historico: Recebimento[];
  nomeDaConta: string;
  documentoDaConta: string | null;
};

function paraEntrada(r: Recebimento | null, nomeDaConta: string, documentoDaConta: string | null): EntradaRecebimento {
  return {
    tipo: r?.tipo ?? 'pix',
    pixTipoChave: r?.pix_tipo_chave ?? 'cpf',
    pixChave: r?.pix_chave ?? '',
    bancoCodigo: r?.banco_codigo ?? '',
    bancoNome: r?.banco_nome ?? '',
    agencia: r?.agencia ?? '',
    conta: r?.conta ?? '',
    contaDigito: r?.conta_digito ?? '',
    tipoConta: r?.tipo_conta ?? 'corrente',
    titularNome: r?.titular_nome ?? nomeDaConta,
    titularDocumento: r?.titular_documento ?? documentoDaConta ?? '',
  };
}

export default function RecebimentoForm({ ativo, historico, nomeDaConta, documentoDaConta }: Props) {
  const [editando, setEditando] = useState(!ativo);
  const [v, setV] = useState<EntradaRecebimento>(() => paraEntrada(ativo, nomeDaConta, documentoDaConta));
  const [erros, setErros] = useState<ErrosRecebimento>({});
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  const set = <K extends keyof EntradaRecebimento>(campo: K, valor: EntradaRecebimento[K]) => {
    setV((atual) => ({ ...atual, [campo]: valor }));
    setErros((e) => ({ ...e, [campo]: undefined }));
    setFeedback(null);
  };

  const documentoDiferente = !!documentoDaConta
    && onlyDigits(v.titularDocumento).length >= 11
    && onlyDigits(v.titularDocumento) !== onlyDigits(documentoDaConta);

  function salvar() {
    const r = validarRecebimento(v);
    if (!r.ok) {
      setErros(r.erros);
      setFeedback({ tipo: 'erro', texto: 'Confira os campos destacados.' });
      return;
    }
    setErros({});
    setFeedback(null);
    iniciar(async () => {
      const res = await salvarRecebimento(v);
      if (!res.ok) {
        setErros(res.campos ?? {});
        setFeedback({ tipo: 'erro', texto: res.error });
        return;
      }
      setFeedback({ tipo: 'ok', texto: res.alterado ? 'Dados salvos. A equipe Boatzy foi avisada.' : 'Nenhuma alteração.' });
      setEditando(false);
    });
  }

  function cancelar() {
    setV(paraEntrada(ativo, nomeDaConta, documentoDaConta));
    setErros({});
    setFeedback(null);
    setEditando(false);
  }

  return (
    <div className="space-y-5">
      {!ativo && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Falta pouco para você receber.</strong> Informe sua chave Pix ou uma conta bancária. Os repasses só são
            feitos para quem tem os dados de recebimento cadastrados.
          </p>
        </div>
      )}

      {ativo && !editando && (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Destino atual</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-[#0B2447]">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                <span className="break-words">{resumoDestino(ativo)}</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Titular: {ativo.titular_nome} · {maskCpfCnpj(ativo.titular_documento)}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">Cadastrado em {formatarData(ativo.criado_em)}</p>
            </div>
            <button
              type="button"
              onClick={() => { setEditando(true); setFeedback(null); }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Pencil className="h-3.5 w-3.5" /> Alterar
            </button>
          </div>
        </section>
      )}

      {feedback && !editando && (
        <p role="status" className="flex items-center gap-2 text-sm font-medium text-emerald-700">
          <CheckCircle className="h-4 w-4" /> {feedback.texto}
        </p>
      )}

      {editando && (
        <section className="space-y-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-slate-600">Como você quer receber?</legend>
            <div className="grid grid-cols-2 gap-2">
              {([['pix', 'Chave Pix'], ['conta', 'Conta bancária']] as [RecebimentoTipo, string][]).map(([valor, rotulo]) => (
                <label
                  key={valor}
                  className={`cursor-pointer rounded-xl border px-4 py-3 text-center text-sm font-semibold transition-colors ${
                    v.tipo === valor ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input type="radio" name="tipo" value={valor} checked={v.tipo === valor} onChange={() => set('tipo', valor)} className="sr-only" />
                  {rotulo}
                </label>
              ))}
            </div>
          </fieldset>

          {v.tipo === 'pix' ? (
            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              <div>
                <label htmlFor="pix-tipo" className={labelCls}>Tipo da chave</label>
                <select
                  id="pix-tipo"
                  value={v.pixTipoChave}
                  onChange={(e) => { set('pixTipoChave', e.target.value as PixTipoChave); set('pixChave', ''); }}
                  className={inputCls}
                >
                  {TIPOS_CHAVE_PIX.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="pix-chave" className={labelCls}>Chave Pix</label>
                <input
                  id="pix-chave"
                  value={v.pixChave}
                  onChange={(e) => set('pixChave', v.pixTipoChave === 'cpf' || v.pixTipoChave === 'cnpj' ? maskCpfCnpj(e.target.value) : e.target.value)}
                  placeholder={TIPOS_CHAVE_PIX.find((t) => t.valor === v.pixTipoChave)?.dica}
                  aria-invalid={!!erros.pixChave}
                  autoComplete="off"
                  className={inputCls}
                />
                {erros.pixChave && <p className="mt-1 text-xs text-red-600">{erros.pixChave}</p>}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-6">
              <div className="sm:col-span-2">
                <label htmlFor="banco-codigo" className={labelCls}>Banco</label>
                <input
                  id="banco-codigo"
                  list="bancos"
                  value={v.bancoCodigo}
                  onChange={(e) => {
                    const codigo = onlyDigits(e.target.value).slice(0, 3);
                    set('bancoCodigo', codigo);
                    const conhecido = nomeDoBanco(codigo);
                    if (conhecido) set('bancoNome', conhecido);
                  }}
                  placeholder="Código (ex.: 260)"
                  inputMode="numeric"
                  aria-invalid={!!erros.bancoCodigo}
                  className={inputCls}
                />
                <datalist id="bancos">
                  {BANCOS.map((b) => <option key={b.codigo} value={b.codigo}>{b.nome}</option>)}
                </datalist>
                {erros.bancoCodigo && <p className="mt-1 text-xs text-red-600">{erros.bancoCodigo}</p>}
              </div>
              <div className="sm:col-span-4">
                <label htmlFor="banco-nome" className={labelCls}>Nome do banco</label>
                <input
                  id="banco-nome"
                  value={nomeDoBanco(v.bancoCodigo) ?? v.bancoNome}
                  onChange={(e) => set('bancoNome', e.target.value)}
                  readOnly={!!nomeDoBanco(v.bancoCodigo)}
                  aria-invalid={!!erros.bancoNome}
                  className={`${inputCls} read-only:bg-slate-50`}
                />
                {erros.bancoNome && <p className="mt-1 text-xs text-red-600">{erros.bancoNome}</p>}
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="agencia" className={labelCls}>Agência</label>
                <input id="agencia" value={v.agencia} onChange={(e) => set('agencia', onlyDigits(e.target.value).slice(0, 6))} inputMode="numeric" aria-invalid={!!erros.agencia} className={inputCls} />
                {erros.agencia && <p className="mt-1 text-xs text-red-600">{erros.agencia}</p>}
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="conta" className={labelCls}>Conta</label>
                <input id="conta" value={v.conta} onChange={(e) => set('conta', onlyDigits(e.target.value).slice(0, 12))} inputMode="numeric" aria-invalid={!!erros.conta} className={inputCls} />
                {erros.conta && <p className="mt-1 text-xs text-red-600">{erros.conta}</p>}
              </div>
              <div className="sm:col-span-1">
                <label htmlFor="conta-digito" className={labelCls}>Dígito</label>
                <input id="conta-digito" value={v.contaDigito} onChange={(e) => set('contaDigito', e.target.value.slice(0, 1))} aria-invalid={!!erros.contaDigito} className={inputCls} />
              </div>
              <div className="sm:col-span-6">
                <label htmlFor="tipo-conta" className={labelCls}>Tipo de conta</label>
                <select id="tipo-conta" value={v.tipoConta} onChange={(e) => set('tipoConta', e.target.value as TipoConta)} className={inputCls}>
                  {(Object.keys(ROTULO_TIPO_CONTA) as TipoConta[]).map((t) => <option key={t} value={t}>{ROTULO_TIPO_CONTA[t]}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="titular-nome" className={labelCls}>Nome do titular</label>
              <input id="titular-nome" value={v.titularNome} onChange={(e) => set('titularNome', e.target.value)} aria-invalid={!!erros.titularNome} className={inputCls} />
              {erros.titularNome && <p className="mt-1 text-xs text-red-600">{erros.titularNome}</p>}
            </div>
            <div>
              <label htmlFor="titular-doc" className={labelCls}>CPF ou CNPJ do titular</label>
              <input
                id="titular-doc"
                value={maskCpfCnpj(v.titularDocumento)}
                onChange={(e) => set('titularDocumento', onlyDigits(e.target.value).slice(0, 14))}
                inputMode="numeric"
                aria-invalid={!!erros.titularDocumento}
                className={inputCls}
              />
              {erros.titularDocumento && <p className="mt-1 text-xs text-red-600">{erros.titularDocumento}</p>}
            </div>
          </div>

          {documentoDiferente && (
            <p role="alert" className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              O documento do titular é diferente do cadastrado na sua conta. Se for de outra pessoa ou empresa, a equipe Boatzy pode
              pedir uma confirmação antes do repasse.
            </p>
          )}

          <p className="flex items-start gap-2 text-xs text-slate-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-500" />
            Use uma chave ou conta em seu nome (ou da sua empresa). A equipe Boatzy é avisada a cada alteração, e o histórico fica guardado.
          </p>

          {feedback?.tipo === 'erro' && (
            <p role="alert" className="flex items-center gap-2 text-sm font-medium text-red-600">
              <AlertCircle className="h-4 w-4" /> {feedback.texto}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {ativo && (
              <button type="button" onClick={cancelar} disabled={pendente} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                Cancelar
              </button>
            )}
            <button
              type="button"
              onClick={salvar}
              disabled={pendente}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0B3D91] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0B2447] disabled:opacity-60"
            >
              {pendente && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar dados de recebimento
            </button>
          </div>
        </section>
      )}

      {historico.length > 0 && (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Destinos anteriores</p>
          <ul className="mt-2 divide-y divide-slate-100">
            {historico.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs text-slate-500">
                <span className="break-words">{resumoDestino(h, true)}</span>
                <span className="text-slate-400">desde {formatarData(h.criado_em)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
