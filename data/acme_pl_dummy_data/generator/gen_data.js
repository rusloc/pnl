/* Dummy dataset for the ACME Unified P&L, following the requirements doc data model (section 8). */
const E = require('./engine.js');
const fs = require('fs'), path = require('path');
const {ENT, LEAVES, I, NV, X_UNITS, X_GMV, X_MERCH, REGIONS, CCYS, FX_BUD, FX_ACT, GEN, T_LAST, SECS, NATURES, MONTHS} = E;
const OUT = process.argv[2];
for (const d of ['facts', 'dims', 'params', 'checks']) fs.mkdirSync(path.join(OUT, d), {recursive:true});

/* ---------- CSV writer ---------- */
class CSV {
  constructor(rel, header) { this.file = path.join(OUT, rel); this.fd = fs.openSync(this.file, 'w'); this.buf = []; this.rows = 0; this.line(header); this.rows = 0; }
  line(arr) { this.buf.push(arr.map(cell).join(',')); this.rows++; if (this.buf.length >= 20000) this.flush(); }
  flush() { if (this.buf.length) { fs.writeSync(this.fd, this.buf.join('\n') + '\n'); this.buf = []; } }
  close() { this.flush(); fs.closeSync(this.fd); return this.rows; }
}
function cell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
const r2 = v => Math.round(v * 100) / 100;
const f2 = v => r2(v).toFixed(2);
const range = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };
const monthKey = t => `${2024 + Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`;
const yearOf = t => Math.floor(t / 12);

/* ---------- Static setup ---------- */
const DIRECT = new Set(['GR', 'GTN', 'COR', 'VSC']);
const VERSIONS = [
  {key:'ACT', code:'Actual', name:'Actual', sc:0, months:range(0, T_LAST), scale:1, cycle:'', latest:false},
  {key:'BUD', code:'Budget', name:'Budget', sc:1, months:range(0, 35), scale:1, cycle:'', latest:false},
  {key:'FC2606', code:'Forecast', name:'Forecast 6+6 (Jun 2026)', sc:2, months:range(30, 35), scale:.99, cycle:'2026-06', latest:false},
  {key:'FC2609', code:'Forecast', name:'Forecast 9+3 (Sep 2026)', sc:2, months:range(33, 35), scale:1, cycle:'2026-09', latest:true},
];
const CC = {
  P:{GR:'P-COM', GTN:'P-COM', COR:'P-MFG', VSC:'P-LOG', SM:'P-MKT', RD:'P-RND', GA:'P-GA', OOI:'P-GA', DA:'P-GA', ADJ:'P-CORP', INV:'P-TRE', FIN:'P-TRE', TAX:'P-TAX'},
  S:{GR:'S-COM', GTN:'S-COM', COR:'S-OPS', VSC:'S-REV', SM:'S-GTM', RD:'S-ENG', GA:'S-GA', OOI:'S-GA', DA:'S-GA', ADJ:'S-CORP', INV:'S-TRE', FIN:'S-TRE', TAX:'S-TAX'},
};
const ccFor = (e, L) => (L.id === 'VSC_P3' || L.id === 'VSC_P4' ? 'P-ECOM' : L.id === 'VSC_S1' ? 'S-GTM' : CC[e][L.sec]);
const STEP = {GR:'1', GTN:'2', COR:'4', VSC:'6', SM:'8a', RD:'8b', GA:'8c', OOI:'8d', DA:'10', ADJ:'12', INV:'14', FIN:'16', TAX:'18'};

/* ---------- Facts ---------- */
const FPL_H = ['entity_code','month_key','version_key','region_code','channel_code','line_code','segment_code','account_code','counterparty_entity_code','currency_code','cost_centre_code','amount_local'];
const fpl = new CSV('facts/fact_pl.csv', FPL_H);
const fal = new CSV('facts/fact_pl_allocated.csv', FPL_H);
const fop = new CSV('facts/fact_operational.csv', ['entity_code','month_key','version_key','region_code','channel_code','line_code','segment_code','currency_code','units_sold','gmv_local','active_merchants_end']);
const buf = new Float64Array(NV);

