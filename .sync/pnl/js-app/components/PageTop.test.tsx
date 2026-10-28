import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Dataset } from '@/lib/data/dataset';
import { createEngine, type Engine } from '@/lib/engine';
import type { Selection } from '@/lib/engine/types';
import { loadPublicDataset } from '@/lib/test-utils/public-data';
import { selection } from '@/lib/test-utils/selection';
import { CompanyPicker } from './CompanyPicker';
import { FilterRail } from './FilterRail';
import { Flyout } from './Flyout';
import { AppliedFilters, Header } from './Header';
import { nextChoice } from './primitives';

// Page top (Track B reference) and period picker v2 (docs/design/period-picker-v2.md), server-rendered with real
// engine output. Effects (focus, Escape, outside click) need a browser and are covered by the click-test.
let ds: Dataset;
let engine: Engine;
beforeAll(async () => {
  ds = await loadPublicDataset(['P']);
  engine = createEngine(ds);
});

const noop = () => undefined;
const flyout = (sel: Selection) =>
  renderToStaticMarkup(
    <Flyout
      panel="period"
      wide={false}
      sel={sel}
      defaults={selection()}
      manifest={ds.manifest}
      period={engine.period(sel)}
      onChange={noop}
      onClose={noop}
    />,
  );
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const monthButtons = (html: string) => html.match(/<button[^>]*role="radio"[^>]*class="[^"]*month[^"]*"[^>]*>/g) ?? [];

describe('period picker v2', () => {
  it('order: summary, Show, Year, grid; plain labels; years without FY; Back to default + Done', () => {
    const t = text(flyout(selection()));
    const order = ['Period', 'Showing Jan – Sep 2026 - year to date', 'Show', 'One month', 'Year', '2024', 'Up to'];
    const at = order.map((s) => t.indexOf(s));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    for (const label of ['Quarter to date', 'Year to date', 'Last 12 months', 'Full year']) expect(t).toContain(label);
    expect(t).not.toMatch(/FY20\d\d|\bQTD\b|\bLTM\b/);
    expect(t).toContain('Back to default');
    expect(t).toContain('Done');
    expect(t).not.toContain('Dashed months'); // no footnote
  });

  it('three radiogroups, each labelled; only the checked option is tabbable', () => {
    const html = flyout(selection());
    expect(html.match(/role="radiogroup"/g)).toHaveLength(3);
    for (const id of ['period-show', 'period-year', 'period-month']) expect(html).toContain(`aria-labelledby="${id}"`);
    expect(html.match(/role="radio" aria-checked="true"[^>]*tabindex="0"/g)).toHaveLength(3);
    expect(html.match(/tabindex="0"/g)).toHaveLength(3);
    expect(html).toContain('aria-live="polite"');
  });

  it('month grid label follows the time view; Full year hides the grid', () => {
    expect(text(flyout(selection({ timeView: 'MTD' })))).toContain(' Month ');
    expect(text(flyout(selection({ timeView: 'LTM' })))).toContain('Ending');
    const fy = flyout(selection({ timeView: 'FY' }));
    expect(text(fy)).toContain('Full year covers January to December.');
    expect(monthButtons(fy)).toHaveLength(0);
    expect(fy.match(/role="radiogroup"/g)).toHaveLength(2);
  });

  it('Actual: Oct – Dec disabled with "not closed yet" and the hint; covered months shaded', () => {
    const html = flyout(selection());
    const buttons = monthButtons(html);
    expect(buttons).toHaveLength(12);
    const disabled = buttons.filter((b) => b.includes('aria-disabled="true"'));
    expect(disabled).toHaveLength(3);
    expect(
      disabled.every((b) => b.includes('title="Switch the base to Latest estimate to include forecast months."')),
    ).toBe(true);
    expect(html.match(/not closed yet/g)).toHaveLength(3);
    expect(buttons.filter((b) => /monthCovered/.test(b))).toHaveLength(8); // Jan – Aug; Sep is the solid anchor
  });

  it('Latest estimate / Budget: open months selectable with a small label', () => {
    const le = flyout(selection({ base: 'LE' }));
    expect(le).not.toContain('aria-disabled');
    expect(le.match(/>forecast</g)).toHaveLength(3);
    expect(flyout(selection({ base: 'B' })).match(/>budget</g)).toHaveLength(3);
  });

  it('other flyouts keep "Reset this group"', () => {
    const html = renderToStaticMarkup(
      <Flyout
        panel="display"
        wide={false}
        sel={selection()}
        defaults={selection()}
        manifest={ds.manifest}
        period={engine.period(selection())}
        onChange={noop}
        onClose={noop}
      />,
    );
    expect(text(html)).toContain('Reset this group');
    expect(text(html)).not.toContain('Showing');
  });

  it('display: units buttons carry the currency symbol; Hide empty lines is a live switch (M-22)', () => {
    const display = (sel: Selection) =>
      renderToStaticMarkup(
        <Flyout
          panel="display"
          wide={false}
          sel={sel}
          defaults={selection()}
          manifest={ds.manifest}
          period={engine.period(sel)}
          onChange={noop}
          onClose={noop}
        />,
      );
    const units = (html: string) => (html.match(/aria-label="Units"[^]*?<\/div>/)?.[0] ?? '').match(/>[^<]+</g);
    expect(units(display(selection()))).toEqual(['>$m<', '>$k<']);
    expect(units(display(selection({ currency: 'EUR' })))).toEqual(['>€m<', '>€k<']);
    expect(units(display(selection({ currency: 'GBP' })))).toEqual(['>£m<', '>£k<']);
    const hide = (html: string) => html.match(/<button[^>]*role="switch" aria-label="Hide empty lines"[^>]*>/)?.[0];
    expect(hide(display(selection()))).toContain('aria-checked="true"');
    expect(hide(display(selection()))).not.toContain('disabled');
    expect(hide(display(selection({ hideEmpty: false })))).toContain('aria-checked="false"');
    expect(text(display(selection()))).not.toContain('Not built yet');
  });
});

