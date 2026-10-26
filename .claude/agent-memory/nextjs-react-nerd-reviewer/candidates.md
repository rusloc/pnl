<!-- next-id: CAND-007 -->

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