// control totals in USD (spec rules: actual & forecast at monthly average rates, budget at its year's budget rate)
const usdRate = (ci, t, vkey) => (vkey === 'BUD' ? FX_BUD[ci][yearOf(t)] : Number(FX_ACT[ci][t].toFixed(6))); // same precision as fact_fx_rate.csv
const ctl = {};      // ctl[ent][vkey][t][sec]
const icUSD = {};    // icUSD[vkey][t]
const addCtl = (e, vkey, t, sec, usd) => { const a = ((ctl[e] ??= {})[vkey] ??= {})[t] ??= {}; a[sec] = (a[sec] || 0) + usd; };
const icLocal = {};  // icLocal[vkey][t][r] (positive revenue to Commerce Cloud, region local currency)
const checks = {allocDiffMax:0, icDiff:0};

for (const e of ['P', 'S']) {
  const En = ENT[e];
  const leaves = LEAVES.filter(L => L.ent === e || L.ent === 'B');
  const direct = leaves.filter(L => DIRECT.has(L.sec));
  const below = leaves.filter(L => !DIRECT.has(L.sec));
  const nrIdx = leaves.filter(L => L.sec === 'GR' || L.sec === 'GTN').map(L => L.i);
  const n = En.combos.length;
  for (const V of VERSIONS) {
    for (const t of V.months) {
      const mk = monthKey(t);
      const regBelow = REGIONS.map(() => new Float64Array(NV));
      const regNR = [0, 0, 0, 0];
      const sliceNR = new Float64Array(n);
      for (const C of En.combos) {
        buf.fill(0);
        GEN[e](C, t, V.sc, buf);
        if (V.scale !== 1) for (let i = 0; i < NV; i++) buf[i] *= V.scale;
        const ccy = CCYS[C.ccy], rid = REGIONS[C.r].id;
        const ch = En.channel[C.c].id, ln = En.line[C.l].id, sg = En.seg[C.s].id;
        const rate = usdRate(C.ccy, t, V.key);
        for (const L of direct) {
          const v = buf[L.i];
          if (Math.abs(v) < .005) continue;
          const cp = L.id === 'VSC_P4' ? 'S' : '';
          fpl.line([e, mk, V.key, rid, ch, ln, sg, L.id, cp, ccy, ccFor(e, L), f2(v)]);
          addCtl(e, V.key, t, L.sec, r2(v) / rate);
          if (L.id === 'VSC_P4') {
            ((icLocal[V.key] ??= {})[t] ??= [0, 0, 0, 0])[C.r] -= r2(v);
            ((icUSD[V.key] ??= {})[t] = (icUSD[V.key][t] || 0) - r2(v) / rate);
          }
        }
        let nr = 0; for (const i of nrIdx) nr += r2(buf[i]);
        sliceNR[C.k] += nr; regNR[C.r] += nr;
        for (const L of below) regBelow[C.r][L.i] += buf[L.i];
        // operational
        if (e === 'P') { if (buf[X_UNITS]) fop.line([e, mk, V.key, rid, ch, ln, sg, ccy, Math.round(buf[X_UNITS]), '', '']); }
        else if (buf[X_GMV] || buf[X_MERCH]) fop.line([e, mk, V.key, rid, ch, ln, sg, ccy, '', buf[X_GMV] ? f2(buf[X_GMV]) : '', buf[X_MERCH] ? Math.round(buf[X_MERCH]) : '']);
      }
      // Commerce Cloud: intercompany revenue billed to Consumer Products (sales-led, enterprise), plus tax on it
      if (e === 'S' && icLocal[V.key] && icLocal[V.key][t]) {
        for (let r = 0; r < 4; r++) {
          const ic = icLocal[V.key][t][r];
          if (!ic) continue;
          const ccy = CCYS[REGIONS[r].ccy], rid = REGIONS[r].id, rate = usdRate(REGIONS[r].ccy, t, V.key);
          const sub = r2(ic * .3), pay = r2(ic - sub);
          fpl.line(['S', mk, V.key, rid, 'SALES', 'SUB', 'ENT', 'GR_S1', 'P', ccy, 'S-COM', f2(sub)]);
          fpl.line(['S', mk, V.key, rid, 'SALES', 'PAY', 'ENT', 'GR_S2', 'P', ccy, 'S-COM', f2(pay)]);
          addCtl('S', V.key, t, 'GR', (sub + pay) / rate);
          const kSub = ((r * 3 + 1) * 4 + 0) * 3 + 2, kPay = ((r * 3 + 1) * 4 + 1) * 3 + 2;
          sliceNR[kSub] += sub; sliceNR[kPay] += pay; regNR[r] += sub + pay;
          regBelow[r][I.TAX_1] += -.17 * ic; regBelow[r][I.TAX_2] += -.05 * ic;
        }
      }
      // below-CM lines: booked at entity x region (UNASSIGNED slices), then allocated by NR share
      for (let r = 0; r < 4; r++) {
        const ccy = CCYS[REGIONS[r].ccy], rid = REGIONS[r].id, rate = usdRate(REGIONS[r].ccy, t, V.key);
        const combos = En.combos.filter(C => C.r === r);
        let big = combos[0];
        for (const C of combos) if (Math.abs(sliceNR[C.k]) > Math.abs(sliceNR[big.k])) big = C;
        for (const L of below) {
          const tot = r2(regBelow[r][L.i]);
          if (Math.abs(tot) < .005) continue;
          fpl.line([e, mk, V.key, rid, e + '_UNASSIGNED', e + '_UNASSIGNED', e + '_UNASSIGNED', L.id, '', ccy, ccFor(e, L), f2(tot)]);
          addCtl(e, V.key, t, L.sec, tot / rate);
          const parts = combos.map(C => r2(tot * sliceNR[C.k] / regNR[r]));
          const resid = r2(tot - parts.reduce((a, b) => a + b, 0));
          combos.forEach((C, j) => {
            let v = parts[j]; if (C === big) v = r2(v + resid);
            if (Math.abs(v) < .005) return;
            fal.line([e, mk, V.key, rid, En.channel[C.c].id, En.line[C.l].id, En.seg[C.s].id, L.id, '', ccy, ccFor(e, L), f2(v)]);
          });
          const check = Math.abs(r2(parts.reduce((a, b) => a + b, 0) + resid) - tot);
          checks.allocDiffMax = Math.max(checks.allocDiffMax, check);
        }
      }
    }
  }
}
const nFpl = fpl.close(), nFal = fal.close(), nFop = fop.close();

