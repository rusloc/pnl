/* ===================== ACME P&L ENGINE (sample data, deterministic) ===================== */
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const Y0 = 2024, NT = 36, T_LAST = 32; // actuals closed through Sep 2026
const CCYS = ['USD','EUR','GBP','AUD'];
const REP_CCYS = ['USD','EUR','GBP'];
const REGIONS = [
  {id:'NA', name:'North America', ccy:0},
  {id:'EU', name:'Continental Europe', ccy:1},
  {id:'UK', name:'UK & Ireland', ccy:2},
  {id:'AP', name:'Asia-Pacific', ccy:3},
];
// local currency per 1 USD; budget rates by year (2024, 2025, 2026)
const FX_BUD = [[1,1,1],[.92,.93,.87],[.79,.79,.75],[1.50,1.55,1.53]];
const FX_ANCH = [[1,1,1,1,1,1,1],[.92,.93,.95,.87,.85,.86,.86],[.79,.79,.79,.74,.73,.74,.74],[1.51,1.50,1.58,1.53,1.52,1.51,1.51]];
const ANCH_T = [0,6,12,18,24,30,35];
const FX_ACT = CCYS.map((c, i) => {
  const a = [];
  for (let t = 0; t < NT; t++) {
    let k = 0;
    while (k < ANCH_T.length - 2 && t > ANCH_T[k + 1]) k++;
    const t0 = ANCH_T[k], t1 = ANCH_T[k + 1];
    const v = FX_ANCH[i][k] + (FX_ANCH[i][k + 1] - FX_ANCH[i][k]) * (t - t0) / (t1 - t0);
    a.push(i === 0 ? 1 : v * (1 + 0.006 * Math.sin(t * 1.7 + i)));
  }
  return a;
});

