# Product overview — ACME Unified P&L

## Purpose
One management P&L page that shows ACME Consumer Products, ACME Commerce Cloud or the consolidated ACME Group through a single entity switch. Layout, row order, subtotals and columns stay identical across entities. Full spec: `docs/Requirements.md`.

## Users
CFO and group finance, entity general managers, FP&A, controllers (spec §1).

## Three flavors, one spec
| Track | Flavor | Folder | Runs on |
|---|---|---|---|
| A | Rayfin app (Microsoft Fabric App) | `fabric-app/` | Fabric workspace (Entra SSO) |
| B | Power BI report (PBIP) | `pbi-report/` | Power BI Service / Fabric workspace |
| C | Custom JS report | `js-report/` | Vercel |

All three read the same dummy dataset (`data/acme_pl_dummy_data/`) and must reconcile to the same control totals.

## Public surface
Showcase page on **vosk.dev**. This repo delivers the three assets only; the site wrapper and embedding live in a separate vosk.dev repo. How each flavor becomes publicly viewable (PBI publish-to-web vs embedded; Rayfin needs Entra sign-in) is decided there.

## Locales
`en` only — UI and content locked together at MVP.