// FX rates
const ffx = new CSV('facts/fact_fx_rate.csv', ['currency_code','month_key','rate_type','local_per_usd']);
CCYS.forEach((c, ci) => { for (let t = 0; t < 36; t++) {
  ffx.line([c, monthKey(t), 'ACTUAL_AVG', FX_ACT[ci][t].toFixed(6)]);
  ffx.line([c, monthKey(t), 'BUDGET', FX_BUD[ci][yearOf(t)].toFixed(6)]);
} });
const nFx = ffx.close();

/* ---------- Dimensions ---------- */
function writeTable(rel, header, rows) { const w = new CSV(rel, header); rows.forEach(r => w.line(r)); return w.close(); }
const counts = {};
const entName = {P:'Consumer Products', S:'Commerce Cloud', B:'Both (shared code)', G:'Group elimination'};
const entScope = {P:'P', S:'S', B:'BOTH', G:'GROUP'};
const ALL_ACCOUNTS = [...LEAVES];
const ooi4 = {i:-1, id:'OOI_4', ent:'G', sec:'OOI', label:'Intercompany difference', nat:[{n:'N8', w:1}], def:'Mismatch between the two sides of intercompany fees (timing, FX); shown only when non-zero (C-37). No rows in the dummy data: both sides match.', ref:'Consolidation (IFRS 10)'};
ALL_ACCOUNTS.splice(ALL_ACCOUNTS.findIndex(L => L.id === 'OOI_3') + 1, 0, ooi4);
const natSign = L => (L.id === 'ELIM_GR' ? -1 : (L.id === 'ELIM_VSC' || L.id === 'RD_S3') ? 1 : L.sec === 'OOI' ? 0 : SECS[L.sec].sign);
counts['dims/dim_account.csv'] = writeTable('dims/dim_account.csv',
  ['account_code','account_name','entity_scope','entity_scope_name','block_code','block_name','block_alias_products','block_alias_services','spine_step','sort_order','natural_sign','ifrs18_category','is_direct','is_below_cm','is_intercompany','has_fact_rows','definition','published_comparable','default_cost_centre_products','default_cost_centre_services'],
  ALL_ACCOUNTS.map((L, k) => [L.id, L.label, entScope[L.ent], entName[L.ent], L.sec, SECS[L.sec].label, SECS[L.sec].alias ? SECS[L.sec].alias.P : SECS[L.sec].label, SECS[L.sec].alias ? SECS[L.sec].alias.S : SECS[L.sec].label,
    STEP[L.sec], (k + 1) * 10, natSign(L), SECS[L.sec].cat, DIRECT.has(L.sec), !DIRECT.has(L.sec), L.id === 'VSC_P4' || L.ent === 'G', L.ent !== 'G',
    L.def, L.ref, (L.ent === 'P' || L.ent === 'B') ? ccFor('P', L) : '', (L.ent === 'S' || L.ent === 'B') ? ccFor('S', L) : '']));
