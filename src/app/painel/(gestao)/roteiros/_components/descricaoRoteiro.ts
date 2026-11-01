import type { FatoDescricao } from '@/lib/descricao/assistente';

/**
 * Fatos do cadastro do passeio para o assistente de descrição (SPEC §98) — itinerário na
 * ordem, duração, horário e opcionais. A embarcação vinculada é completada pelo servidor.
 */
export function fatosRoteiro(a: {
  form: {
    nome: string; embarcacao_id: string; duracao_valor: string; duracao_unidade: 'horas' | 'dias';
    quantidade_pessoas: string; horario_saida: string; origem: string; destino: string;
    estado_id: string; municipio_id: string;
  };
  embarcacoes: { id: string; nome: string }[];
  paradas: { nome: string }[];
  estados: { id: number; uf: string }[];
  municipios: { id: number; nome: string }[];
  catalogo: { id: string; descricao: string }[];
  itensCatalogo: { catalogoId: string }[];
}): FatoDescricao[] {
  const { form } = a;
  const n = Number(form.duracao_valor);
  const duracao = form.duracao_valor
    ? `${form.duracao_valor} ${form.duracao_unidade === 'dias' ? (n === 1 ? 'dia' : 'dias') : (n === 1 ? 'hora' : 'horas')}`
    : '';
  const municipio = a.municipios.find((m) => String(m.id) === form.municipio_id)?.nome;
  const uf = a.estados.find((e) => String(e.id) === form.estado_id)?.uf;
  const opcionais = a.catalogo.filter((c) => a.itensCatalogo.some((i) => i.catalogoId === c.id)).map((c) => c.descricao);
  const fatos: [string, string | null | undefined][] = [
    ['Nome', form.nome.trim()],
    ['Embarcação', a.embarcacoes.find((e) => e.id === form.embarcacao_id)?.nome],
    ['Duração', duracao],
    ['Capacidade', form.quantidade_pessoas && `até ${form.quantidade_pessoas} pessoas`],
    ['Horário de saída', form.horario_saida],
    ['Embarque', form.origem.trim()],
    ['Paradas', a.paradas.map((p, i) => `${i + 1}) ${p.nome}`).join('; ')],
    ['Desembarque', form.destino.trim()],
    ['Cidade de partida', municipio && (uf ? `${municipio}/${uf}` : municipio)],
    ['Opcionais (pagos à parte)', opcionais.join(', ')],
  ];
  return fatos.filter((f): f is [string, string] => !!f[1]).map(([rotulo, valor]) => ({ rotulo, valor }));
}

/** Sem itinerário o texto fica genérico: pede saída/paradas antes. */
export function avisoDescricaoRoteiro(f: { origem: string; destino: string }, paradas: unknown[]): string | null {
  return !f.origem.trim() && !f.destino.trim() && paradas.length === 0
    ? 'Dica: preencha o itinerário (saída, paradas e chegada) acima — assim o texto fala deste passeio, e não de um qualquer.'
    : null;
}
