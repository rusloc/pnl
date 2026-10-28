import { CHANNEL_SHORT, MARKET_NAMES, SEGMENT_NAMES } from './copy.ts';
import type { Cube } from './cube.ts';
import { fmtCount, fmtEur0, fmtInt } from './format.ts';
import type { Drill, FileRows, MarketSel, SalesDetail, SalesSelection } from './types.ts';
import type { DetailLoanRow, SlideOverVM } from './view-model.ts';
import {
  TIME_VIEW_NAMES,
  dateLabel,
  dayNumber,
  lastDayOf,
  monthIndex,
  monthLabel,
  windowLabel,
  windowOf,
} from './windows.ts';
import type { Window } from './windows.ts';

// Loan / client grain (layout-spec §6 Row click). The detail file is a capped sample built so that every list below is
// exact for its cap: the top N by principal of any window × market, the top N of an agent, the worst overdue loans
// and the top cohort clients by principal to date, each with the client's whole loan history. Counts in titles come
// from the aggregates, never from the sample. Loan states (status, DPD, outstanding) are the snapshot at the last close.

type LoanRow = FileRows<'detailLoans'>[number];
type ClientRow = FileRows<'detailClients'>[number];

export const STATUS_SHORT: Readonly<Record<string, string>> = {
  CURRENT: 'Current',
  DPD_1_29: '1–29 DPD',
  DPD_30_59: '30–59 DPD',
  DPD_60_89: '60–89 DPD',
  DPD_90P: '90+ DPD',
  REPAID: 'Repaid',
  WRITTEN_OFF: 'Written off',
};

export type DetailIndex = ReturnType<typeof indexDetail>;

export function indexDetail(cube: Cube, detail: SalesDetail) {
  const byClient = new Map<number, LoanRow[]>(); // file order = client, disbursed, loan id
  for (const r of detail.loans) {
    const list = byClient.get(r.client_id);
    if (list) list.push(r);
    else byClient.set(r.client_id, [r]);
  }
  const clients = new Map<number, ClientRow>(detail.clients.map((c) => [c.client_id, c]));
  const eur = (r: LoanRow) =>
    cube.fx.toEur(r.principal_local, cube.currency(r.market), monthIndex(r.disbursed.slice(0, 7)), 'ACTUAL_AVG');
  const outstandingEur = (r: LoanRow) =>
    cube.fx.toEur(r.outstanding_close_local, cube.currency(r.market), cube.closed, 'ACTUAL_AVG');
  return { loans: detail.loans, byClient, clients, eur, outstandingEur };
}

const inWindow = (r: LoanRow, w: Window) => {
  const m = monthIndex(r.disbursed.slice(0, 7));
  return m >= w.start && m <= w.end;
};
const inMarket = (r: { market: string }, m: MarketSel) => m === 'ALL' || r.market === m;

export function topLoans(ix: DetailIndex, w: Window, market: MarketSel, cap: number, agent?: string): LoanRow[] {
  return ix.loans
    .filter((r) => inWindow(r, w) && inMarket(r, market) && (agent === undefined || r.agent === agent))
    .map((r) => ({ r, v: ix.eur(r) }))
    .sort((a, b) => b.v - a.v || a.r.loan_id - b.r.loan_id)
    .slice(0, cap)
    .map((x) => x.r);
}

export function overdueLoans(ix: DetailIndex, market: MarketSel, cap: number): LoanRow[] {
  return ix.loans
    .filter((r) => r.dpd_close >= 30 && r.outstanding_close_local > 0 && inMarket(r, market))
    .map((r) => ({ r, o: ix.outstandingEur(r) }))
    .sort((a, b) => b.r.dpd_close - a.r.dpd_close || b.o - a.o || a.r.loan_id - b.r.loan_id)
    .slice(0, cap)
    .map((x) => x.r);
}

export interface ClientSummary {
  client: ClientRow;
  loans: number; // fact_loan loans through the last close + loans before 2024
  principalToDate: number; // EUR, loans since 2024
  last: LoanRow;
  daysSince: number;
  status: string;
}

export function clientSummary(ix: DetailIndex, cube: Cube, id: number): ClientSummary | null {
  const client = ix.clients.get(id);
  const loans = ix.byClient.get(id);
  const last = loans?.at(-1);
  if (!client || !loans || !last) return null;
  let principalToDate = 0;
  for (const r of loans) principalToDate += ix.eur(r);
  return {
    client,
    loans: loans.length + client.loans_before_2024,
    principalToDate,
    last,
    daysSince: lastDayOf(cube.closed) - dayNumber(last.disbursed),
    status: STATUS_SHORT[last.status] ?? last.status,
  };
}