function h4(a, b, c, d) {
  let x = Math.imul((a + 0x9E3779B9) | 0, 0x85EBCA6B) ^ Math.imul((b + 0x7F4A7C15) | 0, 0xC2B2AE35);
  x ^= x >>> 15;
  x = Math.imul(x ^ Math.imul((c + 0x165667B1) | 0, 0x27D4EB2F), 0x85EBCA6B);
  x ^= x >>> 13;
  x = Math.imul(x ^ Math.imul((d + 0x61C88647) | 0, 0x9E3779B1), 0xC2B2AE35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296 * 2 - 1;
}

/* ---------- Entities and their dimensions ---------- */
const ENT = {
  P: {
    id:'P', name:'ACME Consumer Products', short:'Consumer Products',
    blurb:'Branded and private-label consumer goods sold through retail, wholesale, marketplaces and an own D2C webstore.',
    dimLabels:{channel:'Channel', line:'Category', seg:'Price tier'},
    channel:[{id:'GRO',name:'Grocery & mass retail'},{id:'DRG',name:'Drugstore & specialty retail'},{id:'D2C',name:'Own D2C webstore'},{id:'MKT',name:'Online marketplaces'},{id:'WHS',name:'Wholesale & distributors'}],
    line:[{id:'HOME',name:'Home care'},{id:'PERS',name:'Personal care & beauty'},{id:'KITC',name:'Kitchen & household'},{id:'ELEC',name:'Electronics accessories'},{id:'TOYS',name:'Toys & leisure'}],
    seg:[{id:'PREM',name:'Premium'},{id:'MAIN',name:'Mainstream'},{id:'VAL',name:'Value & private label'}],
  },
  S: {
    id:'S', name:'ACME Commerce Cloud', short:'Commerce Cloud',
    blurb:'E-commerce SaaS: store platform subscriptions, payments, apps marketplace and implementation services for merchants.',
    dimLabels:{channel:'Sales motion', line:'Service line', seg:'Customer segment'},
    channel:[{id:'SELF',name:'Self-serve sign-up'},{id:'SALES',name:'Sales-led (direct)'},{id:'PART',name:'Partner & agency-led'}],
    line:[{id:'SUB',name:'Platform subscriptions'},{id:'PAY',name:'Payments'},{id:'APP',name:'Apps, partners & ads'},{id:'PS',name:'Professional services'}],
    seg:[{id:'SMB',name:'Small business'},{id:'MID',name:'Mid-market'},{id:'ENT',name:'Enterprise'}],
  },
};

/* ---------- Sections (unified spine building blocks) ---------- */
const SECS = {
  GR:  {label:'Gross revenue', sign:1, cat:'Operating', alias:{P:'Gross sales', S:'Gross billings'}},
  GTN: {label:'Gross-to-net deductions', sign:-1, cat:'Operating', alias:{P:'Trade spend & customer deductions', S:'Discounts, credits & refunds'}},
  COR: {label:'Cost of revenue', sign:-1, cat:'Operating', alias:{P:'Cost of goods sold', S:'Cost of revenue'}},
  VSC: {label:'Variable selling & cost-to-serve', sign:-1, cat:'Operating', alias:{P:'Distribution & channel costs', S:'Acquisition & transaction costs'}},
  SM:  {label:'Sales & marketing', sign:-1, cat:'Operating', alias:{P:'Advertising, promotion & selling', S:'Sales & marketing'}},
  RD:  {label:'Research & development', sign:-1, cat:'Operating', alias:{P:'Product innovation', S:'Product development'}},
  GA:  {label:'General & administrative', sign:-1, cat:'Operating'},
  OOI: {label:'Other operating income / (expense)', sign:1, cat:'Operating'},
  DA:  {label:'Depreciation & amortisation', sign:-1, cat:'Operating'},
  ADJ: {label:'Adjusting items (non-underlying)', sign:-1, cat:'Operating'},
  INV: {label:'Investing income', sign:1, cat:'Investing'},
  FIN: {label:'Financing expenses', sign:-1, cat:'Financing'},
  TAX: {label:'Income tax expense', sign:-1, cat:'Income tax'},
};

const NATURES = [
  {id:'N1', label:'Materials, goods & packaging consumed'},
  {id:'N2', label:'Employee benefits'},
  {id:'N3', label:'Freight, logistics & outsourced services'},
  {id:'N4', label:'Advertising, promotion & media'},
  {id:'N5', label:'Technology, hosting & software'},
  {id:'N6', label:'Commissions, fees, transaction & credit losses'},
  {id:'N7', label:'Energy, facilities & other operating costs'},
  {id:'N8', label:'Other operating income & FX'},
  {id:'N9', label:'Own work capitalised'},
];

/* ---------- Leaf lines: [id, entity (P|S|B=both|G=group elimination), section, label, nature split, definition, comparable published line] ---------- */
const LEAF_DEFS = [
  ['GR_P1','P','GR','Gross product sales', '', 'Units shipped × list price across all channels, before any customer-specific deduction.', 'P&G and Unilever start from gross invoiced sales; Amazon: net product sales'],
  ['GR_P2','P','GR','Shipping & delivery fees billed', '', 'Delivery fees charged to D2C consumers.', 'Amazon includes shipping fees in product sales'],
  ['GR_S1','S','GR','Subscription platform fees', '', 'Recurring plan fees (store platform, POS, themes, domains). Basis of ARR/MRR.', 'Shopify: subscription solutions; BigCommerce: subscription solutions'],
  ['GR_S2','S','GR','Payments & transaction fees', '', 'Processing fees on merchant GMV, transaction fees and shipping-label margin. Moves with GMV.', 'Shopify: merchant solutions (Shopify Payments)'],
  ['GR_S3','S','GR','Apps, partner revenue share & ads', '', 'Revenue share from app and technology partners, marketplace listings and merchant ads.', 'BigCommerce: partner & services revenue'],
  ['GR_S4','S','GR','Professional services', '', 'Implementation, migration and custom development. Mostly non-recurring.', 'SaaS P&L practice: services revenue shown apart from subscription'],
  ['ELIM_GR','G','GR','Intercompany eliminations', '', 'Removes Commerce Cloud fees billed to Consumer Products for its D2C webstore and payments.', 'Consolidation (IFRS 10): intra-group income eliminated'],

  ['GTN_P1','P','GTN','Trade promotions & retailer allowances', '', 'Temporary price reductions, feature and display funding, off-invoice allowances. Contra-revenue.', 'P&G: customer trade funds recorded as a reduction of net sales'],
  ['GTN_P2','P','GTN','Customer rebates, listing & slotting fees', '', 'Volume rebates, new-listing and shelf fees, retailer marketing contributions.', 'CPG gross-to-net waterfall'],
  ['GTN_P3','P','GTN','Consumer coupons & D2C discounts', '', 'Coupons, promo codes and loyalty redemptions.', 'P&G: coupons recorded as a reduction of net sales'],
  ['GTN_P4','P','GTN','Returns, damages & spoilage', '', 'Expected returns and retailer damage deductions; highest in electronics, toys and online channels.', 'Amazon: product sales net of return allowances'],
  ['GTN_P5','P','GTN','Prompt-payment discounts', '', 'Early-settlement discounts taken by trade customers.', 'CPG gross-to-net waterfall'],
  ['GTN_S1','S','GTN','Contractual discounts & promotional credits', '', 'Multi-year and volume discounts, promotional plan pricing.', 'IFRS 15 / ASC 606 variable consideration'],
  ['GTN_S2','S','GTN','Free-trial & onboarding credits', '', 'Free months and migration credits that reduce billed revenue.', 'SaaS bookings vs revenue practice'],
  ['GTN_S3','S','GTN','Refunds, SLA credits & billing adjustments', '', 'Refunds, uptime SLA credits and fee reversals.', 'IFRS 15 / ASC 606 variable consideration'],

  ['COR_P1','P','COR','Raw materials & packaging', 'N1:1', 'Materials and packaging consumed in own plants.', 'P&G: cost of products sold (direct materials and supplies)'],
  ['COR_P2','P','COR','Sourced finished goods', 'N1:1', 'Co-manufactured and imported finished products; dominant for electronics and toys.', 'Amazon: cost of sales (purchase price of products)'],
  ['COR_P3','P','COR','Direct labour', 'N2:1', 'Production-line wages and benefits.', 'P&G: manufacturing labour in cost of products sold'],
  ['COR_P4','P','COR','Manufacturing overhead (ex-depreciation)', 'N2:.45,N7:.55', 'Plant utilities, maintenance, quality and supervision. Plant depreciation is shown under D&A.', 'P&G: direct overhead in cost of products sold'],
  ['COR_P5','P','COR','Inbound freight, duties & tariffs', 'N3:1', 'Supplier-to-plant and supplier-to-DC freight, customs duties and tariffs.', 'P&G and Amazon: inbound freight in cost of sales'],
  ['COR_P6','P','COR','Royalties on licensed brands', 'N6:1', 'Licence fees on character and brand licences.', '—'],
  ['COR_P7','P','COR','Inventory write-downs & obsolescence', 'N1:1', 'Net realisable value and slow-moving stock provisions.', 'IAS 2 write-downs'],
  ['COR_S1','S','COR','Cloud hosting & infrastructure', 'N5:1', 'Production cloud, CDN and storage serving live merchant stores.', 'Shopify: cost of subscription solutions, driven by cloud and infrastructure'],
  ['COR_S2','S','COR','Payment processing & interchange', 'N6:1', 'Card-network, interchange and acquirer fees on payments revenue.', 'Shopify: cost of merchant solutions, driven by payment processing fees'],
  ['COR_S3','S','COR','Third-party software, data & partner payouts', 'N5:1', 'Licensed components embedded in the product; payouts to app partners.', 'SaaS COGS practice: third-party software embedded in the product'],
  ['COR_S4','S','COR','Customer support & merchant onboarding', 'N2:.85,N5:.15', 'Support, onboarding and DevOps teams serving existing customers.', 'SaaS COGS cost centres: support, DevOps, customer success'],
  ['COR_S5','S','COR','Professional services delivery', 'N2:.8,N3:.2', 'Consultants and contractors delivering implementations.', 'SaaS P&L: cost of professional services'],

  ['VSC_P1','P','VSC','Outbound freight & last-mile delivery', 'N3:1', 'DC-to-customer and parcel delivery. Kept below gross profit to expose cost-to-serve by channel.', 'P&G puts distribution in cost of products sold; Amazon puts outbound shipping in cost of sales'],
  ['VSC_P2','P','VSC','Warehousing & pick-pack (3PL)', 'N3:1', 'DC operations and outsourced fulfilment.', 'Amazon: fulfilment (warehousing, picking, packing)'],
  ['VSC_P3','P','VSC','Marketplace referral & fulfilment fees', 'N6:1', 'Commission and fulfilment fees charged by online marketplaces.', 'CPG contribution by channel: marketplace fees as a direct channel cost'],
  ['VSC_P4','P','VSC','E-commerce platform & payment fees (intercompany)', 'N6:1', 'Fees paid to ACME Commerce Cloud for the D2C webstore and payments. Eliminated on consolidation.', 'Amazon: payment processing costs in fulfilment'],
  ['VSC_P5','P','VSC','Sales commissions & broker fees', 'N6:1', 'Brokers and distributor agents.', '—'],
  ['VSC_S1','S','VSC','Sales commissions', 'N2:1', 'Variable pay for new and expansion contracts (expensed portion; capitalised contract costs amortise over the customer life).', 'SaaS P&L: commissions in sales & marketing'],
  ['VSC_S2','S','VSC','Partner & agency referral fees', 'N6:1', 'Revenue share paid to agencies and resellers that refer merchants.', 'BigCommerce partner ecosystem'],
  ['VSC_S3','S','VSC','Transaction & merchant credit losses', 'N6:1', 'Chargebacks, fraud and merchant cash-advance losses. Scales with payments volume.', 'Shopify: transaction and loan losses (an operating expense line there)'],
  ['ELIM_VSC','G','VSC','Intercompany eliminations', 'N6:1', 'Removes the matching platform and payment fees from Consumer Products costs.', 'Consolidation (IFRS 10)'],

  ['SM_P1','P','SM','Advertising: working media', 'N4:1', 'TV, digital, social and retail media spend.', 'Unilever: brand & marketing investment; P&G: advertising in SG&A'],
  ['SM_P2','P','SM','Consumer promotions, sampling & sponsorship', 'N4:1', 'Non-trade consumer activation.', 'P&G: consumer promotions and sampling in SG&A'],
  ['SM_P3','P','SM','Marketing overhead', 'N4:.6,N2:.4', 'Agencies, creative production, market research and brand teams.', 'Unilever: brand & marketing investment'],
  ['SM_P4','P','SM','Sales force & key-account management', 'N2:.85,N7:.15', 'Field sales, key-account and category management.', 'P&G: selling expenses in SG&A'],
  ['SM_S1','S','SM','Performance marketing & paid acquisition', 'N4:1', 'Search, social and affiliate spend to acquire merchants.', 'Shopify: sales and marketing'],
  ['SM_S2','S','SM','Brand, content & events', 'N4:.7,N2:.3', 'Brand campaigns, content and events.', 'Shopify: sales and marketing'],
  ['SM_S3','S','SM','Sales & account management staff', 'N2:1', 'Account executives, SDRs and account managers (base pay).', 'SaaS P&L: S&M % of revenue'],
  ['SM_S4','S','SM','Partner programme & ecosystem', 'N6:1', 'Partner enablement, certification and co-marketing funds.', 'BigCommerce partner programme'],

  ['RD_P1','P','RD','Product innovation & development', 'N2:.7,N7:.3', 'Formulation, design and packaging innovation.', 'P&G: R&D within SG&A'],
  ['RD_P2','P','RD','Quality, regulatory & safety testing', 'N3:.5,N2:.5', 'Product safety, certification and compliance testing.', '—'],
  ['RD_S1','S','RD','Engineering & product management', 'N2:.85,N5:.15', 'Platform engineering, product and design teams.', 'Shopify: research and development'],
  ['RD_S2','S','RD','Data, AI & security platform', 'N2:.6,N5:.4', 'Data, machine learning and platform security work.', 'Shopify: research and development'],
  ['RD_S3','S','RD','Capitalised development costs (credit)', 'N9:1', 'Development cost capitalised as an intangible asset (IAS 38). Shown as a credit; its amortisation appears under D&A.', 'IAS 38 development costs'],

  ['GA_1','B','GA','Finance, legal & HR', 'N2:.8,N3:.2', 'Corporate functions.', 'P&G: administrative costs in SG&A; Shopify: general and administrative'],
  ['GA_2','B','GA','IT & corporate systems', 'N5:.6,N2:.4', 'ERP, workplace IT and internal cybersecurity.', '—'],
  ['GA_3','B','GA','Facilities & insurance', 'N7:1', 'Offices and corporate insurance (lease depreciation sits under D&A).', '—'],
  ['GA_4','B','GA','Corporate centre allocation', 'N3:1', 'Share of group headquarters cost charged to the entity.', 'Amazon: segment allocation of shared costs'],

  ['OOI_1','B','OOI','Operating FX gains / (losses)', 'N8:1', 'FX on operating receivables and payables. IFRS 18 keeps FX in the category of the item that caused it.', 'IFRS 18 FX classification'],
  ['OOI_2','B','OOI','Gain / (loss) on disposal of assets', 'N8:1', 'Disposals of property, plant and equipment.', 'Amazon: other operating expense (income)'],
  ['OOI_3','B','OOI','Other operating income', 'N8:1', 'Scrap sales, grants, sublease income.', '—'],

  ['DA_P1','P','DA','Depreciation: plants, DCs & equipment', '', 'Depreciation of manufacturing and distribution assets.', 'P&G: depreciation embedded in cost of products sold'],
  ['DA_P2','P','DA','Depreciation: right-of-use assets', '', 'Leased warehouses, offices and vehicles (IFRS 16).', 'IFRS 16'],
  ['DA_P3','P','DA','Amortisation: acquired brands & customer relationships', '', 'Intangibles recognised on acquisitions.', '—'],
  ['DA_S1','S','DA','Amortisation: capitalised software', '', 'Release of capitalised development cost over its useful life.', 'IAS 38'],
  ['DA_S2','S','DA','Depreciation: servers, equipment & right-of-use assets', '', 'Owned hardware and leased offices.', 'IFRS 16'],
  ['DA_S3','S','DA','Amortisation: acquired intangibles', '', 'Technology and customer intangibles from acquisitions (step-up after the Jul 2025 deal).', '—'],

  ['ADJ_1','B','ADJ','Restructuring & reorganisation', '', 'Programme costs such as severance and site closures.', 'Unilever: non-underlying items'],
  ['ADJ_2','B','ADJ','Impairment of goodwill & intangibles', '', 'IAS 36 impairments.', 'P&G: goodwill and intangibles impairment shown as its own line'],
  ['ADJ_3','B','ADJ','M&A, integration & other one-offs', '', 'Deal fees, integration and other non-recurring items.', 'Shopify: non-GAAP adjustments'],

  ['INV_1','B','INV','Share of profit of associates & JVs', '', 'Equity-accounted results. IFRS 18 places these outside operating profit.', 'IFRS 18 investing category'],
  ['INV_2','B','INV','Income on cash & investments', '', 'Interest and dividends on cash, deposits and investments.', 'IFRS 18 investing category'],
  ['FIN_1','B','FIN','Interest on borrowings', '', 'Bonds, term loans and revolving credit.', 'P&G: interest expense'],
  ['FIN_2','B','FIN','Interest on lease liabilities', '', 'IFRS 16 lease interest.', 'IFRS 18 financing category'],
  ['FIN_3','B','FIN','FX & other finance costs on financing items', '', 'FX on borrowings, fees and unwinding of discounts.', 'IFRS 18 financing category'],
  ['TAX_1','B','TAX','Current tax', '', 'Tax payable on the period result.', 'P&G: income taxes'],
  ['TAX_2','B','TAX','Deferred tax', '', 'Movements in deferred tax assets and liabilities.', 'IAS 12'],
];

const LEAVES = LEAF_DEFS.map((d, i) => {
  const nat = d[4] ? d[4].split(',').map(p => { const [n, w] = p.split(':'); return {n, w:+w}; }) : [];
  return {i, id:d[0], ent:d[1], sec:d[2], label:d[3], nat, def:d[5], ref:d[6]};
});
const I = {}; LEAVES.forEach(L => { I[L.id] = L.i; });
const NL = LEAVES.length;
const X_UNITS = NL, X_GMV = NL + 1, X_MERCH = NL + 2, X_ARR = NL + 3, X_NRCC = NL + 4, X_PAYNR = NL + 5;
const NV = NL + 6;
const SEC_IDX = {}; Object.keys(SECS).forEach(s => { SEC_IDX[s] = LEAVES.filter(L => L.sec === s).map(L => L.i); });
const NAT_LEAVES = {}; NATURES.forEach(N => { NAT_LEAVES[N.id] = []; });
LEAVES.forEach(L => L.nat.forEach(x => NAT_LEAVES[x.n].push({i:L.i, id:L.id, w:x.w})));
function entLeaves(e) { return LEAVES.filter(L => L.ent === e || L.ent === 'B'); }
['P','S'].forEach(e => {
  ENT[e].leafIdx = entLeaves(e).map(L => L.i);
  ENT[e].preTax = entLeaves(e).filter(L => L.sec !== 'TAX').map(L => L.i);
  ENT[e].nrIdx = entLeaves(e).filter(L => L.sec === 'GR' || L.sec === 'GTN').map(L => L.i);
});

/* ---------- Generator parameters ---------- */
const DRW = [0, .5, 1];             // share of the full drift realised per year
const norm = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return a.map(v => v / m); };
// Consumer Products
const SEAS_P = [
  norm([1,.95,1,1,1,1,1,1,1,1,1,1.05]),
  norm([.95,.92,1,1,1.02,1.02,1,1,.98,1,1.03,1.16]),
  norm([.9,.88,.95,.95,1,.95,.95,.95,1,1.05,1.25,1.27]),
  norm([.85,.8,.85,.85,.85,.85,.9,1.05,1,1,1.45,1.55]),
  norm([.65,.6,.7,.7,.75,.75,.75,.8,.9,1.1,1.8,2.5]),
];
const P0 = [6.5, 8.2, 14, 22, 18], TM = [1.6, 1, .65];
const PI = [[1, 1.035, 1.06], [1, 1.03, 1.065]];
const TP = [.17, .13, 0, .06, .09], RB = [.05, .04, 0, .02, .06], CPN = [.015, .02, .09, .04, 0], PPD = [.015, .015, 0, 0, .02];
const RT = [.01, .015, .02, .05, .035];
const CR = [.49, .41, .53, .63, .55], TCR = [-.07, 0, .08];
const PROF_A = [.52, .12, .12, .12, .07, .02, .03], PROF_B = [.10, .62, .04, .05, .12, .04, .03];
const FRT = [.030, .032, .080, .015, .020], WHR = [.018, .020, .045, .010, .012], BRK = [.008, .008, 0, 0, .030];
const ADV = [.07, .11, .05, .04, .08], TADV = [1.3, 1, .5], SF = [.030, .030, .008, .012, .030];

