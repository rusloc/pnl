import { CHANNEL_SHORT, MARKET_NAMES, STORY_EVENTS, info } from './copy.ts';
import type { InfoValue } from './copy.ts';
import type { Cube } from './cube.ts';
import { fmtCount, fmtDeltaPct, fmtEur, fmtEur0, fmtInt, fmtPct } from './format.ts';
import { heroChip, heroRows } from './kpis.ts';
import type { Bundle } from './kpis.ts';
import { MARKETS } from './manifest.ts';
import type { Metrics } from './metrics.ts';
import { STATUS_WORD, cmpRow } from './status.ts';
import type { DeltaKind } from './status.ts';
import type { SalesSelection, ViewId } from './types.ts';
import type { ChartCard, HeroCard, OverviewVM, TableCard } from './view-model.ts';
import { axisLabel, monthIndex, monthKey, monthLabel, shift, trailing13, windowLabel, windowOf } from './windows.ts';

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
  const budPrincipal = cube.budget(w, mk, 'PRINCIPAL_LOCAL');
  const Y = m.loans(windowOf('Y', sel.anchor), mk);

  const hero = (
    id: string,
    label: string,
    value: string,
    second: string | null,
    values: InfoValue[],
    kind: DeltaKind,
    bundle: Bundle,
    open: ViewId,
  ): HeroCard => {
    const rows = heroRows(kind, bundle);
    return { id, label, info: info(id, values), value, second, rows, status: heroChip(rows, sel.cmp), open };
  };

  // O1 Loans issued
  const loansTrend = trend(ctx, sel.anchor, (i) => m.loans(monthWindow(i), mk).loans);
  const o1 = hero(
    'o1',
    'Loans issued',
    fmtCount(A.loans),
    fmtEur(A.principal),
    [
      { label: 'Budget loans', value: fmtCount(budLoans) },
      {
        label: 'Budget principal',
        value: `${fmtEur(budPrincipal)} (actual ${fmtDeltaPct(budPrincipal ? A.principal / budPrincipal - 1 : null)})`,
      },
      {
        label: 'Avg ticket',
        value: `${fmtEur0(m.avgTicket(A))} (Budget ${fmtEur0(budPrincipal && budLoans ? budPrincipal / budLoans : null)})`,
      },
      { label: 'Prior year', value: `${fmtCount(P?.loans ?? null)} - ${fmtEur(P?.principal ?? null)}` },
      { label: `${monthLabel(sel.anchor).slice(-4)} YTD`, value: `${fmtCount(Y.loans)} - ${fmtEur(Y.principal)}` },
    ],
    'countUp',
    { actual: A.loans, budget: budLoans, py: P?.loans ?? null },
    'loans',
  );

  // O2 New clients locked in
  const byChannel = cube.loansBy(w, mk, (r) => r.channel, { repeat: false });
  const byShare = [...byChannel.entries()].sort((x, y) => y[1].loans - x[1].loans);
  const o2 = hero(
    'o2',
    'New clients locked in',
    fmtCount(A.first),
    null,
    [
      { label: 'Share of loans', value: fmtPct(A.loans ? A.first / A.loans : null) },
      ...byShare.map(([c, v]) => ({
        label: CHANNEL_SHORT[c] ?? c,
        value: `${fmtCount(v.loans)} (${fmtPct(A.first ? v.loans / A.first : null, 0)})`,
      })),
      { label: 'Budget', value: fmtCount(budNew) },
      { label: 'Prior year', value: fmtCount(P?.first ?? null) },
    ],
    'countUp',
    { actual: A.first, budget: budNew, py: P?.first ?? null },
    'clients',
  );

  // O3 Returning clients (client-weighted)
  const ret = m.returning(sel.tv, sel.anchor, mk);
  const r180 = m.repeat180(sel.anchor - 6, mk);
  const stat = cube.windowStat(sel.tv, monthKey(sel.anchor), mk);
  const o3 = hero(
    'o3',
    'Returning clients',
    fmtPct(ret),
    null,
    [
      {
        label: 'Returning borrowers',
        value: `${fmtInt(stat?.returning ?? null)} of ${fmtInt(stat?.borrowers ?? null)}`,
      },
      { label: 'Loan-weighted', value: fmtPct(m.repeatShare(A)) },
      { label: `180-day repeat (cohort ${monthLabel(sel.anchor - 6)})`, value: fmtPct(r180) },
      {
        label: '90-day repeat',
        value: fmtPct(m.cohortCurve([sel.anchor - 6], mk)[cube.cohortDays.indexOf(90)] ?? null),
      },
      { label: 'Prior year', value: fmtPct(m.refReturning(sel.tv, sel.anchor - 12, mk)) },
      { label: 'Budget', value: 'none for this ratio' },
    ],
    'ratioUp',
    { actual: ret, py: m.refReturning(sel.tv, sel.anchor - 12, mk) },
    'clients',
  );

  // O4 Bad / overdue loans (30+ DPD by balance at the anchor month)
  const snap = m.snap(sel.anchor, mk);
  const o4 = hero(
    'o4',
    'Bad / overdue loans',
    fmtPct(m.dpd30(snap)),
    null,
    [
      {
        label: '30+ DPD balance',
        value: `${fmtEur(snap ? snap.b30_59 + snap.b60_89 + snap.b90p : null)} of ${fmtEur(snap?.outstanding ?? null)}`,
      },
      { label: '90+ DPD by balance', value: fmtPct(m.dpd90(snap)) },
      { label: '30+ by count', value: fmtPct(m.dpd30Count(snap)) },
      {
        label: `Vintage 6m bad rate (${monthLabel(sel.anchor - 6)})`,
        value: fmtPct(m.vintageBad6(sel.anchor - 6, mk)),
      },
      { label: 'Budget 30+ appetite', value: fmtPct(cube.budgetDpd30(sel.anchor, mk)) },
      { label: 'Prior year', value: fmtPct(m.dpd30At(sel.anchor - 12, mk)) },
    ],
    'riskDown',
    { actual: m.dpd30(snap), budget: cube.budgetDpd30(sel.anchor, mk), py: m.dpd30At(sel.anchor - 12, mk) },
    'portfolio',
  );

  // O5 Loans issued by month vs Budget
  const o5: ChartCard = {
    id: 'o5',
    title: 'Loans issued by month vs Budget',
    info: info('o5'),
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
    info: info('o6'),
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
    info: info('o7'),
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
    info: info('o8'),
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
    info: info('o9'),
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
    empty: null,
    action: { label: 'Show loans', drill: { kind: 'loans', market: sel.market } },
    needsDetail: false,
  };
}
