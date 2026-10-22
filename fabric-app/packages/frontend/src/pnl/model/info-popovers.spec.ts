// Info pop-up copy (L-15): the shared text with its placeholders filled, never invented.
import { describe, expect, it } from 'vitest';

import { boldRuns, fillInfo, INFO_HEADINGS, INFO_TEXT, infoFor, type InfoKey } from './info-popovers';

const KEYS: InfoKey[] = ['bridge', 'variances', 'profitability', 'cm'];

describe('info pop-up text', () => {
  it('has the four parts for each of the four visuals, with the shared headings', () => {
    for (const key of KEYS) {
      const t = INFO_TEXT[key];
      expect(t.whatItShows.length).toBeGreaterThan(20);
      expect(t.howToRead.length).toBeGreaterThanOrEqual(3);
      expect(t.example.startsWith('"')).toBe(true);
      expect(t.watchOut.length).toBeGreaterThan(20);
    }
    expect(Object.values(INFO_HEADINGS)).toEqual(['What it shows', 'How to read it', 'For example', 'Watch out']);
  });

  it('fills {comparison} and {breakdown} from the current state everywhere, leaving no placeholder behind', () => {
    const filled = infoFor('profitability', { comparison: 'Budget', breakdown: 'channel' });
    expect(filled.title).toBe('Profitability by channel');
    expect(filled.whatItShows).toBe(
      'How much revenue each channel brings in, how it grew against Budget, and how much of that revenue is left as profit at each stage of the P&L.'
    );
    expect(filled.howToRead[1]).toBe('**vs Budget**: revenue growth of the row; green is better than Budget, orange is worse.');
    expect(filled.watchOut).toMatch(/^Costs that are not booked to a channel/);
    const all = [filled.title, filled.whatItShows, ...filled.howToRead, filled.example, filled.watchOut].join('\n');
    expect(all).not.toMatch(/\{(comparison|breakdown)\}/);

    const bridge = infoFor('bridge', { comparison: 'Prior year' });
    expect(bridge.whatItShows).toBe('How net revenue got from Prior year to the current figure, split into the reasons for the change.');
    expect(bridge.howToRead[0]).toBe('The first bar is net revenue in Prior year; the last bar is net revenue now.');
    expect(bridge.title).toBe('Net revenue bridge');

    const cm = infoFor('cm', { comparison: 'Budget', breakdown: 'region' });
    expect(cm.title).toBe('Contribution margin by region');
    expect(cm.whatItShows).toMatch(/^For each region, /);
  });

  it('keeps a placeholder visible rather than inventing a value when the state has none', () => {
    expect(fillInfo('each {breakdown} vs {comparison}', { comparison: 'Budget' })).toBe('each {breakdown} vs Budget');
  });

  it('the examples are the illustrative sentences of the shared document, quoted', () => {
    expect(INFO_TEXT.bridge.example).toBe('"Revenue is 65 m above budget: 128 m from selling more units, partly offset by price / mix and a weaker euro."');
    expect(INFO_TEXT.variances.example).toBe('"Working media is 18 m below budget: a favourable variance, because a lower cost raises profit."');
  });

  it('splits **bold** runs for rendering', () => {
    expect(boldRuns('**FX** = the effect of **rates**.')).toEqual([
      { text: 'FX', bold: true },
      { text: ' = the effect of ', bold: false },
      { text: 'rates', bold: true },
      { text: '.', bold: false },
    ]);
    expect(boldRuns('plain')).toEqual([{ text: 'plain', bold: false }]);
  });
});
