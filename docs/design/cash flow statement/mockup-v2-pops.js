/* ACME Cash Flow mock v2 · glass pop-ups: calendar + settings, menu, How to read, ⓘ, cash, and the two management pop-ups (Diagram, Reconciliation). */
'use strict';
(function () {
  const C = window.CF;
  const V = window.V2;
  const { $, esc } = V;
  const IC = {
    stmt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14M5 10h14M5 15h9M5 20h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    dia: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="9.5" width="6" height="5" rx="1.5"/><rect x="15.5" y="3.5" width="6" height="5" rx="1.5"/><rect x="15.5" y="15.5" width="6" height="5" rx="1.5"/><path d="M8.5 12h3v-6h4M11.5 12v6h4"/></g></svg>',
    heat: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><rect x="3" y="4" width="4" height="4" rx="1"/><rect x="10" y="4" width="4" height="4" rx="1" opacity=".45"/><rect x="17" y="4" width="4" height="4" rx="1" opacity=".7"/><rect x="3" y="10" width="4" height="4" rx="1" opacity=".3"/><rect x="10" y="10" width="4" height="4" rx="1"/><rect x="17" y="10" width="4" height="4" rx="1" opacity=".45"/><rect x="3" y="16" width="4" height="4" rx="1" opacity=".7"/><rect x="10" y="16" width="4" height="4" rx="1" opacity=".3"/><rect x="17" y="16" width="4" height="4" rx="1"/></g></svg>',
    txn: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M7 9h10M7 13h10M7 17h6"/></g></svg>',
    how: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4M12 17h.01"/></g></svg>',
    rec: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  /* ---------- pop-up mechanics (one layer at a time; Esc / outside / × close; focus in and back) ---------- */
  let opener = null, kind = null, calYear = null;
  function openPop(html, cls, from, place) {
    V.hideTip();
    const pop = $('#pop'), fr = $('#frame');
    pop.className = 'pop ' + (cls || '');
    pop.innerHTML = html + '<button class="x" type="button" data-close aria-label="Close">✕</button>';
    pop.style.left = pop.style.top = pop.style.right = '';
    pop.hidden = false; $('#scrim').hidden = false;
    $('#scrim').classList.toggle('blur', cls === 'rec' || cls === 'dia'); // the management pop-ups blur the page behind them
    if (from && from !== opener) { opener = from; }
    if (place === 'near' && from) {
      const fb = fr.getBoundingClientRect(), ob = from.getBoundingClientRect();
      let x = ob.left - fb.left, y = ob.bottom - fb.top + 8;
      if (x + pop.offsetWidth > fb.width - 16) x = ob.right - fb.left - pop.offsetWidth;
      if (y + pop.offsetHeight > fb.height - 16) y = Math.max(16, ob.top - fb.top - pop.offsetHeight - 8);
      pop.style.left = Math.max(16, x) + 'px'; pop.style.top = y + 'px';
    } else if (place === 'center') { // centre over the visible part of the frame (a small window shows only part of the 1440 × 810 frame)
      const fb = fr.getBoundingClientRect();
      const x0 = Math.max(0, -fb.left), x1 = Math.min(fb.width, innerWidth - fb.left), y0 = Math.max(0, -fb.top), y1 = Math.min(fb.height, innerHeight - fb.top);
      pop.style.left = Math.max(x0 + 16, x0 + (x1 - x0 - pop.offsetWidth) / 2) + 'px'; pop.style.top = Math.max(y0 + 16, y0 + (y1 - y0 - pop.offsetHeight) / 2) + 'px';
    }
    if (opener && opener.hasAttribute('aria-expanded')) opener.setAttribute('aria-expanded', 'true');
    const f = pop.querySelector('[data-first]') || pop.querySelector('button:not(.x):not(:disabled)') || pop.querySelector('.x');
    f.focus({ preventScroll: true });
  }
  function closePop() {
    const pop = $('#pop');
    if (pop.hidden) return false;
    pop.hidden = true; pop.innerHTML = ''; $('#scrim').hidden = true; $('#scrim').classList.remove('blur'); kind = null;
    ['#btnCal', '#btnMenu'].forEach((s) => $(s).setAttribute('aria-expanded', 'false'));
    const o = opener; opener = null;
    if (o && document.contains(o)) o.focus({ preventScroll: true });
    return true;
  }
  function trapTab(e) {
    const pop = $('#pop');
    if (e.key !== 'Tab' || pop.hidden) return false;
    const f = [...pop.querySelectorAll('button:not(:disabled)')];
    if (!f.length) return false;
    const a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    return true;
  }

  /* ---------- calendar + settings (top-left square) ---------- */
  // span (Year / Quarter / Month) → its elements; months / quarters without data are disabled, partial ones marked.
  // YTD / QTD / MTD are quick handles: while one is set, no span or element shows as active.
  const SPANS = [['A', 'Year'], ['Q', 'Quarter'], ['M', 'Month']];
  const QSPAN = { YTD: 'A', QTD: 'Q', MTD: 'M' };
  let calSpan = 'M';
  function calHtml() {
    const S = V.S, y = calYear, live = !S.quick;
    const [y0] = C.ym(0), [y1, m1] = C.ym(C.N - 1);
    const has = (yy, m) => C.idx(yy, m) <= C.N - 1;
    const el = (attr, txt, on, off, part) => `<button type="button" ${attr}${off ? ' disabled' : ''}${part ? ` class="part" title="${part}" aria-description="${part}"` : ''} aria-pressed="${on}">${txt}</button>`;
    let els;
    if (calSpan === 'A') {
      const ys = []; for (let yy = y0; yy <= y1; yy++) ys.push(yy);
      els = `<div class="mgrid g3" role="group" aria-label="Year">${ys.map((yy) => el(`data-pick="${yy}"`, yy, live && S.mode === 'A' && S.y === yy, false, has(yy, 12) ? '' : `Jan–${C.MON[m1 - 1]} only`)).join('')}</div>`;
    } else {
      const step = `<div class="ystep" role="group" aria-label="Year"><button type="button" data-cyr="-1" aria-label="Previous year"${y <= y0 ? ' disabled' : ''}>‹</button><b aria-live="polite">${y}</b><button type="button" data-cyr="1" aria-label="Next year"${y >= y1 ? ' disabled' : ''}>›</button></div>`;
      if (calSpan === 'Q') {
        els = step + `<div class="mgrid" role="group" aria-label="Quarter">${[1, 2, 3, 4].map((q) => {
          const last = [3, 2, 1].find((k) => has(y, q * 3 - 3 + k)) || 0; // months with data in the quarter
          const part = last && last < 3 ? `${C.MON[q * 3 - 3]}${last > 1 ? '–' + C.MON[q * 3 - 3 + last - 1] : ''} only` : '';
          return el(`data-pick="${q}"`, 'Q' + q, live && S.mode === 'Q' && S.y === y && Math.ceil(S.m / 3) === q, !last, part);
        }).join('')}</div>`;
      } else {
        els = step + `<div class="mgrid" role="group" aria-label="Month">${C.MON.map((mn, i) => el(`data-pick="${i + 1}"`, mn, live && S.mode === 'M' && S.y === y && S.m === i + 1, !has(y, i + 1), '')).join('')}</div>`;
      }
    }
    return `<h3 id="calH">Period</h3>
      <div class="ctabs" role="group" aria-label="Span">${SPANS.map(([k, t]) => `<button class="vtab" type="button" data-span="${k}" data-t="${t}" aria-pressed="${live && calSpan === k}"${live && calSpan === k ? ' data-first' : ''}>${t}</button>`).join('')}</div>
      <div class="cels">${els}</div>
      <div class="gh">To date · ${C.MON[m1 - 1]} ${y1}</div>
      <div class="chips" role="group" aria-label="To date">${Object.keys(QSPAN).map((k) => `<button type="button" data-quick="${k}" aria-pressed="${S.quick === k}"${S.quick === k ? ' data-first' : ''}>${k}</button>`).join('')}</div>
      <div class="gh" style="margin-top:18px;border-top:1px solid var(--rule);padding-top:14px">Units</div>
      <div class="chips" role="group" aria-label="Units">${[['USD', 'USD'], ['USDk', 'USD k']].map(([k, t]) => `<button type="button" data-unit="${k}" aria-pressed="${S.unit === k}">${t}</button>`).join('')}</div>`;
  }
  function openCal() {
    const S = V.S;
    calYear = S.y; calSpan = S.quick ? QSPAN[S.quick] : S.mode === 'Y' ? 'A' : S.mode;
    kind = 'cal'; openPop(calHtml(), 'cal', $('#btnCal'));
  }
  function pick(n) { // n = year (Year span), quarter 1–4 or month 1–12 in calYear
    const [y1, m1] = C.ym(C.N - 1), y = calSpan === 'A' ? n : calYear;
    if (calSpan === 'A') V.setPeriod('A', y, y === y1 ? m1 : 12);
    else if (calSpan === 'Q') V.setPeriod('Q', y, y === y1 ? Math.min(n * 3, m1) : n * 3);
    else V.setPeriod('M', y, n);
    calYear = y;
  }
  function refreshCal(focusSel) { if (kind !== 'cal') return; $('#pop').innerHTML = calHtml() + '<button class="x" type="button" data-close aria-label="Close">✕</button>'; const f = focusSel && $(focusSel, $('#pop')); if (f) f.focus({ preventScroll: true }); }

  /* ---------- menu (top-right square) ---------- */
  function menuHtml() {
    const v = V.top().view;
    const item = (id, ic, t, cur, layer) => `<button class="mi" type="button" data-menu="${id}" aria-current="${cur}">${layer ? `<span class="ly" aria-label="layer ${layer}">${layer}</span>` : IC[ic]}<span>${t}</span></button>`;
    return `<h3 style="margin:4px 8px 6px">Menu</h3>
      <p class="mgh" id="mgDrill">Drill path</p><div class="drill" role="group" aria-labelledby="mgDrill">${item('stmt', '', 'Statement', v === 'stmt', 1)}${item('heat', '', 'Activities', v === 'heat', 2)}${item('ledger', '', 'Transactions', v === 'ledger', 3)}</div>
      <div class="mgmt" role="group" aria-labelledby="mgMgmt"><p class="mgh" id="mgMgmt">Management view</p>${item('diagram', 'dia', 'Diagram', false)}${item('rec', 'rec', 'Reconciliation', false)}</div>
      <div class="msep"></div>${item('how', 'how', 'How to read', false)}`;
  }

  const KB_GO = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6h7M6.5 3l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ---------- Cash balance + activities (from the Closing cash card) ---------- */
  function cashHtml() {
    const p = V.P(), st = C.statement(p.a, p.b), fl = C.sectionFlows(p.a, p.b);
    const cin = C.r2(fl.OP.in + fl.INV.in + fl.FIN.in), cout = C.r2(fl.OP.out + fl.INV.out + fl.FIN.out);
    const bar = (cls, lbl, v, max) => `<div class="arow ${cls}"><span>${lbl}</span><span class="tr">${Math.abs(v) >= 0.005 ? `<i style="width:${(Math.abs(v) / max) * 100}%"></i>` : ''}</span><span class="n">${C.money(v)}</span></div>`;
    const balMax = Math.max(st.open, st.close, cin, -cout, 1);
    const actMax = Math.max(...C.SECS.flatMap(([k]) => [fl[k].in, -fl[k].out]), 1);
    const secTot = { OP: st.op, INV: st.iv, FIN: st.fn };
    const cards = C.SECS.map(([k, name]) => {
      const f = fl[k], gap = C.r2(secTot[k] - f.net);
      return `<button class="act" type="button" data-act="${k}" aria-label="${name}: cash in ${C.money(f.in)}, cash out ${C.money(f.out)}, net ${C.money(f.net)}; open activities">
        <span class="ah"><h3>${name}</h3><span class="n">${C.money(f.net)}</span><span class="gt" aria-hidden="true">→</span></span>
        <div class="arow blank" aria-hidden="true"></div>${bar('in', 'In', f.in, actMax)}${bar('out', 'Out', f.out, actMax)}${bar('net', 'Net', f.net, actMax)}
        ${Math.abs(gap) >= 0.005 ? `<span class="nc">statement adds ${C.money(gap)} non-cash</span>` : ''}</button>`;
    }).join('');
    return `<h3>Cash · ${esc(p.label)}${p.partial ? ' to date' : ''}</h3>
      <div class="cgrid"><div class="act bal-card" role="group" aria-label="Cash balance: opening ${C.money(st.open)}, in ${C.money(cin)}, out ${C.money(cout)}, closing ${C.money(st.close)}">
        <span class="ah"><h3>Cash balance</h3><span class="n">${C.money(st.close)}</span></span>
        ${bar('bal', 'Opening', st.open, balMax)}${bar('in', 'In', cin, balMax)}${bar('out', 'Out', cout, balMax)}${bar('bal', 'Closing', st.close, balMax)}</div>${cards}</div>`;
  }

  /* ---------- How to read (one per report) ---------- */
  function howHtml() {
    return `<h3>How to read</h3><div class="how-g"><div>
      <p class="gh">Path</p><ol class="steps"><li><b>1</b>Statement<span>sections · bars · % of NI</span></li><li><b>2</b>Activities<span>days × lines</span></li><li><b>3</b>Transactions<span>ledger</span></li></ol>
      <p style="margin-top:10px">Click a section row to expand its lines; the orange <span class="kb" style="display:inline-grid;vertical-align:-4px">${KB_GO}</span> opens its activities. A heatmap row or day opens its transactions. Esc steps back. On Closing cash, the orange button shows the cash balance and the three activities. Two management pop-ups sit in the menu: Diagram (the period's cash KPIs as a tree) and Reconciliation (every figure tied to the control totals).</p>
      <p class="gh">Keys</p><div class="keys"><span class="kbd">↑ ↓</span><span>section rows · Enter expands</span><span class="kbd">← → ↑ ↓</span><span>heatmap days and lines</span><span class="kbd">Enter</span><span>open</span><span class="kbd">Esc</span><span>back or close</span></div></div>
      <div><p class="gh">Marks</p><div class="keys">
        <span class="n">(12,480)</span><span>cash out; cash in has no sign; – is zero</span>
        <span><i class="sw2" style="background:var(--lineBar);width:22px"></i></span><span>statement line: bar length = absolute amount</span>
        <span><i class="sw2" style="background:var(--sec);width:22px"></i></span><span>balance (opening, closing); a notch = longer than the axis</span>
        <span><i class="sw2" style="background:var(--in)"></i> <i class="sw2" style="background:var(--out)"></i> <i class="sw2" style="background:var(--hl)"></i></span><span>activity cards: in · out · net</span>
        <span class="rule1"></span><span>section total</span><span class="rule2"></span><span>closing cash</span>
        <span><span class="ovr">S01</span></span><span>line of credit moved to financing by override</span>
        <span>${[1, 2, 3, 4, 5].map((i) => `<i class="sw2" style="background:var(--q${i});width:9px"></i>`).join('')}</span><span>heatmap: five blocks, 20 % of the days each; orange = top 20 %</span>
        <span><span class="cl R">R</span> <span class="cl C">C</span> <span class="cl U"></span></span><span>reconciled · cleared · uncleared</span>
        <span><i class="sw2" style="background:var(--hl)"></i></span><span>accent: current level, focus, selection; never good or bad</span></div></div></div>`;
  }

  /* ---------- ⓘ definitions ---------- */
  const INFO = {
    close: ['Closing cash', 'Bank accounts plus Undeposited Funds at the period end.', 'M02 = M01 + M03', 'Spec M02'],
    net: ['Net change', 'Closing less opening cash; equals operating + investing + financing.', 'M03 = M02 − M01', 'Spec M03'],
    cfo: ['Operating cash flow', 'Net income plus non-cash adjustments and working-capital changes; line of credit in financing (S01).', 'M06 = M04 + Σ M05 (operating)', 'Spec M06, overrides on'],
    fcf: ['Free cash flow', 'Operating cash flow less fixed-asset purchases, plus asset-sale proceeds.', 'M15 = M06 + purchases + proceeds', 'Spec M15'],
    conv: ['Cash conversion', 'How much of net income arrived as cash. n/m when net income is zero or a loss.', 'M16 = M06 ÷ M04', 'Spec M16'],
    dso: ['DSO · days', 'Days of revenue sitting in receivables at the period end.', 'A/R closing ÷ revenue × days in period', 'fact_account_balance (A/R), Income accounts'],
    pct: ['% of net income', 'Each row as a share of net income for the period; net income = 100 %. Sign kept: (12%) is a cash outflow. n/m on every row when net income is zero or a loss. Opening and closing cash have none.', 'row ÷ net income × 100', 'M04 (net income)'],
    stmt: ['Statement', 'Indirect method in the order of the classic statement: opening cash, three activities, net change, closing cash. One row per balance-sheet account, as QBO shows them. Rows with no movement in the period are hidden.', 'Bar = absolute amount of the row on one shared axis', 'Overrides on: M06 / M07 / M08'],
    heat: ['Activities', 'One row per direct-method line, one column per calendar date. Cells: each block holds 20 % of the days with cash moved (in + out, absolute), ranked within this activity and period; orange = the top 20 %; hover a legend swatch for its block\'s bounds. Right column: each row\'s net total on the same five colours, blocks by quintile of this activity\'s row totals (few rows: ties go to the higher block). Sort toggles above the names and the totals reorder whole rows. Internal transfers excluded.', 'Row total = DIRECT_LINE (overrides on)', 'fact_cash_posting.direct_line_code'],
    ledger: ['Transactions', 'Every cash movement behind the row or day, one line per transaction and counterparty. A payment that settles an invoice shows the invoice number as memo.', 'Total = heatmap row or cell', 'fact_cash_posting × fact_txn'],
    diagram: ['Diagram', 'Management pop-up: net change in cash split into the three activities, each with its KPI groups. Click a group to expand it; click an activity to close the pop-up and open its activities (Esc returns).', 'Net change = Operating + Investing + Financing', 'M03, M06–M08, M15–M17'],
  };
  const infoHtml = (id) => { const i = INFO[id]; return `<h3>${i[0]}</h3><p>${i[1]}</p><div class="f">${esc(i[2])}</div><span class="src">${esc(i[3])}</span>`; };

  /* ---------- reconciliation (control totals for the selected month or year) ---------- */
  function recHtml() {
    const p = V.P();
    if (!p.key) return `<h3>Reconciliation · ${esc(p.label)}</h3><div class="pb"><p>Control totals exist per month and per year. Pick a month, a year or YTD.</p></div>`;
    const sc = C.selfCheck(p.key), ok = sc.rows.every((r) => r.ok);
    const ex = (v) => C.money(v, { exact: true });
    const mark = (k) => `<td class="ok" aria-label="${k ? 'ties' : 'differs'}">${k ? '✓' : '✗'}</td>`;
    const head = sc.rows.filter((r) => !r.metric.startsWith('DIRECT_LINE'));
    const lines = {};
    sc.rows.filter((r) => r.metric.startsWith('DIRECT_LINE')).forEach((r) => {
      const [, code, src] = r.metric.match(/^DIRECT_LINE (\S+) \((.+)\)$/);
      const o = lines[code] || (lines[code] = { control: r.control, ok: true });
      o[src === 'ledger' ? 'ledger' : 'heat'] = r.page; o.ok = o.ok && r.ok;
    });
    return `<h3>Reconciliation · ${esc(p.label)} <span style="font-weight:500;color:var(--muted);font-size:12.5px">${sc.rows.filter((r) => r.ok).length} / ${sc.rows.length} tie ${ok ? '✓' : '✗'}</span></h3>
      <div class="pb"><div class="rec-g"><table class="rec-t"><thead><tr><th>Statement · KPI</th><th class="r">Page</th><th class="r">Control</th><th></th></tr></thead><tbody>
      ${head.map((r) => `<tr><td>${esc(r.metric)}</td><td class="r">${r.metric.startsWith('M16') ? (r.page == null ? 'n/m' : r.page.toFixed(4)) : ex(r.page)}</td><td class="r">${r.metric.startsWith('M16') ? (+r.control).toFixed(4) : ex(r.control)}</td>${mark(r.ok)}</tr>`).join('')}</tbody></table>
      <table class="rec-t"><thead><tr><th>Direct line</th><th class="r">Heatmap row</th><th class="r">Ledger</th><th class="r">Control</th><th></th></tr></thead><tbody>
      ${Object.entries(lines).map(([code, o]) => `<tr><td>${esc(C.LINE[code].label)}</td><td class="r">${ex(o.heat)}</td><td class="r">${ex(o.ledger)}</td><td class="r">${ex(o.control)}</td>${mark(o.ok)}</tr>`).join('')}</tbody></table></div>
      <span class="src">checks/control_totals_usd.csv · ${esc(p.key)} · M06–M08 with overrides on · DIRECT_LINE = overrides on</span></div>`;
  }

  /* ---------- Diagram pop-up (management view; the page underneath keeps its view and path) ---------- */
  const pct = (v) => (v == null ? 'n/m' : (v < 0 ? '−' : '') + C.nf1.format(Math.abs(v * 100)) + '%');
  const xx = (v) => (v == null ? 'n/m' : (v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + '×');
  const dd = (v) => (v == null ? 'n/m' : C.nf1.format(v) + ' d');
  const mm = (v) => C.money(v, { suffix: true });
  const GROUPS = [
    { id: 'quality', sec: 'OP', t: 'Cash quality', lead: (m) => [m.convOk ? xx(m.conv) : 'n/m', 'cash conversion'], mets: [
      ['CFO margin', (m) => pct(m.margin), 'CFO ÷ revenue'], ['Cash conversion', (m) => (m.convOk ? xx(m.conv) : 'n/m'), 'CFO ÷ net income'], ['Accruals', (m) => mm(m.accruals), 'net income − CFO']] },
    { id: 'wc', sec: 'OP', t: 'Working capital', lead: (m) => [dd(m.ccc), 'cash conversion cycle'], mets: [
      ['DSO', (m) => dd(m.dso), 'A/R ÷ revenue × days'], ['DPO', (m) => dd(m.dpo), 'A/P ÷ bills spend × days'], ['Cash conversion cycle', (m) => dd(m.ccc), 'DSO − DPO (no inventory)']] },
    { id: 'fcf', sec: 'INV', t: 'FCF and investment', lead: (m) => [mm(m.fcf), 'free cash flow'], mets: [
      ['Free cash flow', (m) => mm(m.fcf), 'CFO − capex + proceeds'], ['Capex intensity', (m) => pct(m.capexInt), 'capex ÷ revenue'], ['Capex coverage', (m) => (m.capex > 0.005 ? xx(m.capexCov) : 'no capex'), 'CFO ÷ capex']] },
    { id: 'lev', sec: 'FIN', t: 'Leverage and coverage', lead: (m) => [xx(m.dscr), 'debt service coverage'], mets: [
      ['DSCR', (m) => xx(m.dscr), 'CFO ÷ (interest + term principal)'], ['Net debt ÷ EBITDA', (m) => (m.ndEbitda == null ? 'n/m' : xx(m.ndEbitda)), (m) => (m.netDebt < 0 ? 'net cash · EBITDA annualised' : 'EBITDA annualised')], ['Payout cover', (m) => (m.draws > 0.005 ? xx(m.payout) : 'no draws'), 'CFO ÷ owner draws']] },
  ];
  function diagramBody() {
    const S = V.S, p = V.P(), m = C.metrics(p), st = C.statement(p.a, p.b);
    const Wd = 1120; // fits the fixed pop-up body (1200 px box) with its scrollbar gutter, so expanding never adds a sideways scroll
    const NW = { root: 240, act: 210, grp: 240, met: 260 };
    const gx = 52;
    const span = NW.root + NW.act + NW.grp + NW.met + gx * 3;
    const x0 = Math.max(12, (Wd - span) / 2);
    const X = { root: x0, act: x0 + NW.root + gx, grp: x0 + NW.root + NW.act + gx * 2, met: x0 + NW.root + NW.act + NW.grp + gx * 3 };
    const H = { root: 104, act: 78, grp: 70, met: 56 };
    let y = 16;
    const acts = C.SECS.map(([k, name]) => {
      const groups = GROUPS.filter((g) => g.sec === k).map((g) => {
        const open = S.open.has(g.id);
        let cy;
        const mets = [];
        if (open) { g.mets.forEach((mt) => { mets.push({ mt, cy: y + H.met / 2 }); y += H.met + 10; }); cy = (mets[0].cy + mets[mets.length - 1].cy) / 2; }
        else { cy = y + H.grp / 2; y += H.grp + 16; }
        return { g, open, cy, mets };
      });
      y += 18;
      return { k, name, cy: (groups[0].cy + groups[groups.length - 1].cy) / 2, groups };
    });
    const rootCy = (acts[0].cy + acts[2].cy) / 2;
    const Ht = y;
    const secVal = { OP: st.op, INV: st.iv, FIN: st.fn };
    const curve = (x1, y1, x2, y2, on) => { const mx = (x1 + x2) / 2; return `<path class="lnk${on ? ' on' : ''}" d="M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}"/>`; };
    let links = '', nodes = '';
    nodes += `<div class="node root" role="note" style="left:${X.root}px;top:${rootCy - H.root / 2}px;width:${NW.root}px;height:${H.root}px" aria-label="Net change in cash ${C.money(st.net)}">
      <span class="t">Net change in cash</span><span class="v">${C.money(st.net, { suffix: true })}</span><span class="s">closing less opening · ${esc(p.label)}</span></div>`;
    acts.forEach((a) => {
      links += curve(X.root + NW.root, rootCy, X.act - 22, a.cy, true) + `<line class="lnk on" x1="${X.act - 22}" y1="${a.cy}" x2="${X.act}" y2="${a.cy}"/>`;
      links += `<g class="plus"><circle cx="${X.act - 22}" cy="${a.cy}" r="10"/><text x="${X.act - 22}" y="${a.cy}">+</text></g>`;
      nodes += `<button class="node act-n" type="button" data-dheat="${a.k}" style="left:${X.act}px;top:${a.cy - H.act / 2}px;width:${NW.act}px;height:${H.act}px" aria-label="${a.name} ${C.money(secVal[a.k])}; open heatmap">
        <span class="t">${a.name} <span aria-hidden="true" style="margin-left:auto">→</span></span><span class="v">${C.money(secVal[a.k], { suffix: true })}</span><span class="s">net cash · opens heatmap</span></button>`;
      a.groups.forEach(({ g, open, cy, mets }) => {
        links += curve(X.act + NW.act, a.cy, X.grp, cy, open);
        const [lv, ls] = g.lead(m);
        nodes += `<button class="node grp" type="button" data-grp="${g.id}" aria-expanded="${open}" style="left:${X.grp}px;top:${cy - H.grp / 2}px;width:${NW.grp}px;height:${H.grp}px">
          <span class="t">${g.t}</span><span class="v">${lv}</span><span class="s">${ls}</span></button>`;
        mets.forEach(({ mt, cy: my }) => {
          links += curve(X.grp + NW.grp, cy, X.met, my, true);
          const sub = typeof mt[2] === 'function' ? mt[2](m) : mt[2];
          nodes += `<div class="node met" role="note" style="left:${X.met}px;top:${my - H.met / 2}px;width:${NW.met}px;height:${H.met}px"><span class="t">${mt[0]}</span><span class="v">${mt[1](m)}</span><span class="s">${esc(sub)}</span></div>`;
        });
      });
    });
    return `<div class="dg" id="dg" style="width:${Wd}px;height:${Ht}px"><svg class="links" width="${Wd}" height="${Ht}" aria-hidden="true">${links}</svg>${nodes}</div>`;
  }
  const allOpen = () => GROUPS.every((g) => V.S.open.has(g.id));
  const noneOpen = () => !GROUPS.some((g) => V.S.open.has(g.id));
  const dgAll = () => `<button type="button" data-dall="1"${allOpen() ? ' disabled' : ''}>Expand all</button><button type="button" data-dall="0"${noneOpen() ? ' disabled' : ''}>Collapse all</button>`;
  function openDiagram() {
    const p = V.P();
    kind = 'dia';
    openPop(`<div class="ph"><h3>Diagram · ${esc(p.label)}${p.partial ? ' to date' : ''} <button class="i" type="button" data-dinfo aria-label="About the diagram" style="margin-left:6px;vertical-align:-3px">i</button></h3>
      <div class="chips sm" role="group" aria-label="KPI groups" id="dgAll">${dgAll()}</div></div><div class="dgp pb" id="dgp">${diagramBody()}</div>`, 'dia', $('#btnMenu'), 'center');
  }
  // re-draw the tree inside the fixed box (scroll position kept) and keep focus on the control that was used
  function redrawDiagram(focusSel) {
    const b = $('#dgp'), y = b.scrollTop;
    b.innerHTML = diagramBody(); b.scrollTop = y;
    $('#dgAll').innerHTML = dgAll();
    const f = $(`#pop ${focusSel}:not(:disabled)`) || $('#pop [data-dall]:not(:disabled)');
    if (f) f.focus({ preventScroll: true });
  }

  /* ---------- click routing for pop-ups, menu, calendar, diagram ---------- */
  function onClick(e) {
    const t = e.target;
    if (t.closest('#scrim')) { closePop(); return true; }
    if (t.closest('[data-close]')) { closePop(); return true; }
    if (t.closest('#btnCal')) { if (kind === 'cal') closePop(); else { closePop(); openCal(); } return true; }
    if (t.closest('#btnMenu')) { if (kind === 'menu') closePop(); else { closePop(); kind = 'menu'; openPop(menuHtml(), 'menu', $('#btnMenu')); } return true; }
    const sp = t.closest('[data-span]'); if (sp) { calSpan = sp.dataset.span; refreshCal(`[data-span="${calSpan}"]`); return true; }
    const yr = t.closest('[data-cyr]'); if (yr) { const d = +yr.dataset.cyr; calYear += d; refreshCal(`[data-cyr="${d}"]`); const b = $(`#pop [data-cyr="${d}"]`); if (b && b.disabled) $(`#pop [data-cyr="${-d}"]`).focus({ preventScroll: true }); return true; }
    const pk = t.closest('[data-pick]'); if (pk) { pick(+pk.dataset.pick); V.render(); refreshCal(`[data-pick="${pk.dataset.pick}"]`); return true; }
    const qk = t.closest('[data-quick]'); if (qk) { V.setQuick(qk.dataset.quick); calYear = V.S.y; calSpan = QSPAN[V.S.quick]; V.render(); refreshCal(`[data-quick="${qk.dataset.quick}"]`); return true; }
    const un = t.closest('[data-unit]'); if (un) { V.setUnit(un.dataset.unit); V.render(); refreshCal(`[data-unit="${un.dataset.unit}"]`); return true; }
    const mi = t.closest('[data-menu]');
    if (mi) {
      const id = mi.dataset.menu, tp = V.top();
      if (id === 'how') { kind = 'how'; openPop(howHtml(), 'how', $('#btnMenu'), 'center'); return true; }
      if (id === 'rec') { kind = 'rec'; openPop(recHtml(), 'rec', $('#btnMenu'), 'center'); return true; }
      if (id === 'diagram') { openDiagram(); return true; }
      closePop();
      const sec = tp.sec || 'OP';
      if (id === 'stmt') V.go({ view: 'stmt' });
      else if (id === 'heat') { V.S.stack = [{ view: 'stmt' }]; V.go({ view: 'heat', sec }); }
      else if (id === 'ledger') { V.S.stack = [{ view: 'stmt' }, { view: 'heat', sec }]; V.go({ view: 'ledger', sec, line: tp.view === 'ledger' ? tp.line : null, day: tp.view === 'ledger' ? tp.day : null }); }
      return true;
    }
    const cp = t.closest('[data-cashpop]'); if (cp) { closePop(); kind = 'cash'; openPop(cashHtml(), 'cash', cp, 'center'); opener = cp; return true; }
    const ac = t.closest('[data-act]'); if (ac) { closePop(); V.go({ view: 'heat', sec: ac.dataset.act }); return true; }
    const inf = t.closest('[data-info]'); if (inf) { closePop(); kind = 'info'; openPop(infoHtml(inf.dataset.info), '', inf, 'near'); opener = inf; return true; }
    const gr = t.closest('[data-grp]'); if (gr) { const id = gr.dataset.grp; V.S.open.has(id) ? V.S.open.delete(id) : V.S.open.add(id); redrawDiagram(`[data-grp="${id}"]`); return true; }
    const da = t.closest('[data-dall]'); if (da) { const on = da.dataset.dall === '1'; GROUPS.forEach((g) => (on ? V.S.open.add(g.id) : V.S.open.delete(g.id))); if (!on) $('#dgp').scrollTop = 0; redrawDiagram(`[data-dall="${on ? 0 : 1}"]`); return true; }
    // activity node: close the pop-up and open that activity; pushed on the stack, so Esc returns to where the user was
    const dh = t.closest('[data-dheat]'); if (dh) { closePop(); V.go({ view: 'heat', sec: dh.dataset.dheat }); return true; }
    if (t.closest('[data-dinfo]')) { const b = $('#dgp'); const box = document.createElement('div'); box.className = 'dg-note'; box.innerHTML = infoHtml('diagram'); if (!$('.dg-note')) b.before(box); else $('.dg-note').remove(); return true; }
    return false;
  }
  function openNamed(n) {
    if (n === 'cal') openCal();
    else if (n === 'menu') { kind = 'menu'; openPop(menuHtml(), 'menu', $('#btnMenu')); }
    else if (n === 'cash') { const b = $('[data-cashpop]'); if (b) b.click(); }
    else if (n === 'how') { kind = 'how'; openPop(howHtml(), 'how', $('#btnMenu'), 'center'); }
    else if (n === 'rec') { kind = 'rec'; openPop(recHtml(), 'rec', $('#btnMenu'), 'center'); }
    else if (n === 'diagram') openDiagram();
    else if (INFO[n]) { const b = $(`[data-info="${n}"]`); if (b) b.click(); }
  }

  Object.assign(V, { onClick, closePop, trapTab, openNamed, openDiagram });
})();
