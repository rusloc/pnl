import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadDataset } from '../test-utils/marketing-data.ts';
import {
  COLUMNS,
  collapse,
  normalise,
  readRows,
  resolver,
  selectionOf,
  stateKey,
  writeRows,
} from '../test-utils/parity/marketing-parity.ts';
import type { Row } from '../test-utils/parity/marketing-parity.ts';

// PBI = JS parity gate, ACME Marketing (ADR-0015 phase 4; A-84 / A-85; contract marketing-js-flavour.md §7.2).
// Rows: lib/test-utils/parity/parity_selections_marketing.csv = bip's Power BI capture (pbi-report/ACME Marketing/tests/
// parity-expected.csv, 1,416 rows) + hunter's c_status / c_value / note. Every row is asserted against the JS view models
// after the §7.2 normalisation; a `gap` row fails. `accepted` needs a numbered difference of docs/design/parity-rules.md
// › ACME Marketing in `note`; difference 14 (minus glyph) is a normalisation rule, so those rows are still asserted.
// Refresh c_value / c_status after an engine change: PARITY_WRITE=1 npx vitest run lib/engine/parity.test.ts

const CSV = fileURLToPath(new URL('../test-utils/parity/parity_selections_marketing.csv', import.meta.url));
const PBI_CSV = fileURLToPath(new URL('../../../pbi-report/ACME Marketing/tests/parity-expected.csv', import.meta.url));
const PBI_DAX = fileURLToPath(
  new URL('../../../pbi-report/ACME Marketing/tests/parity-selections.dax', import.meta.url),
);
const HAS_PBI = existsSync(PBI_CSV) && existsSync(PBI_DAX); // absent in a .sync pack (ADR-0014)

const ds = await loadDataset();

type Status = 'match' | 'accepted' | 'gap';
/** match = equal (spaces around " | " collapsed, §7.2); accepted 14 = equal only once "-" and U+2212 are one glyph. */
function classify(expected: string, js: string | undefined): Status {
  if (js === undefined) return 'gap';
  if (collapse(js) === collapse(expected)) return 'match';
  return normalise(js) === normalise(expected) ? 'accepted' : 'gap';
}
const NOTE_14 = 'parity-rules ACME Marketing (14) minus glyph: PBI native visual prints "-", JS U+2212';

function resolveAll(rows: readonly Row[]) {
  const bySel = new Map<string, ReturnType<typeof resolver>>();
  return rows.map((r) => {
    let f = bySel.get(r.sel_id);
    if (!f) {
      f = resolver(ds, selectionOf(ds, r));
      bySel.set(r.sel_id, f);
    }
    return f(r.element);
  });
}

if (process.env.PARITY_WRITE === '1') {
  const pbi = readRows(readFileSync(PBI_CSV, 'utf8'));
  const js = resolveAll(pbi);
  const out = pbi.map((r, i) => {
    const st = classify(r.expected, js[i]);
    return { ...r, c_status: st, c_value: js[i] ?? '', note: st === 'accepted' ? NOTE_14 : st === 'gap' ? 'gap' : '' };
  });
  writeFileSync(CSV, writeRows(out));
}

const rows = readRows(readFileSync(CSV, 'utf8'));
const js = resolveAll(rows);
const SELS = [
  'PA-01',
  'PA-02',
  'PA-03',
  'PA-04',
  'PA-05',
  'PA-06',
  'PA-07',
  'PA-08',
  'PA-09',
  'PA-10',
  'PA-11',
  'PA-12',
  'PA-13',
  'PA-14a',
  'PA-14b',
];

describe('harness', () => {
  it('normalisation folds only the minus glyph and the spaces around " | "', () => {
    expect(classify('-0.3', '−0.3')).toBe('accepted');
    expect(classify('Oct 5 – Nov 3  |  vs prior 30 d', 'Oct 5 – Nov 3 | vs prior 30 d')).toBe('match');
    expect(classify('Oct 5 – Nov 3', 'Oct 5 - Nov 3')).toBe('gap'); // en dash of the pill is not a minus
    expect(classify('Platform: iOS   -   Status: Live', 'Platform: iOS | Status: Live')).toBe('gap'); // old divider
    expect(classify('', undefined)).toBe('gap'); // an unresolved slot never passes as blank
    expect(classify('$412', '$413')).toBe('gap');
  });

  it('unknown slots resolve to undefined (no vacuous match)', () => {
    const f = resolver(ds, selectionOf(ds, rows[0] as Row));
    for (const e of ['V7.value', 'O5.row9.campaign', 'C1.NOPE.spend', 'K1.1999-01.m0', 'DYN.v7.points', 'X1'])
      expect(f(e), e).toBeUndefined();
  });
});

