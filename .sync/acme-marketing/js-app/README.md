# ACME Marketing — Paid Acquisition Console, standalone JS app

- **From:** rusloc/pnl (nerd)
- **To:** vosk.dev repo agent
- **Date:** 2026-11-05
- **Status:** ready (builds, tests and runs on its own; parity gate passed — checks below)

A complete, standalone Next.js 16 app for the **ACME paid-acquisition dashboard** (ADR-0015; JS flavour per
`docs/ADD/features/marketing-js-flavour.md` in rusloc/pnl; pack per ADR-0014). ACME is a fictional SaaS analytics product
(web, iOS, Android; 6 channels, 8 networks, 19 campaigns, USD); all data is generated and illustrative. One page, five
views (Overview, Channels, Campaigns, Journey, Cohorts) under a vitals ribbon, a Filters window, ⓘ definitions, one How to
read per view, and a single-metric dynamics pop-up behind each vital's binoculars. The Power BI flavour ships separately in
`../power-bi/`; it is the reference this app matches (parity gate: 1,416 captured rows, 0 gaps).

Copy this folder into the vosk.dev repo, `npm ci`, build, host and embed it. **Do not edit it in place.** The source of
truth stays in rusloc/pnl (`js-marketing/`); this folder is a copy as of 2026-11-05 with the differences listed below. A fix
or a question goes back as a dated note in `.sync/` (`{yyyy-mm-dd}-{topic}.md`, from · to · date · status); the change is
made in `js-marketing/` and the pack is re-issued.

## What is inside

