# ACME Marketing — Paid Acquisition Console (JS flavour)

> **Draft — contract steps 1–6 built (2026-11-05), parity (step 7) and the pack (step 8) pending.** Built from
> `docs/ADD/features/marketing-js-flavour.md` (archi, 2026-11-05, with its dated amendments); the Power BI flavour
> (`pbi-report/ACME Marketing/`) is the reference for look, copy, behaviour and numbers. All figures are generated and
> illustrative.

The Track C flavour of the ACME paid-acquisition dashboard (ADR-0015), a standalone Next.js app built like `js-exec/`
(ADR-0013 (h)): a static shell, pre-aggregated Parquet read in the browser with `hyparquet`, a framework-free TS engine,
no backend (ADR-0002). Data contract: `data/acme_marketing_dummy_data/README.md` (its names win, ADR-0015 (b)); requirement
IDs (A-nn, AT-nn): `docs/Requirements-marketing.md`.

## Scripts

Node ≥ 24 (the build script runs on Node's native type stripping).

| Script                      | What it does                                                                                                                                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run build:data`        | `../data/acme_marketing_dummy_data/parquet` → `public/data/` (manifest + 7 Parquet files, contract §2). Checks: source footers, calendar = `dim_date` / `dim_month`, AT-05 ties, attribution coverage, the 32 `CR:` creative control rows, the byte budgets. |
| `npm run build`             | `build:data` (prebuild), then `next build` (static `○ /`).                                                                                                                                                                                                   |
| `npm run dev` / `npm start` | `next dev` / `next start`.                                                                                                                                                                                                                                   |
| `npm run typecheck`         | `next typegen && tsc --noEmit`.                                                                                                                                                                                                                              |
| `npm run lint`              | ESLint (`eslint-config-next` core-web-vitals + typescript).                                                                                                                                                                                                  |
| `npm test`                  | Vitest: control totals (AT-01, 28,628 rows both ways), the contract's AT list, URL state, copy, manifests, layers. Reads `public/data` (`build:data` first).                                                                                                 |
| `npm run format`            | Prettier (single quotes, width 120).                                                                                                                                                                                                                         |

## Folder map

```
js-marketing/
  app/                 layout.tsx (Inter + Manrope via next/font), page.tsx (static shell), globals.css (§5.1 tokens, light + dark)
  components/          MarketingApp.tsx (client root: load, URL ↔ Selection, layers), views.tsx (the five views),
                       Layers.tsx (ⓘ, How to read, dynamics, Filters window), charts.tsx (SVG primitives), ui.tsx
  lib/data/            manifest.ts (source + shipped schema 'acme-marketing/1', FILES), loader.ts (first paint + lazy groups),
                       parquet-columns.ts (vendored from js-report, as js-exec)
  lib/engine/          calendar, data, selection, scope, windows, metrics, rules, rank, cohorts, format, view, url-state,
                       copy (verbatim from the PBIP), tokens
  lib/test-utils/      marketing-data.ts (Node loader + control totals), control-engine.ts (the control-total surface)
  scripts/             build-marketing-data.ts, control-totals.ts (CSV + verify.py tolerance), csv.ts (vendored)
  public/icons/        binoculars.svg, acme-marketing-logo.svg (svg-designer)
  public/data/         build output (gitignored here; the pack ships it prebuilt)
```

## Data (`public/data`, contract §2.3)

| File                       |   Rows |   Bytes | Loaded                  |
| -------------------------- | -----: | ------: | ----------------------- |
| `manifest.json`            |      — |  50,501 | first paint             |
| `campaign-day.parquet`     | 10,198 | 568,575 | first paint             |
| `cohort-month.parquet`     |  3,457 |  89,317 | first paint             |
| `retention.parquet`        |  2,241 |   8,789 | first paint             |
| `journey-day.parquet`      | 10,198 |  43,648 | first open of Journey   |
| `traffic-page-day.parquet` | 18,880 | 177,200 | first open of Journey   |
| `segment-day.parquet`      | 20,319 |  29,824 | first open of Journey   |
| `term-day.parquet`         | 81,584 | 585,074 | first open of Campaigns |

First paint 717,182 B (budget 750 kB, hard fail 1 MB); total 1,552,928 B (budget 2.5 MB, hard fail 3 MB).
`campaign-day.parquet` stays under the 600 kB line of the `attribution-alt.parquet` fallback.

## URL state (contract §6)

View in the hash (`#overview` omitted, `#channels`, `#campaigns`, `#journey`, `#cohorts`); query keys `p`, `from`, `to`,
`c`, `g`, `pf`, `mk`, `tr`, `ch`, `nw`, `cp`, `st`, `m`, `sel`, `o5`, `o6`, `dyn`, `theme`, every value validated with Zod
(`lib/engine/url-state.ts`); defaults omitted, unknown keys dropped, an invalid value falls back to its default, the URL
is rewritten to the canonical form. A query inside the hash (`#campaigns?sel=cp:SOC_META_LAL2`) is accepted and moved to
the search part. An explicit Live + Learning pick (`st=live,learning`) filters the totals (contract §10 q F); a mover
click (O6) opens Campaigns with the campaign as the cross-filter (q E).

## Deviations from the contract or the PBIP (each deliberate)

1. **P5 title** stays `Keywords / placements` (the PBIP head and its parity capture); the contract's "Keywords" /
   "Placements" title switch is not built. The PBIP's `P5 Caption` ("Placements and audiences of …") is the table's
   accessible name, not drawn (as in Power BI).
2. **C1 share at a platform row** = the platform row's spend ÷ that platform's spend across the scope's channels (what
   the PBIP's `Spend Share` evaluates: Paid social · iOS 50.4 %, Retargeting · iOS 8.4 %); the contract's wording
   ("within that channel's platform rows") would give other numbers.
3. **Channel › Network tree**: channel and network picks are two facets that intersect (as the PBIP's two `ISFILTERED`
   chips); a parent shows indeterminate when only its networks are picked.
4. **ⓘ** opens on click / Enter (focus moves into it); the "on hover after 400 ms" variant is not built.
5. **Table header sort** (accepted difference 13) is not built; tables keep the PBIP sort (P1 spend, J1 visits, P5
   conversions).
6. **Hover values** on the SVG / bar cards are native `<title>` tooltips (mouse only, not on focus).
7. **Heat ramps** (K1, K3) use the PBIP's white → accent formula in both themes.
8. **copy.test**: the contract's "no digits in copy strings except the story date" cannot hold for verbatim copy (the
   `dim_card` notes carry A-nn IDs, the How to read texts story numbers); the test checks the flag words and chip labels.

## Embedding

As `js-exec`: `next.config.ts` sets the CSP with `frame-ancestors` from `EMBED_ALLOWED_ORIGINS` (server-side,
comma-separated https origins); `NEXT_PUBLIC_SITE_URL` sets `metadataBase`. The board is 1440 wide and fits 810 tall at
the default state (tables scroll inside their cards). Hosting and the embed live in the vosk.dev repo.
