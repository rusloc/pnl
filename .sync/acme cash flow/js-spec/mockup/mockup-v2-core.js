/* ACME Cash Flow mock v2 · data model (no DOM). Reads window.CF_DATA from mockup-v2-data.js.
   Sign rule: cash in +, cash out −. Statement = indirect view with the S01 override on (line of credit in financing). */
'use strict';
(function () {
  const D = window.CF_DATA;
  const MONTHS = D.meta.months;            // '2024-01' … '2026-10'
  const N = MONTHS.length;
  const DAY0 = Date.UTC(2024, 0, 1);
  const DAY = 86400000;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const SECS = [['OP', 'Operating'], ['INV', 'Investing'], ['FIN', 'Financing']];

  // month i → first day offset; day offset → month i
  const mStart = MONTHS.map((k) => (Date.UTC(+k.slice(0, 4), +k.slice(5) - 1, 1) - DAY0) / DAY);
  const mEnd = mStart.map((s, i) => (i + 1 < N ? mStart[i + 1] : (Date.UTC(2026, 10, 1) - DAY0) / DAY) - 1);
  const dayMonth = new Int16Array(mEnd[N - 1] + 1);
  mStart.forEach((s, i) => dayMonth.fill(i, s, mEnd[i] + 1));

  const LINES = D.lines.map(([code, sec, label, dir], i) => ({ i, code, sec, label, dir }));
  const LINE = Object.fromEntries(LINES.map((l) => [l.code, l]));
  // ledger rows decoded once: {d, m, line, cp, txn, type, doc, c (cents), cl, memo}
  const LEDGER = D.ledger.map((r) => ({
    d: r[0], m: dayMonth[r[0]], line: r[1], cp: r[2], txn: r[3], type: D.types[r[4]], doc: r[5], c: r[6], cl: r[7], memo: D.memos[r[8]],
  }));

  const sum = (arr, a, b) => { let s = 0; for (let i = a; i <= b; i++) s += arr[i]; return s; };
  const r2 = (x) => Math.round(x * 100) / 100;

  /* ---------- periods ---------- */
  const idx = (y, m) => (y - 2024) * 12 + (m - 1);           // m 1-12
  const ym = (i) => [2024 + Math.floor(i / 12), (i % 12) + 1];
  function period(mode, y, m) {
    const e = idx(y, m);
    let a = e, b = e, label, key = null;
    if (mode === 'Q') { const q = Math.ceil(m / 3); a = idx(y, q * 3 - 2); b = Math.min(idx(y, q * 3), N - 1); label = `Q${q} ${y}`; }
    else if (mode === 'Y') { a = idx(y, 1); label = `YTD ${MON[m - 1]} ${y}`; if (m === 12 || e === N - 1) key = `Y-${y}`; }
    else if (mode === 'A') { a = idx(y, 1); b = Math.min(idx(y, 12), N - 1); label = String(y); key = `Y-${y}`; } // calendar year (the data's last year runs to its last month)
    else { label = `${MON[m - 1]} ${y}`; key = `M-${MONTHS[e]}`; }
    const len = b - a + 1;
    // prior = like-length window just before (Month, Quarter) or same months a year earlier (YTD, Year)
    let pa = mode === 'Y' || mode === 'A' ? a - 12 : mode === 'Q' ? a - 3 : a - 1;
    const prior = pa >= 0 ? { a: pa, b: pa + len - 1 } : null;
    const priorLabel = !prior ? '' : mode === 'M' ? `${MON[ym(pa)[1] - 1]} ${ym(pa)[0]}` : mode === 'Q' ? `Q${Math.ceil(ym(pa)[1] / 3)} ${ym(pa)[0]}`
      : mode === 'A' ? (len === 12 ? String(y - 1) : `Jan–${MON[len - 1]} ${y - 1}`) : `YTD ${ym(pa)[0]}`;
    return { mode, y, m, a, b, label, key, prior, priorLabel, d0: mStart[a], d1: mEnd[b], days: mEnd[b] - mStart[a] + 1, partial: (mode === 'Q' && b - a < 2) || (mode === 'A' && b - a < 11) };
  }

  /* ---------- statement (indirect, overrides on) ---------- */
  const ACC = D.stmt.acc.map(([id, label, grp, ovr]) => ({ id, label, grp, ovr: !!ovr, v: D.stmt.adj[id] }));
  function statement(a, b) {
    const val = (acc) => r2(sum(acc.v, a, b));
    const ni = r2(sum(D.kpi.ni, a, b));
    const pick = (g) => ACC.filter((x) => x.grp === g).map((x) => ({ ...x, val: val(x) })).filter((x) => Math.abs(x.val) >= 0.005);
    const dep = pick('DEP'), wc = pick('OP'), inv = pick('INV'), fin = pick('FIN');
    const tot = (rs) => r2(rs.reduce((s, x) => s + x.val, 0));
    const adj = r2(tot(dep) + tot(wc));
    const op = r2(ni + adj), iv = tot(inv), fn = tot(fin);
    const open = D.cash.open[a], close = D.cash.close[b];
    return { open, close, net: r2(close - open), ni, dep, wc, adj, op, inv, iv, fin, fn };
  }

  /* ---------- direct lines from the ledger rows ---------- */
  function lineTotals(a, b) {
    const t = LINES.map(() => ({ in: 0, out: 0, n: 0 }));
    for (const r of LEDGER) { if (r.m < a || r.m > b) continue; const x = t[r.line]; if (r.c > 0) x.in += r.c; else x.out += r.c; x.n++; }
    return t.map((x) => ({ in: x.in / 100, out: x.out / 100, net: (x.in + x.out) / 100, n: x.n }));
  }
  function sectionFlows(a, b) {
    const lt = lineTotals(a, b);
    const s = Object.fromEntries(SECS.map(([k]) => [k, { in: 0, out: 0, net: 0 }]));
    LINES.forEach((l, i) => { const x = s[l.sec]; x.in = r2(x.in + lt[i].in); x.out = r2(x.out + lt[i].out); x.net = r2(x.net + lt[i].net); });
    return s;
  }
  // heatmap grid for one section: rows = its direct lines, cols = days d0..d1; cell = {in, out, n} in cents
  function heat(sec, p) {
    const rows = LINES.filter((l) => l.sec === sec);
    const pos = Object.fromEntries(rows.map((l, j) => [l.i, j]));
    const W = p.days;
    const grid = rows.map(() => ({ inC: new Float64Array(W), outC: new Float64Array(W), n: new Int32Array(W) }));
    for (const r of LEDGER) {
      if (r.d < p.d0 || r.d > p.d1 || !(r.line in pos)) continue;
      const g = grid[pos[r.line]], k = r.d - p.d0;
      if (r.c > 0) g.inC[k] += r.c; else g.outC[k] += r.c;
      g.n[k]++;
    }
    return { rows, grid };
  }
  function ledgerRows(f) { // f: {sec, line (index|null), d0, d1}
    return LEDGER.filter((r) => r.d >= f.d0 && r.d <= f.d1 && (f.line != null ? r.line === f.line : LINES[r.line].sec === f.sec));
  }

  /* ---------- KPIs and diagram metrics ---------- */
  const K = D.kpi;
  function metrics(p) {
    if (!p) return null;
    const { a, b } = p;
    const days = mEnd[b] - mStart[a] + 1;
    const st = statement(a, b), lt = lineTotals(a, b);
    const L = (code) => lt[LINE[code].i].net;
    const rev = r2(sum(K.rev, a, b)), ni = st.ni, cfo = st.op;
    const capex = -L('D_INV_PURCHASE'), proceeds = L('D_INV_PROCEEDS');
    const fcf = r2(cfo - capex + proceeds);
    const spend = sum(K.spend, a, b);
    const intPaid = -L('D_PAY_INT'), termPrin = sum(K.termPrin, a, b), draws = -L('D_FIN_DRAWS');
    const ebitda = ni + sum(K.int, a, b) + sum(K.dep, a, b);
    const ebitdaAnn = ebitda * 12 / (b - a + 1);
    const netDebt = K.debt[b] - st.close;
    const dso = rev > 0 ? K.ar[b] / rev * days : null;
    const dpo = spend > 0 ? K.ap[b] / spend * days : null;
    const ratio = (x, y) => (y > 0.005 ? x / y : null);
    return {
      close: st.close, net: st.net, cfo, inv: st.iv, fin: st.fn, fcf, rev, ni,
      conv: Math.abs(ni) > 0.005 ? cfo / ni : null, convOk: ni > 0.005,
      margin: rev > 0 ? cfo / rev : null, accruals: r2(ni - cfo),
      dso, dpo, ccc: dso != null && dpo != null ? dso - dpo : null,
      capex, capexInt: rev > 0 ? capex / rev : null, capexCov: ratio(cfo, capex),
      dscr: ratio(cfo, intPaid + termPrin), debtService: intPaid + termPrin,
      ndEbitda: ebitdaAnn > 0.005 ? netDebt / ebitdaAnn : null, netDebt, ebitda,
      payout: ratio(cfo, draws), draws, days,
    };
  }

  /* ---------- formatting ---------- */
  let UNIT = 'USD';
  const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function money(v, opt = {}) { // negatives in parentheses, zero = en dash
    if (v == null || Number.isNaN(v)) return '–';
    const k = UNIT === 'USDk' && !opt.exact;
    const x = k ? v / 1000 : v;
    const s = opt.exact ? nf2.format(Math.abs(x)) : k ? nf1.format(Math.abs(x)) : nf0.format(Math.abs(x));
    if (s === '0' || s === '0.0' || s === '0.00') return '–';
    const t = s + (k && opt.suffix ? 'k' : '');
    return v < 0 ? `(${t})` : t;
  }
  const fmtDay = (d) => { const t = new Date(DAY0 + d * DAY); return `${t.getUTCDate()} ${MON[t.getUTCMonth()]}`; };
  const fmtDayLong = (d) => { const t = new Date(DAY0 + d * DAY); return `${WD[t.getUTCDay()]} ${t.getUTCDate()} ${MON[t.getUTCMonth()]} ${t.getUTCFullYear()}`; };
  const dayOf = (d) => new Date(DAY0 + d * DAY);

  /* ---------- self-check against control totals: every month and year in CF_DATA.ctl ---------- */
  const keyPeriod = (key) => (key[0] === 'M' ? period('M', +key.slice(2, 6), +key.slice(7)) : period('Y', +key.slice(2), key === 'Y-2026' ? 10 : 12));
  function selfCheck(only) {
    const out = [];
    const cases = Object.keys(D.ctl).filter((k) => !only || k === only).map((k) => [k, keyPeriod(k)]);
    for (const [key, p] of cases) {
      const C = D.ctl[key];
      const st = statement(p.a, p.b);
      const mt = metrics(p);
      const hm = SECS.flatMap(([s]) => { const h = heat(s, p); return h.rows.map((l, j) => [l.code, h.grid[j]]); });
      const add = (metric, page, ctl, tol = 0.005) => out.push({ period: key, metric, page: r2(page * 1e6) / 1e6, control: ctl, ok: Math.abs(page - ctl) <= tol });
      add('M01 opening (statement)', st.open, C['M01|ALL']);
      add('M02 closing (statement)', st.close, C['M02|ALL']);
      add('M03 net change (statement)', st.net, C['M03|ALL']);
      add('M06 operating (statement)', st.op, C['M06|OVERRIDES_ON']);
      add('M07 investing (statement)', st.iv, C['M07|OVERRIDES_ON']);
      add('M08 financing (statement)', st.fn, C['M08|OVERRIDES_ON']);
      add('M03 = sections', st.op + st.iv + st.fn, C['M03|ALL']);
      const fl = sectionFlows(p.a, p.b), cin = fl.OP.in + fl.INV.in + fl.FIN.in, cout = fl.OP.out + fl.INV.out + fl.FIN.out;
      add('M09 cash in (cash balance card)', cin, C['M09|ALL']);
      add('M10 cash out (cash balance card)', cout, C['M10|ALL']);
      add('M02 = opening + in + out (cash balance card)', st.open + cin + cout, C['M02|ALL']);
      add('M15 free cash flow (KPI)', mt.fcf, C['M15|ALL']);
      add('M16 cash conversion (KPI)', mt.conv, C['M16|ALL'], 1e-6 * Math.max(1, Math.abs(C['M16|ALL'])));
      for (const [code, g] of hm) {
        let cs = 0; for (let k = 0; k < p.days; k++) cs += g.inC[k] + g.outC[k];
        const ctl = C[`DIRECT_LINE|${code}`] || 0;
        add(`DIRECT_LINE ${code} (heatmap row)`, cs / 100, ctl);
        const lr = ledgerRows({ line: LINE[code].i, d0: p.d0, d1: p.d1 });
        add(`DIRECT_LINE ${code} (ledger)`, lr.reduce((s, r) => s + r.c, 0) / 100, ctl);
      }
    }
    if (!only) {
      for (const [key, p] of [['Q3-2026', period('Q', 2026, 9)], ['YTD-2026-10', period('Y', 2026, 10)]]) {
        const expDays = (Date.UTC(ym(p.b)[0], ym(p.b)[1], 1) - Date.UTC(ym(p.a)[0], ym(p.a)[1] - 1, 1)) / DAY;
        const lt = lineTotals(p.a, p.b);
        for (const [s] of SECS) {
          const h = heat(s, p);
          out.push({ period: key, metric: `heat columns = calendar days (${s})`, page: h.grid[0].inC.length, control: expDays, ok: h.grid[0].inC.length === expDays && p.days === expDays });
          h.rows.forEach((l, j) => {
            let cs = 0; for (let k = 0; k < p.days; k++) cs += h.grid[j].inC[k] + h.grid[j].outC[k];
            out.push({ period: key, metric: `heat row sum = row total ${l.code}`, page: cs / 100, control: lt[l.i].net, ok: Math.abs(cs / 100 - lt[l.i].net) <= 0.005 });
          });
        }
      }
    }
    return { pass: out.every((r) => r.ok), rows: out };
  }

  window.CF = {
    D, MONTHS, N, MON, SECS, LINES, LINE, LEDGER, mStart, mEnd, idx, ym, period, statement, lineTotals, sectionFlows, heat, ledgerRows, metrics,
    money, fmtDay, fmtDayLong, dayOf, selfCheck, nf1, nf0, r2,
    setUnit(u) { UNIT = u; }, get unit() { return UNIT; },
  };
})();
