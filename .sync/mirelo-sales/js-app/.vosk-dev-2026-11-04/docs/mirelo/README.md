# Mirelo Sales & Revenue — the JS showcase

The custom-JavaScript flavour of the Mirelo sales dashboard (a fictional neobank and microlender, PL / RO / PT),
built and hosted in this repo as a showcase item: `/work/online-sales-report`. Brought in on 2026-10-31 from the
PNL repo's **`mirelo-sales/js-app/` pack** (`.sync`, 2026-10-28; its README is `pack-readme-2026-10-28.md` here, the
hand-over note `../report-packs-2026-10-31.md`) and **owned by this repo from then on**, the same way as the P&L
(`../pnl/README.md`, 2026-10-31 section). The Power BI flavour is the owner's; its publish-to-web URL goes into the
showcase entry's `powerBi` field when it exists, and the page then shows two buttons.

## Where things are

| What | Path |
|---|---|
| Engine (framework-free, every number and string): cube, metrics, KPIs, the five views, detail sample, copy, formats, URL codec | `src/lib/mirelo/` (the pack's `lib/sales/` flattened; `parquet-columns.ts` beside it) |
| UI (inline SVG charts, CSS Modules) | `src/components/mirelo/`, root `sales-app.tsx`; `glass.tsx` + `chart-scale.ts` vendored from the P&L app |
| Showcase entry | `src/lib/work.ts` → `online-sales-report`, platform `js`, report `mirelo` |
| Data: **Supabase schema `mirelo_demo`** since 2026-11-03 (below); the Parquet it was loaded from (prebuilt in rusloc/pnl + `build_detail.py`) | `data/mirelo/parquet/` (tests and the loader read it; nothing ships in the build) |
| Server side: artifact name → query, the reader connection, the route | `src/lib/mirelo/artifacts.ts`, `src/lib/mirelo/server.ts`, `src/app/api/mirelo/[...path]/route.ts` |
| Schema, roles, loader | `data/mirelo/sql/001-schema-and-roles.sql`, `002-schema.sql`, `scripts/mirelo-load.ts` |
| Test fixtures | `data/mirelo/checks/control_totals_eur.csv` |
| Tests (92 + 4 skipped: the detail-sample block needs the raw `fact_loan.parquet`, not shipped) | `src/lib/mirelo/*.test.ts` |

## Decisions taken here (2026-10-31)

- **The 1440 × 810 board is scaled, not scrolled.** The app is px-exact at that size; `src/components/report-board.tsx`
  measures the popup and applies `transform: scale()` when it is narrower, so a laptop sees the whole board. The
  pack's `.page { min-height: 100vh }` went: the board host fills the popup instead.
- **State in React** (`src/components/report-search.ts`): the Selection ↔ URL contract of the pack (`?view=…&market=…
  &period=…&month=…&cmp=…&drill=…`) is kept as the report's state inside the popup; "Copy link" (`controls.tsx`)
  takes the share URL as a prop instead of reading `location.href`, so it hands out the showcase page's URL plus
  the state, and such a link opens the popup in that state.
- **Inter** comes from `src/components/inter-font.ts` (next/font) on the board host, read by `sales.module.css`
  through `--font-inter`; the pack's root layout and `globals.css` resets are not needed under Tailwind's preflight.
- **Content as shipped** (owner, 10-30): the L11 "Attainment by channel" placeholder, no mark-click cross-filtering,
  and the three open questions in the pack README (budget per revenue stream, leaderboard columns, the loan-state
  snapshot) stay as they are until the PNL side changes them and re-issues the pack.

## 2026-11-01: the owner's review of the live report (diverges from the pack)

Ten changes, built here and handed to the PNL side as `C:\__PBI\PNL\.sync\2026-11-01-mirelo-sales-changes.md`
(+ `.patch`, the diff for reference) so it can align the pack and the Power BI report. In short:

- **Header:** the Market / Period / Month / Comparator controls are gone; one **Filters** button opens a glass pop-up
  (Period: Week disabled, the data is monthly · Month · Quarter to date · Year to date, "Up to" month; Comparison;
  Region), the applied filters read as one line beside it. R12M left the UI; `period=r12m` links still parse.
- **Cards:** ⓘ top-left beside the title on hero and KPI cards; KPI cards show "vs Budget" and "vs PY" both (no hover
  swap); the hero cards show a visible **Details →** (the whole card still opens the view).
- **Charts:** the story callout is plain text (no yellow box, in the chart's aria-label); o6's prior year is a filled
  yellow bar under the actual one.
- **Pop-ups:** matte frosted glass, 28 px blur, 1 px `#1a1a1a` border, shadow; **this glass copy is Mirelo's own now**
  (the P&L keeps its own). The detail view is a centred window over a 20 % dark-grey mask, not a right-half slide-over.
- **Board:** `ReportBoard fill` scales to fit the popup both ways (≤ 1.25×) and grows taller than 810 px; the extra
  height goes to the chart rows and band tables (`sales-app.tsx`). Nordmark keeps the old behaviour.

## 2026-11-01, second round: the calendar and seven smaller changes (`.sync` note changes 11–18, added 18:30)

- **The period is a range of closed months** (`SalesSelection.from` … `anchor`, URL `from=` + `month=`; the old
  `period=qtd|ytd|r12m` is still read and rewritten). The filter pop-up's calendar has four modes: Month, Quarter,
  Year (the closed part of the current one) and Custom range (two clicks, first month then last, across years).
  QTD / YTD are gone. **Returning % and the time medians (time to cash, cycle time, days between loans) read "n/a" for
  a custom range** that is not a month, a quarter or year to its end, or 12 months: `window-stats.parquet` stores those
  non-additive figures only for Month / QTD / YTD / R12M windows (`windows.ts` `statView`). Every additive figure
  works for any range.
- **Filter pop-up:** Reset (was "Back to default"), a rule, then the "Showing …" sentence; no Done.
- **Look:** brand mark and title on one centre line; every button has 6 px corners (tabs on top only); pop-ups at
  42 % opacity (were 62 %), the detail window at 60 %.
- **Visuals:** Attainment by channel (L11, a placeholder) removed, Loans spreads five charts; the new-client funnel
  shows every step as % of leads and no "lost at the step"; C10 is "Repeat share by product" only; P12 has one bubble
  per product and a small market filter on the card (starts at the page's market), labels drop when they would overlap.
- **ⓘ before the title** on every chart and table (it was in the bottom-left corner on charts, right of the title on
  tables), as on the KPI cards.

## 2026-11-01, third round: stable filters, one glass, heatmaps, no chart clicks (`.sync` note changes 19–29, added 18:30)

- **Filter pop-up has a fixed shape** (420 × 514): the calendar keeps the year-stepper row in every mode (Year mode shows
  the span, arrows hidden), one 108 px tile area (three month rows, or one row of quarters / years stretched to it),
  one hint line per mode, and a two-line "Showing …" sentence. Switching Month / Quarter / Year / Custom range changes
  the content only.
- **One glass for every pop-up** (`glass.module.css` `.surface`): ⓘ, How to read, Filters and the detail window share
  border, 28 px blur, shadow and opacity, now `.32` (was `.42`, the detail window `.60`). The detail window's mask also
  blurs the report (6 px).
- **No "Source" line in the ⓘ pop-ups**: the field left the copy table (`copy.ts`), the view model and the renderer.
- **Chart clicks no longer move the period**: the month hit areas and the charts' `months` field are gone; the period
  is set in the Filters pop-up only.
- **L8 Application funnel:** bars on the scale of Started (it fills the bar); a yellow line over the end of each bar =
  the applications that did not reach the next stage (none on Disbursed). Started reads "% of leads". It was a grey
  "lost" bar after each black one, scaled to the leads, so step 1 read as half lost.
- **L10 Loans by product × market** is a heatmap like P9 (products × markets, four grey steps over the cells shown).
- **C5** is the **returning-client approval rate** (approved ÷ submitted, repeat applicants); the 180-day repeat left the
  Clients band (the Overview hero keeps it).
- **C9 Cohort repeat by quarter cohort** is a heatmap: the four last quarter cohorts, oldest on top, × days since the
  first loan from 45 d to 180 d every 15 days (the leading days where nobody has repeated yet are dropped); a cohort
  not that old yet is blank.
- **R11 New vs churned subscribers** (Plus + Pro, 13 months) replaces "Subscriber churn %", which was a flat 2.1 %
  line: the two lines cross in Feb 2026 after the Plus price rise. The churn rate and net adds of the selected month
  are in the ⓘ.
- **The bottom tables of Clients and Portfolio are aggregates now**, built like the Overview market table: a row opens
  a list in the detail window, and the header button opens the whole list. A list row opens the client card, and
  Back returns to the list.
  - **C11 Acquisition by channel** (was the client list): one row per channel with new clients, vs PY, share of new,
    lead → first loan, new and returning approval %, repeat share, first ticket and status. A row opens that channel's
    new clients (drill `clients.<market>.<CHANNEL>`); **Show clients** opens all of them (`clients`). Budget has no
    channel split, so the Δ is always vs PY.
  - **P13 Overdue by product** (was the overdue-loan list): one row per microloan product with active loans,
    outstanding, the four bucket balances, 30+ DPD %, vs PY, provision and status at the window's last month. A row
    opens that product's loans 30+ DPD at the last close (drill `overdue.<market>.<PRODUCT>`); **Show overdue loans**
    opens all of them (`overdue`). Budget 30+ DPD exists per market only, so the Δ is vs PY.
  - Both lists come from the draft sample (`cohortClients` / `overdueLoans`, now with a channel / product filter); the
    titles count from the aggregates. The client list shows up to 50 rows. The engine's `band()` no longer takes the
    detail index. The sample is still fetched ahead on these two tabs, so a row opens without a wait.

## 2026-11-01, fourth round: the full data behind every list, a four-colour heat scale, a sortable leaderboard (`.sync` note changes 30–33, added 11-02 00:01)

- **The detail window lists every row of the data** (owner: "need full dataset to be available to drill down"). The pack's
  capped sample (`detail-loans` / `detail-clients`, 718 kB, e.g. 23 of 3,260 Partner clients) is gone, with the
  manifest's `caps`. `data/mirelo/build_detail.py` cuts the generator's output (`data-gen/mirelo-sales`, seed 20261026,
  control totals byte-identical to `data/mirelo/checks`) into `public/data/mirelo/detail/` (195 Parquet files, 28 MB,
  + `index.json` with rows and bytes per file):
  - `loans-YYYY-MM`: every loan of a closed month (~410 kB). Show loans and the agent lists load the window's months.
  - `cohort-YYYY-MM`: every client whose first loan is in the month, with loans / principal to date and the last loan
    (~90 kB). The C11 client lists.
  - `overdue`: the 4,782 loans 30+ DPD with a balance at the last close (98 kB). The P13 lists.
  - `client-NN` + `client-dim-NN` (client_id % 64): a client's loans and dims (~215 kB). The client card.
- **Rebuild:** run the generator into an empty folder with its pinned venv (`data-gen/README.md`), then
  `python -I data/mirelo/build_detail.py <out>/parquet public/data/mirelo/detail`.
- **Engine:** `engine.detailFiles(sel, drill)` names the files; the app loads them (`loader.detail(names)`, cached
  per file, row counts checked against `index.json`) and calls `engine.slideOver(sel, parts, drill)`. A list keeps
  every row: `total`, `rowAt(i)` (formats one row) and `csv()` (all rows). The window pages 50 rows at a time
  (« ‹ Page n of N › »). Export CSV writes the whole list and says how many rows. Titles count the list, and tests
  check each list against its aggregate (window loans, an agent's loans, a channel's first loans, a product's
  30+ DPD count at the close).
- **Heatmaps L10, C9, P9:** a continuous grey → yellow → orange → red scale (`charts.tsx` `heatFill`) on a 0 … 1 level
  per cell, normalised over **all rows and columns** of the grid (`clients.ts` `heatLevels`, which replaced the 4-step
  grey `bins`). White text from level 0.8 (the red end).
- **Agent & partner leaderboard is sortable:** each column header is a button (first click: numbers high → low, text
  A → Z; the next click reverses; empty values last; `aria-sort` on the header). Cells carry a raw `sort` key
  (`view-model.ts` `Cell.sort`, `TableCard.sortable`), so "€46k" and "185.3%" sort by value.

## 2026-11-03: the data moved from Parquet files to Supabase (the site is a shopfront for reports)

Owner's decision of 11-02 (`CLAUDE.md` § Supabase): every custom JS report keeps its data in the shared Supabase
project, a schema per report, read live by the site's own server routes; nothing ships in the Vercel build. Mirelo is
the first. What changed, and what did not:

- **The artifact names stayed the contract.** The browser used to fetch `manifest.json`, ten base Parquet files and the
  `detail/` files; it now asks `/api/mirelo/<the same name>` and gets the file's rows (or the document) as JSON. The
  engine, the Zod schemas, the row-count checks and the tests did not change shape: `data.ts` reads through an
  `ArtifactSource` (`jsonSource` in the browser, `parquetSource` in Vitest and the loader), and `checkRows` validates
  JSON rows against the same column kinds `readRows` checks on Parquet.
- **Schema `mirelo_demo`** (`data/mirelo/sql/002-schema.sql`, applied via the Supabase MCP, not a migration): `document`
  (the manifest and the detail index, verbatim), ten base tables named after the files with the file order in `seq`,
  `loan` (613,738 rows; generated `month` and `bucket` = client_id % 64, indexed) and `client` (302,230 rows; the dim
  columns plus the cohort lists' to-date summary, null outside the 2024-01 … last-close cohorts). Column kinds map
  str → text, int → integer, num → double precision (JSON carries JS numbers, as Parquet did), bool → boolean.
- **One query per artifact** (`src/lib/mirelo/artifacts.ts`, pure): `loans-YYYY-MM` = `loan` where month, by loan_id;
  `overdue` = dpd_close ≥ 30 and outstanding > 0, by loan_id; `client-NN` = bucket, by client_id, disbursed, loan_id (the
  client card reverses that order); `client-dim-NN` and `cohort-YYYY-MM` from `client`. Same rows, same order as
  `build_detail.py` wrote them; the loader proves it (below).
- **Roles** (`001-schema-and-roles.sql`): `mirelo_loader` writes, from the owner's machine only; `mirelo_reader` is the
  one credential the site holds (`MIRELO_DATABASE_URL`, **Session pooler, port 5432**, Vercel env), hardened like `cube_reader`,
  denied on real rows in `demo_sales` and `qbo` (`42501`). Passwords are set by the owner in the SQL editor; the
  connection strings live in `.env.local` (never read by the agent) and in Vercel env. **The shared pooler host for
  this project is `aws-1-eu-west-1.pooler.supabase.com`**: `aws-0` answers "tenant/user not found".
- **Loader** `scripts/mirelo-load.ts`: `node --env-file=.env.local --import tsx scripts/mirelo-load.ts` truncates, loads
  in a transaction (batches of 1,000 rows) and then **verifies every artifact the route can serve against its Parquet
  file** (deep equality, 208 artifacts); `--verify` runs the check alone. It prints counts, never a value from the env.
- **Session pooler, not Transaction pooler, for the reader.** Through port 6543 the driver's concurrent reads stalled
  (ten base files at once: a 25 s timeout even with one connection) and the headless run saw one file answered with
  another file's columns; `checkRows` caught it. Port 5432 answered the same ten reads in ~1.2 s, no mismatch, so
  `server.ts` uses the Session pooler with a pool of 2 and a 20 s idle timeout, and throws on a 6543 URL.
- **Floats:** the server runs `extra_float_digits = 0`, which prints 15 significant digits and loses the last bits of
  computed doubles (3220153.1100000003 came back as 3220153.11 in 33 artifacts). Both roles set it to 3; note that a
  role setting reaches the pooler's backends only when they reconnect.
- **Route** `/api/mirelo/[...path]`: a known name or 404; 503 without the env var; a per-instance rate limit; answers
  cached by the CDN for a day and served stale while refreshing (the data is a frozen snapshot), so the database sees a
  handful of reads per artifact. Reachable because `proxy.ts` excludes `/api/*`.
- **Power BI flavour (11-03, later the same day):** `online-sales-report` carries `powerBi` now. ~~The page shows
  "Power BI" (popup, the publish-to-web iframe) and "Custom" side by side, plus a plain link "Power BI in a new
  window".~~ → **Same evening (owner): two buttons side by side, "Power BI" and "Web report", each opening its
  report in the site's popup** (the Power BI one is a real link to the public URL, so a modified click still opens
  a tab). A full-window `/report/<slug>` route was built in between (23:39) and taken out again at the owner's ask
  (23:5x: "window opened on top, styled as the site"); shared links keep the old form, `/work/online-sales-report?…`.
  ~~The Power BI URL is a placeholder report of the owner's ("Coal
  trucks") until the Mirelo report is published to web~~ → **23:52: the owner handed over the published Mirelo Sales
  report's iframe and its `view?r=…` URL replaced the stand-in**; swapping it again is the two URLs in `src/lib/work.ts`.
- **Rebuilding the data** is the same as before up to the Parquet (`build_detail.py` into `data/mirelo/parquet/detail`),
  then the loader instead of a commit of `public/` files.
- **`data/mirelo/parquet/` is git-ignored since 11-03 (owner):** the data of record is the Supabase schema; the
  Parquet is the loader's input and the tests' fixture on the owner's machine only. A fresh clone has to rebuild it
  (the pack's base files + `build_detail.py`) before `pnpm test` can run the Mirelo suites or the loader can run.
