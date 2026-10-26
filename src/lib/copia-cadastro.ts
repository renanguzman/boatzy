/**
 * "Copiar de outro cadastro" (etapas dos forms de embarcação e roteiro no
 * painel): formato comum da etapa Localização, montado nas server actions e
 * exibido na modal de confirmação (`CopiarDeOutroCadastro`).
 *
 * Módulo puro (sem `server-only`): usado pelas actions e pelos forms.
 */

/** Localização — valores no formato dos campos do form + nomes para exibir. */
export type LocalizacaoCopia = {
  nome: string;
  cep: string;
  estado_id: string;
  /** "Nome (UF)". */
  estado: string | null;
  municipio_id: string;
  municipio: string | null;
  bairro: string;
  logradouro: string;
  logradouro_numero: string;
  complemento: string;
  latitude: string;
  longitude: string;
};

/** Linha de `embarcacao`/`roteiro` com o embed `municipios (nome, estado_id, estados (uf, nome))`. */
export type LinhaLocalizacao = {
  nome: string;
  cep: string | null; bairro: string | null; logradouro: string | null;
  logradouro_numero: string | null; complemento: string | null;
  latitude: number | null; longitude: number | null; municipio_id: number | null;
  municipios: unknown;
};

const num = (v: number | null | undefined) => (v != null ? String(v) : '');

export function cepMascarado(v: string | null): string {
  const d = (v ?? '').replace(/\D/g, '');
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function localizacaoParaCopia(row: LinhaLocalizacao): LocalizacaoCopia {
  const mun = row.municipios as
    { nome: string; estado_id: number; estados: { uf: string; nome: string } | null } | null;
  return {
    nome: row.nome,
    cep: cepMascarado(row.cep),
    estado_id: num(mun?.estado_id),
    estado: mun?.estados ? `${mun.estados.nome} (${mun.estados.uf})` : null,
    municipio_id: mun ? num(row.municipio_id) : '',
    municipio: mun?.nome ?? null,
    bairro: row.bairro ?? '',
    logradouro: row.logradouro ?? '',
    logradouro_numero: row.logradouro_numero ?? '',
    complemento: row.complemento ?? '',
    latitude: num(row.latitude),
    longitude: num(row.longitude),
  };
}

/** Embed usado nos selects da etapa Localização. */
export const SELECT_LOCALIZACAO_COPIA =
  'nome, cep, bairro, logradouro, logradouro_numero, complemento, latitude, longitude, municipio_id, municipios ( nome, estado_id, estados ( uf, nome ) )';