describe('arrow keys (nextChoice)', () => {
  const none = () => false;
  it('→ / ↓ next, ← / ↑ previous, wrapping; other keys ignored', () => {
    expect(nextChoice(0, 'ArrowRight', 5, none)).toBe(1);
    expect(nextChoice(0, 'ArrowDown', 5, none)).toBe(1);
    expect(nextChoice(0, 'ArrowLeft', 5, none)).toBe(4);
    expect(nextChoice(4, 'ArrowUp', 5, none)).toBe(3);
    expect(nextChoice(4, 'ArrowRight', 5, none)).toBe(0);
    expect(nextChoice(2, ' ', 5, none)).toBeNull();
    expect(nextChoice(2, 'Tab', 5, none)).toBeNull();
  });
  it('skips disabled months (Oct – Dec under Actual)', () => {
    const open = (i: number) => i >= 9;
    expect(nextChoice(8, 'ArrowRight', 12, open)).toBe(0);
    expect(nextChoice(0, 'ArrowLeft', 12, open)).toBe(8);
    expect(nextChoice(0, 'ArrowRight', 1, none)).toBeNull();
    expect(nextChoice(0, 'ArrowRight', 3, (i) => i !== 0)).toBeNull();
  });
});

describe('page top', () => {
  const header = (sel: Selection, filtersOpen = false) =>
    renderToStaticMarkup(
      <Header
        sel={sel}
        status={engine.header(sel, 'UTC').status}
        filters={engine.header(sel, 'UTC').filters}
        notices={engine.notices(sel)}
        filtersOpen={filtersOpen}
        onToggleFilters={noop}
        onCloseFilters={noop}
        shareUrl="https://example.test/"
        onChange={noop}
        pager={null}
        howToRead={null}
      />,
    );

  it('title row: Profit & loss, filters button, status line; tabs; no context line, cards or toolbar', () => {
    const t = text(header(selection()));
    expect(t).toMatch(
      /Profit &amp; loss .*Consumer Products - Management reporting - Closed through Sep 2026 - Refreshed \d{1,2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}/,
    );
    expect(header(selection())).toContain('aria-label="Applied filters"');
    for (const tab of ['P&amp;L statement', 'Vitals', 'Analysis', 'Profitability']) expect(t).toContain(tab); // Key figures renamed Vitals (redesign v4)
    expect(t).not.toMatch(/Management reporting ·|Actual vs Budget and Prior year|Variance|By function|Standard/);
    expect(t).toContain('Copy link');
  });

  it('applied-filters pop-up: Track B rows, Period = summary sentence, labelled notice rows last', () => {
    const sel = selection({ timeView: 'FY', month: 12 }); // passes the close: Cut-off notice (C-01)
    const html = renderToStaticMarkup(
      <AppliedFilters filters={engine.header(sel, 'UTC').filters} notices={engine.notices(sel)} onClose={noop} />,
    );
    const t = text(html);
    const labels = ['Company', 'Fiscal year', 'Period', 'Time view', 'Versions', 'Currency', 'FX basis', 'Units'];
    const at = [...labels, 'Regions', 'Slices'].map((l) => t.indexOf(` ${l} `));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(t).toContain('Showing Jan – Sep 2026 - full year'); // C-01 cut under Actual
    expect(t.indexOf('Actuals closed through Sep 2026')).toBeGreaterThan(t.indexOf('All slices'));
    // Parity rule 9: one dl row per notice, labelled as Track B
    expect(html).toMatch(
      /<div class="[^"]*noticeRow[^"]*"><dt>Cut-off<\/dt><dd>Actuals closed through Sep 2026: later months excluded; use Latest estimate for the full window<\/dd><\/div>/,
    );
    expect(html).not.toContain('<ul');
    expect(html).toContain('role="dialog"');
    expect(header(sel, true)).toContain('aria-expanded="true"');
  });

  it('no notice row at all when none applies (parity rule 9)', () => {
    const sel = selection();
    const html = renderToStaticMarkup(
      <AppliedFilters filters={engine.header(sel, 'UTC').filters} notices={engine.notices(sel)} onClose={noop} />,
    );
    expect(html).not.toContain('noticeRow');
    expect(text(html)).not.toMatch(/None for this selection|Cut-off|Forecast/);
  });

  it('funnel button carries the notice count (C-50), none without notices', () => {
    const withNotice = header(selection({ timeView: 'FY', month: 12 }));
    expect(withNotice).toContain('aria-label="Applied filters (1 notice)"');
    expect(withNotice).toMatch(/<span aria-hidden="true" class="[^"]*noticeCount[^"]*">1<\/span>/);
    const none = header(selection());
    expect(none).toContain('aria-label="Applied filters"');
    expect(none).not.toContain('noticeCount');
  });

  it('rail: brand mark opens the company picker; period tooltip is the summary sentence', () => {
    const html = renderToStaticMarkup(
      <FilterRail
        wide={false}
        onToggleWide={noop}
        openPanel={null}
        onTogglePanel={noop}
        summaries={{ period: 'Showing Jan – Sep 2026 - year to date', versions: 'v', slice: 's', display: 'd' }}
      />,
    );
    expect(html).toMatch(/<button id="rail-company"[^>]*aria-label="Switch company"/);
    expect(html).toContain('title="Showing Jan – Sep 2026 - year to date"');
  });

  it('company picker: three companies, current checked, Group off with its reason', () => {
    const html = renderToStaticMarkup(
      <CompanyPicker
        entity="S"
        companies={[
          { code: 'P', name: 'Consumer Products' },
          { code: 'S', name: 'Commerce Cloud' },
          { code: 'GROUP', name: 'ACME Group' },
        ]}
        wide={false}
        onSelect={noop}
        onClose={noop}
      />,
    );
    expect(html.match(/role="radio"/g)).toHaveLength(3);
    expect(html).toMatch(/aria-checked="true"[^>]*>.*?Commerce Cloud/);
    expect(html).toContain('Goods - retail, D2C, marketplaces'); // parity rule 6
    expect(text(html)).not.toContain(' · ');
    expect(html).toMatch(/aria-disabled="true"[^>]*title="Not built yet \(ADR-0002 build step 4\)/);
  });
});