| Path | What |
| --- | --- |
| `app/` | `layout.tsx` (Inter + Manrope via `next/font`, metadata), `page.tsx` (static shell), `globals.css` (tokens, light + dark, glass) |
| `components/` | `MarketingApp.tsx` (the only client root: data load, URL ↔ state, layers), `views.tsx` (the five views), `Layers.tsx` (ⓘ, How to read, dynamics, Filters window), `charts.tsx` (SVG primitives), `ui.tsx` |
| `lib/engine/` | Framework-free engine: every number and every string on the page (calendar, scope, windows, metrics, verdicts / flags / alerts, movers, cohorts, formats, copy, view models, URL state) |
| `lib/data/` | `manifest.ts` (strict Zod contract of `public/data`, column specs), `loader.ts`, `parquet-columns.ts` (**vendored** from rusloc/pnl `js-report/`, header comment) |
| `lib/test-utils/` | Node loader + control totals for the tests, the control-total surface, and `parity/` (hunter's parity CSV, harness and notes) |
| `scripts/` | `control-totals.ts` (CSV reader + tolerance), `csv.ts` (**vendored** from `js-report/`) |
| `public/data/` | Prebuilt data, **committed** (see Data) |
| `public/icons/` | `acme-marketing-logo.svg`, `binoculars.svg` |
| `fixtures/checks/control_totals_usd.csv` | The generator's 28,660 expected totals, read by the control-total tests |
| `next.config.ts` | Security headers and CSP (see Embed) |
| `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `.prettierrc.json`, `.prettierignore`, `.gitignore` | Config |

Stack: Next.js 16.4.2 (App Router, Turbopack, `cacheComponents`), React 19.3.1, TypeScript 5.9.3 strict
(`noUncheckedIndexedAccess`), Zod 4.6.7, hyparquet 1.31.5, Vitest 5.0.5, ESLint 9.39.5 (`eslint-config-next`). Node 24 or
later. No chart library, no backend, no API routes.

## Run

```bash
npm ci
npm run dev          # http://localhost:3000
npm run typecheck    # next typegen && tsc --noEmit
npm run lint
npm test             # Vitest: 91 tests (3 skip in the pack: they need the rusloc/pnl source data or the PBIP)
npm run build        # next build: / static
npm start            # next start
```

There is no `prebuild` step: the data is already in `public/data/`.

## Environment variables

| Name | Read | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | inlined at build | Public URL of the deployment, used as `metadataBase`. Optional; client-safe by design. |
| `EMBED_ALLOWED_ORIGINS` | `next.config.ts`, **at build time** | Comma-separated bare https origins allowed to frame the app, for example `https://vosk.dev,https://www.vosk.dev` (`http://localhost` / `http://127.0.0.1` allowed for local tests). A malformed entry fails the build. Empty = same-origin framing only, so **set it for the embed build**. Server-side; not exposed to the client. |

No env var is needed for a local build. There are no secrets in this app.

## Embed

- Embed `/` with an `<iframe>`. The app assumes nothing about the host: no `postMessage`, host CSS, auth, cookies or storage.
- **Board: 1440 wide, 810 tall at the default state** (every view fits; tables scroll inside their cards). The host scales
  it (`transform: scale()` on the wrapper or the iframe). Below 1200 px the app is not optimised (horizontal scroll).
  Whether the board may grow taller than 810 px is open (USER q A); today it does not need to.
- **CSP and headers live in `next.config.ts`** (every path): `default-src 'self'; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'self'
  <EMBED_ALLOWED_ORIGINS>; base-uri 'self'; form-action 'none'; object-src 'none'`, plus `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. No
  `X-Frame-Options`, no `X-Powered-By`. `'unsafe-inline'` scripts are the same day-one compromise as the P&L, Mirelo and
  Nordmark apps; `'unsafe-eval'` only under `next dev`.
- Fonts: Inter and Manrope, self-hosted by `next/font` at build time (the build needs Google Fonts once; no third-party
  requests at runtime).
- Data fetches are absolute (`/data/<file>`, `components/MarketingApp.tsx`); a `basePath` deploy has to prefix them.
- Theme: light, or dark when the viewer's system is dark; the URL key `theme=light|dark` forces one (for the host).

## URL state (hash routing)

The view is in the hash: `#overview` (default, omitted), `#channels`, `#campaigns`, `#journey`, `#cohorts`. The state is
in the query, every value validated with Zod; defaults are omitted, unknown keys dropped, an invalid value falls back to its
default and the URL is rewritten to the canonical form (an inverted or out-of-data Custom range becomes the default window;
a cross-filter outside the scope is dropped).

| Key | Values | Default |
| --- | --- | --- |
| `p` | `7d` · `30d` · `mtd` · `qtd` · `custom` | `30d` |
| `from`, `to` | ISO dates (with `p=custom`), clipped to 2025-01-01 … 2026-11-03 | — |
| `c` | `prev` · `ly` · `plan` · `none` | `prev` |
| `g` | `day` · `week` · `month` | `day` |
| `pf` | `web,ios,android` (comma list) | all |
| `mk` | `global` · `na` · `emea` | all |
| `tr` | `self_serve` · `sales_assisted` | all |
| `ch`, `nw` | channel / network codes, lower case, comma lists | all |
| `cp` | campaign keys, comma list | all |
| `st` | `live,learning,paused,ended`; absent = the list default (Live + Learning on the campaign list, totals unfiltered); an explicit pick filters the totals | absent |
| `m` | `dda` · `lc` · `ft` · `pf` | `dda` |
| `sel` | cross-filter `ch:<code>`, `ch:<code>\|pf:<code>`, `cp:<key>` | none |
| `o5`, `o6` | `worst` · `top` | `worst` |
| `dyn` | `v1` … `v6` (dynamics pop-up open) | closed |
| `theme` | `light` · `dark` | system |

Deep links: `/?sel=cp%3ASOC_META_LAL2#campaigns` (a query inside the hash, `#campaigns?sel=cp:SOC_META_LAL2`, is accepted
too); the USER's saved state `/?p=custom&from=2025-01-01&to=2026-11-03&g=month`. Copy link (header) writes the current URL.

## Data

`public/data/` (1.55 MB) was built in rusloc/pnl by `js-marketing/scripts/build-marketing-data.ts` from the generated
dataset (`../../data-gen/acme-marketing/`, seed 20261104; the data README there is the contract):

| File | Rows | Bytes | Loaded |
| --- | ---: | ---: | --- |
| `manifest.json` | — | 50,501 | first paint |
| `campaign-day.parquet` (day × campaign) | 10,198 | 568,575 | first paint |
| `cohort-month.parquet` | 3,457 | 89,317 | first paint |
| `retention.parquet` | 2,241 | 8,789 | first paint |
| `journey-day.parquet` | 10,198 | 43,648 | first open of Journey |
| `traffic-page-day.parquet` | 18,880 | 177,200 | first open of Journey |
| `segment-day.parquet` | 20,319 | 29,824 | first open of Journey |
| `term-day.parquet` | 81,584 | 585,074 | first open of Campaigns |

First paint 717 kB, total 1.55 MB. The build script is **not** in the pack (it reads the repo's data folder); a data change
is made in rusloc/pnl and re-packed.

## Checks (2026-11-05, run inside this folder)

- `npm ci && npm run typecheck && npm run lint && npm test && npm run build` green: 7 test files, 88 passed, 3 skipped
  (the source-manifest check and the two PBIP mirror checks need rusloc/pnl's `data/` / `pbi-report/`).
- Control totals (AT-01): all 28,628 engine rows of `fixtures/checks/control_totals_usd.csv` within tolerance, both ways;
  the 32 `CR:` creative rows were asserted by the data build in rusloc/pnl.
- Parity (hunter, `lib/test-utils/parity/`): 1,416 rows, 1,396 match, 20 accepted (the minus glyph: Power BI prints `-`,
  this app `−`), 0 gap. Re-run: `npx vitest run lib/engine/parity.test.ts`; refresh the recorded JS values after an engine
  change with `PARITY_WRITE=1 npx vitest run lib/engine/parity.test.ts`.

## Differences from `js-marketing/` (rusloc/pnl)

- No `scripts/build-marketing-data.ts`, no `build:data` / `prebuild` scripts, no `hyparquet-writer` (lockfile re-resolved).
- `public/data/` is committed; `fixtures/checks/control_totals_usd.csv` added; this README replaces the app README.

## Deviations from the contract or the Power BI flavour (deliberate)

1. P5 keeps the title `Keywords / placements` (the PBIP); its caption ("Placements and audiences of …") is the table's
   accessible name only.
2. C1 share at a platform row = that row's spend ÷ the platform's spend across the scope's channels (what the PBIP
   evaluates).
3. Channel and network picks are two facets that intersect (as the PBIP's two filters).
4. ⓘ opens on click / Enter (no hover-after-400 ms); hover values on the SVG cards are native tooltips (mouse only).
5. No table header-click sort; tables keep the PBIP sort (P1 by spend, J1 by visits, P5 by conversions).
6. The K1 / K3 heat ramps use the PBIP's white → accent formula in both themes.
7. Accepted platform differences (parity rules, rusloc/pnl `docs/design/parity-rules.md` › ACME Marketing): Apply-based
   Filters window with a live preview and Reset group / Reset all, `F` / Esc / outside click / ×, removable chips with a
   dashed cross-filter chip, light + dark, backdrop-blur glass, Manrope / Inter, an O6 mover click opens Campaigns scoped to
   it, hash routing + URL state + Copy link, a per-source freshness tooltip, keyboard and focus trap.

## Open USER items (the app runs on the defaults)

- **q A** — may the board grow taller than 810 px? (default yes; not needed today)
- **q B** — dark theme now or later? (shipped; follows the system, `theme` forces one)
- **q D** — restore a creatives card (P4)? (default no, in both flavours)
- **H** — the movers fallback (O5 / O6 compare the window's last 30 days when the comparison basis starts before the first
  data day and the window is longer than 30 days) gives a one-day basis for a 31-day window from 2025-01-01; both flavours
  share the rule (owner: archi / main agent).
- First-load JS is 852 kB raw / 262 kB gzip (full Zod 4 on the client); a lighter client schema is a later optimisation.
