// Status thresholds (spec KPI §6; `param_kpi_threshold` + `_KPI Status` mirrored; PV-01: vs Budget only).
import { describe, expect, it } from 'vitest';

import { cmStatus, KPI_THRESHOLDS, kpiStatus, STATUS_TEXT, statusChip, statusTone } from './thresholds';

describe('kpiStatus', () => {
  it('mirrors param_kpi_threshold: PCT ±1 % / ±3 %, PP ±0.3 / ±1.0', () => {
    expect(KPI_THRESHOLDS).toEqual({ PCT: { onTrack: 0.01, watch: 0.03 }, PP: { onTrack: 0.3, watch: 1.0 } });
    expect(kpiStatus(0.014, 'PCT', 'Higher')).toBe('ahead');
    expect(kpiStatus(0.01, 'PCT', 'Higher')).toBe('ontrack');
    expect(kpiStatus(-0.004, 'PCT', 'Higher')).toBe('ontrack');
    expect(kpiStatus(-0.03, 'PCT', 'Higher')).toBe('watch');
    expect(kpiStatus(-0.032, 'PCT', 'Higher')).toBe('off');
    expect(kpiStatus(-0.3, 'PP', 'Higher')).toBe('ontrack');
    expect(kpiStatus(-0.9, 'PP', 'Higher')).toBe('watch');
    expect(kpiStatus(-1.1, 'PP', 'Higher')).toBe('off');
    expect(kpiStatus(0.5, 'PP', 'Higher')).toBe('ahead');
  });

  it('inverts "lower is better" (Opex %), and is neutral for a neutral KPI or a blank side', () => {
    expect(kpiStatus(-0.9, 'PP', 'Lower')).toBe('ahead');
    expect(kpiStatus(0.9, 'PP', 'Lower')).toBe('watch');
    expect(kpiStatus(2, 'PP', 'Lower')).toBe('off');
    expect(kpiStatus(0.5, 'PP', 'Neutral')).toBe('neutral');
    expect(kpiStatus(null, 'PCT', 'Higher')).toBe('neutral');
    expect(kpiStatus(Number.NaN, 'PCT', 'Higher')).toBe('neutral');
  });

  it('cmStatus is the PP band, higher is better (the profitability table dot)', () => {
    expect(cmStatus(-0.2)).toBe('ontrack');
    expect(cmStatus(-0.8)).toBe('watch');
    expect(cmStatus(1.4)).toBe('ahead');
    expect(cmStatus(null)).toBe('neutral');
  });

  it('chip words are lower case (PV-08) and the tone follows the status', () => {
    expect(STATUS_TEXT).toEqual({ ontrack: 'on track', ahead: 'ahead', watch: 'watch', off: 'off track' });
    expect(statusChip('neutral')).toBeNull();
    expect(statusChip('off')).toEqual({ kind: 'off', text: 'off track' });
    expect(['neutral', 'ontrack', 'ahead', 'watch', 'off'].map((s) => statusTone(s as never))).toEqual(['neutral', 'plan', 'ahead', 'watch', 'off']);
  });
});