/** Clients whose first loan falls in the window, top by principal to date. */
export function cohortClients(ix: DetailIndex, cube: Cube, w: Window, market: MarketSel, cap: number): ClientSummary[] {
  const out: ClientSummary[] = [];
  for (const c of ix.clients.values()) {
    const cm = monthIndex(c.cohort_month);
    if (cm < w.start || cm > w.end || !inMarket(c, market)) continue;
    const s = clientSummary(ix, cube, c.client_id);
    if (s) out.push(s);
  }
  return out
    .sort((a, b) => b.principalToDate - a.principalToDate || a.client.client_id - b.client.client_id)
    .slice(0, cap);
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

function loanRow(ix: DetailIndex, cube: Cube, r: LoanRow): DetailLoanRow {
  const product = cube.dims.product.find((p) => p.product_code === r.product)?.product_name ?? r.product;
  return {
    key: String(r.loan_id),
    client: r.client_id,
    cells: [
      `L-${r.loan_id}`,
      `C-${r.client_id}`,
      product,
      CHANNEL_SHORT[r.channel] ?? r.channel,
      dateLabel(r.disbursed),
      fmtEur0(ix.eur(r)),
      fmtEur0(ix.outstandingEur(r)),
      fmtInt(r.dpd_close),
      STATUS_SHORT[r.status] ?? r.status,
    ],
  };
}

const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const toCsv = (header: readonly string[], rows: readonly DetailLoanRow[]) =>
  [header, ...rows.map((r) => r.cells)].map((r) => r.map(csvCell).join(',')).join('\n');

export function slideOver(cube: Cube, ix: DetailIndex | null, sel: SalesSelection, drill: Drill): SlideOverVM {
  const w = windowOf(sel.tv, sel.anchor);
  const win = `${windowLabel(w)} - ${TIME_VIEW_NAMES[sel.tv]}`;
  const snapshot = `states at ${monthLabel(cube.closed)}`;
  if (!ix) return { kind: 'missing', title: 'Loading the loan sample…', sub: 'Loan grain - Actual only' };
  if (drill.kind === 'client') {
    const s = clientSummary(ix, cube, drill.client);
    if (!s)
      return {
        kind: 'missing',
        title: `Client C-${drill.client}`,
        sub: 'Not in the draft sample (top clients and loans only)',
      };
    const rows = [...(ix.byClient.get(drill.client) ?? [])].reverse().map((r) => loanRow(ix, cube, r));
    const c = s.client;
    const agent = c.acquisition_agent
      ? cube.dims.agent.find((a) => a.agent_code === c.acquisition_agent)?.agent_name
      : null;
    return {
      kind: 'client',
      title: `Client C-${c.client_id} - ${MARKET_NAMES[c.market as MarketSel] ?? c.market} - ${SEGMENT_NAMES[c.segment] ?? c.segment}`,
      sub: `Client grain - ${fmtInt(s.loans)} loans to date - ${fmtEur0(s.principalToDate)} principal since 2024 - ${snapshot}`,
      chips: [
        MARKET_NAMES[c.market as MarketSel] ?? c.market,
        `Cohort ${monthLabel(monthIndex(c.cohort_month))}`,
        s.status,
      ],
      facts: [
        { label: 'First loan', value: dateLabel(c.first_loan_date) },
        {
          label: 'First product',
          value: cube.dims.product.find((p) => p.product_code === c.first_product)?.product_name ?? c.first_product,
        },
        {
          label: 'Acquired via',
          value: `${CHANNEL_SHORT[c.acquisition_channel] ?? c.acquisition_channel}${agent ? ` - ${agent}` : ''}`,
        },
        { label: 'Loans before 2024', value: fmtInt(c.loans_before_2024) },
        { label: 'Birth years', value: c.birth_year_band },
        { label: 'City tier', value: fmtInt(c.city_tier) },
        { label: 'Last loan', value: `${dateLabel(s.last.disbursed)} - ${fmtInt(s.daysSince)} days before close` },
      ],
      columns: [...LOAN_COLUMNS],
      rows,
      footer: `${fmtInt(rows.length)} loans since Jan 2024 - newest first`,
      csv: toCsv(
        LOAN_COLUMNS.map((c) => c.label),
        rows,
      ),
      csvName: `mirelo-client-${c.client_id}.csv`,
    };
  }
  const market: MarketSel =
    drill.kind === 'loans'
      ? drill.market
      : (cube.dims.agent.find((a) => a.agent_code === drill.agent)?.market_code ?? 'ALL');
  const agentName =
    drill.kind === 'agent'
      ? (cube.dims.agent.find((a) => a.agent_code === drill.agent)?.agent_name ?? drill.agent)
      : null;
  const cap = drill.kind === 'agent' ? cube.caps.loansPerAgentMonth : cube.caps.loansPerMonthMarket;
  const loans = topLoans(ix, w, market, cap, drill.kind === 'agent' ? drill.agent : undefined);
  const total =
    drill.kind === 'agent'
      ? (cube.agents(w).get(drill.agent)?.loans ?? 0)
      : cube.loans({ start: Math.max(w.start, cube.first), end: w.end }, market).loans;
  const rows = loans.map((r) => loanRow(ix, cube, r));
  const parts = [`${fmtInt(total)} loans`, agentName, MARKET_NAMES[market], windowLabel(w)].filter(Boolean);
  return {
    kind: 'loans',
    title: parts.join(' - '),
    sub: `Loan grain - Actual only - largest ${fmtCount(rows.length)} by principal (draft sample) - ${snapshot}`,
    chips: [win, MARKET_NAMES[market], ...(agentName ? [agentName] : []), 'All products', 'All channels'],
    columns: [...LOAN_COLUMNS],
    rows,
    footer: `Showing ${fmtInt(rows.length)} of ${fmtInt(total)} rows - row click opens the client card`,
    csv: toCsv(
      LOAN_COLUMNS.map((c) => c.label),
      rows,
    ),
    csvName: `mirelo-loans-${market.toLowerCase()}-${sel.tv.toLowerCase()}-${windowLabel(w)
      .replace(/[^\w]+/g, '-')
      .toLowerCase()}.csv`,
  };
}
