// Fidelity of the sample adapter: parsing the mockup's cells to numbers and
// re-deriving favourable/unfavourable from the rounded Δ must reproduce the
// mockup's own tone codes on every row of every company.
import { describe, expect, it } from 'vitest';

import { fmtAmount, fmtPct, fmtPp, pctToneOf, toneOf } from '../model/format';
import { SAMPLE_DATA } from './sample-data';
import { sampleFigures, toStatementRow } from './sample-source';
import { sampleReference } from './sample-reference';
import { defaultFilters } from '../model/filters';

const TONE_CODE = { fav: 'f', unf: 'u', neutral: '0' } as const;

describe('sample statement rows', () => {
  for (const entity of ['P', 'S', 'G'] as const) {
    it(`reproduces the mockup tone codes and cell text for ${entity}`, () => {
      for (const raw of SAMPLE_DATA[entity].rows) {
        const row = toStatementRow(raw);
        const codes = raw[7];
        const v = row.values;
        const ratio = row.kind === 'ratio';
        const expectTone = (index: number, derived: 'fav' | 'unf' | 'neutral') => {
          expect(TONE_CODE[derived], `${entity} ${row.code} cell ${index}`).toBe(codes[index]);
        };
        const t = (d: number | null) => (row.neutralDelta ? 'neutral' : toneOf(d));
        const pt = (d: number | null, p: number | null) => (row.neutralDelta ? 'neutral' : pctToneOf(d, p));
        expectTone(3, t(v.dA));
        expectTone(4, pt(v.dA, v.dApct));
        expectTone(6, t(v.dB));
        expectTone(7, pt(v.dB, v.dBpct));
        expectTone(10, t(v.fyD));
        // Round trip of the text.
        expect(ratio ? fmtPct(v.base) : fmtAmount(v.base, 'm')).toBe(raw[6][0]);
        expect(ratio ? fmtPp(v.dA) : fmtAmount(v.dA, 'm', true)).toBe(raw[6][3]);
        if (!ratio && raw[6][4] !== '') expect(fmtPct(v.dApct, true)).toBe(raw[6][4]);
      }
    });
  }

  it('flags the figures as sample and keeps the company-specific KPI slots (K-04, K-05)', () => {
    const f = sampleFigures({ ...defaultFilters(sampleReference()), entity: 'S' });
    expect(f.sample).toBe(true);
    expect(f.financial.map((t) => t.label)).toContain('ARR, period end');
    expect(f.operational.map((t) => t.label)).toContain('Rule of 40');
    expect(f.profitability.options).toEqual(['Region', 'Sales motion', 'Service line', 'Segment']);
  });
});
