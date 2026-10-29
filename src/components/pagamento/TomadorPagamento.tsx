'use client';

import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useTranslations } from 'next-intl';
import { Building2, FileText, Loader2, TriangleAlert, User, UserRound } from 'lucide-react';
import type { PagamentoTomadorTipo } from '@/types/supabase';
import { isValidCNPJ, isValidCPF, maskCEP, maskCNPJ, maskCPF, onlyDigits } from '@/lib/validators';
import {
  TOMADOR_VAZIO, UFS, documentoMascarado, maskTelefoneBR, type CampoTomador, type TomadorForm,
} from '@/lib/pagamentos/tomador';
import { consultarCnpjTomador } from '@/lib/pagamentos/actions-cliente';

/**
 * Em nome de quem sai o pagamento — comprovante e futura nota fiscal (SPEC §97).
 * Por padrão, o próprio cliente; "Alterar" abre outra pessoa (CPF, todos os
 * campos obrigatórios) ou empresa (CNPJ, preenchida pelo OpenCNPJ e editável).
 */
type Props = {
  /** Dados do cadastro do cliente (o padrão). */
  titular: { nome: string; documento: string | null };
  valor: TomadorForm;
  onChange: Dispatch<SetStateAction<TomadorForm>>;
  /** Campo recusado ao pagar (abre o painel e destaca o campo). */
  erroCampo: CampoTomador | null;
};

type Consulta =
  | { estado: 'ocioso' }
  | { estado: 'buscando' }
  | { estado: 'ok'; situacao: string | null; nomeFantasia: string | null }
  | { estado: 'erro'; motivo: 'invalido' | 'nao_encontrado' | 'limite' | 'indisponivel' };

const OPCOES: { tipo: PagamentoTomadorTipo; Icone: React.ElementType }[] = [
  { tipo: 'proprio', Icone: User },
  { tipo: 'cpf', Icone: UserRound },
  { tipo: 'cnpj', Icone: Building2 },
];

