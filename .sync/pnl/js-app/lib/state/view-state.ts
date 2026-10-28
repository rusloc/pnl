import { z } from 'zod';
import type { VarCut, VarMode, VarTop } from '../engine/view-types.ts';

// URL keys of the P&L views redesign (F-37 shareable link): sub-page and the largest-variances controls. Validated at
// the boundary like the Selection keys: an invalid value falls back to its default and the URL is rewritten; defaults
// are omitted. The view itself stays `v` (Vitals keeps the value `kpi`).
//   p   = sub-page of Analysis / Profitability (1 | 2)
//   lvn = Top-N (8 | 12 | all) · lvm = grouping (block | abs) · lvc = cut (none | region | channel | line | segment)

export interface ViewState {
  page: 1 | 2;
  top: VarTop;
  mode: VarMode;
  cut: VarCut;
}

export const VIEW_STATE_DEFAULTS: ViewState = { page: 1, top: 8, mode: 'block', cut: 'none' };

const schema = z
  .object({
    p: z
      .enum(['1', '2'])
      .transform((v): ViewState['page'] => (v === '2' ? 2 : 1))
      .catch(1),
    lvn: z
      .enum(['8', '12', 'all'])
      .transform((v): VarTop => (v === 'all' ? 'all' : v === '12' ? 12 : 8))
      .catch(8),
    lvm: z.enum(['block', 'abs']).catch('block'),
    lvc: z.enum(['none', 'region', 'channel', 'line', 'segment']).catch('none'),
  })
  .strict();

type Query = Pick<URLSearchParams, 'get'>;

export function parseViewState(q: Query): ViewState {
  const r = schema.parse({
    p: q.get('p') ?? '1',
    lvn: q.get('lvn') ?? '8',
    lvm: q.get('lvm') ?? 'block',
    lvc: q.get('lvc') ?? 'none',
  });
  return { page: r.p, top: r.lvn, mode: r.lvm, cut: r.lvc };
}

/** Non-default keys only, appended after the Selection keys. */
export function serializeViewState(s: ViewState): string {
  const out = new URLSearchParams();
  if (s.page !== 1) out.set('p', String(s.page));
  if (s.top !== 8) out.set('lvn', String(s.top));
  if (s.mode !== 'block') out.set('lvm', s.mode);
  if (s.cut !== 'none') out.set('lvc', s.cut);
  return out.toString();
}

export const joinQuery = (...parts: string[]) => parts.filter(Boolean).join('&');
