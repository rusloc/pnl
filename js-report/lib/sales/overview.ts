import { CHANNEL_SHORT, INFO, MARKET_NAMES, STORY_EVENTS } from './copy.ts';
import type { Cube } from './cube.ts';
import { fmtCount, fmtEur, fmtEur0, fmtPct } from './format.ts';
import { heroRows } from './kpis.ts';
import { MARKETS } from './manifest.ts';
import type { Metrics } from './metrics.ts';
import { STATUS_WORD, cmpRow } from './status.ts';
import type { SalesSelection } from './types.ts';
import type { ChartCard, HeroCard, OverviewVM, TableCard } from './view-model.ts';
import { axisLabel, monthIndex, shift, trailing13, windowLabel, windowOf } from './windows.ts';

// View 1 — Overview (layout-spec §1): four Tier-1 hero cards, the 2 × 2 "why" grid and the market table.

export interface Ctx {
  cube: Cube;
  m: Metrics;
}

const monthWindow = (i: number) => ({ start: i, end: i });

/** 13 monthly values ending at the anchor, and the same months a year earlier (blank before Jan 2024). */
export function trend(ctx: Ctx, anchor: number, value: (month: number) => number | null) {
  const months = trailing13(anchor);
  const inData = (i: number) => i >= ctx.cube.first && i <= ctx.cube.closed;
  return {
    months,
    x: months.map(axisLabel),
    actual: months.map((i) => (inData(i) ? value(i) : null)),
    py: months.map((i) => (inData(i - 12) ? value(i - 12) : null)),
  };
}

export function storyCallout(chartId: string, months: readonly number[]) {
  const e = STORY_EVENTS.find((s) => s.charts.includes(chartId) && months.includes(monthIndex(s.month)));
  return e ? { index: months.indexOf(monthIndex(e.month)), text: e.text } : null;
}

/** Last ≤ 3 months of the anchor's quarter (cohort / vintage quarters), oldest first. */
export const quarterMonths = (anchor: number, quartersBack = 0): number[] => {
  const end = anchor - (anchor % 3) + 2 - quartersBack * 3;
  return [end - 2, end - 1, end].filter((m) => m <= anchor);
};
export const quarterLabel = (month: number) =>
  `Q${Math.floor((((month % 12) + 12) % 12) / 3) + 1} ${2024 + Math.floor(month / 12)}`;

