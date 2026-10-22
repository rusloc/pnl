// Info pop-up copy (L-15, ADR-0007 §2.6): the shared text of
// docs/ADD/features/info-popovers.md, verbatim, with `{comparison}` and
// `{breakdown}` filled from the current state at render time. Bold runs are
// marked `**like this**` as in the source document.

export type InfoKey = 'bridge' | 'variances' | 'profitability' | 'cm';

export interface InfoText {
  /** Card title with the placeholders left in (filled like the body). */
  title: string;
  whatItShows: string;
  howToRead: string[];
  example: string;
  watchOut: string;
}

export const INFO_TEXT: Record<InfoKey, InfoText> = {
  bridge: {
    title: 'Net revenue bridge',
    whatItShows: 'How net revenue got from {comparison} to the current figure, split into the reasons for the change.',
    howToRead: [
      'The first bar is net revenue in {comparison}; the last bar is net revenue now.',
      'Each bar in between is one reason for the difference: green adds revenue, orange takes it away.',
      'The steps always add up exactly: first bar + all steps = last bar.',
      'Consumer Products: **Volume** = more or fewer units sold; **Price / mix** = earning more or less per unit (prices, discounts, selling more of the dearer products). Commerce Cloud: one step per service line. ACME Group: one step per company, then the change in intercompany eliminations.',
      '**FX** = the effect of exchange rates when local currencies are translated into the reporting currency. All other steps are measured at constant rates, so they show real business change.',
    ],
    example: '"Revenue is 65 m above budget: 128 m from selling more units, partly offset by price / mix and a weaker euro."',
    watchOut:
      'The axis does not start at zero, so small steps look bigger than they are; read the numbers above the bars. With FX basis set to Constant currency, the FX step is zero.',
  },
  variances: {
    title: 'Largest variances',
    whatItShows: 'The 8 lines of the P&L that differ most from {comparison}, in amount, whether up or down.',
    howToRead: [
      'Each row is one detailed P&L line, with the block it belongs to underneath (for example "Advertising: working media · Sales & marketing").',
      'The bar points right (green) when the difference helps profit and left (orange) when it hurts profit.',
      'For costs this means: spending less than planned is green, spending more is orange.',
      'Δ is the difference in money; Δ % is that difference as a share of {comparison}.',
    ],
    example: '"Working media is 18 m below budget: a favourable variance, because a lower cost raises profit."',
    watchOut:
      'The ranking is by size only. A large variance is not always bad news, and a small line can still matter; check the colour, not just the length of the bar.',
  },
  profitability: {
    title: 'Profitability by {breakdown}',
    whatItShows:
      'How much revenue each {breakdown} brings in, how it grew against {comparison}, and how much of that revenue is left as profit at each stage of the P&L.',
    howToRead: [
      '**Net revenue**: the revenue of the row. **Share**: its part of the total (the rows add up to 100 %).',
      '**vs {comparison}**: revenue growth of the row; green is better than {comparison}, orange is worse.',
      '**Margins** are profit as a % of the row\'s revenue, from the top of the P&L down: **Gross** (after the direct cost of the product or service), **Contribution** (after selling and delivery costs), **Adj. EBITDA** (after running costs such as marketing, R&D and admin), **Operating** (after depreciation and one-off items).',
      'Read across a row: each margin is lower than the one before, because more costs are taken off.',
    ],
    example: '"Online marketplaces is 22 % of revenue and grew 8 % vs budget, but its contribution margin is the lowest because of marketplace fees."',
    watchOut:
      'Costs that are not booked to a {breakdown} (for example marketing or admin) are shared out by each row\'s share of revenue, so margins below contribution margin are partly an allocation, not a direct measurement.',
  },
  cm: {
    title: 'Contribution margin by {breakdown}',
    whatItShows:
      'For each {breakdown}, the share of its revenue that is left after the direct costs of making, selling and delivering: the contribution margin %.',
    howToRead: [
      'A longer bar means more of each sale is left to pay for running costs and profit.',
      'The dashed line is the company average. Bars beyond the line do better than average; bars short of it do worse.',
      'Rows are the same as in the table next to it, so a large row with a short bar weighs on the whole company.',
    ],
    example: '"Premium earns a 52 % contribution margin against a 41 % average: every 100 of premium sales leaves 52 after direct costs."',
    watchOut: 'A high margin on a small row moves the total little. Look at the share in the table next to the bar before drawing conclusions.',
  },
};

/** The four section headings, in order (the example is labelled "For example"). */
export const INFO_HEADINGS = { whatItShows: 'What it shows', howToRead: 'How to read it', example: 'For example', watchOut: 'Watch out' } as const;

export interface InfoContext {
  /** The comparison the visual uses (C-40): "Budget", "Prior year", "Latest estimate". */
  comparison: string;
  /** The selected breakdown as the visual names it: "channel", "region", "service line", … */
  breakdown?: string;
}

/** `{comparison}` / `{breakdown}` filled; a missing value is left as the placeholder (never invented). */
export function fillInfo(text: string, context: InfoContext): string {
  return text.replace(/\{(comparison|breakdown)\}/g, (match, key: 'comparison' | 'breakdown') => context[key] ?? match);
}

/** The whole text filled for one visual. */
export function infoFor(key: InfoKey, context: InfoContext): InfoText {
  const t = INFO_TEXT[key];
  return {
    title: fillInfo(t.title, context),
    whatItShows: fillInfo(t.whatItShows, context),
    howToRead: t.howToRead.map((line) => fillInfo(line, context)),
    example: fillInfo(t.example, context),
    watchOut: fillInfo(t.watchOut, context),
  };
}

/** `**bold**` runs → alternating plain / bold segments for rendering. */
export function boldRuns(text: string): { text: string; bold: boolean }[] {
  return text
    .split('**')
    .map((part, i) => ({ text: part, bold: i % 2 === 1 }))
    .filter((r) => r.text.length > 0);
}