describe('parity_selections_marketing.csv', () => {
  it('1,416 rows, 15 selections, unique sel_id + element, one state per selection', () => {
    expect(rows).toHaveLength(1416);
    expect([...new Set(rows.map((r) => r.sel_id))]).toEqual(SELS);
    const keys = rows.map((r) => `${r.sel_id} ${r.element}`);
    expect(new Set(keys).size).toBe(rows.length);
    for (const s of SELS) expect(new Set(rows.filter((r) => r.sel_id === s).map(stateKey)).size, s).toBe(1);
  });

  it('c_status is filled; accepted rows cite a numbered difference (1 … 14)', () => {
    for (const r of rows) {
      expect(['match', 'accepted', 'gap'], `${r.sel_id} ${r.element}`).toContain(r.c_status);
      if (r.c_status === 'accepted') expect(r.note, `${r.sel_id} ${r.element}`).toMatch(/\((?:[1-9]|1[0-4])\)/);
    }
  });

  it.skipIf(!HAS_PBI)("mirrors bip's capture row for row (pbi-report/ACME Marketing/tests/parity-expected.csv)", () => {
    const pbi = readRows(readFileSync(PBI_CSV, 'utf8'));
    const pick = (r: Row) => COLUMNS.filter((k) => k !== 'c_status').map((k) => r[k]);
    expect(rows.map(pick)).toEqual(pbi.map(pick));
  });

  it.skipIf(!HAS_PBI)('state columns agree with the // State: lines of parity-selections.dax', () => {
    const dax = readFileSync(PBI_DAX, 'utf8');
    const blocks = [...dax.matchAll(/^\/\/ ==== BLOCK (PA-\d+[ab]?):.*\r?\n\/\/ State: (.*)$/gm)];
    expect(blocks.map((b) => b[1])).toEqual(SELS);
    for (const [, sel, state] of blocks) {
      const r = rows.find((x) => x.sel_id === sel) as Row;
      const f = Object.fromEntries(
        (state ?? '').split(' | ').map((kv) => {
          const i = kv.indexOf(' ');
          return [kv.slice(0, i), kv.slice(i + 1)];
        }),
      );
      if (r.from) expect(state, sel).toContain(`${r.from} .. ${r.to}`);
      else expect(state, sel).not.toContain(' .. ');
      expect(
        {
          preset: f.preset,
          comparator: f.comparator,
          granularity: f.granularity,
          model: f.model,
          platforms: f.platforms === 'all' ? '' : f.platforms,
          statuses: f.statuses === 'default' ? '' : f.statuses,
          campaigns: f.campaigns === 'all' ? '' : f.campaigns,
          cross: f.cross === 'none' ? '' : f.cross,
          o5: f.O5,
          o6: f.O6,
        },
        sel,
      ).toEqual({
        preset: r.preset,
        comparator: r.comparator,
        granularity: r.granularity,
        model: r.model,
        platforms: r.platforms,
        statuses: r.statuses,
        campaigns: r.campaigns,
        cross: r.cross,
        o5: r.o5_mode,
        o6: r.o6_mode,
      });
    }
  });
});

describe.each(SELS)('PBI = JS %s', (sel) => {
  const ix = rows.flatMap((r, i) => (r.sel_id === sel ? [i] : []));

  it('every non-accepted row equal after normalisation (a gap fails)', () => {
    const off = ix.flatMap((i) => {
      const r = rows[i] as Row;
      const st = classify(r.expected, js[i]);
      if (r.c_status === 'accepted' && !/\(14\)/.test(r.note)) return []; // a presentation difference, not asserted
      return st === 'gap' ? [{ element: r.element, expected: r.expected, js: js[i] ?? '(no slot)' }] : [];
    });
    expect(off).toEqual([]);
  });

  it('c_status / c_value are current (else PARITY_WRITE=1)', () => {
    const stale = ix.flatMap((i) => {
      const r = rows[i] as Row;
      const st = classify(r.expected, js[i]);
      const status = r.c_status === 'accepted' && !/\(14\)/.test(r.note) ? 'accepted' : st;
      return r.c_value !== (js[i] ?? '') || r.c_status !== status
        ? [{ element: r.element, c_value: r.c_value, js: js[i], c_status: r.c_status, now: status }]
        : [];
    });
    expect(stale).toEqual([]);
  });
});
