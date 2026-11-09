import { describe, expect, it } from 'vitest';
import { loadDataset } from '../test-utils/marketing-data.ts';
import { DEFAULT_SELECTION } from './selection.ts';
import type { Selection } from './selection.ts';
import { catalog, parseSelection, serializeSelection, viewHash } from './url-state.ts';

// URL state (contract §6, A-62): Zod at the boundary, defaults omitted, canonical order, idempotent round trips.

const ds = await loadDataset();
const cat = catalog(ds.m, ds.cal);
const parse = (q: string, hash = '') => parseSelection(new URLSearchParams(q), cat, hash);
const ser = (s: Selection) => serializeSelection(s, ds.cal);

describe('url-state', () => {
  it('empty URL = the defaults; defaults serialize to nothing', () => {
    expect(parse('')).toEqual(DEFAULT_SELECTION);
    expect(ser(DEFAULT_SELECTION)).toBe('');
    expect(viewHash('overview')).toBe('');
  });

  it('round-trips every key', () => {
    const q =
      'p=custom&from=2025-01-01&to=2026-11-03&c=ly&g=month&pf=ios,android&mk=na&tr=self_serve&ch=paid_social&nw=meta' +
      '&cp=SOC_META_LAL2&st=live,paused&m=lc&sel=ch:paid_social|pf:ios&o5=top&o6=top&dyn=v3&theme=dark';
    const s = parse(q, '#channels');
    expect(s).toMatchObject({
      view: 'channels',
      preset: 'custom',
      from: 0,
      to: ds.cal.asOf,
      cmp: 'ly',
      grain: 'month',
      platforms: ['IOS', 'ANDROID'],
      market: 'NA',
      tier: 'SELF_SERVE',
      channels: ['PAID_SOCIAL'],
      networks: ['META'],
      campaigns: ['SOC_META_LAL2'],
      statuses: ['LIVE', 'PAUSED'],
      model: 'LAST_CLICK',
      cross: { kind: 'channel', channel: 'PAID_SOCIAL', platform: 'IOS' },
      o5: 'top',
      o6: 'top',
      dyn: 3,
      theme: 'dark',
    });
    expect(parse(ser(s), viewHash(s.view))).toEqual(s);
    expect(ser(parse(ser(s)))).toBe(ser(s));
  });

  it('drops unknown keys and falls back per key on invalid values', () => {
    const s = parse('zz=1&p=year&c=prev&g=hour&pf=web,tv&m=xx&sel=cp:NOPE&o5=best&dyn=v9&from=2025-01-01&lay=x');
    expect(s).toEqual(DEFAULT_SELECTION);
    expect(parse(`p=7d&c=${'x'.repeat(300)}`).cmp).toBe('prev');
  });

  it('normalises lists: catalog order, deduplicated, all = absent', () => {
    expect(parse('pf=android,web,android').platforms).toEqual(['WEB', 'ANDROID']);
    expect(parse('pf=web,ios,android').platforms).toEqual([]);
    expect(ser(parse('pf=android,web'))).toBe('pf=web%2Candroid');
  });

  it('clips Custom dates to the data and ignores from / to without p=custom', () => {
    const s = parse('p=custom&from=2024-06-01&to=2027-01-01');
    expect([s.from, s.to]).toEqual([0, ds.cal.asOf]);
    expect(parse('from=2025-02-01&to=2025-03-01').preset).toBe('30d');
  });

  it('deep link with the query in the hash: #campaigns?sel=cp:SOC_META_LAL2', () => {
    const s = parse('', '#campaigns?sel=cp:SOC_META_LAL2');
    expect(s.view).toBe('campaigns');
    expect(s.cross).toEqual({ kind: 'campaign', campaign: 'SOC_META_LAL2' });
    expect(`${ser(s)}${viewHash(s.view)}`).toBe('sel=cp%3ASOC_META_LAL2#campaigns');
  });

  it('an explicit Live + Learning pick is written (it filters the totals, contract §10 q F)', () => {
    const s = parse('st=live,learning');
    expect(s.statuses).toEqual(['LIVE', 'LEARNING']);
    expect(ser(s)).toBe('st=live%2Clearning');
  });

  it('PA-04 saved state', () => {
    const s = parse('p=custom&from=2025-01-01&to=2026-11-03&g=month');
    expect(ser(s)).toBe('p=custom&from=2025-01-01&to=2026-11-03&g=month');
  });
});

describe('url-state: edges rewritten to the state on screen (hunter stress run)', () => {
  it('an inverted Custom range is the default window (canonical URL without it, Period dot off)', () => {
    const s = parse('p=custom&from=2026-11-03&to=2025-01-01');
    expect([s.preset, s.from, s.to]).toEqual(['30d', null, null]);
    expect(ser(s)).toBe('');
  });
  it('a `to` before the first data day resets to the default window (was a 1-day clip)', () => {
    expect(parse('p=custom&to=2024-12-31').preset).toBe('30d');
    expect(parse('p=custom&from=2027-01-01').preset).toBe('30d');
  });
  it('a cross-filter outside the scope is dropped (pf=web&sel=ch:app_install|pf:ios)', () => {
    const s = parse('pf=web&sel=ch:app_install|pf:ios');
    expect(s.cross).toBeNull();
    expect(ser(s)).toBe('pf=web');
    expect(parse('pf=ios&sel=ch:app_install|pf:ios').cross).toEqual({
      kind: 'channel',
      channel: 'APP_INSTALL',
      platform: 'IOS',
    });
  });
});