counts['dims/bridge_account_nature.csv'] = writeTable('dims/bridge_account_nature.csv', ['account_code','nature_code','weight'],
  ALL_ACCOUNTS.flatMap(L => L.nat.map(x => [L.id, x.n, x.w.toFixed(2)])));
counts['dims/dim_nature.csv'] = writeTable('dims/dim_nature.csv', ['nature_code','nature_name','sort_order','natural_sign'],
  NATURES.map((N, k) => [N.id, N.label, (k + 1) * 10, (N.id === 'N8' || N.id === 'N9') ? 0 : -1]));

const RL = [
  ['GR','Gross revenue','input_block','','GR','1','','',false,'Gross sales','Gross billings','Operating'],
  ['GTN','Gross-to-net deductions','input_block','','GTN','2','','',false,'Trade spend & customer deductions','Discounts, credits & refunds','Operating'],
  ['NR','Net revenue','subtotal','GR + GTN','','3','','',true,'Net sales','Revenue','Operating'],
  ['COR','Cost of revenue','input_block','','COR','4','','',false,'Cost of goods sold','Cost of revenue','Operating'],
  ['GP','Gross profit','subtotal','NR + COR','','5','','',false,'Gross profit','Gross profit','Operating'],
  ['GM_PCT','Gross margin %','ratio','GP / NR','','5','','',false,'','','Operating'],
  ['VSC','Variable selling & cost-to-serve','input_block','','VSC','6','','',false,'Distribution & channel costs','Acquisition & transaction costs','Operating'],
  ['CM','Contribution margin','subtotal','GP + VSC','','7','Mgmt','',false,'','','Operating'],
  ['CM_PCT','Contribution margin %','ratio','CM / NR','','7','','',false,'','','Operating'],
  ['OPEX','Operating expenses','group_total','SM + RD + GA + OOI','','8','','',false,'','','Operating'],
  ['SM','Sales & marketing','input_block','','SM','8a','','OPEX',false,'Advertising, promotion & selling','Sales & marketing','Operating'],
  ['RD','Research & development','input_block','','RD','8b','','OPEX',false,'Product innovation','Product development','Operating'],
  ['GA','General & administrative','input_block','','GA','8c','','OPEX',false,'','','Operating'],
  ['OOI','Other operating income / (expense)','input_block','','OOI','8d','','OPEX',false,'','','Operating'],
  ['EBITDA','Adjusted EBITDA','subtotal','CM + OPEX','','9','MPM','',true,'','','Operating'],
  ['EBITDA_PCT','Adjusted EBITDA margin %','ratio','EBITDA / NR','','9','','',false,'','','Operating'],
  ['DA','Depreciation & amortisation','input_block','','DA','10','','',false,'','','Operating'],
  ['UOP','Underlying operating profit','memo','EBITDA + DA','','11','MPM','',false,'','','Operating'],
  ['ADJ','Adjusting items (non-underlying)','input_block','','ADJ','12','','',false,'','','Operating'],
  ['OP','Operating profit','subtotal','UOP + ADJ','','13','IFRS 18','',true,'','','Operating'],
  ['OP_PCT','Operating margin %','ratio','OP / NR','','13','','',false,'','','Operating'],
  ['INV','Investing income','input_block','','INV','14','','',false,'','','Investing'],
  ['PBFIT','Profit before financing and income taxes','subtotal','OP + INV','','15','IFRS 18','',false,'','',''],
  ['FIN','Financing expenses','input_block','','FIN','16','','',false,'','','Financing'],
  ['PBT','Profit before tax','subtotal','PBFIT + FIN','','17','','',false,'','',''],
  ['TAX','Income tax expense','input_block','','TAX','18','','',false,'','','Income tax'],
  ['ETR_PCT','Effective tax rate %','ratio','-TAX / PBT','','18','','',false,'','',''],
  ['NP','Net profit for the period','subtotal','PBT + TAX','','19','','',true,'Net earnings','Net income',''],
  ['NP_PCT','Net margin %','ratio','NP / NR','','19','','',false,'','',''],
];
counts['dims/dim_report_line.csv'] = writeTable('dims/dim_report_line.csv',
  ['line_code','line_name','row_type','formula','block_code','spine_step','tag','parent_line_code','is_key','alias_products','alias_services','ifrs18_category','sort_order'],
  RL.map((r, k) => [...r, (k + 1) * 10]));

