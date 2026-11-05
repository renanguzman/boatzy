/**
 * Rascunho automático dos cadastros do painel (SPEC §107) — armazenamento NESTE
 * aparelho, no IndexedDB do navegador. Sem rede, sem servidor.
 *
 * Dois "armários" (object stores):
 * - `rascunhos`: o estado do formulário em JSON (pequeno; regravado a cada mudança);
 * - `arquivos`: fotos e arquivos de documentos (`File`), gravados UMA vez quando entram
 *   no formulário e apagados quando saem — regravar 20 fotos a cada letra digitada
 *   travaria o celular.
 *
 * Plano B: sem IndexedDB (aba anônima antiga, bloqueio) ou sem espaço para os arquivos,
 * o JSON vai para o `localStorage` e o resultado avisa que os arquivos ficaram de fora.
 * Módulo só de navegador; toda falha vira um resultado, nunca uma exceção.
 */

const NOME_DB = 'boatzy-rascunhos';
const VERSAO_DB = 1;
const LOJA_RASCUNHOS = 'rascunhos';
const LOJA_ARQUIVOS = 'arquivos';
const PREFIXO_LS = 'boatzy-rascunho:';
/** Rascunho mais velho que isso é apagado sozinho. */
export const VALIDADE_RASCUNHO_MS = 30 * 24 * 60 * 60 * 1000;

export type ResumoRascunho = { titulo: string; fotos: number };

export type RegistroRascunho<D = unknown> = {
  /** `{usuarioId}:{entidade}:{novo|id}` — ver `chaveRascunho`. */
  chave: string;
  /** Versão do formato de `dados` (rascunho de versão diferente é descartado). */
  versao: number;
  dados: D;
  etapa: { atual: number; visitadas: boolean[] };
  /** Edição: assinatura dos dados do servidor quando o rascunho começou. */
  base: string | null;
  /** Ids dos arquivos que o rascunho referencia (fotos/documentos). */
  arquivos: string[];
  atualizadoEm: number;
  /** Cadastro novo cujo registro já foi criado no servidor (envio interrompido depois). */
  criadoId?: string;
  resumo: ResumoRascunho;
};

type ArquivoGuardado = { id: string; chave: string; file: Blob; nome: string; tipo: string; modificadoEm: number };

export type ResultadoGravacao = 'ok' | 'sem-arquivos' | 'erro';

export function chaveRascunho(usuarioId: string, entidade: 'embarcacao' | 'roteiro', alvo: string): string {
  return `${usuarioId}:${entidade}:${alvo}`;
}

// ─── IndexedDB ────────────────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase | null> | null = null;

function abrir(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase | null>(resolve => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    // O Safari às vezes nunca responde ao open: sem resposta em 3 s, segue sem IndexedDB.
    const limite = setTimeout(() => resolve(null), 3000);
    try {
      const req = indexedDB.open(NOME_DB, VERSAO_DB);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(LOJA_RASCUNHOS)) db.createObjectStore(LOJA_RASCUNHOS, { keyPath: 'chave' });
        if (!db.objectStoreNames.contains(LOJA_ARQUIVOS)) {
          db.createObjectStore(LOJA_ARQUIVOS, { keyPath: 'id' }).createIndex('chave', 'chave');
        }
      };
      req.onsuccess = () => {
        clearTimeout(limite);
        const db = req.result;
        // Outra aba atualizou o banco: fecha esta conexão para não travar a atualização.
        db.onversionchange = () => { db.close(); dbPromise = null; };
        resolve(db);
      };
      req.onerror = () => { clearTimeout(limite); resolve(null); };
      req.onblocked = () => { clearTimeout(limite); resolve(null); };
    } catch {
      clearTimeout(limite);
      resolve(null);
    }
  });
  // Falhou: a próxima chamada tenta de novo.
  dbPromise.then(db => { if (!db) dbPromise = null; });
  return dbPromise;
}

function requisicao<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function transacao(db: IDBDatabase, lojas: string[], modo: IDBTransactionMode, agir: (tx: IDBTransaction) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(lojas, modo);
    } catch (e) {
      return reject(e);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('transação abortada'));
    try {
      agir(tx);
    } catch (e) {
      try { tx.abort(); } catch { /* já encerrada */ }
      reject(e);
    }
  });
}

const idArquivo = (chave: string, id: string) => `${chave}|${id}`;

