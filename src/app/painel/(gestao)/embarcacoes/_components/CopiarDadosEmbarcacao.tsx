'use client';

import { formatarComprimento } from '@/lib/comprimento';
import CopiarDeOutroCadastro, {
  GrupoResumo, LinhaResumo, ResumoLocalizacao, type OpcaoCopia,
} from '@/components/painel/CopiarDeOutroCadastro';
import {
  buscarDadosParaCopia,
  type DadosCopiaDetalhes,
  type DadosCopiaLocalizacao,
} from '../novo/actions';

export type EmbarcacaoCopiavel = OpcaoCopia;

type Props = { embarcacoes: EmbarcacaoCopiavel[] } & (
  | { etapa: 'detalhes'; onCopiar: (dados: DadosCopiaDetalhes) => void }
  | { etapa: 'localizacao'; onCopiar: (dados: DadosCopiaLocalizacao) => void }
);

/**
 * Etapas Detalhes e Localização do cadastro/edição de embarcação: copia os
 * dados SÓ da etapa a partir de outra embarcação do gestor, após confirmação
 * na modal (`CopiarDeOutroCadastro`).
 */
export default function CopiarDadosEmbarcacao(props: Props) {
  const comum = { opcoes: props.embarcacoes, rotuloSelect: 'Copiar de outra embarcação…' };

  if (props.etapa === 'detalhes') {
    return (
      <CopiarDeOutroCadastro<DadosCopiaDetalhes>
        {...comum}
        chamada="Tem outra embarcação parecida? Copie os detalhes dela para agilizar o cadastro."
        titulo="Copiar detalhes"
        buscar={async id => {
          const r = await buscarDadosParaCopia(id, 'detalhes');
          return r.ok && r.dados.etapa === 'detalhes' ? { ok: true, dados: r.dados } : { ok: false, error: r.ok ? 'Dados inválidos.' : r.error };
        }}
        resumo={d => <ResumoDetalhes d={d} />}
        onCopiar={props.onCopiar}
      />
    );
  }

  return (
    <CopiarDeOutroCadastro<DadosCopiaLocalizacao>
      {...comum}
      chamada="Esta embarcação fica no mesmo lugar de outra? Copie a localização dela."
      titulo="Copiar localização"
      buscar={async id => {
        const r = await buscarDadosParaCopia(id, 'localizacao');
        return r.ok && r.dados.etapa === 'localizacao' ? { ok: true, dados: r.dados } : { ok: false, error: r.ok ? 'Dados inválidos.' : r.error };
      }}
      resumo={d => <ResumoLocalizacao d={d} />}
      onCopiar={props.onCopiar}
    />
  );
}

function ResumoDetalhes({ d }: { d: DadosCopiaDetalhes }) {
  return (
    <div className="divide-y divide-slate-100">
      <dl className="pb-2">
        <LinhaResumo label="Capacidade" valor={d.capacidade && `${d.capacidade} ${d.capacidade === '1' ? 'pessoa' : 'pessoas'}`} />
        <LinhaResumo label="Tripulação" valor={d.tripulacao} />
        <LinhaResumo label="Comprimento" valor={formatarComprimento(d.comprimento, d.comprimento_unidade)} />
        <LinhaResumo label="Quartos" valor={d.quartos} />
        <LinhaResumo label="Banheiros" valor={d.banheiros} />
      </dl>
      <GrupoResumo titulo="Regras a bordo" itens={d.regras} />
      <GrupoResumo titulo="Equipamentos de segurança" itens={d.equipamentos.map(i => i.nome)} />
      <GrupoResumo titulo="Acessórios" itens={d.acessorios.map(i => i.nome)} />
      <GrupoResumo titulo="Comodidades" itens={d.comodidades.map(i => i.nome)} />
    </div>
  );
}
