import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadExecData } from '@/lib/test-utils/exec-data';
import type { ExecData } from '@/lib/engine/cube';
import { ACTUAL_LABEL, NO_BASIS_VALUE } from '@/lib/engine/copy';
import { DEFAULT_SELECTION } from '@/lib/engine/url-state';
import type { Selection } from '@/lib/engine/url-state';
import { buildView } from '@/lib/engine/view';
import { ExplainPop } from './Layers';

// ⓘ figure block (USER 2026-10-30, spec shared with the PBI flavour): Actual label → actual value → basis label → basis
// value, stacked, each label + number one dt / dd pair; a blank basis keeps the label and shows a muted "–".

let d: ExecData;
beforeAll(async () => {
  d = await loadExecData();
});
const noop = () => {};
const card = (id: string, patch: Partial<Selection> = {}) => {
  const c = buildView(d, { ...DEFAULT_SELECTION, ...patch }).cards.find((k) => k.id === id);
  if (!c) throw new Error(`no card ${id}`);
  return c;
};
const fig = (id: string, patch: Partial<Selection> = {}) =>
  /<dl class="fig">([\s\S]*?)<\/dl>/.exec(renderToStaticMarkup(<ExplainPop card={card(id, patch)} onDrill={noop} />));
/** The block as [tag, text] in document order (tags stripped from the text). */
const parts = (html: string) =>
  [...html.matchAll(/<(dt|dd)[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => [m[1], (m[2] ?? '').replace(/<[^>]+>/g, '')]);

describe('ⓘ figure block (USER 2026-10-30)', () => {
  it('copy: "Actual" and "–" come from lib/engine/copy.ts', () => {
    expect([ACTUAL_LABEL, NO_BASIS_VALUE]).toEqual(['Actual', '–']);
  });

  it('Net sales W43: Actual → €64.3m → Budget → €62.9m, then the Δ line right below the block', () => {
    const c = card('NET_SALES');
    const m = fig('NET_SALES');
    expect(parts(m?.[1] ?? '')).toEqual([
      ['dt', 'Actual'],
      ['dd', `${c.value}${c.unit}`],
      ['dt', 'Budget'],
      ['dd', '€62.9m'],
    ]);
    const html = renderToStaticMarkup(<ExplainPop card={c} onDrill={noop} />);
    expect(html).toMatch(/<\/dl><div class="delta"/);
  });

  it('each label sits with its number in one group (dt + dd in a div), basis group marked .tgt', () => {
    const html = fig('EBITDA')?.[1] ?? '';
    expect(html).toMatch(
      /^<div><dt>Actual<\/dt><dd class="big">[^<]+<small>[^<]*<\/small><\/dd><\/div><div class="tgt"><dt>Budget<\/dt><dd>[^<]+<small>m<\/small><\/dd><\/div>$/,
    );
  });

  it.each([
    'NET_SALES',
    'TOTAL_MARGIN',
    'WEEKS_OF_COVER',
    'MARKDOWN',
    'AVAILABILITY',
    'EBITDA',
    'LFL_GROWTH',
    'FRONT_GM',
    'SELL_THROUGH',
    'GMROI',
    'SUPPLIER_OTIF',
    'CHANNEL_MIX',
  ])('%s: four parts in order', (id) => {
    const c = card(id);
    expect(parts(fig(id)?.[1] ?? '').map(([tag, text]) => `${tag}:${text}`)).toEqual([
      'dt:Actual',
      `dd:${c.value}${c.unit}`,
      `dt:${c.target?.label}`,
      `dd:${c.target?.value}${c.target?.unit}`,
    ]);
  });

  it('N/A basis (FY2025 P10 Net sales: no FY2025 budget): basis label kept, value a muted "–"', () => {
    const c = card('NET_SALES', { item: 'FY2025-P10' });
    expect(c.target).toEqual({ label: 'Budget', value: 'n/a', unit: '' });
    const html = fig('NET_SALES', { item: 'FY2025-P10' })?.[1] ?? '';
    expect(parts(html)).toEqual([
      ['dt', 'Actual'],
      ['dd', `${c.value}${c.unit}`],
      ['dt', 'Budget'],
      ['dd', '–'],
    ]);
    expect(html).toContain('<dd class="none">–</dd>');
    expect(html).not.toContain('n/a');
  });

  it('CSS spec in globals.css: sizes, weights, colours and gaps', () => {
    const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
    const rule = (sel: string) =>
      new RegExp(`(?:^|\n)${sel.replace(/[.()]/g, '\\$&')} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    expect(rule('.fig dt')).toMatch(/font-size: 16px;[\s\S]*font-weight: 600;[\s\S]*color: #374151;/);
    expect(rule('.fig dd')).toMatch(/margin-top: 4px;[\s\S]*font-weight: 700;[\s\S]*color: var\(--ink\);/);
    expect(rule('.fig dd.big')).toContain('font-size: 48px;');
    expect(rule('.fig .tgt')).toContain('margin-top: 12px;');
    expect(rule('.fig .tgt dt::before')).toMatch(/width: 20px;[\s\S]*border-top: 2px dotted var\(--tgt\);/);
    expect(rule('.fig .tgt dd')).toContain('font-size: 40px;');
    expect(rule('.fig .tgt dd small')).toMatch(/font-size: 16px;[\s\S]*font-weight: 600;/);
    expect(rule('.fig .tgt dd.none')).toContain('color: var(--muted);');
    expect(css).toContain('--tgt: #9ca3af;');
  });
});
