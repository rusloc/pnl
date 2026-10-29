import { readFileSync } from 'node:fs';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LayerFrame } from './Layers';
import type { LayerKind } from './Layers';

// One overlay for every layer (USER 2026-10-29, E-52): each side-bar panel (Filters, How to read, More KPIs) and each
// card pop-up (ⓘ, drill path) opens over the same scrim, and a click on the scrim closes it.

const KINDS: readonly LayerKind[] = ['menu', 'how', 'more', 'explain', 'drill'];
const noop = () => {};
const frame = (kind: LayerKind, onClose = noop) => (
  <LayerFrame kind={kind} onClose={onClose} onClick={noop} panelRef={noop}>
    <p>content</p>
  </LayerFrame>
);

describe('LayerFrame', () => {
  it.each(KINDS)('%s: the scrim first, then the modal dialog', (kind) => {
    const html = renderToStaticMarkup(frame(kind));
    expect(html.startsWith('<div class="scrim"></div>')).toBe(true);
    expect(html.match(/class="scrim"/g)).toHaveLength(1);
    expect(html).toMatch(/role="dialog" aria-modal="true" aria-labelledby="(menu|pop|drawer)-title" tabindex="-1"/);
    expect(html).toContain('<p>content</p>');
  });

  it('side-bar panels keep their shells: menu left, How to read centred, More KPIs drawer right', () => {
    const shell = (kind: LayerKind) =>
      /<(aside|div) class="(menu|pop|drawer) glass"/.exec(renderToStaticMarkup(frame(kind)))?.slice(1);
    expect(KINDS.map(shell)).toEqual([
      ['aside', 'menu'],
      ['div', 'pop'],
      ['aside', 'drawer'],
      ['div', 'pop'],
      ['div', 'pop'],
    ]);
  });

  it.each(KINDS)('%s: a click on the scrim closes the layer', (kind) => {
    const close = () => {};
    const el = LayerFrame({ kind, onClose: close, onClick: noop, panelRef: noop, children: null }) as ReactElement<{
      children: readonly ReactElement<{ className?: string; onClick?: unknown }>[];
    }>;
    const [scrim] = el.props.children;
    expect(scrim?.props.className).toBe('scrim');
    expect(scrim?.props.onClick).toBe(close);
  });

  it('scrim spec: ink #111827 at 22 % (Power BI: #111827, transparency 78 %), above the side bar, below the panels', () => {
    const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
    const rule = (sel: string) => new RegExp(`(?:^|\n)${sel.replace('.', '\.')} \{([^}]*)\}`).exec(css)?.[1] ?? '';
    const z = (sel: string) => Number(/z-index: (\d+)/.exec(rule(sel))?.[1]);
    expect(rule('.scrim')).toContain('background: rgba(17, 24, 39, 0.22);');
    expect(rule('.scrim')).toMatch(/position: fixed;[\s\S]*inset: 0;/);
    expect([z('.sb'), z('.scrim'), z('.menu'), z('.pop'), z('.drawer')]).toEqual([30, 40, 50, 50, 50]);
  });
});
