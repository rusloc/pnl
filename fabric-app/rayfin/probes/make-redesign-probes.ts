// Writes the redesign-v4 queries (ADR-0006 §8.3: QV, Q3, QP, QL, Q5, QC, QB, QH) as
// `connector invoke` probe files, built by the app's own builders so the probes and
// the deployed app send the same DAX. Commerce Cloud FY2025 vs Budget / Prior year
// (the quoted view of the parity check §4) plus the Group heatmap.
// usage (from fabric-app/): npx tsx rayfin/probes/make-redesign-probes.ts
//   then: npx rayfin connector invoke pnlModel executeQuery --file rayfin/probes/redesign/<name>.query.json
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { defaultFilters } from '../../packages/frontend/src/pnl/model/filters';
import type { FilterState } from '../../packages/frontend/src/pnl/model/types';
import { sampleReference } from '../../packages/frontend/src/pnl/data/sample-reference';
import {
  BRIDGE_LIMIT,
  BUBBLE_LIMIT,
  buildBridgeQuery,
  buildBubbleQuery,
  buildConcentrationQuery,
  buildHeatQuery,
  buildProfitabilityQuery,
  buildProfitBridgeQuery,
  buildVariancesCutQuery,
  buildVariancesQuery,
  buildVitalsInfoQuery,
  buildVitalsMetaQuery,
  buildVitalsValuesQuery,
  CONCENTRATION_LIMIT,
  CUT_LIMIT,
  HEAT_LIMIT,
  PROFIT_LIMIT,
  PROFITABILITY_LIMIT,
  VARIANCE_LIMIT,
  VITALS_META_LIMIT,
  VITALS_VALUES_LIMIT,
} from '../../packages/frontend/src/pnl/data/pnl-model-queries';

const reference = sampleReference();
const s: FilterState = { ...defaultFilters(reference), entity: 'S', fiscalYear: 2025, month: 12, timeView: 'fy' };
const sPy: FilterState = { ...s, compareA: 'PY', compareB: 'NONE' };
const cc: FilterState = { ...s, fxBasis: 'constant' };

const probes: Record<string, { query: string; resultSetRowCountLimit: number }> = {
  'qv1-vitals-meta-s': { query: buildVitalsMetaQuery('S'), resultSetRowCountLimit: VITALS_META_LIMIT },
  'qv2-vitals-values-s-heroes': { query: buildVitalsValuesQuery(s, reference, ['NR', 'EBITDA', 'OP']), resultSetRowCountLimit: VITALS_VALUES_LIMIT },
  'qv2-vitals-values-s-ratios': { query: buildVitalsValuesQuery(s, reference, ['GM_PCT', 'OPEX_PCT', 'GMV']), resultSetRowCountLimit: VITALS_VALUES_LIMIT },
  'qv2-vitals-values-s-drivers': { query: buildVitalsValuesQuery(s, reference, ['MERCHANTS', 'ARR', 'MIX']), resultSetRowCountLimit: VITALS_VALUES_LIMIT },
  'qv2-vitals-values-s-fy': { query: buildVitalsValuesQuery(s, reference, ['FY_OUTLOOK']), resultSetRowCountLimit: VITALS_VALUES_LIMIT },
  'qv2-vitals-values-s-cmp-py': { query: buildVitalsValuesQuery(sPy, reference, ['NR']), resultSetRowCountLimit: VITALS_VALUES_LIMIT },
  'qv3-vitals-info-s': { query: buildVitalsInfoQuery(s, reference, ['NR', 'EBITDA', 'OP']), resultSetRowCountLimit: VITALS_VALUES_LIMIT },
  'q3-bridge-s': { query: buildBridgeQuery(s, reference), resultSetRowCountLimit: BRIDGE_LIMIT },
  'qp-profit-bridge-s': { query: buildProfitBridgeQuery(s, reference), resultSetRowCountLimit: PROFIT_LIMIT },
  'ql-variances-s': { query: buildVariancesQuery(s, reference), resultSetRowCountLimit: VARIANCE_LIMIT },
  'ql2-variances-cut-region-s': { query: buildVariancesCutQuery({ ...s, varCut: 'region' }, reference), resultSetRowCountLimit: CUT_LIMIT },
  'q5-profitability-s': { query: buildProfitabilityQuery(cc, reference), resultSetRowCountLimit: PROFITABILITY_LIMIT },
  'qc-concentration-s': { query: buildConcentrationQuery(cc, reference), resultSetRowCountLimit: CONCENTRATION_LIMIT },
  'qb-bubble-s': { query: buildBubbleQuery(cc, reference), resultSetRowCountLimit: BUBBLE_LIMIT },
  'qh-heat-s': { query: buildHeatQuery(cc, reference), resultSetRowCountLimit: HEAT_LIMIT },
  'qh-heat-group': { query: buildHeatQuery({ ...cc, entity: 'G' }, reference), resultSetRowCountLimit: HEAT_LIMIT },
};

const dir = join('rayfin', 'probes', 'redesign');
mkdirSync(dir, { recursive: true });
for (const [name, probe] of Object.entries(probes)) {
  writeFileSync(join(dir, `${name}.query.json`), `${JSON.stringify(probe, null, 2)}\n`);
  console.log(`${name}.query.json`);
}
