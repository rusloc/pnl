// Exports the Track C ⓘ pop-up and "How to read" copy as markdown so Tracks A and B align to it (parity check PC-01,
// ADR-0012 §2.3). The TypeScript builders are the source; the markdown is a generated copy:
//   P&L   → docs/ADD/features/info-popovers.md (only the block between the GENERATED markers is rewritten)
//   Mirelo → docs/ADD/features/sales-info-popovers.md (whole file)
// Sub-values are shown at the default selection as an example. Run `npm run build:data && npm run build:sales-data`
// first. Runs on Node's native type stripping, like build-data.ts (erasable TypeScript, explicit `.ts` imports).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createEngine } from '../lib/engine/index.ts';
import type { EntityView, Selection } from '../lib/engine/types.ts';
import type { HowToReadVM, InfoVM } from '../lib/engine/view-types.ts';
import { createSalesEngine } from '../lib/sales/index.ts';
import type { InfoVM as SalesInfoVM } from '../lib/sales/copy.ts';
import type { ViewId } from '../lib/sales/types.ts';
import { loadPublicDataset } from '../lib/test-utils/public-data.ts';
import { loadSalesBase, loadSalesDetail } from '../lib/test-utils/sales-data.ts';
import { selection } from '../lib/test-utils/selection.ts';

const docPath = (name: string) => fileURLToPath(new URL(`../../docs/ADD/features/${name}`, import.meta.url));
const START = '<!-- GENERATED:redesign-v4 start - npm run export:info-copy; edit the TypeScript, not this block -->';
const END = '<!-- GENERATED:redesign-v4 end -->';

const values = (v: readonly { label: string; value: string }[]) =>
  v.length ? ['', '**Values (example at the default selection)**', ...v.map((x) => `- ${x.label}: ${x.value}`)] : [];

const howTo = (h: HowToReadVM) => [`### ${h.title}`, '', ...h.lines.map((l) => `- **${l.label}**: ${l.value}`), ''];

// ---------- P&L (lib/engine: vitals.ts, analysis.ts, profitability.ts, view-copy.ts) ----------

/** Group is not built in Track C (view-context.ts); its copy follows ADR-0007 in Tracks A and B. */
const ENTITIES: readonly [EntityView, string][] = [
  ['P', 'Consumer Products'],
  ['S', 'Commerce Cloud'],
];

type Card = { key: string; info: InfoVM };

function pnlCard(variants: readonly [string, InfoVM][]): string[] {
  const [, first] = variants[0]!;
  const same = variants.every(
    ([, i]) => i.what === first.what && i.formula === first.formula && i.source === first.source,
  );
  const body = (i: InfoVM) => [
    '**What it is**',
    i.what,
    '',
    '**Formula**',
    i.formula,
    ...values(i.values),
    '',
    '**Source (Track B measures)**',
    i.source,
  ];
  if (same) return [`#### ${first.title}`, '', ...body(first), ''];
  return [
    `#### ${first.title}`,
    '',
    ...variants.flatMap(([name, i]) => [
      `_${name}_${i.title === first.title ? '' : ` - ${i.title}`}`,
      '',
      ...body(i),
      '',
    ]),
  ];
}

/** Groups cards by key across entities, keeping first-seen order; a card shown for one entity only stays single. */
function section(title: string, perEntity: readonly [string, Card[]][]): string[] {
  const order: string[] = [];
  const byKey = new Map<string, [string, InfoVM][]>();
  for (const [name, cards] of perEntity)
    for (const c of cards) {
      if (!byKey.has(c.key)) {
        byKey.set(c.key, []);
        order.push(c.key);
      }
      byKey.get(c.key)!.push([name, c.info]);
    }
  return [`### ${title}`, '', ...order.flatMap((k) => pnlCard(byKey.get(k)!))];
}

