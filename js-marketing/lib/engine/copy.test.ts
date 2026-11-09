import { describe, expect, it } from 'vitest';
import { CARDS, CHIPS, FLAG_WORDS, HOW_TO_READ, VIEWS, VITAL_LABELS, dynamicsTitle, infoNote } from './copy.ts';

// Copy source (contract §4, sync point 1): 29 cards, five How to read pop-ups, the vitals labels and the house divider.
// The verbatim diff against the PBIP (dim_card.tmdl + the howto text boxes) is bip's at sync point 1.

describe('copy.ts', () => {
  it('holds the 29 dim_card rows in sort order', () => {
    expect(CARDS.map((c) => c.code)).toEqual(
      'V1 V2 V3 V4 V5 V6 O1 O2 O3 O7 O5 O6 C1 C2 C5 C6 P1 P5 P6 P7 J1 J2 J3 J4 K1 K2 K6 K7 K3'.split(' '),
    );
    for (const c of CARDS)
      for (const k of ['title', 'what', 'formula', 'note'] as const) expect(c[k].length).toBeGreaterThan(0);
  });
  it('one How to read per view', () => {
    expect(VIEWS.map((v) => v.key)).toEqual(Object.keys(HOW_TO_READ.text));
    for (const v of VIEWS) expect(HOW_TO_READ.text[v.key].length).toBeGreaterThan(0);
  });
  it('vitals labels are the titles in capitals; dynamics titles use the " | " divider', () => {
    for (const [code, label] of Object.entries(VITAL_LABELS))
      expect(CARDS.find((c) => c.code === code)?.title.toUpperCase()).toBe(label);
    expect(dynamicsTitle('ROAS 90 d')).toBe('ROAS 90 d | dynamics');
    expect(infoNote('Note.', 'Oct 5 – Nov 3  |  vs prior 30 d', 'Data-driven')).toBe(
      'Note.   Window Oct 5 – Nov 3  |  vs prior 30 d | model Data-driven.',
    );
    expect(CHIPS.segmentJoin).toBe(' | ');
  });
  it('flag words and chip labels carry no digits (numbers come from the engine)', () => {
    for (const w of [...Object.values(FLAG_WORDS), ...Object.values(CHIPS).filter((x) => typeof x === 'string')])
      expect(w).not.toMatch(/\d/);
  });
});
