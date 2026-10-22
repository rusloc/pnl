import type { ReactNode } from 'react';

// The mockup's stroke icons (design guide §5.1: 20 × 20, stroke 1.6, round caps); same shapes as Track A.

function Svg({ size = 20, box = 20, children }: { size?: number; box?: number; children: ReactNode }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox={`0 0 ${box} ${box}`} style={{ flex: 'none' }}>
      {children}
    </svg>
  );
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' } as const;

export const CalendarIcon = () => (
  <Svg>
    <rect x="3" y="4.5" width="14" height="12.5" rx="2" {...stroke} />
    <path d="M3 8.5h14M7 2.5v4M13 2.5v4" {...stroke} />
  </Svg>
);

export const BarsIcon = () => (
  <Svg>
    <path d="M2.5 17h15M5 15V9.5M10 15V4.5M15 15V7.5" {...stroke} strokeWidth={1.8} />
  </Svg>
);

export const FunnelIcon = () => (
  <Svg>
    <path d="M3 4h14l-5.5 6.5V16l-3-1.5v-4z" {...stroke} strokeLinejoin="round" />
  </Svg>
);

export const SlidersIcon = () => (
  <Svg>
    <path d="M3 6h8.5M15.5 6H17M3 14h2.5M9.5 14H17" {...stroke} />
    <circle cx="13.5" cy="6" r="2" {...stroke} />
    <circle cx="7.5" cy="14" r="2" {...stroke} />
  </Svg>
);

export const RailToggleIcon = ({ expanded }: { expanded: boolean }) => (
  <Svg>
    <path d={expanded ? 'M13 4l-6 6 6 6' : 'M7 4l6 6-6 6'} {...stroke} strokeLinejoin="round" />
  </Svg>
);

export const TableIcon = () => (
  <Svg size={18}>
    <rect x="3" y="4" width="14" height="12" rx="1.5" {...stroke} />
    <path d="M3 8h14M3 12h14M8 8v8" {...stroke} />
  </Svg>
);

export const TilesIcon = () => (
  <Svg size={18}>
    <rect x="3" y="3" width="6" height="6" rx="1.2" {...stroke} />
    <rect x="11" y="3" width="6" height="6" rx="1.2" {...stroke} />
    <rect x="3" y="11" width="6" height="6" rx="1.2" {...stroke} />
    <rect x="11" y="11" width="6" height="6" rx="1.2" {...stroke} />
  </Svg>
);

export const AnalysisIcon = () => (
  <Svg size={18}>
    <path d="M2.5 17.5h15" {...stroke} />
    <rect x="3.5" y="6" width="2.6" height="10" fill="currentColor" />
    <rect x="7.6" y="3.5" width="2.6" height="2.5" fill="currentColor" />
    <rect x="11.7" y="3.5" width="2.6" height="5" fill="currentColor" />
    <rect x="15" y="8.5" width="2.6" height="7.5" fill="currentColor" />
  </Svg>
);

export const ProfitabilityIcon = () => (
  <Svg size={18}>
    <circle cx="10" cy="10" r="7" {...stroke} />
    <path d="M10 3v7l5 5" {...stroke} strokeLinejoin="round" />
  </Svg>
);

export const CloseIcon = () => (
  <Svg size={14} box={14}>
    <path d="M3 3l8 8M11 3l-8 8" fill="none" stroke="var(--slate-600)" strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

export const InfoIcon = () => (
  <Svg size={16} box={16}>
    <circle cx="8" cy="8" r="6.5" fill="none" stroke="var(--notice-icon)" strokeWidth={1.4} />
    <path d="M8 7v4M8 4.6v.2" fill="none" stroke="var(--notice-icon)" strokeWidth={1.6} strokeLinecap="round" />
  </Svg>
);

export const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    aria-hidden="true"
    width={12}
    height={12}
    viewBox="0 0 12 12"
    style={{ flex: 'none', transform: open ? 'rotate(90deg)' : 'none' }}
  >
    <path d="M4.5 3l3 3-3 3" fill="none" stroke="var(--slate-600)" strokeWidth={1.6} />
  </svg>
);