(function initP() {
  const E = ENT.P;
  const wR = [.45,.27,.12,.16], wC = [.38,.17,.10,.17,.18], wL = [.26,.24,.20,.16,.14], wS = [.25,.50,.25];
  const gC = [0,-.01,.12,.09,-.02], gL = [0,.02,0,.03,-.01], gS = [.01,0,.015];
  const dC = [-.02,-.01,.05,.02,-.015], dL = [0,.02,0,-.03,-.07];
  E.combos = []; let k = 0;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) for (let l = 0; l < 5; l++) for (let s = 0; s < 3; s++) {
    const ccy = REGIONS[r].ccy;
    E.combos.push({k:k++, r, c, l, s, ccy, base:5.4e9 * wR[r] * wC[c] * wL[l] * wS[s] * FX_BUD[ccy][0], g:.028 + gC[c] + gL[l] + gS[s], d:dC[c] + dL[l], p0:P0[l] * TM[s] * FX_BUD[ccy][0]});
  }
})();

function genP(C, t, sc, b) {
  const y = (t / 12) | 0, m = t % 12, tr = t / 12 - .5, k = C.k, c = C.c, l = C.l, s = C.s, act = sc !== 1;
  let f;
  if (sc === 1) f = Math.pow(1 + C.g + .012, tr) * (1 + C.d * DRW[Math.max(0, y - 1)]);
  else { f = Math.pow(1 + C.g, tr) * (1 + C.d * DRW[y]); f *= sc === 0 ? (1 + .02 * h4(k, y, 11, 1) + .035 * h4(k, t, 3, 2)) : .995; }
  const gross = C.base * f * SEAS_P[l][m] / 12;
  const n0 = sc === 0 ? h4(k, t, 5, 3) : 0, n1 = sc === 0 ? h4(k, t, 6, 4) : 0;
  b[I.GR_P1] = gross;
  b[I.GR_P2] = c === 2 ? gross * .035 : 0;
  const tp = TP[c] + (act && y === 2 && c === 0 ? .01 : 0);
  b[I.GTN_P1] = -gross * tp * (1 + .03 * n0);
  b[I.GTN_P2] = -gross * RB[c];
  b[I.GTN_P3] = -gross * CPN[c];
  b[I.GTN_P4] = -gross * RT[l] * ((c === 2 || c === 3) ? 1.6 : 1) * (1 + .1 * n1);
  b[I.GTN_P5] = -gross * PPD[c];
  const nr = b[I.GR_P1] + b[I.GR_P2] + b[I.GTN_P1] + b[I.GTN_P2] + b[I.GTN_P3] + b[I.GTN_P4] + b[I.GTN_P5];
  const tariff = (l === 3 || l === 4) ? (y === 0 ? 0 : y === 1 ? (act ? .015 : .008) : (act ? .028 : .012)) : 0;
  const cogs = nr * (CR[l] + TCR[s] - .004 * y) * (1 + .015 * n1);
  const pr = l >= 3 ? PROF_B : PROF_A;
  b[I.COR_P1] = -cogs * pr[0]; b[I.COR_P2] = -cogs * pr[1]; b[I.COR_P3] = -cogs * pr[2]; b[I.COR_P4] = -cogs * pr[3];
  b[I.COR_P5] = -(cogs * pr[4] + nr * tariff); b[I.COR_P6] = -cogs * pr[5];
  b[I.COR_P7] = -(cogs * pr[6] + (act && y === 2 && l === 4 ? nr * .012 : 0));
  const fi = act ? [1, 1.03, 1.06][y] : 1 + .02 * y;
  b[I.VSC_P1] = -nr * FRT[c] * fi; b[I.VSC_P2] = -nr * WHR[c]; b[I.VSC_P3] = c === 3 ? -nr * .16 : 0;
  b[I.VSC_P4] = c === 2 ? -nr * .045 : 0; b[I.VSC_P5] = -nr * BRK[c];
  b[I.SM_P1] = -nr * ADV[l] * TADV[s] * (act && y === 2 ? .94 : 1); b[I.SM_P2] = -nr * .015; b[I.SM_P3] = -nr * .012; b[I.SM_P4] = -nr * SF[c];
  b[I.RD_P1] = -nr * (l === 3 ? .025 : .017); b[I.RD_P2] = -nr * .006;
  const gn = sc === 0 ? 1 + .04 * h4(k, t, 8, 5) : 1;
  b[I.GA_1] = -nr * .022 * gn; b[I.GA_2] = -nr * .012 * gn; b[I.GA_3] = -nr * .009; b[I.GA_4] = -nr * .010;
  b[I.OOI_1] = sc === 0 ? nr * .002 * h4(k, t, 9, 6) : 0; b[I.OOI_2] = sc === 0 ? nr * .0006 * h4(k, t, 10, 7) : 0; b[I.OOI_3] = nr * .002;
  b[I.DA_P1] = -nr * .022; b[I.DA_P2] = -nr * .008; b[I.DA_P3] = -nr * .006;
  let a1 = 0, a2 = 0, a3 = 0;
  if (sc === 0) { if (t >= 15 && t <= 17) a1 = .025; if (t === 25 || t === 26) a1 = .006; if (t === 23 && l === 4) a2 = .12; if (t >= 28 && t <= 30) a3 = .005; }
  else if (sc === 1) { if (t >= 15 && t <= 17) a1 = .015; if (t === 25 || t === 26) a1 = .003; if (t >= 28 && t <= 30) a3 = .002; }
  b[I.ADJ_1] = -nr * a1; b[I.ADJ_2] = -nr * a2; b[I.ADJ_3] = -nr * a3;
  b[I.INV_1] = nr * .0025; b[I.INV_2] = nr * (.0015 - .0002 * y);
  b[I.FIN_1] = -nr * .009; b[I.FIN_2] = -nr * .0025; b[I.FIN_3] = -nr * .0006 * (1 + (sc === 0 ? h4(k, t, 12, 8) : 0));
  let pbt = 0; for (const i of ENT.P.preTax) pbt += b[i];
  b[I.TAX_1] = -.20 * pbt; b[I.TAX_2] = -.04 * pbt;
  b[X_UNITS] = gross / (C.p0 * PI[sc === 1 ? 1 : 0][y]);
}

