# Video script · Case 1 · Power BI to Fabric migration (Import vs Direct Lake)

Status: **draft v0.1** (2026-11-24) · target **4:30** (hard cap 5:00) · voice-over about 380 words (about 2:50 spoken); the rest is on-screen action, waits and pauses.
Click path and fallbacks: `guide.md` § 4. Numbers in `{braces}` come from the recorded run (`run_log.md`), never from this script; the value after `≈` is today's reference only.

**The one claim:** after migration, new data shows up in seconds, with no refresh to wait for.

## Before you press record

- Guide § 4 "Off camera": both reports side by side and warm, `nb_02_append_day` session started, stopwatch overlay ready.
- `Sales Import.pbix` open in Desktop for the B-roll (guide § 3 A); `nb_01_build_sales_demo` open at cell 3.
- Record the Import refresh in full; the edit compresses it (scene 6).

## Scenes

| # | Time | On screen | Voice-over |
|---|---|---|---|
| 1 | 0:00–0:20 | Split screen: `Sales Import` (grey bar) left, `Sales Direct Lake` (green bar) right. Cards match: Sales Amount (fx) {≈ $19,476,577,851}, Order Lines (fx) {≈ 30,000,000}, Last Order Date (fx) {≈ 31 Oct 2026}. | "Same report, same thirty million order lines, built twice. On the left, a classic Power BI Import model. On the right, the same report after migration to Microsoft Fabric, running on Direct Lake. Right now the numbers match. Let's see what happens when new data arrives." |
| 2 | 0:20–0:40 | `nb_02_append_day` › Run all › output `Appended 50,000 lines for 2026-11-01`. | "This notebook is our nightly load. It writes one new day, fifty thousand order lines, into the lakehouse." |
| 3 | 0:40–1:05 | Right report › Refresh: Last Order Date (fx) 01 Nov 2026, Order Lines (fx) {≈ 30,050,000}, Data As Of (fx) = now. Caption: **Direct Lake: {n} s**. | "Refresh the Direct Lake report, and the new day is already there. Last order date, line count, timestamp: all updated within seconds. Direct Lake doesn't copy the data. It reads the Delta tables in OneLake and simply picks up the new version." |
| 4 | 1:05–1:20 | Left report › Refresh: nothing changes. | "The Import report still shows yesterday. It holds its own copy of the data, and that copy is only as fresh as its last refresh." |
| 5 | 1:20–1:35 | Workspace › `Sales Import` (semantic model) › Refresh now. Stopwatch starts. | "So let's refresh it. All thirty million rows get copied again. While that runs, here's what actually changes in a migration." |
| 6 | 1:35–2:50 | B-roll, stopwatch in the corner (time-lapse): Power Query › Customer (Merged Columns), Sales (Added Net Amount, Added Cost Amount); Product › **Price Band** column formula; **Date** table formula; then `nb_01_build_sales_demo` cell 3. | "The Import model does its shaping inside Power BI. Power Query merges first and last names and adds net and cost amounts. A DAX column sorts products into price bands. A DAX table builds the calendar. Direct Lake tables have no Power Query, so that logic moves upstream. One notebook cell now does all of it, once, in the lakehouse, and every model that reads these tables gets the same result. For bigger models, Semantic Link Labs can script this migration. Here every step was done by hand, so you can see it." |
| 7 | 2:50–3:20 | Overlay card, four rows: Refresh · Editing · First query · Licence (Import vs Direct Lake). | "A few more things change. Refresh becomes framing: reading metadata, in seconds. You edit the model live in the workspace instead of a local file. The first query after a change is a bit slower, because columns load from OneLake on demand. And Direct Lake needs a Fabric capacity." |
| 8 | 3:20–3:50 | Settings › Refresh history: duration {≈ 4 min 55 s}. Caption: **Import: {m:ss} · Direct Lake: {n} s**. Refresh left report: both match. | "The Import refresh is done. Almost five minutes, against a few seconds for Direct Lake. And both reports agree again." |
| 9 | 3:50–4:15 | Split screen again; highlight the measures list and the visuals. | "What stays the same? The DAX measures, the relationships, every visual. The Direct Lake report is a copy of the Import report, pointed at the new model. Nothing was rebuilt. And Import isn't dead: it's still the right choice for some models, and one model can now mix both." |
| 10 | 4:15–4:30 | Closing card: **Migration Assessment · 1 week · $1,200**. | "Want to know what moving your models would take? A Migration Assessment takes one week." |

## Edit notes

- **Scene 6 is a time-lapse.** The real Import refresh ({≈ 295 s}) is longer than the slot. Keep the stopwatch visible, speed the middle up, and add a small "sped up" tag; scene 8 shows the real duration.
- **Scene 3 timing is the money shot.** If the Direct Lake update takes more than about 20 s, cut the wait but keep the caption honest ("{n} s").
- Captions on screen: only the two timings and the card numbers. Everything else is voice-over.

## Blur in post

Tenant and account name, workspace and item IDs in the address bar, the SQL endpoint host if Power Query settings show it.
