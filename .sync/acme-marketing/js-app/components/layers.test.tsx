import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { loadDataset } from '@/lib/test-utils/marketing-data';
import { DEFAULT_SELECTION } from '@/lib/engine/selection';
import { cardInfo, context, dynamics, options, preview } from '@/lib/engine/view';
import { DynamicsPop, FiltersWindow, GROUPS, HowPop, InfoPop } from './Layers';

// The layers render as modal dialogs with a close button (A-59); the Filters window has the six rail entries, the
// "SAME PERIOD LY" label, the live preview and Reset group · Reset all · Apply (§5.5). Interaction (Esc, outside click,
// focus trap) is MarketingApp's and is exercised in the headless smoke run.

const ds = await loadDataset();
const ctx = context(ds, DEFAULT_SELECTION);
const noop = () => {};

describe('layers', () => {
  it('ⓘ pop-up: title, what, formula, note with the window and model', () => {
    const html = renderToStaticMarkup(<InfoPop info={cardInfo(ctx, 'O1')} style={{ top: 0, left: 0 }} />);
    expect(html).toMatch(/role="dialog" aria-modal="true"/);
    expect(html).toContain('Acquisition funnel');
    expect(html).toContain('Window Oct 5 – Nov 3  |  vs prior 30 d | model Data-driven.');
    expect(html).toContain('data-close');
  });
  it('How to read: one per view', () => {
    expect(renderToStaticMarkup(<HowPop view="journey" />)).toContain('How to read');
  });
  it('dynamics: "<metric> | dynamics", one line chart with LY dashed and the last label', () => {
    const html = renderToStaticMarkup(<DynamicsPop v={dynamics(ctx, 1)} />);
    expect(html).toContain('Spend | dynamics');
    expect(html).toContain('class="s-ly"');
    expect(html).toContain('class="s-now"');
    expect(html.match(/<svg/g)).toHaveLength(1);
  });
  it('Filters window: six rails, SAME PERIOD LY, preview, three footer buttons', () => {
    const html = renderToStaticMarkup(
      <FiltersWindow
        opts={options(ds)}
        pending={DEFAULT_SELECTION}
        set={noop}
        group="period"
        setGroup={noop}
        dots={{ period: 0, scope: 0, channels: 0, campaigns: 0, audience: 0, attribution: 0 }}
        pv={preview(ds, DEFAULT_SELECTION)}
        toIso={ds.cal.iso}
        toIx={ds.cal.ix}
        defaultWindow={{ from: ctx.w.a, to: ctx.w.b }}
        onApply={noop}
        onResetGroup={noop}
        onResetAll={noop}
      />,
    );
    expect(GROUPS).toHaveLength(6);
    for (const t of ['Period', 'Scope', 'Channels', 'Campaigns', 'Audience', 'Attribution', 'SAME PERIOD LY'])
      expect(html).toContain(t);
    expect(html).toContain('$188.4k');
    expect(html).toMatch(/Reset group.*Reset all.*Apply/);
  });
});
