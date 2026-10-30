<!-- next-id: CAND-020 -->

# Candidates (single observation, awaiting a second hit)

### CAND-001 · "Collapsed" differs by hierarchy depth across tracks · 2026-10-23 · expires 2027-01-21
Track B's statement matrix is two-level (dim_pl_row: line → account), so collapsed shows all 29 numbered lines. Track C's spine nests SM/RD/GA/OOI under OPEX, so an empty open-set hides them. Parity "collapsed" = no accounts: open every parent of a non-leaf (`components/expansion.ts` collapsedRows). Watch for the same depth mismatch in Group/entity rows (step 4).
Seen: js-report/components/expansion.ts (uncommitted, 2026-10-23)

### CAND-002 · eslint-config-next flags `_`-prefixed discards in rest destructuring · 2026-10-23 · expires 2027-01-21
`const { $schema: _drop, ...rest } = obj` → warning "'_drop' is assigned a value but never used" (no `ignoreRestSiblings` / underscore pattern in the Next config). Use `delete copy.key` on a fresh object instead of a throwaway binding.
Seen: js-report/lib/chat/tools.ts jsonSchema() (2026-10-23, uncommitted)

### CAND-003 · Code → name substitution before operator rewrite corrupts names holding the operator · 2026-10-23 · expires 2027-01-21
Readable formulas: `formula.replace(codes → names).replace('/', '÷')` turned "Other operating income / (expense)" into "… ÷ (expense)". Rewrite operators first, substitute names last (replace callbacks do not rescan inserted text). Caught only by printing a real result, not by the first tests.
Seen: js-report/lib/chat/tools.ts explain() OPEX formula (2026-10-23, uncommitted)

### CAND-004 · Drill inside a modal removes the focused row → focus falls to body · 2026-10-27 · expires 2027-01-25
A slide-over that swaps its content (loan list → client card) unmounts the focused row; focus drops to <body> while the dialog stays open. Fix: effect keyed on the content title that refocuses the close button when the panel no longer contains activeElement. Caught only by a CDP focus trace, not by tests.
Seen: js-report/components/sales/SlideOver.tsx (2026-10-27, uncommitted)

### CAND-005 · Headless check without Playwright: CDP from Node 24 (built-in WebSocket) · 2026-10-27 · expires 2027-01-25
Driving ms-playwright's chrome-headless-shell over CDP works for screenshots, scrollWidth, keyboard and focus checks. Gotcha: Input.dispatchKeyEvent Enter needs `text: '\r'` (String.fromCharCode(13)) or buttons do not activate. Script kept in the session scratchpad only.
Seen: /sales verify run (2026-10-27)

### CAND-006 · layout-spec table heights cannot fit the row count at 24 px rows · 2026-10-27 · expires 2027-01-25
Overview table 118 px = title + header + 3 rows only at 20/21 px rows; band tables 186 px fit 6 rows only at 21 px. Spec says 24 px. Used 21 px rows + in-card scroll. Watch the same arithmetic in Track B.
Seen: js-report/components/sales/sales.module.css (2026-10-27)

### CAND-007 · Context consumer outside its provider fails silently (default no-op setter) · 2026-10-27 · expires 2027-01-25
The P&L "How to read" button sat in the header, outside a PopupProvider that only wrapped the content area; the context default `setOpenId: () => undefined` made the click do nothing, with no error. Caught only by the headless click check. Fix: provider wraps header + content; reset per view/page with a `scope` prop (derived state) instead of a `key` remount. Consider throwing from the default context value in dev.
Seen: js-report/components/Shell.tsx + components/glass.tsx (2026-10-27)

### CAND-008 · eslint react-hooks/immutability flags a `let` reassigned inside `.map` in a component body · 2026-10-27 · expires 2027-01-25
"Cannot reassign variable after render completes" for a running total in a waterfall. Fix: move the accumulation into a pure module-level helper (`runningLevels(steps)`).
Seen: js-report/components/views/charts.tsx Waterfall (2026-10-27)

### CAND-009 · Global separator swap turns formula separators into minus signs · 2026-10-27 · expires 2027-01-25
A blanket sed " · " → " - " (parity rule 6) also hit ⓘ formula strings: "NR = GR + GTN - Δ = actual − comparison" reads as subtraction. Prose separator is " - "; between formulas use "; ". Caught only by reading the exported markdown (scripts/export-info-copy.ts), not by tests.
Seen: js-report/lib/engine/{vitals,analysis,profitability}.ts formula fields (2026-10-27, uncommitted)

### CAND-010 · Status banded on the raw Δ while the face shows the rounded Δ · 2026-10-27 · expires 2027-01-25
"◦ 0.0%" shown with a red/amber chip: band computed from the exact Δ, text from the rounded one. Band the displayed value (lib/sales/status.ts displayed()). Parity rows seeded from engine output had captured the bug: seed from the contract, not from the track's own result.
Seen: js-report/lib/sales/status.ts, lib/test-utils/parity/parity_selections_mirelo.csv (3 rows) (2026-10-27, uncommitted)

