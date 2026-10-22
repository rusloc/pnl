// Live captures from the published model "ACME Unified PnL" (workspace RAW) through
// `npx rayfin connector invoke pnlModel executeQuery` on 2026-10-22 (model refreshed
// 2026-10-21 18:00 UTC), for the parity tests of the client-side variance derivation
// (ADR-0006 §16). `old` = the pre-§16 query shape with the model's own Δ / Δ % / % NR
// (or KPI Δ A/B) columns; `new` = the §16 shape with level (comparison) columns only.
// Generated file — do not hand-edit; regenerate with rayfin/probes/make-parity-fixtures.mjs.
import type { QueryTable } from '@microsoft/rayfin-connector-fabric-semanticmodel';

/** Q2b for NR, ORG_GROWTH, GM_PCT, GTN_PCT with the default filters (P · FY2026 · Sep · YTD · Actual vs Budget / Prior year · USD · M). */
export const Q2_FIN: { old: QueryTable; new: QueryTable } = {
  old: {
  columns: [{"name":"[@NR]","dataType":"Double"},{"name":"[@NR_a]","dataType":"Double"},{"name":"[@NR_b]","dataType":"Double"},{"name":"[@NR_s]","dataType":"String"},{"name":"[@ORG_GROWTH]","dataType":"Double"},{"name":"[@ORG_GROWTH_a]","dataType":"Double"},{"name":"[@ORG_GROWTH_b]","dataType":"Double"},{"name":"[@ORG_GROWTH_s]","dataType":"String"},{"name":"[@GM_PCT]","dataType":"Double"},{"name":"[@GM_PCT_a]","dataType":"Double"},{"name":"[@GM_PCT_b]","dataType":"Double"},{"name":"[@GM_PCT_s]","dataType":"String"},{"name":"[@GTN_PCT]","dataType":"Double"},{"name":"[@GTN_PCT_a]","dataType":"Double"},{"name":"[@GTN_PCT_b]","dataType":"Double"},{"name":"[@GTN_PCT_s]","dataType":"String"}],
  rows: [
    [3398.5219426605,-0.019128599306347662,0.08246880445391276,null,0.060786957516311135,-3.016150456932576,6.0786957516311135,"Reported +8.2%",0.4941001143709982,-0.41203953323923903,0.03054340767127961,null,0.21348738290488004,0.2684416640451187,0.07506272058351582,null],
  ],
},
  new: {
  columns: [{"name":"[@NR]","dataType":"Double"},{"name":"[@NR_cmp_a]","dataType":"Double"},{"name":"[@NR_cmp_b]","dataType":"Double"},{"name":"[@NR_s]","dataType":"String"},{"name":"[@ORG_GROWTH]","dataType":"Double"},{"name":"[@ORG_GROWTH_cmp_a]","dataType":"Double"},{"name":"[@ORG_GROWTH_cmp_b]","dataType":"Double"},{"name":"[@ORG_GROWTH_s]","dataType":"String"},{"name":"[@GM_PCT]","dataType":"Double"},{"name":"[@GM_PCT_cmp_a]","dataType":"Double"},{"name":"[@GM_PCT_cmp_b]","dataType":"Double"},{"name":"[@GM_PCT_s]","dataType":"String"},{"name":"[@GTN_PCT]","dataType":"Double"},{"name":"[@GTN_PCT_cmp_a]","dataType":"Double"},{"name":"[@GTN_PCT_cmp_b]","dataType":"Double"},{"name":"[@GTN_PCT_s]","dataType":"String"}],
  rows: [
    [3398.5219426605,3464.7986884489997,3139.6026644619997,null,0.060786957516311135,0.0909484620856369,0,"Reported +8.2%",0.4941001143709982,0.4982205097033906,0.4937946802942854,null,0.21348738290488004,0.21080296626442885,0.21273675569904488,null],
  ],
},
};
