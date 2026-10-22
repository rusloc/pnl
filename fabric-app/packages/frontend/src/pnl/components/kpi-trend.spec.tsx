// Trend area of a KPI tile (K-24, K-25): the SVG pieces and the per-tile states.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TREND_LOADING_TEXT, TREND_UNAVAILABLE_TEXT } from '../model/sample-mode';
import { monthLabel } from '../model/trend-geometry';
import type { KpiTrend } from '../model/types';
import { Sparkline, TargetBar, TrendArea } from './kpi-trend';

function trend(values: (number | null)[], open: number[] = []): KpiTrend {
  return {
    code: 'NR',
    points: values.map((value, i) => ({
      month: `2025-${String(((i + 8) % 12) + 1).padStart(2, '0')}`,
      value,
      text: value === null ? '' : `${value.toFixed(1)}m`,
      isOpen: open.includes(i),
    })),
  };
}

const marks = (a: number | null, b?: number | null) => [
  { name: 'Budget', value: a, text: a === null ? '' : `${a.toFixed(1)}m` },
  ...(b === undefined ? [] : [{ name: 'Prior year', value: b, text: b === null ? '' : `${b.toFixed(1)}m` }]),
];

describe('Sparkline', () => {
  it('draws one path per run, a marker on the selected month and a dot per blank month, with an accessible description', () => {
    const t = trend([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    const { container } = render(<Sparkline trend={t} />);
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('aria-label', '13-month trend to Sep: from 1.0m in Sep to 13.0m in Sep');
    expect(screen.getByTestId('sparkline-marker').querySelector('title')?.textContent).toBe('Sep: 13.0m');
    expect(container.querySelectorAll('path')).toHaveLength(1);
    expect(screen.getByTestId('sparkline-marker')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-blank]')).toHaveLength(0);
  });

  it('breaks the line at open months and drops the marker when the selected month is open', () => {
    const t = trend([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, null, null, null], [10, 11, 12]);
    const { container } = render(<Sparkline trend={t} />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', expect.stringMatching(/; 3 months blank$/));
    expect(container.querySelectorAll('path')).toHaveLength(1);
    expect(screen.queryByTestId('sparkline-marker')).toBeNull();
    expect(container.querySelectorAll('[data-blank]')).toHaveLength(3);
  });

  it('says so when no month is closed', () => {
    render(<Sparkline trend={trend([null, null], [0, 1])} />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', expect.stringMatching(/^No closed months/));
  });

  it('monthLabel reads a YYYY-MM key', () => {
    expect(monthLabel('2026-09')).toBe('Sep');
    expect(monthLabel('2026-01')).toBe('Jan');
  });
});

describe('TargetBar', () => {
  it('draws the base bar and one labelled tick per comparison, named in the legend and the description', () => {
    const { container } = render(<TargetBar target={{ base: 80, marks: marks(100, 50) }} baseText="$80.0m" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Value $80.0m; Budget 100.0m; Prior year 50.0m');
    // 1-unit padding on a 100-wide scale: 80 → x 79.4, bar from zero (1) = 78.4 wide.
    expect(screen.getByTestId('target-bar-base')).toHaveAttribute('width', '78.4');
    expect(container.querySelectorAll('[data-tick="a"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-tick="b"]')).toHaveLength(1);
    expect(screen.getByText('Budget')).toBeInTheDocument();
    expect(screen.getByText('Prior year')).toBeInTheDocument();
  });

  it('renders nothing when there is no value at all', () => {
    const { container } = render(<TargetBar target={{ base: null, marks: marks(null) }} baseText="n/a" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('TrendArea (progressive states)', () => {
  const target = { base: 80, marks: marks(100) };

  it('shows the loading state (also when the tile has no trend entry yet) while the target bar from the tile values is already there', () => {
    render(<TrendArea state={undefined} target={target} baseText="80.0m" />);
    expect(screen.getByRole('status')).toHaveTextContent(TREND_LOADING_TEXT);
    expect(screen.getByTestId('trend-area')).toHaveAttribute('data-trend-state', 'loading');
    expect(screen.getByTestId('target-bar')).toBeInTheDocument();
  });

  it('shows "not available" with the reason as the title, never numbers', () => {
    render(<TrendArea state={{ kind: 'unavailable', reason: 'because' }} target={null} baseText="n/a" />);
    expect(screen.getByText(TREND_UNAVAILABLE_TEXT)).toHaveAttribute('title', 'because');
    expect(screen.queryByTestId('sparkline')).toBeNull();
    expect(screen.queryByTestId('target-bar')).toBeNull();
  });

  it('shows the sparkline when ready; growth KPIs (no target) get the sparkline only (K-25)', () => {
    render(<TrendArea state={{ kind: 'ready', trend: trend([1, 2, 3]) }} target={null} baseText="3.0m" />);
    expect(screen.getByTestId('sparkline')).toBeInTheDocument();
    expect(screen.queryByTestId('target-bar')).toBeNull();
    expect(screen.getByTestId('trend-area')).toHaveAttribute('data-trend-state', 'ready');
  });
});