export function overview(ctx: Ctx, sel: SalesSelection): OverviewVM {
  const { cube, m } = ctx;
  const mk = sel.market;
  const w = windowOf(sel.tv, sel.anchor);
  const py = shift(w, -12);
  const A = m.loans(w, mk);
  const P = m.refLoans(py, mk);
  const budLoans = cube.budget(w, mk, 'LOANS');
  const budNew = cube.budget(w, mk, 'NEW_CLIENTS');

  // O1 Loans issued
  const loansTrend = trend(ctx, sel.anchor, (i) => m.loans(monthWindow(i), mk).loans);
  const o1: HeroCard = {
    id: 'o1',
    label: 'Loans issued',
    info: INFO.o1 ?? '',
    value: fmtCount(A.loans),
    second: fmtEur(A.principal),
    sub: [`avg ticket ${fmtEur0(m.avgTicket(A))}`, budLoans ? `${fmtPct(A.loans / budLoans)} of target loans` : null]
      .filter(Boolean)
      .join(' - '),
    rows: heroRows('countUp', { actual: A.loans, budget: budLoans, py: P?.loans ?? null }),
    spark: { actual: loansTrend.actual, py: loansTrend.py },
    open: 'loans',
  };

  // O2 New clients locked in
  const byChannel = cube.loansBy(w, mk, (r) => r.channel, { repeat: false });
  const top = [...byChannel.entries()].sort((a, b) => b[1].loans - a[1].loans).slice(0, 2);
  const newTrend = trend(ctx, sel.anchor, (i) => m.loans(monthWindow(i), mk).first);
  const o2: HeroCard = {
    id: 'o2',
    label: 'New clients locked in',
    info: INFO.o2 ?? '',
    value: fmtCount(A.first),
    second: null,
    sub: [
      `${fmtPct(A.loans ? A.first / A.loans : null)} of loans`,
      ...top.map(([c, s]) => `${CHANNEL_SHORT[c] ?? c} ${fmtPct(A.first ? s.loans / A.first : null, 0)}`),
    ].join(' - '),
    rows: heroRows('countUp', { actual: A.first, budget: budNew, py: P?.first ?? null }),
    spark: { actual: newTrend.actual, py: newTrend.py },
    open: 'clients',
  };

  // O3 Returning clients (client-weighted)
  const ret = m.returning(sel.tv, sel.anchor, mk);
  const retTrend = trend(ctx, sel.anchor, (i) => m.returning('M', i, mk));
  const r180 = m.repeat180(sel.anchor - 6, mk);
  const o3: HeroCard = {
    id: 'o3',
    label: 'Returning clients',
    info: INFO.o3 ?? '',
    value: fmtPct(ret),
    second: null,
    sub: ['of borrowers', `${fmtPct(m.repeatShare(A))} of loans`, `180-day repeat ${fmtPct(r180, 0)}`].join(' - '),
    rows: heroRows('ratioUp', { actual: ret, py: m.refReturning(sel.tv, sel.anchor - 12, mk) }),
    spark: { actual: retTrend.actual, py: retTrend.py },
    open: 'clients',
  };

  // O4 Bad / overdue loans (30+ DPD by balance at the anchor month)
  const snap = m.snap(sel.anchor, mk);
  const dpdTrend = trend(ctx, sel.anchor, (i) => m.dpd30At(i, mk));
  const o4: HeroCard = {
    id: 'o4',
    label: 'Bad / overdue loans',
    info: INFO.o4 ?? '',
    value: fmtPct(m.dpd30(snap)),
    second: null,
    sub: [
      '30+ DPD by balance',
      `90+ ${fmtPct(m.dpd90(snap))}`,
      `vintage 6m ${fmtPct(m.vintageBad6(sel.anchor - 6, mk))}`,
    ].join(' - '),
    rows: heroRows('riskDown', {
      actual: m.dpd30(snap),
      budget: cube.budgetDpd30(sel.anchor, mk),
      py: m.dpd30At(sel.anchor - 12, mk),
    }),
    spark: { actual: dpdTrend.actual, py: dpdTrend.py },
    open: 'portfolio',
  };

  // O5 Loans issued by month vs Budget
  const o5: ChartCard = {
    id: 'o5',
    title: 'Loans issued by month vs Budget',
    info: INFO.o5 ?? '',
    open: 'loans',
    legend: [
      { label: 'Actual', role: 'actual' },
      { label: 'Budget', role: 'budget' },
      { label: 'Prior year', role: 'py' },
      { label: 'selected month', role: 'selected' },
    ],
    chart: {
      kind: 'line',
      x: loansTrend.x,
      months: loansTrend.months,
      unit: 'count',
      series: [
        { name: 'Actual', role: 'actual', values: loansTrend.actual },
        {
          name: 'Budget',
          role: 'budget',
          values: loansTrend.months.map((i) =>
            i >= cube.first && i <= cube.closed ? cube.budget(monthWindow(i), mk, 'LOANS') : null,
          ),
        },
        { name: 'Prior year', role: 'py', values: loansTrend.py },
      ],
      selected: 12,
      callout: null,
      zeroBased: false,
    },
  };

  // O6 New clients by acquisition channel
  const pyByChannel = cube.available(py) ? cube.loansBy(py, mk, (r) => r.channel, { repeat: false }) : null;
  const o6: ChartCard = {
    id: 'o6',
    title: 'New clients by acquisition channel',
    info: INFO.o6 ?? '',
    open: 'clients',
    legend: [
      { label: windowLabel(w), role: 'actual' },
      { label: 'Prior year', role: 'ghost' },
    ],
    chart: {
      kind: 'bars',
      unit: 'count',
      rows: cube.dims.channel.map((c) => {
        const v = byChannel.get(c.channel_code)?.loans ?? 0;
        return {
          label: CHANNEL_SHORT[c.channel_code] ?? c.channel_name,
          value: v,
          ghost: pyByChannel ? (pyByChannel.get(c.channel_code)?.loans ?? 0) : null,
          tick: null,
          text: `${fmtCount(v)} - ${fmtPct(A.first ? v / A.first : null, 0)}`,
        };
      }),
    },
  };

  // O7 Cohort repeat curve: anchor quarter, previous quarter, same quarter a year earlier
  const cohorts = [quarterMonths(sel.anchor), quarterMonths(sel.anchor, 1), quarterMonths(sel.anchor, 4)];
  const dayLabels = cube.cohortDays.map((d) => (d % 30 === 0 ? `${d} d` : ''));
  const o7: ChartCard = {
    id: 'o7',
    title: 'Returning clients - cohort repeat curve',
    info: INFO.o7 ?? '',
    open: 'clients',
    legend: cohorts.map((c, k) => ({
      label: `${k === 0 ? 'Cohort ' : ''}${quarterLabel(c[0] ?? sel.anchor)}`,
      role: k === 0 ? 'c1' : k === 1 ? 'c2' : 'py',
    })),
    chart: {
      kind: 'line',
      x: dayLabels,
      months: null,
      unit: 'pct',
      series: cohorts.map((c, k) => ({
        name: quarterLabel(c[0] ?? sel.anchor),
        role: k === 0 ? 'c1' : k === 1 ? 'c2' : 'py',
        values: m.cohortCurve(c, mk),
      })),
      selected: null,
      callout: null,
      zeroBased: true,
    },
  };

  // O8 30+ DPD by market, 13 months
  const months13 = trailing13(sel.anchor);
  const o8: ChartCard = {
    id: 'o8',
    title: '30+ DPD by market, 13 months',
    info: INFO.o8 ?? '',
    open: 'portfolio',
    legend: MARKETS.map((c, k) => ({ label: MARKET_NAMES[c], role: k === 0 ? 'c1' : k === 1 ? 'c2' : 'py' })),
    chart: {
      kind: 'line',
      x: months13.map(axisLabel),
      months: months13,
      unit: 'pct',
      series: MARKETS.map((c, k) => ({
        name: MARKET_NAMES[c],
        role: k === 0 ? 'c1' : k === 1 ? 'c2' : 'py',
        values: months13.map((i) => m.dpd30At(i, c)),
      })),
      selected: null,
      callout: storyCallout('o8', months13),
      zeroBased: false,
    },
  };

  return { heroes: [o1, o2, o3, o4], charts: [o5, o6, o7, o8], table: marketTable(ctx, sel) };
}