### CAND-011 · Splitting a sub-route out of a shared Next app: root globals leak and must be re-declared · 2026-10-28 · expires 2027-01-26
/sales lived under the P&L root layout, so it silently depended on P&L globals (`* { box-sizing }`, `button, input { font: inherit; color: inherit }`). A standalone root that drops them shifts button text/size. Fix: copy only the resets the route actually relied on (not tokens / min-width / focus colour), keep vendored files at their original relative paths so sources copy unchanged, and gate the split with a headless pixel diff against the source server at the same URLs (0 px diff on 9 URLs).
Seen: .sync/mirelo-sales/js-app/app/globals.css vs js-report/app/globals.css (2026-10-28)

### CAND-012 · Split JSX text inside an inline-flex + gap container spaces out · 2026-10-28 · expires 2027-01-26
`<span className="cnt">▲ {n} on track</span>` renders three text nodes; in an inline-flex container with `gap` each one is a flex item, so the pill is wider than the HTML prototype's. Fix: one template-string child. Caught only by the screenshot comparison with prototype.html.
Seen: js-exec/components/ExecApp.tsx status pills (2026-10-28)

### CAND-013 · Bash tool chokes on quote-heavy heredocs / node -e bodies · 2026-10-28 · expires 2027-01-26
Quoted heredocs holding TS test files or a Playwright script, and `node -e` bodies with backticks, fail with "unexpected EOF while looking for matching quote" in the harness. Write files with the Write tool (or Edit), use Bash only to run them.
Seen: js-exec test files, scratchpad checks.py, this memory update (2026-10-28)
Promoted-to: PG-005 on 2026-10-29

### CAND-014 · Component wiring tests without jsdom: renderToStaticMarkup + call the component as a function · 2026-10-29 · expires 2027-01-27
No RTL / jsdom in js-exec (new dep = ask first). Markup order/attrs via `react-dom/server` renderToStaticMarkup in the Vitest node env; handler wiring by calling the (hook-free) component and checking `el.props.children[0].props.onClick === onClose`. Needs the component to be hook-free; extract the shell (LayerFrame) to make it so.
Seen: js-exec/components/layers.test.tsx (2026-10-29)

### CAND-015 · Adding a row to a max-height pop-up silently tips one card into scroll · 2026-10-29 · expires 2027-01-27
ⓘ target line (+26 px) made only EBITDA's ⓘ scroll 15 px at 1440 × 810 (86vh cap); unit tests cannot see it. Measure scrollHeight − clientHeight for every card's pop in a headless pass after any ⓘ height change.
Seen: js-exec ExplainPop (2026-10-29)
Promoted-to: AP-001 on 2026-10-30


### CAND-016 · Retired control keys: reconcile on their as-built reading, not by exemption · 2026-10-29 · expires 2027-01-27
When the reading of a metric changes by design (exit-week mix → window shares, EBITDA PTD pair → Week only), legacy rows still in the CSV can be checked against the engine's *old* reading (Week metrics at the window's last week) instead of being skipped; only the derived statuses are skipped. Keeps the old rows useful as a regression net until they retire. The test should parse both key grammars from the CSV's own key set, so it passes before and after the data owner lands new rows.
Seen: js-exec/lib/engine/control-totals.test.ts (2026-10-29)

### CAND-017 · Inner Esc vs a document keydown listener: stopPropagation does nothing in the App Router · 2026-10-30 · expires 2027-01-28
Next.js App Router hydrates with the React root on `document`, so a React onKeyDown's `e.stopPropagation()` runs on the same node as a `document.addEventListener('keydown')` layer-close handler and cannot stop it (only stopImmediatePropagation, order-dependent). Fix used: the inner control calls `e.preventDefault()` and the document handler returns early on `e.defaultPrevented` (React's root listener is registered at hydration, before any effect).
Seen: js-exec CategoryDropdown in components/Layers.tsx + ExecApp.tsx Esc handler (2026-10-30, headless: Esc closed the whole menu)

### CAND-018 · Pack copy hazards: nested data .gitignore, gate leftovers · 2026-10-30 · expires 2027-01-28
Copying a Next app into a `.sync` pack: (1) leave out the source's `public/data/.gitignore` (`*`), or git silently ignores the shipped prebuilt data; (2) the gate re-creates `tsconfig.tsbuildinfo` (`incremental` + `tsc --noEmit`) and `next-env.d.ts` (`next typegen`) inside the pack besides node_modules / .next: all gitignored, but the folder is not clean afterwards. Lockfile after dropping a devDep: `npm install --package-lock-only --ignore-scripts`, then diff `packages` versions against the source lock (only the dropped entry may differ).
Seen: .sync/nordmark-exec/js-app (2026-10-30)

### CAND-019 · Harness blocks any command whose text holds Remove-Item next to a slash switch · 2026-10-30 · expires 2027-01-28
A PowerShell call with robocopy's `/E` switch and a Remove-Item in the same text was refused as "Remove-Item on system path '/E'" and ran nothing; the same happened to an Add-Content here-string that merely quoted that text. Run robocopy alone (quoted absolute paths; exit codes 0–7 are success, 1 = files copied, shown as "Exit code 1"); write memory / docs with Edit or Write, never via shell strings.
Seen: .sync/nordmark-exec/js-app copy + this memory write (2026-10-30)