// Commerce Cloud
const SEAS_S = [
  norm([1,1,1,1,1,1,1,1,1,1,1,1]),
  norm([.85,.82,.92,.92,.95,.95,.95,.97,.95,1,1.3,1.42]),
  norm([.95,.92,.97,.97,.98,.98,.98,1,.98,1,1.1,1.17]),
  norm([1,1.05,1.1,1.05,1.05,1,.9,.8,1.05,1.1,1.05,.85]),
];
const ARPU = [85, 1100, 7500], TAKE = [.029, .026, .021], PIS = [1, 1.04, 1.07];
const GRS = ['GR_S1','GR_S2','GR_S3','GR_S4'];
(function initS() {
  const E = ENT.S;
  const wR = [.55,.22,.10,.13], wC = [.45,.35,.20], CS = [[.80,.17,.03],[.05,.40,.55],[.35,.45,.20]], wL = [.40,.44,.08,.08];
  const LC = [[1,1,1],[1,1,1],[1,1,1],[.2,1.5,1.3]];
  const gL = [.22,.30,.18,.08], gS = [0,.02,.05], gR = [0,.02,0,.04], dL = [-.02,.05,0,-.08];
  let tot = 0;
  for (let c = 0; c < 3; c++) for (let l = 0; l < 4; l++) for (let s = 0; s < 3; s++) tot += wC[c] * CS[c][s] * wL[l] * LC[l][c];
  E.combos = []; let k = 0;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) for (let l = 0; l < 4; l++) for (let s = 0; s < 3; s++) {
    const ccy = REGIONS[r].ccy;
    const w = wR[r] * wC[c] * CS[c][s] * wL[l] * LC[l][c] / tot;
    E.combos.push({k:k++, r, c, l, s, ccy, base:520e6 * w * FX_BUD[ccy][0], g:gL[l] + gS[s] + gR[r], d:dL[l]});
  }
})();

