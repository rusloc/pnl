// Fill of a heatmap cell (the model's `_Heat GM Fill Raw`, PV-03: the column's GM %):
// the company tint (0) → colour (1) by GM band < 30 / < 50 / < 70 / ≥ 70 %; white for a blank.
import { COMPANY_THEME } from '../theme/company';
import type { EntityCode } from './types';

function hex(c: string): [number, number, number] {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

export function heatFill(gm: number | null, entity: EntityCode): { fill: string; ink: string } {
  if (gm === null) return { fill: '#FFFFFF', ink: '#101B2B' };
  const t = gm < 0.3 ? 0.15 : gm < 0.5 ? 0.4 : gm < 0.7 ? 0.65 : 0.9;
  const from = hex(COMPANY_THEME[entity].accT);
  const to = hex(COMPANY_THEME[entity].acc);
  const mixed = from.map((f, i) => Math.round(f + (to[i] - f) * t));
  return { fill: `#${mixed.map((c) => c.toString(16).padStart(2, '0')).join('')}`, ink: gm >= 0.5 ? '#FFFFFF' : '#101B2B' };
}
