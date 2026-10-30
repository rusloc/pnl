import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadExecData } from '@/lib/test-utils/exec-data';
import type { ExecData } from '@/lib/engine/cube';
import { DEFAULT_SELECTION } from '@/lib/engine/url-state';
import type { Selection } from '@/lib/engine/url-state';
import { buildView } from '@/lib/engine/view';
import { FiltersMenu } from './Layers';

// Category dropdown in the Filters menu (E-100, USER 2026-10-30): under Region, before the attribute groups; a closed
// button with the pick, a hidden list of checkboxes (names only, "All categories" first).

let d: ExecData;
beforeAll(async () => {
  d = await loadExecData();
});
const noop = () => {};
const html = (patch: Partial<Selection> = {}) => {
  const sel = { ...DEFAULT_SELECTION, ...patch };
  return renderToStaticMarkup(
    <FiltersMenu sel={sel} menu={buildView(d, sel).menu} onSelect={noop} onToggle={noop} onReset={noop} />,
  );
};
const options = (h: string) =>
  [
    ...h.matchAll(
      /<button type="button" role="checkbox" aria-checked="(true|false)" class="dd-o" data-id="([A-Za-z]+)">([^<]+)<\/button>/g,
    ),
  ].map((m) => [m[2], m[3], m[1]]);

describe('Category dropdown', () => {
  it('sits between Region / format and the metric attributes, closed, labelled with the pick', () => {
    const h = html();
    const i = (s: string) => h.indexOf(s);
    expect(i('>Region / format<')).toBeLessThan(i('>Category<'));
    expect(i('>Category<')).toBeLessThan(i('Metric attributes'));
    expect(h).toMatch(
      /<button type="button" class="dd-b" aria-label="Category: All categories" aria-expanded="false" aria-controls="[^"]+" data-dd=""><span>All categories<\/span>/,
    );
    expect(h).toMatch(/<div id="[^"]+" role="group" aria-label="Category" class="dd-l" hidden="">/);
  });

  it('lists "All categories" then the 9 names as checkboxes, no code on screen', () => {
    expect(options(html())).toEqual([
      ['all', 'All categories', 'true'],
      ['FRESH', 'Fresh food', 'false'],
      ['AMBIENT', 'Ambient grocery', 'false'],
      ['HB', 'Health &amp; beauty', 'false'],
      ['HOUSEHOLD', 'Household &amp; cleaning', 'false'],
      ['ELEC', 'Electronics', 'false'],
      ['APPAREL', 'Apparel', 'false'],
      ['HOME', 'Home &amp; kitchen', 'false'],
      ['GARDEN', 'Garden &amp; DIY', 'false'],
      ['TOYS', 'Toys &amp; leisure', 'false'],
    ]);
  });

  it('a pick checks its options and unchecks All; 3 or more = "n categories" with the names as title', () => {
    const h = html({ categories: ['FRESH', 'AMBIENT', 'HB'] });
    expect(
      options(h)
        .filter(([, , on]) => on === 'true')
        .map(([id]) => id),
    ).toEqual(['FRESH', 'AMBIENT', 'HB']);
    expect(h).toContain('aria-label="Category: 3 categories"');
    expect(h).toContain('title="Fresh food, Ambient grocery, Health &amp; beauty"');
    expect(html({ categories: ['ELEC', 'TOYS'] })).toContain('<span>Electronics &amp; Toys &amp; leisure</span>');
  });
});