counts['dims/dim_entity.csv'] = writeTable('dims/dim_entity.csv', ['entity_code','entity_name','short_name','description','consolidation_group'],
  ['P', 'S'].map(e => [e, ENT[e].name, ENT[e].short, ENT[e].blurb, 'ACME Group']));
counts['dims/dim_month.csv'] = writeTable('dims/dim_month.csv', ['month_key','month_start_date','month_index','fiscal_year','quarter','month_number','month_name','is_closed'],
  range(0, 35).map(t => [monthKey(t), monthKey(t) + '-01', t, 2024 + yearOf(t), 'Q' + (Math.floor((t % 12) / 3) + 1), t % 12 + 1, MONTHS[t % 12], t <= T_LAST]));
counts['dims/dim_version.csv'] = writeTable('dims/dim_version.csv', ['version_key','version_code','version_name','forecast_cycle','is_latest_forecast','first_month_key','last_month_key'],
  VERSIONS.map(V => [V.key, V.code, V.name, V.cycle, V.latest, monthKey(V.months[0]), monthKey(V.months.at(-1))]));
counts['dims/dim_region.csv'] = writeTable('dims/dim_region.csv', ['region_code','region_name','functional_currency','sort_order'],
  REGIONS.map((R, k) => [R.id, R.name, CCYS[R.ccy], (k + 1) * 10]));
const dimSlice = (key, label) => ['P', 'S'].flatMap(e => [
  ...ENT[e][key].map((x, k) => [x.id, x.name, e, ENT[e].dimLabels[label], (k + 1) * 10, false]),
  [e + '_UNASSIGNED', 'Unassigned (allocated by NR share)', e, ENT[e].dimLabels[label], 990, true]]);