function marketTable(ctx: Ctx, sel: SalesSelection): TableCard {
  const { cube, m } = ctx;
  const w = windowOf(sel.tv, sel.anchor);
  const cmpName = sel.cmp === 'BUD' ? 'vs Budget' : 'vs PY';
  return {
    id: 'o9',
    title: `Markets - ${windowLabel(w)}`,
    info: INFO.o9 ?? '',
    columns: [
      { key: 'market', label: 'Market', width: 160, align: 'left' },
      { key: 'loans', label: 'Loans', width: 120, align: 'right' },
      { key: 'delta', label: cmpName, width: 120, align: 'right' },
      { key: 'principal', label: 'Principal €', width: 140, align: 'right' },
      { key: 'new', label: 'New clients', width: 140, align: 'right' },
      { key: 'ret', label: 'Returning %', width: 120, align: 'right' },
      { key: 'dpd', label: '30+ DPD %', width: 120, align: 'right' },
      { key: 'status', label: 'Status', width: 96, align: 'left' },
    ],
    rows: MARKETS.map((c) => {
      const a = m.loans(w, c);
      const ref = sel.cmp === 'BUD' ? cube.budget(w, c, 'LOANS') : (m.refLoans(shift(w, -12), c)?.loans ?? null);
      const row = cmpRow('countUp', cmpName, a.loans, ref);
      return {
        key: c,
        selected: sel.market === c,
        action: { kind: 'market', market: c },
        secondary: { kind: 'drill', drill: { kind: 'loans', market: c } },
        cells: [
          { text: MARKET_NAMES[c] },
          { text: fmtCount(a.loans) },
          { text: row.text, status: row.status },
          { text: fmtEur(a.principal) },
          { text: fmtCount(a.first) },
          { text: fmtPct(m.returning(sel.tv, sel.anchor, c)) },
          { text: fmtPct(m.dpd30At(sel.anchor, c)) },
          {
            text: row.status === 'neutral' ? STATUS_WORD.neutral : `${row.text.slice(0, 1)} ${STATUS_WORD[row.status]}`,
            status: row.status,
            chip: true,
          },
        ],
      };
    }),
    note: null,
    action: { label: 'Show loans', drill: { kind: 'loans', market: sel.market } },
    needsDetail: false,
  };
}
