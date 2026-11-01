'use client';

import { AlertCircle, Check, CheckCircle2, Info, RefreshCw, Sparkles } from 'lucide-react';
import { formatarData } from '@/lib/datas';
import { isValidCPF, maskCPF, onlyDigits } from '@/lib/validators';
import { CATEGORIAS_CHA, TIPOS_DOCUMENTO, normalizarCategorias, type DadosDocumento } from '@/lib/documentos/tipos';
import { diasParaVencer, situacaoValidade, textoPrazo } from '@/lib/documentos/validade';
import { somarAnos, type CampoLido, type CamposDocumento, type ExtraCondutor } from '@/lib/documentos/rascunho';
import type { DocumentoEscopo, DocumentoTipo } from '@/types/supabase';

/**
 * Peças da conferência de documento (SPEC §95.6 e §95.10), usadas pelo envio do menu
 * Documentos (`DocumentoWizard`) e pelos documentos embutidos nos cadastros
 * (`DocumentoEmbutido`): campos com o selo "lido do documento", situação da
 * validade e avisos.
 */

export const inputDocumentoCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none';

export function Campo({
  rotulo, obrigatorio = false, lido = false, ajuda, className = '', children,
}: { rotulo: string; obrigatorio?: boolean; lido?: boolean; ajuda?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
        <span>
          {rotulo} {obrigatorio && <span className="text-red-500">*</span>}
        </span>
        {lido && (
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
            <Sparkles className="h-3 w-3" /> lido do documento
          </span>
        )}
      </label>
      {children}
      {ajuda && <p className="mt-1 text-xs text-slate-400">{ajuda}</p>}
    </div>
  );
}

export function MensagemErro({ texto }: { texto: string }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {texto}
    </p>
  );
}

export function AvisoSubstituicao({ sigla, validade }: { sigla: string; validade: string | null }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5 text-sm text-sky-900">
      <RefreshCw className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Este envio substitui o {sigla} atual{validade ? ` (válido até ${formatarData(validade)})` : ''}. O anterior fica guardado no histórico.
      </span>
    </p>
  );
}

/**
 * Situação da validade digitada/lida, com as mesmas regras do painel (SPEC §95.3): vencido,
 * vence em breve (≤ 60 dias) ou em dia. Confere também validade × emissão: além do prazo
 * usual do tipo, a data provavelmente foi mal lida.
 */
export function SituacaoDaValidade({
  validade, emissao, anos, sigla,
}: { validade: string; emissao: string; anos: number | null; sigla: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validade)) return null;
  const situacao = situacaoValidade(validade);
  const prazo = textoPrazo(validade);
  const alemDoPrazo = !!anos && /^\d{4}-\d{2}-\d{2}$/.test(emissao) && validade > somarAnos(emissao, anos);

  return (
    <div className="mt-1.5 space-y-1.5">
      {situacao === 'vencido' ? (
        <p className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Vencido</strong> — {prazo}. Você pode salvar para acompanhar, mas ele aparecerá como vencido no painel até ser
            renovado.
            {sigla === 'CHA' && diasParaVencer(validade) < -5 * 365 && (
              <> Vencida há mais de 5 anos, a renovação exige refazer a prova na Capitania.</>
            )}
          </span>
        </p>
      ) : situacao === 'vence_em_breve' ? (
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Vence em breve</strong> — {prazo}. Já vale pedir a renovação.
          </span>
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Em dia — válido até {formatarData(validade)}.
        </p>
      )}
      {alemDoPrazo && (
        <p className="text-xs text-amber-700">
          Confira a data: o {sigla} costuma valer {anos} {anos === 1 ? 'ano' : 'anos'} a partir da emissão (até{' '}
          {formatarData(somarAnos(emissao, anos!))}).
        </p>
      )}
    </div>
  );
}

/**
 * Campos do documento para conferir/editar. A grade se ajusta à largura de onde está
 * (container query): duas colunas no wizard e no cadastro, uma no celular.
 */