counts['dims/dim_channel.csv'] = writeTable('dims/dim_channel.csv', ['channel_code','channel_name','entity_code','slot_label','sort_order','is_unassigned'], dimSlice('channel', 'channel'));
counts['dims/dim_line.csv'] = writeTable('dims/dim_line.csv', ['line_code','line_name','entity_code','slot_label','sort_order','is_unassigned'], dimSlice('line', 'line'));
counts['dims/dim_segment.csv'] = writeTable('dims/dim_segment.csv', ['segment_code','segment_name','entity_code','slot_label','sort_order','is_unassigned'], dimSlice('seg', 'seg'));
counts['dims/dim_cost_centre.csv'] = writeTable('dims/dim_cost_centre.csv', ['cost_centre_code','cost_centre_name','entity_code','function'], [
  ['P-COM','Commercial','P','Revenue'], ['P-MFG','Manufacturing & sourcing','P','Cost of revenue'], ['P-LOG','Logistics & distribution','P','Cost-to-serve'], ['P-ECOM','E-commerce & marketplaces','P','Cost-to-serve'],
  ['P-MKT','Marketing & sales','P','Sales & marketing'], ['P-RND','Innovation & quality','P','Research & development'], ['P-GA','Corporate functions','P','General & administrative'],
  ['P-CORP','Corporate projects','P','Adjusting items'], ['P-TRE','Treasury','P','Investing & financing'], ['P-TAX','Tax','P','Income tax'],
  ['S-COM','Commercial','S','Revenue'], ['S-OPS','Service delivery & infrastructure','S','Cost of revenue'], ['S-REV','Revenue operations','S','Cost-to-serve'],
  ['S-GTM','Go-to-market','S','Sales & marketing'], ['S-ENG','Engineering','S','Research & development'], ['S-GA','Corporate functions','S','General & administrative'],
  ['S-CORP','Corporate projects','S','Adjusting items'], ['S-TRE','Treasury','S','Investing & financing'], ['S-TAX','Tax','S','Income tax'],
]);

/* ---------- Parameter tables ---------- */
const P = (name, header, rows) => { counts['params/' + name] = writeTable('params/' + name, header, rows); };
P('param_reporting_currency.csv', ['currency_code','currency_name','symbol','sort_order','is_default'], [['USD','US dollar','$',10,true],['EUR','Euro','€',20,false],['GBP','Pound sterling','£',30,false]]);
P('param_fx_basis.csv', ['fx_basis_code','fx_basis_name','sort_order','is_default'], [['ACT','Actual rates',10,true],['CC','Constant currency (budget rates of selected year)',20,false]]);
P('param_units.csv', ['units_code','units_name','divisor','decimals','sort_order','is_default'], [['M','Millions',1000000,1,10,true],['K','Thousands',1000,0,20,false]]);
P('param_version_choice.csv', ['choice_code','choice_name','allowed_as_base','allowed_as_compare','sort_order','default_for'], [['A','Actual',true,false,10,'Base'],['LE','Latest estimate (actual + latest forecast)',true,true,20,''],['B','Budget',true,true,30,'Compare A'],['PY','Prior year (actual, months shifted 12 back)',false,true,40,'Compare B'],['NONE','None',false,true,50,'']]);
P('param_time_view.csv', ['time_view_code','time_view_name','sort_order','is_default'], [['MTD','Month',10,false],['QTD','QTD',20,false],['YTD','YTD',30,true],['LTM','LTM',40,false],['FY','Full year',50,false]]);
P('param_layout.csv', ['layout_code','layout_name','available_for','sort_order'], [['VAR','Variance','All views',10],['TREND','Trend','All views',20],['ENT','Entity columns','Group view only',30]]);
P('param_cost_lens.csv', ['lens_code','lens_name','sort_order','is_default'], [['FN','By function',10,true],['NAT','By nature',20,false]]);
P('param_detail_level.csv', ['detail_code','detail_name','sort_order','is_default'], [['SUM','Summary',10,false],['STD','Standard',20,true],['FULL','Full',30,false]]);
P('param_cost_sign.csv', ['cost_sign_code','cost_sign_name','display_multiplier_for_costs','sort_order','is_default'], [['NEG','As negatives',1,10,true],['POS','As positives',-1,20,false]]);
P('param_variance_format.csv', ['variance_format_code','variance_format_name','sort_order','is_default'], [['BOTH','Amount and %',10,true],['ABS','Amount',20,false],['PCT','%',30,false]]);
P('param_breakdown.csv', ['breakdown_code','breakdown_name','available_for','sort_order'], [['REGION','Region','All views',10],['CHANNEL','Channel / sales motion','Single entity',20],['LINE','Category / service line','Single entity',30],['SEGMENT','Price tier / customer segment','Single entity',40],['ENTITY','Entity','Group view only',50]]);

