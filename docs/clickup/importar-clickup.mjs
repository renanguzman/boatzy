#!/usr/bin/env node
/**
 * Importa as tarefas de boatzy-clickup-import.csv para uma lista do ClickUp via API v2.
 *
 * Uso:
 *   CLICKUP_TOKEN=pk_xxx CLICKUP_LIST_ID=123456 node docs/clickup/importar-clickup.mjs
 *
 * - CLICKUP_TOKEN: token pessoal (ClickUp → Settings → Apps → API Token).
 * - CLICKUP_LIST_ID: id da lista de destino (visível na URL da lista).
 *
 * A lista deve ter os status "Backlog", "Em andamento" e "Concluído" (a comparação
 * é case-insensitive). Se um status não existir, a tarefa é criada com o status
 * padrão da lista e um aviso é exibido.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const TOKEN = process.env.CLICKUP_TOKEN;
const LIST_ID = process.env.CLICKUP_LIST_ID;

if (!TOKEN || !LIST_ID) {
  console.error('Defina CLICKUP_TOKEN e CLICKUP_LIST_ID. Ex.:');
  console.error('  CLICKUP_TOKEN=pk_xxx CLICKUP_LIST_ID=123456 node docs/clickup/importar-clickup.mjs');
  process.exit(1);
}

const CSV_PATH = join(dirname(fileURLToPath(import.meta.url)), 'boatzy-clickup-import.csv');
const PRIORITY = { urgent: 1, high: 2, normal: 3, low: 4 };

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function api(path, options = {}) {
  const res = await fetch(`https://api.clickup.com/api/v2${path}`, {
    ...options,
    headers: { Authorization: TOKEN, 'Content-Type': 'application/json', ...options.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${path}: ${JSON.stringify(body)}`);
  return body;
}

const [header, ...rows] = parseCsv(await readFile(CSV_PATH, 'utf8'));
const col = Object.fromEntries(header.map((h, i) => [h, i]));

const list = await api(`/list/${LIST_ID}`);
const listStatuses = (list.statuses ?? []).map((s) => s.status.toLowerCase());
console.log(`Lista destino: "${list.name}" — status disponíveis: ${listStatuses.join(', ')}`);
console.log(`Importando ${rows.length} tarefas...\n`);

let ok = 0, fail = 0;
for (const r of rows) {
  const name = r[col['Task Name']];
  const status = r[col['Status']];
  const hasStatus = listStatuses.includes(status.toLowerCase());
  if (!hasStatus) console.warn(`  aviso: status "${status}" não existe na lista — "${name}" usará o status padrão.`);
  const payload = {
    name,
    markdown_description: `**Módulo:** ${r[col['Módulo']]}\n\n${r[col['Description']]}`,
    priority: PRIORITY[r[col['Priority']].toLowerCase()] ?? 3,
    tags: r[col['Tags']].split(',').map((t) => t.trim()).filter(Boolean),
    ...(hasStatus ? { status } : {}),
  };
  try {
    await api(`/list/${LIST_ID}/task`, { method: 'POST', body: JSON.stringify(payload) });
    ok++;
    console.log(`  ✔ ${name}`);
  } catch (e) {
    fail++;
    console.error(`  ✖ ${name}: ${e.message}`);
  }
  await new Promise((res) => setTimeout(res, 700)); // rate limit da API (100 req/min)
}

console.log(`\nConcluído: ${ok} criadas, ${fail} falhas.`);