function genS(C, t, sc, b) {
  const y = (t / 12) | 0, m = t % 12, tr = t / 12 - .5, k = C.k, c = C.c, l = C.l, s = C.s, act = sc !== 1;
  let f;
  if (sc === 1) f = Math.pow(1 + C.g + .015, tr) * (1 + C.d * DRW[Math.max(0, y - 1)]);
  else { f = Math.pow(1 + C.g, tr) * (1 + C.d * DRW[y]); f *= sc === 0 ? (1 + .03 * h4(k, y, 21, 1) + [.015,.04,.05,.15][l] * h4(k, t, 22, 2)) : .995; }
  const gross = C.base * f * SEAS_S[l][m] / 12;
  const n = sc === 0 ? h4(k, t, 23, 3) : 0, n2 = sc === 0 ? h4(k, t, 24, 4) : 0;
  b[I[GRS[l]]] = gross;
  const d1 = l === 0 ? [.03,.06,.10][s] : l === 1 ? .004 : l === 2 ? .02 : .04;
  const d2 = l === 0 ? (c === 0 ? .035 : .004) : 0;
  const d3 = [.008,.012,.01,.015][l] * (1 + .2 * n);
  b[I.GTN_S1] = -gross * d1; b[I.GTN_S2] = -gross * d2; b[I.GTN_S3] = -gross * d3;
  const nr = gross * (1 - d1 - d2 - d3);
  const lev = Math.pow(.93, y);
  const host = l === 0 ? .095 * Math.pow(.97, y) : l === 1 ? .012 : l === 2 ? .05 : 0;
  b[I.COR_S1] = -nr * host * (1 + .03 * n2);
  b[I.COR_S2] = l === 1 ? -nr * (act && y === 2 ? .605 : .60) : 0;
  b[I.COR_S3] = -nr * [.03,.01,.22,.02][l];
  b[I.COR_S4] = -nr * (l === 0 ? [.085,.07,.06][s] : l === 1 ? .02 : l === 2 ? .03 : 0);
  b[I.COR_S5] = l === 3 ? -nr * .80 * (1 + .04 * n2) : 0;
  b[I.VSC_S1] = -nr * [.004,.07,.02][c] * [1,.2,.3,1][l];
  b[I.VSC_S2] = c === 2 ? -nr * [.12,.04,.08,.10][l] : 0;
  b[I.VSC_S3] = l === 1 ? -nr * (act && y === 2 ? .033 : .028) * (1 + .15 * n) : 0;
  b[I.SM_S1] = -nr * [.15,.03,.04][c] * lev; b[I.SM_S2] = -nr * .025 * lev; b[I.SM_S3] = -nr * [.012,.095,.045][c] * lev; b[I.SM_S4] = -nr * (c === 2 ? .03 : .006);
  b[I.RD_S1] = -nr * .16 * lev; b[I.RD_S2] = -nr * (y === 2 ? .055 : .045); b[I.RD_S3] = nr * .032 * lev;
  const gn = sc === 0 ? 1 + .05 * h4(k, t, 25, 5) : 1;
  b[I.GA_1] = -nr * .04 * lev * gn; b[I.GA_2] = -nr * .02; b[I.GA_3] = -nr * .012; b[I.GA_4] = -nr * .015;
  b[I.OOI_1] = sc === 0 ? nr * .002 * h4(k, t, 26, 6) : 0; b[I.OOI_2] = 0; b[I.OOI_3] = nr * .001;
  b[I.DA_S1] = -nr * .028; b[I.DA_S2] = -nr * .012; b[I.DA_S3] = -nr * (t >= 18 ? .012 : .004);
  let a1 = 0, a3 = 0;
  if (sc === 0) { if (t === 25 || t === 26) a1 = .012; if (t >= 17 && t <= 20) a3 = .015; }
  else if (sc === 1) { if (t >= 17 && t <= 20) a3 = .01; }
  b[I.ADJ_1] = -nr * a1; b[I.ADJ_2] = 0; b[I.ADJ_3] = -nr * a3;
  b[I.INV_1] = 0; b[I.INV_2] = nr * .007;
  b[I.FIN_1] = -nr * .002; b[I.FIN_2] = -nr * .004; b[I.FIN_3] = -nr * .0005 * (1 + (sc === 0 ? h4(k, t, 27, 7) : 0));
  let pbt = 0; for (const i of ENT.S.preTax) pbt += b[i];
  b[I.TAX_1] = -.17 * pbt; b[I.TAX_2] = -.05 * pbt;
  b[X_GMV] = l === 1 ? gross / TAKE[s] : 0;
  b[X_MERCH] = l === 0 ? gross / (ARPU[s] * FX_BUD[C.ccy][0] * PIS[y]) : 0;
  b[X_ARR] = l === 0 ? nr * 12 : 0;
  b[X_PAYNR] = l === 1 ? nr : 0;
}
const GEN = {P:genP, S:genS};