/* ---------- Control totals (USD, spec translation rules) ---------- */
const SECS_ORDER = ['GR','GTN','COR','VSC','SM','RD','GA','OOI','DA','ADJ','INV','FIN','TAX'];
function windowSum(e, parts) {
  const s = Object.fromEntries(SECS_ORDER.map(k => [k, 0]));
  for (const [vkey, months] of parts) for (const t of months) {
    for (const en of (e === 'GROUP' ? ['P', 'S'] : [e])) { const a = ctl[en]?.[vkey]?.[t]; if (a) for (const k in a) s[k] += a[k]; }
    if (e === 'GROUP') { const ic = icUSD[vkey]?.[t] || 0; s.GR -= ic; s.VSC += ic; }
  }
  const v = {...s};
  v.NR = v.GR + v.GTN; v.GP = v.NR + v.COR; v.CM = v.GP + v.VSC; v.OPEX = v.SM + v.RD + v.GA + v.OOI; v.EBITDA = v.CM + v.OPEX;
  v.UOP = v.EBITDA + v.DA; v.OP = v.UOP + v.ADJ; v.PBFIT = v.OP + v.INV; v.PBT = v.PBFIT + v.FIN; v.NP = v.PBT + v.TAX;
  return v;
}
const WINDOWS = [
  ['ACT', 'FY2024', [['ACT', range(0, 11)]]], ['ACT', 'FY2025', [['ACT', range(12, 23)]]], ['ACT', 'FY2026 YTD Sep', [['ACT', range(24, 32)]]],
  ['BUD', 'FY2024', [['BUD', range(0, 11)]]], ['BUD', 'FY2025', [['BUD', range(12, 23)]]], ['BUD', 'FY2026', [['BUD', range(24, 35)]]], ['BUD', 'FY2026 YTD Sep', [['BUD', range(24, 32)]]],
  ['LE', 'FY2026 (actual Jan-Sep + forecast 9+3)', [['ACT', range(24, 32)], ['FC2609', range(33, 35)]]],
];
const LINES = ['GR','GTN','NR','COR','GP','VSC','CM','SM','RD','GA','OOI','OPEX','EBITDA','DA','UOP','ADJ','OP','INV','PBFIT','FIN','PBT','TAX','NP'];
const ctlRows = [];
for (const e of ['P', 'S', 'GROUP']) for (const [ver, win, parts] of WINDOWS) {
  const v = windowSum(e, parts);
  for (const ln of LINES) ctlRows.push([e, ver, win, ln, f2(v[ln])]);
}
counts['checks/control_totals_usd.csv'] = writeTable('checks/control_totals_usd.csv', ['entity_code','version','window','line_code','amount_usd'], ctlRows);

// IC symmetry check (local currency): sum of P VSC_P4 vs S counterparty-P revenue
let icP = 0; for (const vk in icLocal) for (const t in icLocal[vk]) icP += icLocal[vk][t].reduce((a, b) => a + b, 0);
console.log(JSON.stringify({rows:{'facts/fact_pl.csv':nFpl, 'facts/fact_pl_allocated.csv':nFal, 'facts/fact_operational.csv':nFop, 'facts/fact_fx_rate.csv':nFx, ...counts}, checks, icLocalTotal:r2(icP)}, null, 1));
fs.writeFileSync(path.join(OUT, 'checks', '_counts.json'), JSON.stringify({'facts/fact_pl.csv':nFpl, 'facts/fact_pl_allocated.csv':nFal, 'facts/fact_operational.csv':nFop, 'facts/fact_fx_rate.csv':nFx, ...counts}));
