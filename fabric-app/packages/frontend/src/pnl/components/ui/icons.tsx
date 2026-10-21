// The mockup's stroke icons (20 × 20, stroke 1.6, round caps), replicated 1:1.
import type { SVGProps } from 'react';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number };

function Svg({ size = 20, viewBox = '0 0 20 20', ...rest }: IconProps & { children: React.ReactNode }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox={viewBox} {...rest} />;
}

export function CalendarIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="4.5" width="14" height="12.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 8.5h14M7 2.5v4M13 2.5v4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function BarsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M2.5 17h15M5 15V9.5M10 15V4.5M15 15V7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function FunnelIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 4h14l-5.5 6.5V16l-3-1.5v-4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </Svg>
  );
}

export function SlidersIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 6h8.5M15.5 6H17M3 14h2.5M9.5 14H17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="13.5" cy="6" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="7.5" cy="14" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  );
}

export function RailToggleIcon({ expanded, ...p }: IconProps & { expanded: boolean }) {
  return (
    <Svg {...p} style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}>
      <path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function TableIcon(p: IconProps) {
  return (
    <Svg size={18} {...p}>
      <rect x="3" y="4" width="14" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 8h14M3 12h14M8 8v8" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  );
}

export function TilesIcon(p: IconProps) {
  return (
    <Svg size={18} {...p}>
      <rect x="3" y="3" width="6" height="6" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11" y="3" width="6" height="6" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="11" width="6" height="6" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11" y="11" width="6" height="6" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  );
}

export function AnalysisIcon(p: IconProps) {
  return (
    <Svg size={18} {...p}>
      <path d="M2.5 17.5h15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="3.5" y="6" width="2.6" height="10" fill="currentColor" />
      <rect x="7.6" y="3.5" width="2.6" height="2.5" fill="currentColor" />
      <rect x="11.7" y="3.5" width="2.6" height="5" fill="currentColor" />
      <rect x="15" y="8.5" width="2.6" height="7.5" fill="currentColor" />
    </Svg>
  );
}

export function ProfitabilityIcon(p: IconProps) {
  return (
    <Svg size={18} {...p}>
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 3v7l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </Svg>
  );
}

export function CloseIcon(p: IconProps) {
  return (
    <Svg size={14} viewBox="0 0 14 14" {...p}>
      <path d="M3 3l8 8M11 3l-8 8" fill="none" stroke="#4F5C6C" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function CheckIcon(p: IconProps) {
  return (
    <Svg size={12} viewBox="0 0 12 12" {...p}>
      <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="var(--acc)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function InfoIcon(p: IconProps) {
  return (
    <Svg size={16} viewBox="0 0 16 16" {...p}>
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="#8A5A00" strokeWidth="1.4" />
      <path d="M8 7v4M8 4.6v.2" fill="none" stroke="#8A5A00" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function ChevronIcon({ open, ...p }: IconProps & { open: boolean }) {
  return (
    <Svg size={12} viewBox="0 0 12 12" {...p} style={{ flex: 'none', transform: open ? 'rotate(90deg)' : 'none' }}>
      <path d="M4.5 3l3 3-3 3" fill="none" stroke="#4F5C6C" strokeWidth="1.6" />
    </Svg>
  );
}
