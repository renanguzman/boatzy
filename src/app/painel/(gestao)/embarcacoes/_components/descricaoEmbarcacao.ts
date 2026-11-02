import { formatarComprimento } from '@/lib/comprimento';
import type { FatoDescricao } from '@/lib/descricao/assistente';

type Item = { id: string; nome: string };

/**
 * Fatos do cadastro da embarcação para o assistente de descrição (SPEC §98) — só o que já
 * foi preenchido, com rótulos legíveis. Mesmo cálculo no cadastro e na edição.
 */
export function fatosEmbarcacao(a: {
  form: {
    nome: string; embarcacao_tipo_id: string; capacidade: string; tripulacao: string;
    comprimento: string; comprimento_unidade: string; quartos: string; banheiros: string;
    estado_id: string; municipio_id: string; bairro: string;
  };
  tipos: Item[];
  estados: { id: number; uf: string }[];
  municipios: { id: number; nome: string }[];
  comodidades: Item[]; comodidadesSelecionadas: string[];
  equipamentos: Item[]; equipamentosSelecionados: string[];
  acessorios: Item[]; acessoriosSelecionados: string[];
  regras: string[];
}): FatoDescricao[] {
  const { form } = a;
  const nomes = (lista: Item[], ids: string[]) => lista.filter((i) => ids.includes(i.id)).map((i) => i.nome).join(', ');
  const municipio = a.municipios.find((m) => String(m.id) === form.municipio_id)?.nome;
  const uf = a.estados.find((e) => String(e.id) === form.estado_id)?.uf;
  const fatos: [string, string | null | undefined][] = [
    ['Nome', form.nome.trim()],
    ['Tipo', a.tipos.find((t) => t.id === form.embarcacao_tipo_id)?.nome],
    ['Condução', 'Sempre com capitão — o passeio é conduzido pela tripulação'],
    ['Capacidade', form.capacidade && `${form.capacidade} pessoas`],
    ['Tripulação', form.tripulacao && `${form.tripulacao} pessoa(s)`],
    ['Comprimento', formatarComprimento(form.comprimento, form.comprimento_unidade)],
    ['Quartos', form.quartos],
    ['Banheiros', form.banheiros],
    ['Comodidades', nomes(a.comodidades, a.comodidadesSelecionadas)],
    ['Acessórios', nomes(a.acessorios, a.acessoriosSelecionados)],
    ['Equipamentos de segurança', nomes(a.equipamentos, a.equipamentosSelecionados)],
    ['Regras a bordo', a.regras.filter(Boolean).join('; ')],
    ['Local', [form.bairro.trim(), municipio && (uf ? `${municipio}/${uf}` : municipio)].filter(Boolean).join(', ')],
  ];
  return fatos.filter((f): f is [string, string] => !!f[1]).map(([rotulo, valor]) => ({ rotulo, valor }));
}

/** O texto fica mais completo com os Detalhes preenchidos (a descrição fica no fim da mesma etapa). */
export function avisoDescricaoEmbarcacao(f: { capacidade: string }, comodidadesSelecionadas: string[]): string | null {
  return !f.capacidade && comodidadesSelecionadas.length === 0
    ? 'Dica: preencha a capacidade e as comodidades aqui em cima antes — o texto fica mais completo.'
    : null;
}