async function pnl(): Promise<string[]> {
  const engine = createEngine(await loadPublicDataset());
  const sel = (entity: EntityView, view: Selection['view']) => selection({ entity, view });
  const vitals = ENTITIES.map(([e, name]): [string, Card[]] => {
    const vm = engine.vitals(sel(e, 'kpi'));
    return [name, [...vm.results, ...vm.drivers].map((c) => ({ key: c.id, info: c.info }))];
  });
  const analysis = ENTITIES.map(([e, name]): [string, Card[]] => {
    const a = engine.analysis(sel(e, 'analysis'));
    const v = engine.variances(sel(e, 'analysis'), 8, 'block', 'none');
    return [
      name,
      [
        { key: 'nr', info: a.nr.info },
        { key: 'profit', info: a.profit.info },
        { key: 'variances', info: v.info },
      ],
    ];
  });
  const prof = ENTITIES.map(([e, name]): [string, Card[]] => {
    const p = engine.profitability(sel(e, 'profitability'));
    return [
      name,
      [
        { key: 'table', info: p.table.info },
        { key: 'concentration', info: p.concentration.info },
        { key: 'bubble', info: p.bubble.info },
        { key: 'heat', info: p.heat.info },
      ],
    ];
  });
  const views: Selection['view'][] = ['kpi', 'analysis', 'profitability'];
  return [
    START,
    '',
    '## P&L views redesign v4 - ⓘ pop-ups and How to read (Track C source)',
    '',
    'Generated from `js-report/lib/engine/vitals.ts`, `analysis.ts`, `profitability.ts` and `view-copy.ts` by',
    '`npm run export:info-copy`. The TypeScript is the source: change the copy there and re-run the script. Tracks A',
    'and B take the text as is (parity rule 6: " - " separator). Pop-up shape (ADR-0012 §2.3): title - what it is -',
    'formula in words - sub-values - source. Where a card reads differently per company, each company is listed;',
    'example values: FY2026 YTD Sep, USD m, Budget and Prior year.',
    '',
    ...section('Vitals cards', vitals),
    ...section('Analysis panels', analysis),
    ...section('Profitability panels', prof),
    '### How to read (one per view)',
    '',
    ...views.flatMap((v) => howTo(engine.howToRead(sel('P', v))).map((l) => l.replace(/^### /, '#### '))),
    END,
  ];
}

// ---------- Mirelo (lib/sales: copy.ts INFO + howToRead, card builders per view) ----------

const VIEWS: readonly ViewId[] = ['overview', 'loans', 'clients', 'portfolio', 'revenue'];

function salesCard(id: string, title: string, i: SalesInfoVM): string[] {
  return [
    `### ${id} - ${title}`,
    '',
    `**What it is** ${i.what}`,
    '',
    `**Why it matters** ${i.why}`,
    '',
    `**Formula** ${i.formula}`,
    ...values(i.values),
    '',
    `**Source** ${i.source}`,
    '',
  ];
}

async function sales(): Promise<string[]> {
  const engine = createSalesEngine(await loadSalesBase());
  const ix = engine.indexDetail(await loadSalesDetail());
  const d = engine.codec.defaults();
  const out: string[] = [];
  let cards = 0;
  for (const view of VIEWS) {
    const sel = { ...d, view };
    const head = engine.header(sel);
    out.push(`## ${head.howToRead.title.replace(/^How to read - /, '')}`, '');
    out.push(...howTo(head.howToRead));
    const list: [string, string, SalesInfoVM][] = [];
    if (view === 'overview') {
      const vm = engine.overview(sel);
      list.push(...vm.heroes.map((h): [string, string, SalesInfoVM] => [h.id, h.label, h.info]));
      list.push(...vm.charts.map((c): [string, string, SalesInfoVM] => [c.id, c.title, c.info]));
      list.push([vm.table.id, vm.table.title, vm.table.info]);
    } else {
      const vm = engine.band(sel, ix);
      list.push(...vm.kpis.map((k): [string, string, SalesInfoVM] => [k.id, k.label, k.info]));
      list.push(...vm.charts.map((c): [string, string, SalesInfoVM] => [c.id, c.title, c.info]));
      list.push([vm.table.id, vm.table.title, vm.table.info]);
    }
    cards += list.length;
    out.push(...list.flatMap(([id, title, info]) => salesCard(id, title, info)));
  }
  return [
    '# Mirelo Sales & revenue - ⓘ pop-ups and How to read (Track C source)',
    '',
    'Generated from `js-report/lib/sales/copy.ts` (INFO, howToRead) and the card builders in `js-report/lib/sales/`',
    'by `npm run export:info-copy`. The TypeScript is the source: change the copy there and re-run the script; do not',
    'edit this file by hand. Track B (Power BI) takes the text as is (ADR-0011, ADR-0012 §2.3). Pop-up shape: what it',
    'is - why it matters - formula in words - sub-values - source. Example values: Sep 2026, Month, All markets, vs',
    `Budget. ${cards} cards, ${VIEWS.length} How to read.`,
    '',
    ...out,
  ];
}

const pnlBlock = (await pnl()).join('\n');
const infoPath = docPath('info-popovers.md');
const current = readFileSync(infoPath, 'utf8');
const s = current.indexOf(START);
const e = current.indexOf(END);
const next =
  s >= 0 && e > s
    ? `${current.slice(0, s)}${pnlBlock}${current.slice(e + END.length)}`
    : `${current.trimEnd()}\n\n---\n\n${pnlBlock}\n`;
writeFileSync(infoPath, next);
const salesDoc = `${(await sales()).join('\n').trimEnd()}\n`;
writeFileSync(docPath('sales-info-popovers.md'), salesDoc);
console.log(`info-popovers.md: ${pnlBlock.length} characters; sales-info-popovers.md: ${salesDoc.length} characters`);
