// Rail geometry and the four filter groups, shared by the rail and the flyout.
import type { PanelKey } from '../model/types';
import { BarsIcon, CalendarIcon, FunnelIcon, SlidersIcon } from './ui/icons';

export const RAIL_WIDTH = { collapsed: 64, expanded: 248 } as const;

export const RAIL_GROUPS: readonly { key: PanelKey; label: string; Icon: typeof CalendarIcon }[] = [
  { key: 'period', label: 'Period', Icon: CalendarIcon },
  { key: 'compare', label: 'Versions', Icon: BarsIcon },
  { key: 'slice', label: 'Slice', Icon: FunnelIcon },
  { key: 'display', label: 'Display', Icon: SlidersIcon },
];

export function railItemId(key: PanelKey): string {
  return `rail-item-${key}`;
}
