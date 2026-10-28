// Template for LSN-008 · Last-tested: 2026-10-28 · Against: rayfin-core 1.36.2 / rayfin-cli 1.36.2
// Inputs in <scratch>: probe-refs.json (per probe {measures, columns}), svc-measures.json / svc-columns.json
// (`npx rayfin connector invoke --name pnlModel --operation executeQuery --file rayfin/.temp/meta-*.query.json --json --max-inline-bytes 0`).
// Usage: node LSN-008.readiness-diff.mjs <scratch> "<path to *.SemanticModel>"
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
const S = process.argv[2], modelDir = process.argv[3];
const refs = JSON.parse(readFileSync(path.join(S, 'probe-refs.json'), 'utf8'));
const svcM = new Set(JSON.parse(readFileSync(path.join(S, 'svc-measures.json'), 'utf8')).output.table.rows.map(r => r[0]));
const svcC = new Set(JSON.parse(readFileSync(path.join(S, 'svc-columns.json'), 'utf8')).output.table.rows.map(r => `${r[0]}[${r[1]}]`));
// TMDL inventory
const tmdlM = new Set(), tmdlC = new Set(), tmdlT = new Set();
const tdir = path.join(modelDir, 'definition', 'tables');
for (const f of readdirSync(tdir)) {
  const text = readFileSync(path.join(tdir, f), 'utf8');
  const tm = text.match(/^table\s+(?:'([^']+)'|(\S+))/m); const table = tm ? (tm[1] ?? tm[2]) : f;
  tmdlT.add(table);
  for (const m of text.matchAll(/^\tmeasure\s+(?:'([^']+)'|([^\s=]+))\s*=/gm)) tmdlM.add(m[1] ?? m[2]);
  for (const m of text.matchAll(/^\tcolumn\s+(?:'([^']+)'|([^\s=]+))/gm)) tmdlC.add(`${table}[${m[1] ?? m[2]}]`);
}
console.log(`service: ${svcM.size} measures, ${svcC.size} columns · tmdl: ${tmdlM.size} measures, ${tmdlC.size} columns, ${tmdlT.size} tables`);
console.log('measures in TMDL not in service:', [...tmdlM].filter(m => !svcM.has(m)).length, '· columns in TMDL not in service:', [...tmdlC].filter(c => !svcC.has(c)).length);
console.log('measures in service not in TMDL:', [...svcM].filter(m => !tmdlM.has(m)));
console.log('columns in service not in TMDL:', [...svcC].filter(c => !tmdlC.has(c)));
console.log('');
for (const [probe, r] of Object.entries(refs)) {
  const meas = r.measures.filter(m => m !== 'step_sort');
  const missSvcM = meas.filter(m => !svcM.has(m)), missSvcC = r.columns.filter(c => !svcC.has(c));
  const missTmdlM = meas.filter(m => !tmdlM.has(m)), missTmdlC = r.columns.filter(c => !tmdlC.has(c));
  const ok = missSvcM.length + missSvcC.length === 0;
  console.log(`${probe.replace('.query.json','')} · ${ok ? 'OK now' : 'NEEDS REPUBLISH'}`);
  console.log(`   measures: ${meas.join(', ') || '—'}`);
  if (missSvcM.length) console.log(`   missing in service (measures): ${missSvcM.join(', ')}`);
  if (missSvcC.length) console.log(`   missing in service (columns):  ${missSvcC.join(', ')}`);
  if (missTmdlM.length) console.log(`   !! missing in TMDL too (measures): ${missTmdlM.join(', ')}`);
  if (missTmdlC.length) console.log(`   !! missing in TMDL too (columns):  ${missTmdlC.join(', ')}`);
}