/* ---------- Query: aggregate a slice for one scenario ---------- */
// o = {ents:['P'] | ['S'] | ['P','S'], group:bool, months:[t], scen:'A'|'B'|'LE', fx:'ACT'|'CC', rep:0..2, fy, filt:{P:{r,c,l,s}, S:{...}}, wantMonths}
function query(o) {
  const fyi = o.fy - Y0, buf = new Float64Array(NV);
  const out = {ents:{}, combo:{}, months:{}, used:[], partial:false, tLast:-1, scen:o.scen};
  const ms = [];
  for (const t of o.months) {
    if (t < 0 || t >= NT) { out.partial = true; continue; }
    const sc = o.scen === 'B' ? 1 : (t <= T_LAST ? 0 : (o.scen === 'LE' ? 2 : -1));
    if (sc < 0) { out.partial = true; continue; }
    ms.push([t, sc]);
  }
  out.used = ms.map(x => x[0]);
  out.fcMonths = ms.filter(x => x[1] === 2).map(x => x[0]);
  out.tLast = ms.length ? Math.max(...out.used) : -1;
  let ic = 0, iccc = 0; const icm = {};
  for (const e of o.ents) {
    const E = ENT[e], F = o.filt[e], vec = new Float64Array(NV), cv = new Array(E.combos.length).fill(null);
    for (const [t, sc] of ms) {
      const y = (t / 12) | 0;
      let mv = null;
      if (o.wantMonths) { out.months[t] = out.months[t] || {}; mv = out.months[t][e] = new Float64Array(NV); }
      for (const C of E.combos) {
        if (!F.r[C.r] || !F.c[C.c] || !F.l[C.l] || !F.s[C.s]) continue;
        buf.fill(0);
        GEN[e](C, t, sc, buf);
        const ci = C.ccy;
        const fx = o.fx === 'CC' ? FX_BUD[o.rep][fyi] / FX_BUD[ci][fyi] : (sc === 1 ? FX_BUD[o.rep][y] / FX_BUD[ci][y] : FX_ACT[o.rep][t] / FX_ACT[ci][t]);
        const fcc = FX_BUD[o.rep][fyi] / FX_BUD[ci][fyi];
        let cvec = cv[C.k]; if (!cvec) cvec = cv[C.k] = new Float64Array(NV);
        for (const i of E.leafIdx) { const v = buf[i] * fx; cvec[i] += v; if (mv) mv[i] += v; }
        let nrl = 0; for (const i of E.nrIdx) nrl += buf[i];
        cvec[X_NRCC] += nrl * fcc; cvec[X_UNITS] += buf[X_UNITS]; cvec[X_GMV] += buf[X_GMV] * fx; cvec[X_PAYNR] += buf[X_PAYNR] * fx;
        if (mv) { mv[X_NRCC] += nrl * fcc; mv[X_UNITS] += buf[X_UNITS]; mv[X_GMV] += buf[X_GMV] * fx; mv[X_PAYNR] += buf[X_PAYNR] * fx; }
        if (t === out.tLast) { cvec[X_MERCH] += buf[X_MERCH]; cvec[X_ARR] += buf[X_ARR] * fx; }
        if (e === 'P') { const v = buf[I.VSC_P4]; ic += v * fx; iccc += v * fcc; icm[t] = (icm[t] || 0) + v * fx; }
      }
    }
    for (const cvec of cv) if (cvec) for (let i = 0; i < NV; i++) vec[i] += cvec[i];
    out.ents[e] = vec; out.combo[e] = cv;
  }
  if (o.group) {
    const g = new Float64Array(NV);
    g[I.ELIM_GR] = ic; g[I.ELIM_VSC] = -ic; g[X_NRCC] = iccc;
    out.ents.G = g;
    if (o.wantMonths) for (const t in out.months) { const gm = new Float64Array(NV); gm[I.ELIM_GR] = icm[t] || 0; gm[I.ELIM_VSC] = -(icm[t] || 0); out.months[t].G = gm; }
  }
  return out;
}