/** Apaga todos os arquivos de um rascunho (pelo índice `chave`). */
function apagarArquivosDe(tx: IDBTransaction, chave: string) {
  const loja = tx.objectStore(LOJA_ARQUIVOS);
  const cursor = loja.index('chave').openKeyCursor(IDBKeyRange.only(chave));
  cursor.onsuccess = () => {
    const c = cursor.result;
    if (!c) return;
    loja.delete(c.primaryKey);
    c.continue();
  };
}

// ─── localStorage (plano B, só o JSON) ────────────────────────────────────────

function gravarLS(registro: RegistroRascunho): boolean {
  try {
    localStorage.setItem(PREFIXO_LS + registro.chave, JSON.stringify(registro));
    return true;
  } catch {
    return false;
  }
}

function lerLS<D>(chave: string): RegistroRascunho<D> | null {
  try {
    const bruto = localStorage.getItem(PREFIXO_LS + chave);
    return bruto ? (JSON.parse(bruto) as RegistroRascunho<D>) : null;
  } catch {
    return null;
  }
}

function apagarLS(chave: string) {
  try { localStorage.removeItem(PREFIXO_LS + chave); } catch { /* sem localStorage */ }
}

function chavesLS(): string[] {
  try {
    return Object.keys(localStorage).filter(k => k.startsWith(PREFIXO_LS)).map(k => k.slice(PREFIXO_LS.length));
  } catch {
    return [];
  }
}

// ─── API ──────────────────────────────────────────────────────────────────────

/** Lê o rascunho e os arquivos dele (id do arquivo → File). null se não houver. */
export async function lerRascunho<D>(chave: string): Promise<{ registro: RegistroRascunho<D>; arquivos: Map<string, File> } | null> {
  const arquivos = new Map<string, File>();
  let registro: RegistroRascunho<D> | undefined;
  const db = await abrir();
  if (db) {
    try {
      const tx = db.transaction([LOJA_RASCUNHOS, LOJA_ARQUIVOS], 'readonly');
      const [doDb, guardados] = await Promise.all([
        requisicao(tx.objectStore(LOJA_RASCUNHOS).get(chave)) as Promise<RegistroRascunho<D> | undefined>,
        requisicao(tx.objectStore(LOJA_ARQUIVOS).index('chave').getAll(IDBKeyRange.only(chave))) as Promise<ArquivoGuardado[]>,
      ]);
      registro = doDb;
      for (const g of guardados) {
        arquivos.set(g.id.slice(chave.length + 1), g.file instanceof File
          ? g.file
          : new File([g.file], g.nome, { type: g.tipo, lastModified: g.modificadoEm }));
      }
    } catch {
      /* segue para o plano B */
    }
  }
  // O plano B pode ter uma versão mais nova do JSON (gravação no IndexedDB falhou).
  const ls = lerLS<D>(chave);
  if (ls && (!registro || ls.atualizadoEm > registro.atualizadoEm)) registro = ls;
  return registro ? { registro, arquivos } : null;
}

/**
 * Grava o rascunho: os arquivos novos (só os que ainda não estão guardados), remove os
 * que saíram do formulário e regrava o JSON — tudo numa transação. Sem espaço para os
 * arquivos, grava só o JSON ('sem-arquivos').
 */
export async function gravarRascunho(
  registro: RegistroRascunho,
  novos: { id: string; file: File }[],
  remover: string[],
): Promise<ResultadoGravacao> {
  const db = await abrir();
  if (!db) return gravarLS(registro) ? 'sem-arquivos' : 'erro';

  const gravar = (comArquivos: boolean) => transacao(db, [LOJA_RASCUNHOS, LOJA_ARQUIVOS], 'readwrite', tx => {
    const arquivos = tx.objectStore(LOJA_ARQUIVOS);
    for (const id of remover) arquivos.delete(idArquivo(registro.chave, id));
    if (comArquivos) {
      for (const { id, file } of novos) {
        const guardado: ArquivoGuardado = {
          id: idArquivo(registro.chave, id), chave: registro.chave, file,
          nome: file.name, tipo: file.type, modificadoEm: file.lastModified,
        };
        arquivos.put(guardado);
      }
    }
    tx.objectStore(LOJA_RASCUNHOS).put(registro);
  });

  try {
    await gravar(true);
    apagarLS(registro.chave);
    return 'ok';
  } catch {
    // Quota estourada ou Blob recusado (Safari antigo/anônimo): tenta só o JSON.
    if (novos.length > 0) {
      try {
        await gravar(false);
        apagarLS(registro.chave);
        return 'sem-arquivos';
      } catch { /* plano B */ }
    }
    return gravarLS(registro) ? 'sem-arquivos' : 'erro';
  }
}

