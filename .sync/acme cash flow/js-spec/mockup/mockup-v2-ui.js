/* ACME Cash Flow mock v2 · UI: shell + fixed path, KPI cards, expandable statement, heatmap (Activities), ledger (Transactions), navigation.
   Pop-ups (incl. the Diagram and Reconciliation management pop-ups) live in mockup-v2-pops.js (loaded after this file). */
'use strict';
(function () {
  const C = window.CF;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SEC_NAME = Object.fromEntries(C.SECS);

  // view stack: each entry {view:'stmt'|'heat'|'ledger', sec, line (index|null), day (abs day|null)}
  // mode: 'M' month · 'Q' quarter · 'A' calendar year · 'Y' YTD; quick: 'YTD' | 'QTD' | 'MTD' when a calendar quick button set the period
  const S = { mode: 'M', y: 2026, m: 10, quick: null, unit: 'USD', lastSec: 'OP', hsort: null, exp: new Set(['OP', 'INV', 'FIN']), stack: [{ view: 'stmt' }], hc: null, open: new Set() };
  const top = () => S.stack[S.stack.length - 1];
  const P = () => C.period(S.mode, S.y, S.m);

  /* ---------- shell ---------- */
  function renderShell() {
    const p = P();
    const modeName = S.quick || { M: 'Month', Q: 'Quarter', Y: 'YTD', A: 'Year' }[S.mode];
    $('#pm').innerHTML = S.mode === 'A'
      ? `<i>${modeName}</i><b>${S.y}</b><span>${C.MON[C.ym(p.a)[1] - 1]}–${C.MON[C.ym(p.b)[1] - 1]}</span>`
      : `<i>${modeName}</i><b>${S.mode === 'Q' ? 'Q' + Math.ceil(S.m / 3) : C.MON[S.m - 1]}</b><span>${S.y}</span>`;
    $('#btnCal').setAttribute('aria-label', `Period ${p.label}${p.partial ? ' to date' : ''}; open calendar and settings`);
    const d0 = C.dayOf(p.d0), d1 = C.dayOf(p.d1);
    $('#ctx').textContent = `${C.D.meta.company} · ${d0.getUTCDate()} ${C.MON[d0.getUTCMonth()]} – ${d1.getUTCDate()} ${C.MON[d1.getUTCMonth()]} ${d1.getUTCFullYear()} · ${S.unit === 'USDk' ? 'USD thousands' : 'USD'} · as of 5 Nov 2026`;
    renderCrumbs();
  }
  // fixed three-step path at every level; current step bold + underline; forward steps open with defaults
  const STEPS = [['stmt', 'Statement'], ['heat', 'Activities'], ['ledger', 'Transactions']];
  function renderCrumbs() {
    const v = top().view, cur = STEPS.findIndex(([k]) => k === v);
    $('#crumbs').innerHTML = STEPS.map(([k, label], i) => (i === cur
      ? `<span class="cur" aria-current="page" data-t="${label}">${label}</span>`
      : `<button type="button" data-step="${i}" data-t="${label}">${label}</button>`)).join('<span class="gt" aria-hidden="true">›</span>');
  }
  function goStep(i) {
    const hi = S.stack.findIndex((e) => e.view === 'heat');
    const sec = (S.stack[hi] || {}).sec || S.lastSec;
    if (i === 0) return go({ view: 'stmt' });
    S.stack = hi >= 0 ? S.stack.slice(0, hi + 1) : [{ view: 'stmt' }, { view: 'heat', sec }];
    if (i === 2) S.stack.push({ view: 'ledger', sec, line: null, day: null });
    S.hc = null; render(); $('#layer').scrollTop = 0;
  }

  /* ---------- KPI cards ---------- */
  const fx = (v, d = 2) => (v == null ? 'n/m' : (v < 0 ? '−' : '') + Math.abs(v).toFixed(d) + '×');
  const days = (v) => (v == null ? 'n/m' : C.nf1.format(v));
  const KPIS = [
    { id: 'close', t: 'Closing cash', v: (m) => m.close, f: 'money' },
    { id: 'net', t: 'Net change', v: (m) => m.net, f: 'money' },
    { id: 'cfo', t: 'Operating cash flow', v: (m) => m.cfo, f: 'money' },
    { id: 'fcf', t: 'Free cash flow', v: (m) => m.fcf, f: 'money' },
    { id: 'conv', t: 'Cash conversion', v: (m) => (m.convOk ? m.conv : null), f: 'x' },
    { id: 'dso', t: 'DSO · days', v: (m) => m.dso, f: 'days' },
  ];
  function kpiFmt(k, v, delta) {
    if (k.f === 'money') return C.money(v, { suffix: true });
    if (k.f === 'x') return fx(v);
    return days(v);
  }
  const KB_BARS = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 10V6M6 10V2M10 10V5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const KB_GO = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6h7M6.5 3l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CHEV = '<svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function renderKpis() {
    const p = P(), cur = C.metrics(p), pr = C.metrics(p.prior && { ...p, a: p.prior.a, b: p.prior.b });
    $('#kpis').innerHTML = KPIS.map((k) => {
      const v = k.v(cur), pv = pr ? k.v(pr) : null;
      let dl = '<span>no prior period</span>';
      if (pr && v != null && pv != null) {
        const d = v - pv;
        const arrow = Math.abs(d) < 0.005 ? '' : d > 0 ? '▲ ' : '▼ ';
        const dv = k.f === 'money' ? C.money(Math.abs(d), { suffix: true }) : k.f === 'x' ? Math.abs(d).toFixed(2) + '×' : C.nf1.format(Math.abs(d));
        dl = `<b>${arrow}${dv}</b><span>vs ${esc(p.priorLabel)}</span>`;
      } else if (pr) dl = `<span>vs ${esc(p.priorLabel)}: n/m</span>`;
      const cash = k.id === 'close' ? `<button class="kb kb-k" type="button" data-cashpop aria-haspopup="dialog" aria-label="Cash balance and activities: opening, in, out, closing">${KB_BARS}</button>` : '';
      return `<div class="kpi"><span class="t">${k.t}</span><span class="v">${kpiFmt(k, v)}</span><span class="dl">${dl}</span>
        ${cash}<button class="i" type="button" data-info="${k.id}" aria-label="About ${k.t}">i</button></div>`;
    }).join('');
  }

  /* ---------- statement (layer 1) ---------- */
  function niceMax(v) { if (v <= 0) return 1; const e = 10 ** Math.floor(Math.log10(v)); for (const f of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (f * e >= v) return f * e; return 10 * e; }
  function stmtRows(st) {
    const R = [];
    const row = (k, label, val, o = {}) => R.push({ k, label, val, ...o });
    const section = (sec, label, total, kids) => {
      const open = S.exp.has(sec);
      row('secx', label, open ? null : total, { sec, open, cls: 'k-secx' });
      if (!open) return;
      kids();
      row('sect', `Net cash from ${label.toLowerCase()}`, total, { cls: 'k-sect' });
    };
    row('bal', 'Cash at beginning of period', st.open, { cls: 'k-bal k-open' });
    row('gap', '', null);
    section('OP', 'Operating activities', st.op, () => {
      row('data', 'Net income', st.ni, { d: 1 });
      row('sub', 'Adjustments to reconcile net income', null, { d: 1 });
      st.dep.forEach((x) => row('data', x.label, x.val, { d: 2 }));
      if (st.wc.length) row('sub', 'Changes in operating assets and liabilities', null, { d: 2 });
      st.wc.forEach((x) => row('data', x.label, x.val, { d: 3 }));
      row('tot', 'Total adjustments', st.adj, { d: 1, cls: 'k-tot' });
    });
    section('INV', 'Investing activities', st.iv, () => st.inv.forEach((x) => row('data', x.label, x.val, { d: 1 })));
    section('FIN', 'Financing activities', st.fn, () => st.fin.forEach((x) => row('data', x.label, x.val, { d: 1, ovr: x.ovr })));
    row('gap', '', null);
    row('grand', 'Net increase (decrease) in cash', st.net, { cls: 'k-grand' });
    row('bal', 'Cash at end of period', st.close, { cls: 'k-bal k-end' });
    return R;
  }
  const BRK = '<svg class="brk" viewBox="0 0 14 24" aria-hidden="true"><path d="M3 0 L9 6 L3 12 L9 18 L3 24" fill="none" stroke="var(--surf)" stroke-width="4"/></svg>';
  function barCell(r, max) {
    if (r.val == null || r.k === 'sub' || r.k === 'sec') return '';
    const a = Math.abs(r.val);
    if (a < 0.005) return '<div class="bw"></div>';
    if (r.k === 'bal') {
      const clip = a > max;
      const w = Math.min(a / max, 1) * 100;
      return `<div class="bw"><div class="bar bal${clip ? ' clip' : ''}" style="width:${w}%"></div>${clip ? `<span style="position:absolute;left:calc(100% - 44px);top:0;bottom:0;display:flex;align-items:center">${BRK}</span>` : ''}</div>`;
    }
    const heavy = ['tot', 'sect', 'grand', 'secx'].includes(r.k) ? ' heavy' : '';
    return `<div class="bw"><div class="bar${heavy}" style="width:${(a / max) * 100}%"></div></div>`;
  }
  // % of net income: sign kept (parentheses like the amounts), 0 dp, 1 dp under 10 %; n/m on every row when NI ≤ 0
  function pctNI(r, ni) {
    if (r.val == null || r.k === 'bal' || r.k === 'sub') return '';
    if (!(ni > 0.005)) return 'n/m';
    const x = (r.val / ni) * 100, ax = Math.abs(x);
    const t = (ax < 10 ? C.nf1.format(ax) : C.nf0.format(ax)) + '%';
    return x < 0 && t !== '0.0%' ? `(${t})` : t;
  }
  function renderStatement() {
    const p = P(), st = C.statement(p.a, p.b), rows = stmtRows(st);
    const flowMax = Math.max(...rows.filter((r) => r.k !== 'bal' && r.val != null).map((r) => Math.abs(r.val)), 1);
    const max = niceMax(flowMax);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => `<span style="left:${f * 100}%">${C.money(f * max, { suffix: true }) === '–' ? '0' : C.money(f * max, { suffix: true })}</span>`).join('');
    const grid = [0.25, 0.5, 0.75, 1].map((f) => `<i class="grid" style="left:${f * 100}%"></i>`).join('');
    const body = rows.map((r) => {
      if (r.k === 'gap') return '<tr class="k-gap"><td colspan="5"></td></tr>';
      const tr = r.k === 'secx' ? ` class="tog ${r.cls}" data-tog="${r.sec}" tabindex="0" aria-expanded="${r.open}" aria-label="${esc(r.label)}: ${r.open ? 'collapse' : 'expand'} its lines"` : ` class="${r.cls || ''} k-${r.k}"`;
      const lbl = r.k === 'secx'
        ? `<div class="lw">${CHEV}<span class="lb">${esc(r.label)}</span><button class="kb" type="button" data-heat="${r.sec}" aria-label="Open ${esc(r.label)} (Activities)">${KB_GO}</button></div>`
        : `<div class="lw"><span class="lb">${esc(r.label)}</span>${r.ovr ? '<span class="ovr" data-tipov title="">S01</span>' : ''}</div>`;
      return `<tr${tr}><td class="l" style="--d:${r.d || 0}">${lbl}</td><td class="v">${r.val == null ? '' : C.money(r.val)}</td><td></td><td class="b">${r.k === 'sub' || r.val == null ? '' : `<div style="position:relative;margin-right:16px;height:100%">${grid}${barCell(r, max)}</div>`}</td><td class="p">${pctNI(r, st.ni)}</td></tr>`;
    }).join('');
    $('#layer').innerHTML = `<div class="card"><div class="ch"><h2>Statement of cash flows</h2><span class="sp"></span>
        <span class="lg"><span><i class="amt"></i>Line amount, absolute</span><span><i class="bal"></i>Balance</span></span>
        <button class="i" type="button" data-info="stmt" aria-label="About the statement">i</button></div>
      <table class="st" id="stmt"><colgroup><col class="c-l"><col class="c-v"><col class="c-g"><col><col class="c-p"></colgroup>
        <thead><tr><th class="l">${esc(p.label)}${p.partial ? ' · to date' : ''}</th><th>${S.unit === 'USDk' ? 'USD k' : 'USD'}</th><th></th><th class="ax"><div class="ax-w" style="margin-right:16px">${ticks}</div></th><th class="p">% of NI<button class="i" type="button" data-info="pct" aria-label="About % of net income">i</button></th></tr></thead>
        <tbody>${body}</tbody></table></div>`;
    // pin the opening row directly under the sticky column header
    const tb = $('#stmt'); tb.style.setProperty('--theadH', tb.tHead.getBoundingClientRect().height + 'px');
  }

  /* ---------- heatmap (layer 2: Activities) — square cells; long periods scroll sideways, labels and totals stay put ---------- */
  const CS_MIN = 16, CS_MAX = 40, TOT_H = 36;
  // quintile blocks: block = ceil((rank of the last equal value + 1) × 5 / n), so each block holds ~20 % of the items and ties go up
  const compact = (v) => (v < 1000 ? C.nf0.format(v) : (v < 100000 ? C.nf1.format(v / 1000) : C.nf0.format(v / 1000)) + 'k');
  function quint(vals) {
    const a = vals.slice().sort((x, y) => x - y), n = a.length, last = new Map();
    a.forEach((v, i) => last.set(v, i));
    const blk = (v) => (n && last.has(v) ? Math.min(5, Math.max(1, Math.ceil(((last.get(v) + 1) * 5) / n))) : 0);
    const maxes = [0, 0, 0, 0, 0], mins = [0, 0, 0, 0, 0];
    a.forEach((v) => { const b = blk(v); maxes[b - 1] = Math.max(maxes[b - 1], v); if (!mins[b - 1]) mins[b - 1] = v; });
    return { blk, maxes, mins };
  }
  let TH = 26; // axis height: 26 single tier (month), 44 month band + every date (longer periods)
  function renderHeat() {
    const t = top(), p = P(), h0 = C.heat(t.sec, p), lt = C.lineTotals(p.a, p.b);
    // row order: direct-line order by default; S.hsort = {key:'name'|'amt', dir} reorders whole rows (labels, cells, totals)
    const ord = h0.rows.map((_, j) => j), hs = S.hsort;
    if (hs) ord.sort((x, y) => (hs.key === 'name'
      ? h0.rows[x].label.localeCompare(h0.rows[y].label) * hs.dir
      : (Math.abs(lt[h0.rows[x].i].net) - Math.abs(lt[h0.rows[y].i].net)) * hs.dir || x - y));
    const h = { rows: ord.map((j) => h0.rows[j]), grid: ord.map((j) => h0.grid[j]) };
    // 5 blocks by quintile of the non-zero day cells (equal counts); ties resolve upward (rank of the last equal value)
    const vals = [];
    h.grid.forEach((g) => { for (let k = 0; k < p.days; k++) { const v = g.inC[k] - g.outC[k]; if (v > 0) vals.push(v); } });
    const QC = quint(vals), step = QC.blk;
    const legend = QC.maxes.map((m, i) => `<i class="q${i + 1}" title="${m ? `Block ${i + 1} (${i * 20}–${(i + 1) * 20} %): ${compact(QC.mins[i] / 100)} – ${compact(m / 100)}` : `Block ${i + 1}: no days`}"></i>`).join('');
    const secNet = h.rows.reduce((s, l) => s + lt[l.i].net, 0);
    $('#layer').innerHTML = `<div class="card hm-card"><div class="ftabs" role="tablist" aria-label="Activity">${C.SECS.map(([k, n]) => `<button class="ftab" type="button" role="tab" id="tab-${k}" data-sec="${k}" data-t="${n}" aria-selected="${k === t.sec}" aria-controls="hm" tabindex="${k === t.sec ? 0 : -1}">${n}</button>`).join('')}</div>
      <div class="hm-box"><div class="ch"><h2>${SEC_NAME[t.sec]} activities</h2><span style="color:var(--muted);font-size:13px">${esc(p.label)}${p.partial ? ' to date' : ''}</span>
        <span class="sp"></span></div>
      <div class="hm" id="hm" role="tabpanel" aria-labelledby="tab-${t.sec}"><div class="hl-col" id="hml"></div><div id="hmw" class="hmw"></div><div class="hl-col" id="hmr"></div></div>
      <div class="hm-foot"><span class="ramp" aria-label="Cash moved per day in five equal-count blocks; orange = top 20 %"><i class="z" title="No cash moved"></i>${legend}</span>
        <button class="i" type="button" data-info="heat" aria-label="About the heatmap colours">i</button></div></div></div>`;
    const avail = $('#hmw').clientWidth, n = p.days, multi = n > 31;
    TH = multi ? 44 : 26;
    // one column = one calendar date; longer periods keep the size a 31-day month gets and scroll sideways
    const cs = Math.min(CS_MAX, Math.max(CS_MIN, avail / Math.min(n, 31))), W = n * cs, H = TH + h.rows.length * cs, gap = 2;
    const tight = cs < 24 ? ' tight' : '';
    const sortBtn = (key) => {
      const on = hs && hs.key === key, dir = on ? hs.dir : 0;
      const name = key === 'name' ? (dir === 1 ? 'line name, A to Z' : dir === -1 ? 'line name, Z to A' : 'line name') : (dir === -1 ? 'total, high to low' : dir === 1 ? 'total, low to high' : 'total amount');
      const txt = key === 'name' ? (dir === -1 ? 'Z–A' : 'A–Z') : (dir === 1 ? 'Low–high' : 'High–low');
      const ic = !on ? '<path d="M5 6l3-3 3 3M5 10l3 3 3-3"/>' : (key === 'name' ? dir === 1 : dir === 1) ? '<path d="M8 13V3M4.5 6.5L8 3l3.5 3.5"/>' : '<path d="M8 3v10M4.5 9.5L8 13l3.5-3.5"/>';
      return `<button class="hsort${on ? ' on' : ''}" type="button" data-hsort="${key}" aria-pressed="${on}" aria-label="Sort by ${name}${on ? '' : ' (off)'}"><svg viewBox="0 0 16 16" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ic}</g></svg><span>${key === 'name' ? 'Name' : 'Total'} ${on ? txt : ''}</span></button>`;
    };
    $('#hml').innerHTML = `<div class="hsh" style="height:${TH}px">${sortBtn('name')}</div>${h.rows.map((l) => `<button class="rl${lt[l.i].n ? '' : ' zero'}${tight}" type="button" data-line="${l.i}" style="height:${cs}px" ${lt[l.i].n ? '' : 'disabled'}><span>${esc(l.label)}</span>${lt[l.i].n ? '<span class="go" aria-hidden="true">→</span>' : ''}</button>`).join('')}
      <button class="rl tot" type="button" data-line="all" style="height:${TOT_H}px;border-radius:0">Net cash from ${SEC_NAME[t.sec].toLowerCase()} activities</button>`;
    // totals column: same 5 colours, quintiles over this activity's non-zero |row totals| (few rows: ties and gaps resolve upward)
    const TQ = quint(h.rows.map((l) => Math.round(Math.abs(lt[l.i].net) * 100)).filter((v) => v > 0));
    const tstep = (v) => (Math.abs(v) < 0.005 ? 0 : TQ.blk(Math.round(Math.abs(v) * 100)));
    const sq = cs - 2;
    $('#hmr').innerHTML = `<div class="hsh r" style="height:${TH}px">${sortBtn('amt')}</div>${h.rows.map((l) => { const st = tstep(lt[l.i].net); return `<span class="rt n${lt[l.i].n ? '' : ' zero'}${tight}" style="height:${cs}px"><i class="tq ${st ? 'q' + st : 'z'}" style="width:${sq}px;height:${sq}px" aria-hidden="true"></i><span class="tv">${C.money(lt[l.i].net)}</span></span>`; }).join('')}<span class="rt n tot" style="height:${TOT_H}px">${C.money(secNet)}</span>`;
    let svg = '', seps = '';
    for (let k = 0; k < n; k++) {
      const dt = C.dayOf(p.d0 + k), dom = dt.getUTCDate(), x = k * cs;
      if (multi && (dom === 1 || k === 0)) {
        const mEnd = Math.min(n, k + new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate() - dom + 1);
        svg += `<rect class="mband${dt.getUTCMonth() % 2 ? ' alt' : ''}" x="${x}" y="0" width="${(mEnd - k) * cs}" height="18" rx="4"/><text class="tick mo" x="${x + 8}" y="13">${C.MON[dt.getUTCMonth()]} ${dt.getUTCFullYear()}</text>`;
        if (k > 0) seps += `<line class="msep" x1="${x}" x2="${x}" y1="0" y2="${H}"/>`; // drawn over the cells
      }
      const lab = multi || cs >= 18 || dom % 2 === 1;
      if (lab) svg += `<text class="tick" x="${x + cs / 2}" y="${TH - 8}" text-anchor="middle" data-day="${k}">${dom}</text>`;
    }
    h.rows.forEach((l, j) => {
      const g = h.grid[j], y = TH + j * cs + gap / 2, side = cs - gap;
      svg += `<rect class="cell z" x="0" y="${y}" width="${W - gap}" height="${side}" rx="3"/>`;
      for (let k = 0; k < n; k++) {
        const v = g.inC[k] - g.outC[k];
        if (v > 0) svg += `<rect class="cell hit q${step(v)}" data-j="${j}" data-k="${k}" x="${k * cs + gap / 2}" y="${y}" width="${side}" height="${side}" rx="2"/>`;
      }
    });
    svg += seps + `<rect class="cur" id="hcur" x="-10" y="0" width="0" height="0" rx="3"/>`;
    $('#hmw').innerHTML = `<svg id="hsvg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" tabindex="0" role="grid" aria-label="${SEC_NAME[t.sec]} cash moved per day; arrow keys move, Enter opens the day">${svg}</svg>`;
    HM = { h, p, cw: cs, W, step };
    if (S.hc) moveCursor(S.hc.j, S.hc.k, false);
  }
  let HM = null;
  function cellTip(j, k) {
    const g = HM.h.grid[j], l = HM.h.rows[j];
    return `<b>${esc(C.fmtDayLong(HM.p.d0 + k))}</b><div class="m">${esc(l.label)}</div>
      <div class="r"><span>In</span><span>${C.money(g.inC[k] / 100, { exact: S.unit === 'USD' })}</span></div>
      <div class="r"><span>Out</span><span>${C.money(g.outC[k] / 100, { exact: S.unit === 'USD' })}</span></div>
      <div class="r"><span>Transactions</span><span>${g.n[k]}</span></div>`;
  }
  function moveCursor(j, k, tip = true) {
    if (!HM) return;
    j = Math.max(0, Math.min(HM.h.rows.length - 1, j)); k = Math.max(0, Math.min(HM.p.days - 1, k));
    S.hc = { j, k };
    const c = $('#hcur');
    const cs = HM.cw, sc = $('#hmw');
    if (c) { c.setAttribute('x', k * cs); c.setAttribute('y', TH + j * cs); c.setAttribute('width', cs); c.setAttribute('height', cs); c.style.stroke = 'var(--hl)'; c.style.strokeWidth = 2; }
    if (sc && (k * cs < sc.scrollLeft || (k + 1) * cs > sc.scrollLeft + sc.clientWidth)) sc.scrollLeft = k * cs - sc.clientWidth / 2;
    if (tip) { const r = $('#hsvg').getBoundingClientRect(); showTip(cellTip(j, k), r.left + (k + 0.5) * cs, r.top + TH + j * cs); }
  }

  /* ---------- ledger (layer 3) ---------- */
  function renderLedger() {
    const t = top(), p = P();
    const f = { sec: t.sec, line: t.line, d0: t.day != null ? t.day : p.d0, d1: t.day != null ? t.day : p.d1 };
    const rows = C.ledgerRows(f).slice().sort((a, b) => a.d - b.d || a.txn - b.txn || a.c - b.c);
    let cin = 0, cout = 0;
    rows.forEach((r) => { if (r.c > 0) cin += r.c; else cout += r.c; });
    const allLines = t.line == null;
    const title = `${SEC_NAME[t.sec]} › ${allLines ? 'all lines' : C.LINES[t.line].label}`;
    const when = t.day != null ? C.fmtDayLong(t.day) : p.label + (p.partial ? ' to date' : '');
    const ex = { exact: S.unit === 'USD' };
    $('#layer').innerHTML = `<div class="card"><div class="ch"><h2>${esc(title)}</h2><span style="color:var(--muted);font-size:13px">${esc(when)}</span><span class="sp"></span>
        <button class="i" type="button" data-info="ledger" aria-label="About the ledger">i</button></div>
      <div class="trio" style="margin-top:8px"><div class="k-in"><span>Cash in</span><b>${C.money(cin / 100, ex)}</b></div><div class="k-out"><span>Cash out</span><b>${C.money(cout / 100, ex)}</b></div>
        <div><span>Net</span><b>${C.money((cin + cout) / 100, ex)}</b></div><div><span>Transactions</span><b>${rows.length}</b></div></div>
      ${rows.length ? `<div class="lgw" id="lgw"><table class="lt"><colgroup><col class="c1"><col class="c2"><col><col class="c4">${allLines ? '<col class="c5">' : ''}<col class="c6"><col class="c7"></colgroup>
        <thead><tr><th>Date</th><th>Party</th><th>Memo</th><th>Type · No.</th>${allLines ? '<th>Line</th>' : ''}<th class="r">Amount</th><th title="Cleared status">Clr</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td class="n">${esc(C.fmtDay(r.d))} ${C.dayOf(r.d).getUTCFullYear() % 100}</td><td title="${esc(C.D.cps[r.cp] || '')}">${esc(C.D.cps[r.cp] || '(no name)')}</td><td class="m" title="${esc(r.memo)}">${esc(r.memo || '–')}</td>
          <td>${esc(r.type.replace(/([a-z])([A-Z])/g, '$1 $2'))}${r.doc ? ` <span class="m">#${esc(r.doc)}</span>` : ''}</td>${allLines ? `<td class="m">${esc(C.LINES[r.line].label)}</td>` : ''}
          <td class="r n">${C.money(r.c / 100, ex)}</td><td><span class="cl ${r.cl}" title="${{ R: 'Reconciled', C: 'Cleared', U: 'Uncleared', N: 'Not applicable (Undeposited Funds)' }[r.cl]}">${r.cl === 'N' ? '·' : r.cl === 'U' ? '' : r.cl}</span></td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="${allLines ? 5 : 4}">Total · ${rows.length} transactions</td><td class="r n">${C.money((cin + cout) / 100, ex)}</td><td></td></tr></tfoot></table></div>`
        : '<div class="empty">No cash moved</div>'}</div>`;
    LEDGER_TOTAL = (cin + cout) / 100;
    const w = $('#lgw'); // table scrolls inside the card so the header, KPIs and totals stay in view
    if (w) w.style.maxHeight = Math.max(220, $('#layer').getBoundingClientRect().bottom - w.getBoundingClientRect().top - 20) + 'px';
  }
  let LEDGER_TOTAL = 0;

  /* ---------- router ---------- */
  function render() {
    renderShell(); renderKpis(); hideTip();
    const v = top().view;
    if (v === 'heat') renderHeat();
    else if (v === 'ledger') renderLedger();
    else renderStatement();
  }
  function go(entry, replace) {
    if (entry.view === 'stmt') S.stack = [entry];
    else if (replace) S.stack[S.stack.length - 1] = entry;
    else S.stack.push(entry);
    if (entry.view !== 'heat') S.hc = null; else S.lastSec = entry.sec;
    render();
    $('#layer').scrollTop = 0;
    $('#layer').focus({ preventScroll: true });
  }
  // switch activity in place (same stack slot, same period, sort kept); focus stays on the selected tab
  function selectTab(sec) {
    if (sec !== top().sec) go({ view: 'heat', sec }, true);
    const tb = $(`#tab-${sec}`); if (tb) tb.focus({ preventScroll: true });
  }
  function back() { if (S.stack.length < 2) return false; S.stack.pop(); render(); $('#layer').focus({ preventScroll: true }); return true; }

  function toggleSec(sec) {
    S.exp.has(sec) ? S.exp.delete(sec) : S.exp.add(sec);
    const y = $('#layer').scrollTop; renderStatement(); $('#layer').scrollTop = y;
    const r = $(`tr.tog[data-tog="${sec}"]`); if (r) r.focus({ preventScroll: true });
  }

  /* ---------- tooltip ---------- */
  function showTip(html, cx, cy) {
    const t = $('#tip'), fr = $('#frame').getBoundingClientRect();
    t.innerHTML = html; t.hidden = false;
    let x = cx - fr.left + 14, y = cy - fr.top - t.offsetHeight - 8;
    if (x + t.offsetWidth > fr.width - 8) x = cx - fr.left - t.offsetWidth - 14;
    if (y < 8) y = cy - fr.top + 24;
    t.style.left = x + 'px'; t.style.top = y + 'px';
  }
  function hideTip() { $('#tip').hidden = true; }

  /* ---------- events ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (window.V2.onClick(e)) return; // pop-ups, menu, calendar, info, diagram
    const hsb = t.closest('[data-hsort]');
    if (hsb) { // first click: A→Z / high→low; next click flips; the other toggle clears
      const key = hsb.dataset.hsort, cur = S.hsort && S.hsort.key === key ? S.hsort.dir : 0;
      S.hsort = { key, dir: cur ? -cur : key === 'name' ? 1 : -1 };
      S.hc = null; renderHeat(); const nb = $(`[data-hsort="${key}"]`); if (nb) nb.focus({ preventScroll: true }); return;
    }
    const stp = t.closest('[data-step]'); if (stp) { goStep(+stp.dataset.step); return; }
    const hb = t.closest('[data-heat]'); if (hb) { go({ view: 'heat', sec: hb.dataset.heat }); return; }
    const tg = t.closest('tr.tog'); if (tg) { toggleSec(tg.dataset.tog); return; }
    const sec = t.closest('[data-sec]'); if (sec) { selectTab(sec.dataset.sec); return; }
    const ln = t.closest('[data-line]'); if (ln) { const line = ln.dataset.line === 'all' ? null : +ln.dataset.line; go({ view: 'ledger', sec: top().sec, line, day: null }); return; }
    const cell = t.closest('rect.hit'); if (cell) { const j = +cell.dataset.j, k = +cell.dataset.k; go({ view: 'ledger', sec: top().sec, line: HM.h.rows[j].i, day: HM.p.d0 + k }); }
  });
  document.addEventListener('mousemove', (e) => {
    const cell = e.target.closest && e.target.closest('rect.hit');
    if (cell) { const j = +cell.dataset.j, k = +cell.dataset.k; showTip(cellTip(j, k), e.clientX, e.clientY); return; }
    const ov = e.target.closest && e.target.closest('[data-tipov]');
    if (ov) { showTip('<b>Override S01</b><div class="m">Line of credit is typed Other Current Liability in QBO (operating); the mapping override moves it to financing. Net change does not move.</div>', e.clientX, e.clientY); return; }
    if (!$('#tip').hidden && !(document.activeElement && document.activeElement.id === 'hsvg')) hideTip();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (window.V2.closePop()) { e.preventDefault(); return; } if (back()) e.preventDefault(); return; }
    if (window.V2.trapTab(e)) return;
    const nav = e.target.matches && e.target.matches('tr.tog') ? e.target : null;
    if (nav && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleSec(nav.dataset.tog); return; }
    if (nav && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); const all = [...document.querySelectorAll('tr.tog')]; const n = all[all.indexOf(nav) + (e.key === 'ArrowDown' ? 1 : -1)]; if (n) n.focus(); return; }
    // Activities tabs: ← → (wrapping), Home, End move and select (automatic activation)
    if (e.target.matches && e.target.matches('[role="tab"][data-sec]')) {
      const ks = C.SECS.map(([k]) => k), i = ks.indexOf(e.target.dataset.sec);
      const j = { ArrowRight: i + 1, ArrowLeft: i - 1 + ks.length, Home: 0, End: ks.length - 1 }[e.key];
      if (j != null) { e.preventDefault(); selectTab(ks[j % ks.length]); }
      return;
    }
    if (e.target.id === 'hsvg' && HM) {
      const c = S.hc || { j: 0, k: 0 };
      const mv = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0], Home: [0, -1e4], End: [0, 1e4] }[e.key];
      if (mv) { e.preventDefault(); moveCursor(c.j + mv[0], c.k + mv[1]); return; }
      if (e.key === 'Enter' && S.hc && HM.h.grid[S.hc.j].n[S.hc.k]) { e.preventDefault(); go({ view: 'ledger', sec: top().sec, line: HM.h.rows[S.hc.j].i, day: HM.p.d0 + S.hc.k }); }
    }
  });
  document.addEventListener('focusin', (e) => { if (e.target.id === 'hsvg' && HM) moveCursor((S.hc || { j: 0 }).j, (S.hc || { k: 0 }).k); else if (e.target.id !== 'hsvg') hideTip(); });
  document.addEventListener('focusout', (e) => { if (e.target.id === 'hsvg') hideTip(); });
  $('#layer').addEventListener('scroll', hideTip, { passive: true });
  document.addEventListener('scroll', (e) => { if (e.target.id === 'hmw') hideTip(); }, { capture: true, passive: true });

  /* ---------- settings ---------- */
  function setUnit(u) { S.unit = u === 'USDk' ? 'USDk' : 'USD'; C.setUnit(S.unit); try { localStorage.setItem('cf2-unit', S.unit); } catch (err) { /* storage unavailable */ } }
  function setPeriod(mode, y, m, quick) {
    S.mode = mode; S.y = y; S.m = m; S.quick = quick || null;
    const p = P(), t = top();
    if (t.view === 'ledger' && t.day != null && (t.day < p.d0 || t.day > p.d1)) t.day = null;
    S.hc = null;
  }
  // quick handles: current period to date, "current" = the data's last month (Oct 2026)
  const QUICK = { YTD: 'Y', QTD: 'Q', MTD: 'M' };
  function setQuick(k) { if (!QUICK[k]) return; const [y, m] = C.ym(C.N - 1); setPeriod(QUICK[k], y, m, k); }

  /* ---------- palette self-test (round 14): every computed colour in the DOM must be one of the four Orbya colours, a listed mix of them,
     the USER-fixed line-bar grey, or one of those with alpha. Mock / harness only; returns {pass, n, bad}. ---------- */
  const TOKENS = ['--bg', '--surf', '--ink', '--hl', '--sub', '--sub2', '--muted', '--faint', '--rule', '--line', '--hover', '--out', '--q1', '--q2', '--q3', '--tabLine', '--lineBar'];
  const parseColors = (s) => (s.match(/rgba?\([^)]*\)|color\(srgb[^)]*\)/g) || []).map((c) => {
    const n = c.match(/-?[\d.]+(e-?\d+)?/g).map(Number);
    return c.startsWith('color') ? [n[0] * 255, n[1] * 255, n[2] * 255, n.length > 3 ? n[3] : 1] : [n[0], n[1], n[2], n.length > 3 ? n[3] : 1];
  });
  function paletteCheck(root = document.body) {
    const probe = document.createElement('i'); document.body.append(probe);
    const allowed = TOKENS.map((t) => { probe.style.color = `var(${t})`; return [t, parseColors(getComputedStyle(probe).color)[0]]; });
    probe.remove();
    const PROPS = ['color', 'background-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color', 'text-decoration-color', 'box-shadow', 'background-image'];
    const bad = []; let n = 0;
    const test = (el, pseudo, prop, val) => parseColors(val).forEach((c) => {
      n++;
      if (c[3] === 0) return; // fully transparent
      if (!allowed.some(([, a]) => Math.abs(a[0] - c[0]) < 0.75 && Math.abs(a[1] - c[1]) < 0.75 && Math.abs(a[2] - c[2]) < 0.75)) bad.push({ el: el.id || el.className.baseVal || el.className || el.tagName, pseudo, prop, val });
    });
    for (const el of [root, ...root.querySelectorAll('*')]) {
      for (const pseudo of [null, '::before', '::after']) {
        const cs = getComputedStyle(el, pseudo);
        if (pseudo && (cs.content === 'none' || cs.content === 'normal')) continue;
        PROPS.forEach((p) => test(el, pseudo, p, cs.getPropertyValue(p)));
        if (el instanceof SVGGeometryElement || el instanceof SVGTextContentElement) { // paint only where it is drawn: shapes and text (svg / g / line fill never paints)
          if (cs.fill !== 'none' && !(el instanceof SVGLineElement)) test(el, null, 'fill', cs.fill);
          if (cs.stroke !== 'none') test(el, null, 'stroke', cs.stroke);
        }
      }
    }
    return { pass: !bad.length, n, bad };
  }

  window.V2 = Object.assign(window.V2 || {}, { paletteCheck, S, P, top, go, back, render, esc, $, showTip, hideTip, setUnit, setPeriod, setQuick, SEC_NAME, ledgerTotal: () => LEDGER_TOTAL, heatState: () => HM });

  /* ---------- init (query params are mock-only review hooks) ---------- */
  window.addEventListener('DOMContentLoaded', () => {
    try { const u = localStorage.getItem('cf2-unit'); if (u) setUnit(u); } catch (err) { /* storage unavailable */ }
    const q = new URLSearchParams(location.search);
    if (q.get('unit')) setUnit(q.get('unit'));
    if (q.get('mode')) setPeriod(q.get('mode'), +(q.get('y') || 2026), +(q.get('m') || 10));
    if (q.get('quick')) setQuick(q.get('quick'));
    const v = q.get('view');
    if (q.get('exp') != null) { S.exp.clear(); q.get('exp').split(',').filter(Boolean).forEach((x) => S.exp.add(x)); }
    if (v === 'heat' || v === 'ledger') S.stack.push({ view: 'heat', sec: q.get('sec') || 'OP' });
    if (v === 'ledger') { const ln = q.get('line'); S.stack.push({ view: 'ledger', sec: q.get('sec') || 'OP', line: ln == null || ln === 'all' ? null : C.LINE[ln].i, day: q.get('day') ? +q.get('day') : null }); }
    (q.get('open') || '').split(',').filter(Boolean).forEach((g) => S.open.add(g));
    render();
    const sc = C.selfCheck();
    window.CF_SELFCHECK = sc;
    console.info(`[cf-v2] self-check vs control_totals_usd.csv: ${sc.pass ? 'PASS' : 'FAIL'} (${sc.rows.filter((r) => r.ok).length}/${sc.rows.length})`);
    if (console.table) console.table(sc.rows);
    const pop = q.get('pop') || (v === 'diagram' ? 'diagram' : null); // old ?view=diagram links open the pop-up over the Statement
    if (pop) window.V2.openNamed(pop);
  });
})();
