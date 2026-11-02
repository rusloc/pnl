import { CHANNEL_SHORT, MARKET_NAMES, SEGMENT_NAMES } from './copy.ts';
import type { Cube } from './cube.ts';
import { fmtEur0, fmtInt } from './format.ts';
import { DETAIL } from './manifest.ts';
import type { CohortRow, DetailParts, Drill, LoanRow, MarketSel, SalesSelection } from './types.ts';
import type { DetailLoanRow, SlideOverVM } from './view-model.ts';
import {
  PERIOD_KIND_NAMES,
  dateLabel,
  dayNumber,
  lastDayOf,
  monthIndex,
  monthKey,
  monthLabel,
  periodKind,
  periodWindow,
  windowLabel,
} from './windows.ts';

// Loan / client grain for the detail window (layout-spec §6 Row click; "Show loans"). Since 2026-11-01 the lists are
// complete: `detail/` holds every loan and client of the data (manifest.ts DETAIL), split so a drill loads only the
// months, cohorts or client bucket it needs (detailFiles). Every row of a list is kept; the window pages through them
// (rowAt formats one row at a time) and the CSV export writes them all. Loan states (status, DPD, outstanding) are the
// snapshot at the last close.

export const STATUS_SHORT: Readonly<Record<string, string>> = {
  CURRENT: 'Current',
  DPD_1_29: '1–29 DPD',
  DPD_30_59: '30–59 DPD',
  DPD_60_89: '60–89 DPD',
  DPD_90P: '90+ DPD',
  REPAID: 'Repaid',
  WRITTEN_OFF: 'Written off',
};

const inMarket = (r: { market: string }, m: MarketSel) => m === 'ALL' || r.market === m;
const bucketOf = (client: number) => String(client % DETAIL.buckets).padStart(2, '0');
/** The closed months of the selected period that have data. */
const windowMonths = (cube: Cube, sel: SalesSelection) => {
  const w = periodWindow(sel);
  const out: number[] = [];
  for (let m = Math.max(w.start, cube.first); m <= w.end; m++) out.push(m);
  return out;
};

/** The `detail/` files a drill reads. */
export function detailFiles(cube: Cube, sel: SalesSelection, drill: Drill): string[] {
  switch (drill.kind) {
    case 'loans':
    case 'agent':
      return windowMonths(cube, sel).map((m) => `loans-${monthKey(m)}.parquet`);
    case 'clients':
      return windowMonths(cube, sel).map((m) => `cohort-${monthKey(m)}.parquet`);
    case 'overdue':
      return ['overdue.parquet'];
    case 'client':
      return [`client-${bucketOf(drill.client)}.parquet`, `client-dim-${bucketOf(drill.client)}.parquet`];
  }
}

const LOAN_COLUMNS = [
  { label: 'Loan id', align: 'left' },
  { label: 'Client', align: 'left' },
  { label: 'Product', align: 'left' },
  { label: 'Channel', align: 'left' },
  { label: 'Disbursed', align: 'left' },
  { label: 'Principal', align: 'right' },
  { label: 'Outstanding', align: 'right' },
  { label: 'DPD', align: 'right' },
  { label: 'Status', align: 'left' },
] as const;

const CLIENT_COLUMNS = [
  { label: 'Client id', align: 'left' },
  { label: 'Market', align: 'left' },
  { label: 'Type', align: 'left' },
  { label: 'First loan', align: 'left' },
  { label: 'First product', align: 'left' },
  { label: 'Channel', align: 'left' },
  { label: 'Loans to date', align: 'right' },
  { label: 'Principal to date', align: 'right' },
  { label: 'Last loan', align: 'left' },
  { label: 'Days since', align: 'right' },
  { label: 'Status', align: 'left' },
] as const;

const productName = (cube: Cube, code: string) =>
  cube.dims.product.find((p) => p.product_code === code)?.product_name ?? code;