/** Apaga o rascunho e os arquivos dele. */
export async function apagarRascunho(chave: string): Promise<void> {
  apagarLS(chave);
  const db = await abrir();
  if (!db) return;
  try {
    await transacao(db, [LOJA_RASCUNHOS, LOJA_ARQUIVOS], 'readwrite', tx => {
      tx.objectStore(LOJA_RASCUNHOS).delete(chave);
      apagarArquivosDe(tx, chave);
    });
  } catch { /* nada a fazer */ }
}

export type RascunhoListado = { chave: string; resumo: ResumoRascunho; atualizadoEm: number; criadoId?: string };

/** Rascunhos cujas chaves começam com `prefixo` (sem os dados), do mais recente ao mais antigo. */
export async function listarRascunhos(prefixo: string): Promise<RascunhoListado[]> {
  const porChave = new Map<string, RascunhoListado>();
  const incluir = (r: RegistroRascunho | null | undefined) => {
    if (!r || !r.chave.startsWith(prefixo) || Date.now() - r.atualizadoEm > VALIDADE_RASCUNHO_MS) return;
    const atual = porChave.get(r.chave);
    if (!atual || atual.atualizadoEm < r.atualizadoEm) {
      porChave.set(r.chave, { chave: r.chave, resumo: r.resumo, atualizadoEm: r.atualizadoEm, criadoId: r.criadoId });
    }
  };
  const db = await abrir();
  if (db) {
    try {
      const todos = await requisicao(db.transaction(LOJA_RASCUNHOS, 'readonly').objectStore(LOJA_RASCUNHOS).getAll()) as RegistroRascunho[];
      todos.forEach(incluir);
    } catch { /* segue com o localStorage */ }
  }
  chavesLS().forEach(c => incluir(lerLS(c)));
  return [...porChave.values()].sort((a, b) => b.atualizadoEm - a.atualizadoEm);
}

/** Logout: apaga todos os rascunhos deste aparelho (há documentos com dados pessoais). */
export async function apagarTodosRascunhos(): Promise<void> {
  chavesLS().forEach(apagarLS);
  const db = await abrir();
  if (!db) return;
  try {
    await transacao(db, [LOJA_RASCUNHOS, LOJA_ARQUIVOS], 'readwrite', tx => {
      tx.objectStore(LOJA_RASCUNHOS).clear();
      tx.objectStore(LOJA_ARQUIVOS).clear();
    });
  } catch { /* nada a fazer */ }
}

let limpezaFeita = false;

/** Apaga rascunhos vencidos (uma vez por carregamento da página). */
export async function limparRascunhosVencidos(): Promise<void> {
  if (limpezaFeita) return;
  limpezaFeita = true;
  const vencido = (r: RegistroRascunho | null) => !!r && Date.now() - r.atualizadoEm > VALIDADE_RASCUNHO_MS;
  chavesLS().forEach(c => { if (vencido(lerLS(c))) apagarLS(c); });
  const db = await abrir();
  if (!db) return;
  try {
    const todos = await requisicao(db.transaction(LOJA_RASCUNHOS, 'readonly').objectStore(LOJA_RASCUNHOS).getAll()) as RegistroRascunho[];
    const vencidos = todos.filter(vencido).map(r => r.chave);
    if (vencidos.length === 0) return;
    await transacao(db, [LOJA_RASCUNHOS, LOJA_ARQUIVOS], 'readwrite', tx => {
      for (const chave of vencidos) {
        tx.objectStore(LOJA_RASCUNHOS).delete(chave);
        apagarArquivosDe(tx, chave);
      }
    });
  } catch { /* nada a fazer */ }
}

let persistenciaPedida = false;

/** Pede ao navegador para não apagar os dados do site por falta de espaço (melhor esforço). */
export function pedirArmazenamentoPersistente() {
  if (persistenciaPedida) return;
  persistenciaPedida = true;
  try {
    void navigator.storage?.persist?.().catch(() => {});
  } catch { /* sem suporte */ }
}