/* ---------- Node values for a set of entity vectors ---------- */
function computeNodes(ents) {
  const v = {}, es = Object.keys(ents);
  for (const L of LEAVES) {
    let s = 0;
    for (const e of es) { const x = ents[e][L.i]; if (x) { v[L.id + '|' + e] = x; s += x; } }
    v[L.id] = s;
  }
  for (const sec in SECS) {
    let s = 0;
    for (const e of es) { let se = 0; for (const i of SEC_IDX[sec]) se += ents[e][i]; v[sec + '|' + e] = se; s += se; }
    v[sec] = s;
  }
  v.OPEX = v.SM + v.RD + v.GA + v.OOI;
  let natx = 0;
  for (const N of NATURES) {
    let s = 0;
    for (const e of es) for (const x of NAT_LEAVES[N.id]) { const a = ents[e][x.i] * x.w; if (a) { v[N.id + '|' + x.id + '|' + e] = a; s += a; } }
    v[N.id] = s; natx += s;
  }
  v.NATX = natx;
  v.NR = v.GR + v.GTN; v.GP = v.NR + v.COR; v.CM = v.GP + v.VSC; v.EBITDA = v.CM + v.OPEX;
  v.UOP = v.EBITDA + v.DA; v.OP = v.UOP + v.ADJ; v.PBFIT = v.OP + v.INV; v.PBT = v.PBFIT + v.FIN; v.NP = v.PBT + v.TAX;
  const r = (a, b) => (b && Math.abs(b) > 1e-9 ? a / b : null);
  v.GM = r(v.GP, v.NR); v.CMP = r(v.CM, v.NR); v.EBITDAP = r(v.EBITDA, v.NR); v.OPP = r(v.OP, v.NR); v.NPP = r(v.NP, v.NR);
  v.ETR = r(-v.TAX, v.PBT);
  v.X = {units:0, gmv:0, merch:0, arr:0, nrcc:0, paynr:0};
  for (const e of es) { const a = ents[e]; v.X.units += a[X_UNITS]; v.X.gmv += a[X_GMV]; v.X.merch += a[X_MERCH]; v.X.arr += a[X_ARR]; v.X.nrcc += a[X_NRCC]; v.X.paynr += a[X_PAYNR]; }
  return v;
}

if (typeof module !== 'undefined') module.exports = {MONTHS, Y0, NT, T_LAST, REGIONS, ENT, SECS, LEAVES, NATURES, I, NL, NV, X_UNITS, X_GMV, X_MERCH, X_NRCC, CCYS, FX_BUD, FX_ACT, GEN, query, computeNodes};