export function slideOver(cube: Cube, parts: DetailParts | null, sel: SalesSelection, drill: Drill): SlideOverVM {
  if (!parts)
    return {
      kind: 'missing',
      title: 'Loading the loans…',
      sub: 'Loan grain - Actual only',
    };
  const w = periodWindow(sel);
  const win = `${windowLabel(w)} - ${PERIOD_KIND_NAMES[periodKind(w, cube.closed)]}`;
  const snapshot = `states at ${monthLabel(cube.closed)}`;
  const eur = (r: LoanRow) =>
    cube.fx.toEur(r.principal_local, cube.currency(r.market), monthIndex(r.disbursed.slice(0, 7)), 'ACTUAL_AVG');
  const outstandingEur = (r: LoanRow) =>
    cube.fx.toEur(r.outstanding_close_local, cube.currency(r.market), cube.closed, 'ACTUAL_AVG');
  const loanRow = (r: LoanRow): DetailLoanRow => ({
    key: String(r.loan_id),
    client: r.client_id,
    cells: [
      `L-${r.loan_id}`,
      `C-${r.client_id}`,
      productName(cube, r.product),
      CHANNEL_SHORT[r.channel] ?? r.channel,
      dateLabel(r.disbursed),
      fmtEur0(eur(r)),
      fmtEur0(outstandingEur(r)),
      fmtInt(r.dpd_close),
      STATUS_SHORT[r.status] ?? r.status,
    ],
  });
  const closeDay = lastDayOf(cube.closed);
  const clientRow = (c: CohortRow): DetailLoanRow => ({
    key: String(c.client_id),
    client: c.client_id,
    cells: [
      `C-${c.client_id}`,
      c.market,
      SEGMENT_NAMES[c.segment] ?? c.segment,
      dateLabel(c.first_loan_date),
      productName(cube, c.first_product),
      CHANNEL_SHORT[c.acquisition_channel] ?? c.acquisition_channel,
      fmtInt(c.loans_to_date),
      fmtEur0(c.principal_eur_to_date),
      dateLabel(c.last_disbursed),
      fmtInt(closeDay - dayNumber(c.last_disbursed)),
      STATUS_SHORT[c.last_status] ?? c.last_status,
    ],
  });
  const list = <T>(items: readonly T[], format: (t: T) => DetailLoanRow, header: readonly { label: string }[]) => ({
    total: items.length,
    rowAt: (i: number) => {
      const t = items[i];
      if (t === undefined) throw new Error(`detail row ${i} out of range`);
      return format(t);
    },
    csv: () => toCsv(header, items.map(format)),
  });

  if (drill.kind === 'client') {
    const c = parts.clients.find((x) => x.client_id === drill.client);
    if (!c)
      return {
        kind: 'missing',
        title: `Client C-${drill.client}`,
        sub: 'Not in the client file',
      };
    const loans = parts.loans.filter((r) => r.client_id === drill.client).reverse(); // file order client, disbursed, loan id → newest first
    const last = loans[0];
    const principal = loans.reduce((s, r) => s + eur(r), 0);
    const agent = c.acquisition_agent
      ? cube.dims.agent.find((a) => a.agent_code === c.acquisition_agent)?.agent_name
      : null;
    const status = last ? (STATUS_SHORT[last.status] ?? last.status) : 'n/a';
    return {
      kind: 'client',
      title: `Client C-${c.client_id} - ${MARKET_NAMES[c.market as MarketSel] ?? c.market} - ${SEGMENT_NAMES[c.segment] ?? c.segment}`,
      sub: `Client grain - ${fmtInt(loans.length + c.loans_before_2024)} loans to date - ${fmtEur0(principal)} principal since 2024 - ${snapshot}`,
      chips: [
        MARKET_NAMES[c.market as MarketSel] ?? c.market,
        `Cohort ${monthLabel(monthIndex(c.cohort_month))}`,
        status,
      ],
      facts: [
        { label: 'First loan', value: dateLabel(c.first_loan_date) },
        { label: 'First product', value: productName(cube, c.first_product) },
        {
          label: 'Acquired via',
          value: `${CHANNEL_SHORT[c.acquisition_channel] ?? c.acquisition_channel}${agent ? ` - ${agent}` : ''}`,
        },
        { label: 'Loans before 2024', value: fmtInt(c.loans_before_2024) },
        { label: 'Birth years', value: c.birth_year_band },
        { label: 'City tier', value: fmtInt(c.city_tier) },
        {
          label: 'Last loan',
          value: last
            ? `${dateLabel(last.disbursed)} - ${fmtInt(closeDay - dayNumber(last.disbursed))} days before close`
            : 'n/a',
        },
      ],
      columns: [...LOAN_COLUMNS],
      ...list(loans, loanRow, LOAN_COLUMNS),
      footer: 'loans since Jan 2024, newest first',
      csvName: `mirelo-client-${c.client_id}.csv`,
    };
  }

  if (drill.kind === 'clients') {
    const channel = drill.channel === null ? 'All channels' : (CHANNEL_SHORT[drill.channel] ?? drill.channel);
    const items = parts.cohort
      .filter((c) => inMarket(c, drill.market) && (drill.channel === null || c.acquisition_channel === drill.channel))
      .sort((a, b) => b.principal_eur_to_date - a.principal_eur_to_date || a.client_id - b.client_id);
    return {
      kind: 'clients',
      title: `${fmtInt(items.length)} new clients - ${channel} - ${MARKET_NAMES[drill.market]} - ${windowLabel(w)}`,
      sub: `Client grain - first loan in the window - largest principal to date first - ${snapshot}`,
      chips: [win, MARKET_NAMES[drill.market], channel],
      columns: [...CLIENT_COLUMNS],
      ...list(items, clientRow, CLIENT_COLUMNS),
      footer: 'row click opens the client card',
      csvName: `mirelo-clients-${slug(`${drill.market}-${drill.channel ?? 'all'}-${windowLabel(w)}`)}.csv`,
    };
  }

  if (drill.kind === 'overdue') {
    const product = drill.product === null ? 'All products' : productName(cube, drill.product);
    const items = parts.loans
      .filter((r) => inMarket(r, drill.market) && (drill.product === null || r.product === drill.product))
      .map((r) => ({ r, o: outstandingEur(r) }))
      .sort((a, b) => b.r.dpd_close - a.r.dpd_close || b.o - a.o || a.r.loan_id - b.r.loan_id)
      .map((x) => x.r);
    return {
      kind: 'loans',
      title: `${fmtInt(items.length)} loans 30+ DPD - ${product} - ${MARKET_NAMES[drill.market]} - ${monthLabel(cube.closed)}`,
      sub: `Loan grain - worst DPD first - ${snapshot}`,
      chips: [`Month-end ${monthLabel(cube.closed)}`, MARKET_NAMES[drill.market], product],
      columns: [...LOAN_COLUMNS],
      ...list(items, loanRow, LOAN_COLUMNS),
      footer: 'row click opens the client card',
      csvName: `mirelo-overdue-${slug(`${drill.market}-${drill.product ?? 'all'}-${monthLabel(cube.closed)}`)}.csv`,
    };
  }

  // loans of the window: a market's, or an agent's
  const agent = drill.kind === 'agent' ? cube.dims.agent.find((a) => a.agent_code === drill.agent) : undefined;
  const market: MarketSel =
    drill.kind === 'loans' ? drill.market : ((agent?.market_code as MarketSel | undefined) ?? 'ALL');
  const agentName = drill.kind === 'agent' ? (agent?.agent_name ?? drill.agent) : null;
  const items = parts.loans
    .filter((r) => inMarket(r, market) && (drill.kind !== 'agent' || r.agent === drill.agent))
    .map((r) => ({ r, v: eur(r) }))
    .sort((a, b) => b.v - a.v || a.r.loan_id - b.r.loan_id)
    .map((x) => x.r);
  return {
    kind: 'loans',
    title: [`${fmtInt(items.length)} loans`, agentName, MARKET_NAMES[market], windowLabel(w)]
      .filter(Boolean)
      .join(' - '),
    sub: `Loan grain - Actual only - largest principal first - ${snapshot}`,
    chips: [win, MARKET_NAMES[market], ...(agentName ? [agentName] : []), 'All products', 'All channels'],
    columns: [...LOAN_COLUMNS],
    ...list(items, loanRow, LOAN_COLUMNS),
    footer: 'row click opens the client card',
    csvName: `mirelo-loans-${market.toLowerCase()}-${slug(windowLabel(w))}.csv`,
  };
}

const slug = (s: string) => s.replace(/[^\w]+/g, '-').toLowerCase();
const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const toCsv = (header: readonly { label: string }[], rows: readonly DetailLoanRow[]) =>
  [header.map((c) => c.label), ...rows.map((r) => r.cells)].map((r) => r.map(csvCell).join(',')).join('\n');
