import { beforeAll, describe, expect, it } from 'vitest';
import type { Manifest } from '../data/manifest.ts';
import { loadPublicDataset } from '../test-utils/public-data.ts';
import { createSelectionCodec, parseEntity, restrictToBuilt } from './selection-schema.ts';
import type { SelectionCodec } from './selection-schema.ts';

// F-37 link state validated at the boundary (ADR-0002 §2.4).
let codec: SelectionCodec;
let manifest: Manifest;
beforeAll(async () => {
  manifest = (await loadPublicDataset(['P'])).manifest;
  codec = createSelectionCodec(manifest);
});
const q = (s: string) => new URLSearchParams(s);

describe('selection codec', () => {
  it('the bare URL is the spec default (F-01 … F-21): Consumer Products, YTD Sep 2026, Actual vs Budget and PY', () => {
    const sel = codec.parse(q(''));
    expect(sel).toEqual(codec.defaults('P'));
    expect(sel).toMatchObject({
      entity: 'P',
      fy: 2026,
      month: 9,
      timeView: 'YTD',
      base: 'A',
      compareA: 'B',
      compareB: 'PY',
    });
    expect(codec.serialize(sel)).toBe('');
  });

  it('round-trips every non-default field', () => {
    const sel = {
      ...codec.defaults('S'),
      fy: 2025,
      month: 3 as const,
      timeView: 'LTM' as const,
      base: 'B' as const,
      compareA: 'LE' as const,
      compareB: 'NONE' as const,
      region: ['EU', 'UK'],
      channel: ['SELF'],
      currency: 'GBP' as const,
      costSign: 'POS' as const,
      showTags: false,
      view: 'kpi' as const,
    };
    const text = codec.serialize(sel);
    expect(text).toBe('e=S&fy=2025&m=3&tv=LTM&b=B&ca=LE&cb=NONE&r=EU%2CUK&ch=SELF&cur=GBP&cs=POS&tg=0&v=kpi');
    expect(codec.parse(q(text))).toEqual(sel);
  });

  it('replaces invalid values with the default and drops unknown keys', () => {
    const sel = codec.parse(q('e=X&fy=1999&m=13&tv=WEEK&cur=JPY&pn=yes&utm_source=mail'));
    expect(sel).toEqual(codec.defaults('P'));
    expect(codec.serialize(sel)).toBe('');
  });

  it('slice codes: unknown or other-entity codes dropped; all selected means all (F-33)', () => {
    expect(codec.parse(q('ch=GRO,SELF,NOPE')).channel).toEqual(['GRO']);
    expect(codec.parse(q('r=NA,EU,UK,AP')).region).toEqual([]);
  });

  it('Group view: entity-specific slices off (F-32), Entity columns and Entity breakdown by default (F-18, F-21)', () => {
    const sel = codec.parse(q('e=GROUP&ch=GRO'));
    expect(sel).toMatchObject({ entity: 'GROUP', channel: [], layout: 'ENTITY', breakdown: 'ENTITY' });
    expect(codec.parse(q('lay=ENTITY&bd=ENTITY'))).toMatchObject({ layout: 'VAR', breakdown: 'CHANNEL' });
  });

  it('reads the entity before the manifest is loaded', () => {
    expect(parseEntity(q('e=S'))).toBe('S');
    expect(parseEntity(q('e=bad'))).toBe('P');
  });
});

describe('restrictToBuilt (build step 3)', () => {
  it('falls back to what is built: single entity, Variance, by function, no slices, statement', () => {
    const sel = codec.parse(q('e=GROUP&lay=TREND_M&lens=NAT&d=FULL&r=EU&v=analysis&cur=EUR'));
    expect(restrictToBuilt(sel, codec.defaults('P'))).toMatchObject({
      entity: 'P',
      layout: 'VAR',
      costLens: 'FN',
      detail: 'STD',
      region: [],
      view: 'statement',
      currency: 'EUR', // built settings are kept
    });
  });
});