export default function TomadorPagamento({ titular, valor, onChange, erroCampo }: Props) {
  const t = useTranslations('Pagamento.tomador');
  const [aberto, setAberto] = useState(valor.tipo !== 'proprio');
  const [consulta, setConsulta] = useState<Consulta>(() =>
    valor.tipo === 'cnpj' && valor.nome ? { estado: 'ok', situacao: null, nomeFantasia: valor.nomeFantasia || null } : { estado: 'ocioso' },
  );
  const ultimoCnpj = useRef<string | null>(valor.tipo === 'cnpj' ? onlyDigits(valor.documento) : null);

  // Campo recusado ao pagar → reabre o painel (ajuste de estado no render, sem efeito).
  const [erroAnterior, setErroAnterior] = useState(erroCampo);
  if (erroCampo !== erroAnterior) {
    setErroAnterior(erroCampo);
    if (erroCampo) setAberto(true);
  }

  const set = (campo: keyof TomadorForm, v: string) => onChange((atual) => ({ ...atual, [campo]: v }));

  function escolher(tipo: PagamentoTomadorTipo) {
    if (tipo === valor.tipo) return;
    onChange({ ...TOMADOR_VAZIO, tipo });
    setConsulta({ estado: 'ocioso' });
    ultimoCnpj.current = null;
  }

  async function digitarCnpj(texto: string) {
    const mascarado = maskCNPJ(texto);
    set('documento', mascarado);
    const cnpj = onlyDigits(mascarado);
    if (cnpj.length < 14) {
      if (consulta.estado === 'erro') setConsulta({ estado: 'ocioso' });
      return;
    }
    if (!isValidCNPJ(cnpj)) {
      setConsulta({ estado: 'erro', motivo: 'invalido' });
      return;
    }
    if (ultimoCnpj.current === cnpj) return;
    ultimoCnpj.current = cnpj;
    setConsulta({ estado: 'buscando' });
    const r = await consultarCnpjTomador(cnpj);
    if (ultimoCnpj.current !== cnpj) return; // digitou outro CNPJ enquanto buscava
    if (!r.ok) {
      setConsulta({ estado: 'erro', motivo: r.motivo });
      return;
    }
    const d = r.dados;
    onChange((atual) => onlyDigits(atual.documento) !== cnpj ? atual : {
      ...atual,
      nome: d.razaoSocial,
      nomeFantasia: d.nomeFantasia ?? '',
      telefone: d.telefone ? maskTelefoneBR(d.telefone) : atual.telefone,
      cep: d.cep ? maskCEP(d.cep) : '',
      logradouro: d.logradouro ?? '',
      numero: d.numero ?? '',
      complemento: d.complemento ?? '',
      bairro: d.bairro ?? '',
      cidade: d.cidade ?? '',
      uf: d.uf ?? '',
    });
    setConsulta({ estado: 'ok', situacao: d.situacao, nomeFantasia: d.nomeFantasia });
  }

  const docTitular = documentoMascarado(titular.documento);
  const resumo = valor.tipo === 'proprio'
    ? [titular.nome, docTitular].filter(Boolean).join(' · ')
    : [valor.nome || t('aPreencher'), onlyDigits(valor.documento).length ? valor.documento : null].filter(Boolean).join(' · ');

  const cpfDigitado = onlyDigits(valor.documento);
  const cpfInvalido = valor.tipo === 'cpf' && cpfDigitado.length === 11 && !isValidCPF(cpfDigitado);
  const mostrarCamposCnpj = valor.tipo === 'cnpj' && (consulta.estado === 'ok' || (consulta.estado === 'erro' && consulta.motivo !== 'invalido'));
  const buscando = consulta.estado === 'buscando';

  return (
    <div className="rounded-xl border border-slate-200">
      <div className="flex items-start justify-between gap-3 p-3.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <FileText className="h-3.5 w-3.5 text-slate-400" /> {t('titulo')}
          </p>
          <p className="mt-0.5 text-sm text-slate-700 break-words">
            <span className="text-slate-400">{t('emNomeDe')}:</span> <span className="font-semibold">{resumo}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-marinho hover:bg-slate-50 transition-colors"
        >
          {aberto ? t('fechar') : t('alterar')}
        </button>
      </div>

      {aberto && (
        <div className="border-t border-slate-100 p-3.5 space-y-4">
          <p className="text-[11px] text-slate-500">{t('ajuda')}</p>
          <div className="grid grid-cols-3 gap-2">
            {OPCOES.map(({ tipo, Icone }) => {
              const ativo = valor.tipo === tipo;
              return (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => escolher(tipo)}
                  aria-pressed={ativo}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold text-center transition-colors ${
                    ativo ? 'border-marinho bg-marinho/5 text-marinho' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Icone className="h-4 w-4" />
                  {t(`opcoes.${tipo}`)}
                </button>
              );
            })}
          </div>

          {valor.tipo === 'proprio' && (
            <p className="text-xs text-slate-500">{t('proprioTexto')}</p>
          )}

          {valor.tipo === 'cnpj' && (
            <div className="space-y-3">
              <Campo rotulo={t('campos.cnpj')} erro={erroCampo === 'documento' || (consulta.estado === 'erro' && consulta.motivo === 'invalido')}>
                <div className="relative">
                  <input
                    inputMode="numeric"
                    autoComplete="off"
                    value={valor.documento}
                    onChange={(e) => digitarCnpj(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    className={classeInput(erroCampo === 'documento' || (consulta.estado === 'erro' && consulta.motivo === 'invalido'))}
                  />
                  {buscando && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />}
                </div>
              </Campo>
              {buscando && <p className="text-xs text-slate-500">{t('buscando')}</p>}
              {consulta.estado === 'erro' && (
                <p className={`text-xs ${consulta.motivo === 'invalido' ? 'text-red-600' : 'text-amber-700'}`}>{t(`consulta.${consulta.motivo}`)}</p>
              )}
              {consulta.estado === 'ok' && (
                <p className="text-xs text-turquesa-escuro">{t('encontrado')}</p>
              )}
              {consulta.estado === 'ok' && consulta.situacao && consulta.situacao.toLowerCase() !== 'ativa' && (
                <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-100 px-2.5 py-2 text-xs text-amber-800">
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {t('situacao', { situacao: consulta.situacao })}
                </p>
              )}
              {mostrarCamposCnpj && (
                <>
                  <Campo rotulo={t('campos.razaoSocial')} erro={erroCampo === 'nome'}>
                    <input value={valor.nome} onChange={(e) => set('nome', e.target.value)} className={classeInput(erroCampo === 'nome')} />
                    {valor.nomeFantasia && <span className="block mt-1 text-[11px] text-slate-400">{t('nomeFantasia', { nome: valor.nomeFantasia })}</span>}
                  </Campo>
                  <Endereco valor={valor} set={set} onChange={onChange} erroCampo={erroCampo} />
                  <Campo rotulo={t('campos.telefoneOpcional')} erro={erroCampo === 'telefone'}>
                    <input inputMode="tel" value={valor.telefone} onChange={(e) => set('telefone', maskTelefoneBR(e.target.value))}
                      placeholder="(00) 00000-0000" className={classeInput(erroCampo === 'telefone')} />
                  </Campo>
                </>
              )}
            </div>
          )}

          {valor.tipo === 'cpf' && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-500">{t('avisoCpf')}</p>
              <Campo rotulo={t('campos.nomeCompleto')} erro={erroCampo === 'nome'}>
                <input autoComplete="off" value={valor.nome} onChange={(e) => set('nome', e.target.value)} className={classeInput(erroCampo === 'nome')} />
              </Campo>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Campo rotulo={t('campos.cpf')} erro={erroCampo === 'documento' || cpfInvalido}>
                  <input inputMode="numeric" autoComplete="off" value={valor.documento} onChange={(e) => set('documento', maskCPF(e.target.value))}
                    placeholder="000.000.000-00" className={classeInput(erroCampo === 'documento' || cpfInvalido)} />
                  {cpfInvalido && <span className="block mt-1 text-[11px] text-red-600">{t('erros.cpf')}</span>}
                </Campo>
                <Campo rotulo={t('campos.telefone')} erro={erroCampo === 'telefone'}>
                  <input inputMode="tel" autoComplete="off" value={valor.telefone} onChange={(e) => set('telefone', maskTelefoneBR(e.target.value))}
                    placeholder="(00) 00000-0000" className={classeInput(erroCampo === 'telefone')} />
                </Campo>
              </div>
              <Endereco valor={valor} set={set} onChange={onChange} erroCampo={erroCampo} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Endereço do titular. Ao completar o CEP, preenche logradouro, bairro, cidade e UF pelo ViaCEP — o mesmo
 * serviço do endereço em Minha conta — e leva o cursor ao número. Tudo continua editável.
 */
function Endereco({ valor, set, onChange, erroCampo }: {
  valor: TomadorForm;
  set: (campo: keyof TomadorForm, v: string) => void;
  onChange: Dispatch<SetStateAction<TomadorForm>>;
  erroCampo: CampoTomador | null;
}) {
  const t = useTranslations('Pagamento.tomador.campos');
  const tCep = useTranslations('Pagamento.tomador.cep');
  const [cepEstado, setCepEstado] = useState<'ocioso' | 'buscando' | 'naoEncontrado' | 'erro'>('ocioso');
  const ultimoCep = useRef<string | null>(null);
  const numeroRef = useRef<HTMLInputElement>(null);

  async function digitarCep(texto: string) {
    const mascarado = maskCEP(texto);
    set('cep', mascarado);
    const cep = onlyDigits(mascarado);
    if (cep.length !== 8) {
      ultimoCep.current = null;
      setCepEstado('ocioso');
      return;
    }
    if (ultimoCep.current === cep) return;
    ultimoCep.current = cep;
    setCepEstado('buscando');
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as Record<string, string | boolean | undefined>;
      if (ultimoCep.current !== cep) return; // digitou outro CEP enquanto buscava
      if (data.erro) {
        setCepEstado('naoEncontrado');
        return;
      }
      const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
      const uf = texto(data.uf).toUpperCase();
      onChange((atual) => onlyDigits(atual.cep) !== cep ? atual : {
        ...atual,
        logradouro: texto(data.logradouro) || atual.logradouro,
        bairro: texto(data.bairro) || atual.bairro,
        cidade: texto(data.localidade) || atual.cidade,
        uf: (UFS as readonly string[]).includes(uf) ? uf : atual.uf,
      });
      setCepEstado('ocioso');
      if (texto(data.logradouro)) numeroRef.current?.focus();
    } catch {
      if (ultimoCep.current === cep) setCepEstado('erro');
    }
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <Campo rotulo={t('cep')} erro={erroCampo === 'cep'}>
          <div className="relative">
            <input inputMode="numeric" autoComplete="off" value={valor.cep} onChange={(e) => digitarCep(e.target.value)}
              placeholder="00000-000" className={classeInput(erroCampo === 'cep')} />
            {cepEstado === 'buscando' && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />}
          </div>
        </Campo>
        <div className="col-span-2">
          <Campo rotulo={t('logradouro')} erro={erroCampo === 'logradouro'}>
            <input autoComplete="off" value={valor.logradouro} onChange={(e) => set('logradouro', e.target.value)} className={classeInput(erroCampo === 'logradouro')} />
          </Campo>
        </div>
      </div>
      {(cepEstado === 'naoEncontrado' || cepEstado === 'erro') && (
        <p className="-mt-1 text-xs text-amber-700">{tCep(cepEstado)}</p>
      )}
      <div className="grid grid-cols-3 gap-3">
        <Campo rotulo={t('numero')} erro={erroCampo === 'numero'}>
          <input ref={numeroRef} autoComplete="off" value={valor.numero} onChange={(e) => set('numero', e.target.value)} className={classeInput(erroCampo === 'numero')} />
        </Campo>
        <div className="col-span-2">
          <Campo rotulo={t('complemento')} erro={false}>
            <input autoComplete="off" value={valor.complemento} onChange={(e) => set('complemento', e.target.value)} className={classeInput(false)} />
          </Campo>
        </div>
      </div>
      <Campo rotulo={t('bairro')} erro={erroCampo === 'bairro'}>
        <input autoComplete="off" value={valor.bairro} onChange={(e) => set('bairro', e.target.value)} className={classeInput(erroCampo === 'bairro')} />
      </Campo>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Campo rotulo={t('cidade')} erro={erroCampo === 'cidade'}>
            <input autoComplete="off" value={valor.cidade} onChange={(e) => set('cidade', e.target.value)} className={classeInput(erroCampo === 'cidade')} />
          </Campo>
        </div>
        <Campo rotulo={t('uf')} erro={erroCampo === 'uf'}>
          <select value={valor.uf} onChange={(e) => set('uf', e.target.value)} className={`${classeInput(erroCampo === 'uf')} bg-white cursor-pointer`}>
            <option value="">—</option>
            {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </Campo>
      </div>
    </>
  );
}

function Campo({ rotulo, erro, children }: { rotulo: string; erro: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={`text-xs font-semibold ${erro ? 'text-red-600' : 'text-slate-600'}`}>{rotulo}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function classeInput(erro: boolean): string {
  return `w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-marinho/20 ${
    erro ? 'border-red-300' : 'border-slate-200'
  }`;
}
