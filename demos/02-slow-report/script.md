# Video script · Case 2 · Slow report, live fix

Status: **draft v0.1** (2026-11-24) · target **4:05** (hard cap 5:00) · voice-over about 265 words (about 2:00 spoken); the rest is on-screen action and cut waits.
Click path: `guide.md` § 4. Numbers in `{braces}` come from `perf_log.md` (the recorded Desktop run), never from this script; the value after `≈` is the service benchmark of 2026-11-24, a reference only.

**The one claim:** your slow report might be one line of DAX.

## Before you press record

- Guide § 4 "Off camera": `Slow Report Demo.pbix` open (slow body), every visual clicked once; DAX Studio connected, Server Timings on, the copied query and `perf_test.dax` ready; `measures.dax` open for the paste.
- `perf_log.md` filled from at least one full rehearsal (guide § 3 C), so the voice-over numbers are known.

## Scenes

| # | Time | On screen | Voice-over |
|---|---|---|---|
| 1 | 0:00–0:20 | Page "Sales by brand". Click a Country in the slicer; the matrix spins. Timer overlay {≈ 26–33 s}. | "One click on this slicer, and the report stalls. Half a minute, every time someone changes a filter. Let's find out why, and fix it live." |
| 2 | 0:20–0:45 | Optimize › Performance analyzer › Start recording › click again › expand the matrix: DAX query {ms} vs Visual display {ms}. | "Performance Analyzer splits the time. Almost all of it is the DAX query. The visual itself draws in milliseconds. So the problem is in the model, not on the page." |
| 3 | 0:45–1:25 | Copy query › DAX Studio › Clear Cache then Run › Server Timings: highlight Total, the FE share, the SE query with {rows} rows. | "Copy the query into DAX Studio and turn on Server Timings. Two clues. Most of the time sits in the formula engine, which runs on a single thread. And one storage-engine query returns {rows} rows, for a matrix with only eight hundred and fifty cells. The engine is hauling data it doesn't need." |
| 4 | 1:25–2:00 | Data pane › `_Measures` › **Big Line Sales (fx)**; highlight `FILTER ( Sales, ... )`. | "The matrix uses one measure: sales from order lines worth five hundred or more. And here's the cause. FILTER over the whole Sales table. That hands CALCULATE every column of every matching row, and the engine has to build all of it first." |
| 5 | 2:00–2:40 | The optimized body next to the slow one. DAX Studio: `perf_test.dax` block 1 `[Slow]`, then block 2 `[Fast]`, each Clear Cache then Run. Caption: **{slow} s → {fast} s**. | "The fix: filter only the two columns the condition needs. KEEPFILTERS keeps the filters that are already there, exactly like before. Same query, both versions, cold cache. {slow} seconds before. {fast} seconds after." |
| 6 | 2:40–3:00 | Block 3 (difference query): no rows. | "Faster is useless if the numbers change. This query compares both versions cell by cell. Zero rows. They match exactly." |
| 7 | 3:00–3:30 | Paste the optimized body into Big Line Sales (fx) › Enter. Click the same Country: the matrix redraws at once; the Big Line Sales (fx) card is unchanged. | "Paste the new formula into the model. Same slicer, same click. Instant. And the total hasn't moved." |
| 8 | 3:30–3:50 | Block 4 (search query): the measures that contain FILTER. | "One last query lists every measure in the model that uses FILTER. On a client model, that list is the tune-up backlog." |
| 9 | 3:50–4:05 | Closing card: **Model tune-up · 3 to 5 days · $900**. | "If your reports feel slow, it might be one line of DAX. A model tune-up takes three to five days." |

## Edit notes

- **Cut the waits.** Scenes 1 and 3 each wait half a minute on a cold run. Keep the first two seconds of the spinner and the timer jump; drop the middle. The caption carries the real number.
- **Scene 5 is the money shot.** Both timings on one frame. If {fast} is under 0.1 s, say "a fraction of a second" instead of the number.
- **Say the measured numbers, not the spec's.** The spec expected 3–20 s; the shared 30 M-row data runs slower (accepted 2026-11-24). Fill every `{…}` from `perf_log.md`.
- Never Ctrl+S during a take; reset = close without saving and reopen (guide § 4).

## Blur in post

Account name in Desktop's top-right corner and in DAX Studio's connection bar; the SQL endpoint host if Transform data or Data source settings show it.
