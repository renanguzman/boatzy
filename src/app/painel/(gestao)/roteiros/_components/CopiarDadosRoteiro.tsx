'use client';

import { Info } from 'lucide-react';
import CopiarDeOutroCadastro, {
  GrupoResumo, LinhaResumo, ResumoLocalizacao, type OpcaoCopia,
} from '@/components/painel/CopiarDeOutroCadastro';
import { compactarAjustes, type RegraFormulario } from '@/lib/precos-calendario';
import { formatarData } from '@/lib/datas';
import {
  buscarDadosRoteiroParaCopia,
  type DadosCopiaRoteiroLocalizacao,
  type DadosCopiaRoteiroPreco,
} from '../novo/actions';

export type RoteiroCopiavel = OpcaoCopia;

type Props = { roteiros: RoteiroCopiavel[] } & (
  | { etapa: 'localizacao'; onCopiar: (dados: DadosCopiaRoteiroLocalizacao) => void }
  | { etapa: 'preco'; onCopiar: (dados: DadosCopiaRoteiroPreco) => void }
);

/**
 * Etapas Localização e Preço e disponibilidade do cadastro/edição de roteiro:
 * copia os dados SÓ da etapa a partir de outro roteiro do gestor, após
 * confirmação na modal (`CopiarDeOutroCadastro`).
 */
export default function CopiarDadosRoteiro(props: Props) {
  const comum = { opcoes: props.roteiros, rotuloSelect: 'Copiar de outro roteiro…' };

  if (props.etapa === 'localizacao') {
    return (
      <CopiarDeOutroCadastro<DadosCopiaRoteiroLocalizacao>
        {...comum}
        chamada="Este roteiro sai do mesmo lugar de outro? Copie a localização de partida dele."
        titulo="Copiar localização"
        buscar={async id => {
          const r = await buscarDadosRoteiroParaCopia(id, 'localizacao');
          return r.ok && r.dados.etapa === 'localizacao' ? { ok: true, dados: r.dados } : { ok: false, error: r.ok ? 'Dados inválidos.' : r.error };
        }}
        resumo={d => <ResumoLocalizacao d={d} />}
        onCopiar={props.onCopiar}
      />
    );
  }

  return (
    <CopiarDeOutroCadastro<DadosCopiaRoteiroPreco>
      {...comum}
      chamada="Os preços e a agenda são parecidos com os de outro roteiro? Copie e depois ajuste o que precisar."
      titulo="Copiar preço e disponibilidade"
      buscar={async id => {
        const r = await buscarDadosRoteiroParaCopia(id, 'preco');
        return r.ok && r.dados.etapa === 'preco' ? { ok: true, dados: r.dados } : { ok: false, error: r.ok ? 'Dados inválidos.' : r.error };
      }}
      resumo={d => <ResumoPreco d={d} />}
      onCopiar={props.onCopiar}
    />
  );
}

// ─── Resumo da etapa Preço e disponibilidade ──────────────────────────────────

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function reais(v: string): string | null {
  const n = parseFloat(v);
  return n > 0 ? brl(n) : null;
}

/** "Sex, Sáb e Dom" / "Todos os dias" — semana começando na segunda (igual à EtapaPreco). */
function descreverDias(dias: number[]): string {
  if (dias.length === 0 || dias.length === 7) return 'Todos os dias';
  const ordem = [1, 2, 3, 4, 5, 6, 0].filter(d => dias.includes(d)).map(d => DIAS[d]);
  return ordem.length === 1 ? ordem[0] : `${ordem.slice(0, -1).join(', ')} e ${ordem[ordem.length - 1]}`;
}

function descreverRegra(r: RegraFormulario): string {
  const valor = reais(r.valor) ?? '—';
  if (r.tipo === 'dia_semana') return `${r.nome} · ${descreverDias(r.diasSemana)} · ${valor}`;
  const d = (dia: number, mes: number) => `${String(dia).padStart(2, '0')}/${MESES[mes - 1]}`;
  return `${r.nome} · ${d(r.periodoDiaInicio, r.periodoMesInicio)} → ${d(r.periodoDiaFim, r.periodoMesFim)} · ${valor}`;
}

/** Datas seguidas viram um intervalo: "24/12/2026 a 26/12/2026". */
function intervalos(datas: string[]): string[] {
  const mapa = Object.fromEntries(datas.map(d => [d, 0]));
  return compactarAjustes(mapa).map(g =>
    g.inicio === g.fim ? formatarData(g.inicio) : `${formatarData(g.inicio)} a ${formatarData(g.fim)}`);
}

function ResumoPreco({ d }: { d: DadosCopiaRoteiroPreco }) {
  const minimo = parseInt(d.preco_diaria_minimo) || 1;
  const diaria = d.preco_diaria_ativo
    ? `Por diária: ${reais(d.preco_diaria_valor) ?? 'sem valor'}${minimo > 1 ? ` · mín. ${minimo} diárias` : ''}`
    : null;
  const datasEspecificas = compactarAjustes(d.ajustes).map(g =>
    `${g.inicio === g.fim ? formatarData(g.inicio) : `${formatarData(g.inicio)} a ${formatarData(g.fim)}`} · ${brl(g.valor)}`);
  const fechados = intervalos(Object.keys(d.diasRoteiro).filter(k => !d.diasRoteiro[k]));
  const abertos = intervalos(Object.keys(d.diasRoteiro).filter(k => d.diasRoteiro[k]));

  return (
    <div className="divide-y divide-slate-100">
      <dl className="pb-2">
        <LinhaResumo label="Como o cliente paga" valor={['Roteiro (diária única)', diaria].filter(Boolean).join(' + ')} />
        <LinhaResumo label="Preço padrão por dia" valor={reais(d.preco_base)} />
        <LinhaResumo label="Dias de operação" valor={descreverDias(d.disponibilidade_dias_semana)} />
        <LinhaResumo label="Abrir reservas para"
          valor={d.janela_reserva_meses === 12 ? 'O próximo ano' : `Os próximos ${d.janela_reserva_meses} meses`} />
      </dl>
      <GrupoResumo titulo="Preços especiais" itens={d.regras.map(descreverRegra)} vazio="Nenhum" />
      <GrupoResumo titulo="Datas específicas" itens={datasEspecificas} vazio="Nenhuma" />
      <GrupoResumo titulo="Dias fechados" itens={fechados} vazio="Nenhum" />
      <GrupoResumo titulo="Dias abertos fora da operação" itens={abertos} vazio="Nenhum" />
      <p className="flex items-start gap-2 pt-3 text-xs leading-snug text-slate-500">
        <Info className="mt-px h-3.5 w-3.5 shrink-0 text-slate-400" />
        Datas específicas e dias abertos/fechados são copiados de hoje em diante. Os dias com a
        embarcação fechada não são copiados — eles valem para a embarcação, não para o roteiro.
      </p>
    </div>
  );
}
