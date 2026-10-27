// ADR-0008 §5: the Track A query set, built by the app's own builders (read-only use).
// Usage (repo root): fabric-app/node_modules/.bin/tsx fabric-data/perf/gen-queries.ts <outDir> [P KPI codes, comma list] [GROUP KPI codes, comma list]
// The KPI codes are the dim_kpi slots of each entity view (see README.md).
import { writeFileSync } from 'node:fs';
import { defaultFilters } from '../../fabric-app/packages/frontend/src/pnl/model/filters.ts';
import { sampleReference } from '../../fabric-app/packages/frontend/src/pnl/data/sample-reference.ts';
import {
  buildBridgeQuery,
  buildContextQuery,
  buildDriversQuery,
  buildKpiMetaQuery,
  buildKpiValuesQuery,
  buildProfitabilityQuery,
  buildStatementQuery,
  KPI_CHUNK,
} from '../../fabric-app/packages/frontend/src/pnl/data/pnl-model-queries.ts';

const [outDir, pCodes, gCodes] = process.argv.slice(2);
const reference = sampleReference();
const d = defaultFilters(reference);
const cases = {
  def: d, // P, FY of last close, Sep YTD, ACT vs BUD / PY, USD, actual rates
  worst: { ...d, entity: 'G' as const, timeView: 'ltm' as const }, // ACME Group, LTM
};
const w = (name: string, query: string) => writeFileSync(`${outDir}/${name}.dax`, query);
for (const [k, f] of Object.entries(cases)) {
  w(`${k}-q1-statement`, buildStatementQuery(f, reference));
  w(`${k}-q6-context`, buildContextQuery(f, reference));
  w(`${k}-q3-bridge`, buildBridgeQuery(f, reference));
  w(`${k}-q4-drivers`, buildDriversQuery(f, reference));
  w(`${k}-q5-profitability`, buildProfitabilityQuery(f, reference));
  w(`${k}-q2a-kpi-meta`, buildKpiMetaQuery(f.entity));
  const codes = (k === 'def' ? pCodes : gCodes)?.split(',').filter(Boolean) ?? [];
  for (let i = 0; i < codes.length; i += KPI_CHUNK) {
    w(`${k}-q2b-kpi-${i / KPI_CHUNK + 1}`, buildKpiValuesQuery(f, reference, codes.slice(i, i + KPI_CHUNK)));
  }
}
console.log(JSON.stringify({ fiscalYear: d.fiscalYear, month: d.month, cases: Object.keys(cases) }));
