// Turns the 2026-10-22 connector captures into the parity fixtures (verification only).
// usage (from fabric-app/): node rayfin/probes/make-parity-fixtures.mjs — reads the `connector invoke --output json` captures in rayfin/.temp/c-*.out (old shape = pre-§16 query with the model Δ columns; new = the shape the app sends now)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const load = (f) => {
  const j = JSON.parse(readFileSync(f, 'utf8'));
  return j.output ? j.output.table : j.table;
};
const strip = (t) => ({ columns: t.columns.map((c) => ({ name: c.name, dataType: c.dataType })), rows: t.rows });
// The full old-shape default Q1 exceeds the CLI's 30 s timeout (QRK-004): captured as its two halves.
const union = (a, b) => {
  if (a.columns.map((c) => c.name).join() !== b.columns.map((c) => c.name).join()) throw new Error('halves differ in columns');
  return { columns: a.columns, rows: [...a.rows, ...b.rows] };
};

const q1 = {
  // P · FY2026 · Sep · YTD · Actual vs Budget / Prior year · USD · actual FX · M
  default: {
    old: strip(union(load('rayfin/.temp/c-q1-old2-default-lines.out'), load('rayfin/.temp/c-q1-old2-default-leaves.out'))),
    new: strip(load('rayfin/.temp/c-q1-new-default.out')),
  },
  // P · FY2026 · Jun · QTD · Latest estimate vs Budget / None · EUR · constant currency · M · regions NA+EU · channels D2C+GRO
  sliced: { old: strip(load('rayfin/.temp/c-q1-old-sliced.out')), new: strip(load('rayfin/.temp/c-q1-new-sliced.out')) },
};
const q2 = { old: strip(load('rayfin/.temp/c-q2-old-fin.out')), new: strip(load('rayfin/.temp/c-q2-new-fin.out')) };

const header = `// Live captures from the published model "ACME Unified PnL" (workspace RAW) through
// \`npx rayfin connector invoke pnlModel executeQuery\` on 2026-10-22 (model refreshed
// 2026-10-21 18:00 UTC), for the parity tests of the client-side variance derivation
// (ADR-0006 §16). \`old\` = the pre-§16 query shape with the model's own Δ / Δ % / % NR
// (or KPI Δ A/B) columns; \`new\` = the §16 shape with level (comparison) columns only.
// Generated file — do not hand-edit; regenerate with rayfin/probes/make-parity-fixtures.mjs.
import type { QueryTable } from '@microsoft/rayfin-connector-fabric-semanticmodel';
`;
const rowsLiteral = (t) => `{\n  columns: ${JSON.stringify(t.columns)},\n  rows: [\n${t.rows.map((r) => `    ${JSON.stringify(r)},`).join('\n')}\n  ],\n}`;

mkdirSync('packages/frontend/src/pnl/data/fixtures', { recursive: true });
writeFileSync(
  'packages/frontend/src/pnl/data/fixtures/q1-statement-parity.fixture.ts',
  `${header}
/** Q1, default filters: P · FY2026 · Sep · YTD · Actual vs Budget / Prior year · USD · actual FX · M. */
export const Q1_DEFAULT: { old: QueryTable; new: QueryTable } = {
  old: ${rowsLiteral(q1.default.old)},
  new: ${rowsLiteral(q1.default.new)},
};

/** Q1, sliced: P · FY2026 · Jun · QTD · Latest estimate vs Budget / None · EUR · constant currency · M · regions NA+EU · channels D2C+GRO. */
export const Q1_SLICED: { old: QueryTable; new: QueryTable } = {
  old: ${rowsLiteral(q1.sliced.old)},
  new: ${rowsLiteral(q1.sliced.new)},
};
`
);
writeFileSync(
  'packages/frontend/src/pnl/data/fixtures/q2-kpi-parity.fixture.ts',
  `${header}
/** Q2b for NR, ORG_GROWTH, GM_PCT, GTN_PCT with the default filters (P · FY2026 · Sep · YTD · Actual vs Budget / Prior year · USD · M). */
export const Q2_FIN: { old: QueryTable; new: QueryTable } = {
  old: ${rowsLiteral(q2.old)},
  new: ${rowsLiteral(q2.new)},
};
`
);
console.log('fixtures written', q1.default.old.rows.length, q1.default.new.rows.length, q1.sliced.old.rows.length, q1.sliced.new.rows.length);
