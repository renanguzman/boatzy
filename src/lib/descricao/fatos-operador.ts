import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { partesNoFuso } from '@/lib/datas';
import type { FatoDescricao } from './assistente';

/**
 * Operador: fatos do próprio cadastro, montados AQUI (não confiamos no que o navegador manda):
 * desde quando está no Boatzy, onde atua e que embarcações tem. O nome vem do formulário (ainda
 * pode não estar salvo).
 */
export async function fatosDoOperador(userId: string, nomeInformado: string): Promise<FatoDescricao[]> {
  const [{ data: usuario }, { data: embarcacoes }] = await Promise.all([
    supabaseAdmin.from('users').select('created_at').eq('id', userId).maybeSingle(),
    supabaseAdmin
      .from('embarcacao')
      .select('embarcacao_tipo ( nome ), municipios ( nome, estados ( uf ) )')
      .eq('owner_id', userId),
  ]);
  const lista = (embarcacoes ?? []) as unknown as {
    embarcacao_tipo: { nome: string } | null;
    municipios: { nome: string; estados: { uf: string } | null } | null;
  }[];
  const locais = [...new Set(lista.flatMap((e) => (e.municipios ? [`${e.municipios.nome}${e.municipios.estados ? `/${e.municipios.estados.uf}` : ''}`] : [])))];
  const tipos = [...new Set(lista.flatMap((e) => (e.embarcacao_tipo ? [e.embarcacao_tipo.nome.toLowerCase()] : [])))];
  return [
    ...(nomeInformado ? [{ rotulo: 'Nome', valor: nomeInformado }] : []),
    ...(usuario?.created_at ? [{ rotulo: 'Membro do Boatzy desde', valor: String(partesNoFuso(new Date(usuario.created_at)).ano) }] : []),
    ...(locais.length ? [{ rotulo: 'Atua em', valor: locais.slice(0, 5).join(', ') }] : []),
    ...(lista.length
      ? [{ rotulo: 'Embarcações', valor: `${lista.length} ${lista.length === 1 ? 'embarcação' : 'embarcações'}${tipos.length ? ` (${tipos.slice(0, 5).join(', ')})` : ''}` }]
      : []),
  ];
}