export function CamposConferencia({
  tipo, escopo, campos, dados, lidos, onCampo, onExtra, placeholderEmbarcacao,
}: {
  tipo: DocumentoTipo;
  escopo: DocumentoEscopo;
  campos: CamposDocumento;
  dados: DadosDocumento;
  lidos: ReadonlySet<CampoLido>;
  onCampo: (k: keyof CamposDocumento, v: string) => void;
  onExtra: (k: ExtraCondutor, v: string) => void;
  placeholderEmbarcacao?: string;
}) {
  const info = TIPOS_DOCUMENTO[tipo];

  function alternarCategoria(valor: string) {
    const atuais = new Set(campos.categoria.split(',').filter(Boolean));
    const cat = CATEGORIAS_CHA.find((c) => c.valor === valor);
    if (atuais.has(valor)) atuais.delete(valor);
    else {
      // Arrais, Mestre e Capitão-Amador são excludentes; Motonauta e Veleiro somam.
      if (cat?.amador) CATEGORIAS_CHA.filter((c) => c.amador).forEach((c) => atuais.delete(c.valor));
      atuais.add(valor);
    }
    onCampo('categoria', normalizarCategorias([...atuais].join(',')) ?? '');
  }

  return (
    <div className="@container space-y-4">
      <div className="grid gap-4 @min-[30rem]:grid-cols-2">
        {info.temTitulo && (
          <Campo rotulo="Nome do documento" obrigatorio className="@min-[30rem]:col-span-2">
            <input className={inputDocumentoCls} value={campos.titulo} onChange={(e) => onCampo('titulo', e.target.value)} placeholder="Ex.: Vistoria anual" />
          </Campo>
        )}
        <Campo rotulo={info.rotuloNumero} lido={lidos.has('numero')}>
          <input className={inputDocumentoCls} value={campos.numero} onChange={(e) => onCampo('numero', e.target.value.toUpperCase())} />
        </Campo>
        <Campo rotulo={info.rotuloTitular} lido={lidos.has('titular')}>
          <input className={inputDocumentoCls} value={campos.titular} onChange={(e) => onCampo('titular', e.target.value)} />
        </Campo>
        {escopo === 'condutor' && (
          <Campo
            rotulo="CPF do condutor"
            lido={lidos.has('cpf')}
            ajuda={onlyDigits(campos.cpf).length === 11 && !isValidCPF(campos.cpf) ? 'CPF inválido — confira os números.' : undefined}
          >
            <input
              className={inputDocumentoCls}
              value={campos.cpf}
              onChange={(e) => onCampo('cpf', maskCPF(e.target.value))}
              placeholder="000.000.000-00"
              inputMode="numeric"
            />
          </Campo>
        )}
        {escopo === 'embarcacao' && (
          <Campo rotulo="Nome da embarcação no documento" lido={lidos.has('embarcacaoNome')}>
            <input
              className={inputDocumentoCls}
              value={campos.embarcacaoNome}
              onChange={(e) => onCampo('embarcacaoNome', e.target.value)}
              placeholder={placeholderEmbarcacao}
            />
          </Campo>
        )}
        {info.temCategoria && (
          <Campo
            rotulo="Categoria"
            lido={lidos.has('categoria')}
            className="@min-[30rem]:col-span-2"
            ajuda="Marque todas as da carteira — ex.: Mestre-Amador e Motonauta."
          >
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS_CHA.map((c) => {
                const marcada = campos.categoria.split(',').includes(c.valor);
                return (
                  <button
                    key={c.valor}
                    type="button"
                    aria-pressed={marcada}
                    onClick={() => alternarCategoria(c.valor)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      marcada ? 'border-teal-400 bg-teal-50 font-semibold text-teal-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {marcada && <Check className="h-3.5 w-3.5" />} {c.rotulo}
                  </button>
                );
              })}
            </div>
          </Campo>
        )}
        <Campo rotulo="Data de emissão" lido={lidos.has('dataEmissao')}>
          <input type="date" className={inputDocumentoCls} value={campos.dataEmissao} onChange={(e) => onCampo('dataEmissao', e.target.value)} />
        </Campo>
        <Campo
          rotulo="Validade"
          obrigatorio={info.validadeAnos != null}
          lido={lidos.has('dataValidade')}
          ajuda={
            info.validadeAnos
              ? `O ${info.sigla} costuma valer ${info.validadeAnos} ${info.validadeAnos === 1 ? 'ano' : 'anos'}.`
              : 'Opcional — sem validade, não geramos avisos.'
          }
        >
          <input type="date" className={inputDocumentoCls} value={campos.dataValidade} onChange={(e) => onCampo('dataValidade', e.target.value)} />
          <SituacaoDaValidade validade={campos.dataValidade} emissao={campos.dataEmissao} anos={info.validadeAnos} sigla={info.sigla} />
          {!campos.dataValidade && campos.dataEmissao && info.validadeAnos && (
            <button
              type="button"
              onClick={() => onCampo('dataValidade', somarAnos(campos.dataEmissao, info.validadeAnos!))}
              className="mt-1 text-xs font-semibold text-teal-700 hover:underline"
            >
              Usar emissão + {info.validadeAnos} {info.validadeAnos === 1 ? 'ano' : 'anos'}
            </button>
          )}
        </Campo>
      </div>

      {escopo === 'condutor' && (
        <div className="grid gap-4 @min-[30rem]:grid-cols-2">
          <Campo rotulo="Limites da navegação" lido={lidos.has('limites_navegacao')} ajuda="Opcional — como está no verso da carteira.">
            <input
              className={inputDocumentoCls}
              value={dados.limites_navegacao ?? ''}
              onChange={(e) => onExtra('limites_navegacao', e.target.value)}
              placeholder="Ex.: Costeira"
              maxLength={120}
            />
          </Campo>
          <Campo rotulo="Órgão emissor" lido={lidos.has('orgao_emissor')} ajuda="Opcional.">
            <input
              className={inputDocumentoCls}
              value={dados.orgao_emissor ?? ''}
              onChange={(e) => onExtra('orgao_emissor', e.target.value)}
              placeholder="Ex.: Capitania dos Portos de Santa Catarina"
              maxLength={80}
            />
          </Campo>
        </div>
      )}

      {escopo === 'embarcacao' && (dados.tipo_embarcacao || dados.area_navegacao || dados.atividade) && (
        <p className="text-xs text-slate-500">
          Também lemos:{' '}
          <span className="font-medium text-slate-700">
            {[dados.tipo_embarcacao, dados.area_navegacao, dados.atividade].filter(Boolean).join(' · ')}
          </span>
        </p>
      )}
    </div>
  );
}
