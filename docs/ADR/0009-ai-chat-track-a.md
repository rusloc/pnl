# ADR-0009 — AI chat ("talk to the P&L") across the three tracks

- **Status:** accepted with the USER's decisions in §8 (2026-10-23). Drafted by the main agent; research by fin, bip and archi.
- **Date:** 2026-10-23
- **Decider:** USER
- **Inputs:** fin (Rayfin SDK 1.36.2 verification, plan), bip (Power BI Copilot assessment), archi (sovereign LLM for Track C); coms 2026-10-21 §27/§29 and 2026-10-23 §5. Sources are listed in the agents' reports in the coms log; items marked _(unconfirmed)_ came from secondary sources.
- **Requirement (USER):** a clean, scalable chat that respects each user's RLS; Copilot for the Power BI report; a sovereign LLM for the public JS report; a plan for the Rayfin app chat.
- **Spec:** `docs/Requirements.md` N-04 (RLS), §7 (one calculation implementation). Not in the spec yet: a chat requirement block and tests follow on acceptance.

## 1. One pattern, three hosts

Every track uses the same shape (option C of the first draft): **the LLM never touches data.** It sees the conversation and a closed list of tools; the client runs every tool call against the track's own engine or model (as the signed-in user where there is one) and sends back capped results. Every number in an answer comes from a tool result, so the chat shows the same numbers as the views.

| Track | Where the LLM call lives | Where tools run | Who sees the chat | RLS |
|---|---|---|---|---|
| **A · Rayfin app** | Rayfin function (UDF), TypeScript on the Node functions host | browser → delegated `pnlModel` connector (DAX, as the user) | signed-in Entra users only (the app is not publicly embeddable) | holds by construction: a UDF has no semantic-model audience at all |
| **B · Power BI report** | Microsoft Copilot (no custom LLM) | Copilot's own DAX on the model, as the user | signed-in users only; **no Copilot chat works for anonymous visitors** | holds for answers; **not** for verified answers (preview caveat) |
| **C · JS report (public)** | relay function in the **vosk.dev repo** (Vercel), key in its env vault | visitor's browser → Track C's pure-TS engine | anonymous visitors on vosk.dev/work | n/a (public dummy data) |

## 2. Track A — Rayfin app (fin, verified on SDK 1.36.2)

- **Runtime:** Rayfin functions are **TypeScript on the Node 20/22/24 functions host** (`@microsoft/fabric-user-data-functions` 1.36.2), not Python. Enabled with `npm run pack:add -- functions` (`services.functions` with `auth.type: application`; applied only by a **full** `npx rayfin up`, later `npx rayfin up functions deploy`). Never `npx rayfin functions init` in this template.
- **Invocation:** `client.functions.chatTurn.invoke(params, { timeoutMs })` = one JSON POST; **no streaming**. Limits: request 4 MB, response 30 MB, client clamp 250 s, documented execution 240 s (100 s via a public endpoint). Budget: LLM call ≤ 60 s, turn ≤ 90 s.
- **Auth:** every invoke carries the user's Rayfin session token, but there is **no per-function authorization** and the UDF can't see the caller's Entra identity → abuse control = vendor quota + budget alert + a coarse limiter.
- **Outbound identity:** `ctx.Tokens.<Audience>` = the app item owner. Harmless here: the call carries messages only. `AudienceType` has no semantic-model member, so the UDF **cannot** read the model.
- **Secrets:** `rayfin.yml` `secrets:` (name + description), value via `npx rayfin secret set NAME` after a deploy, read as `ctx.Secrets.NAME`. Not needed on the Entra path.
- **Tools** (all builders exist in `pnl-model-queries.ts`; a tool call on the current filters is a cache hit): `get_statement` (Q1 + `derive.ts`, ≤ 30/50 rows), `get_kpis` (Q2a/Q2b, 12), `get_bridge` (Q3, ≤ 20), `get_largest_variances` (Q4, 8), `get_profitability` (Q5, ≤ 25), `get_context` (Q6), `explain_line` / `explain_kpi` (reference data, no query). Arguments = a `FilterState` patch validated against `ReferenceData` (hand-written validators, no new dependency); unspecified fields inherit the user's current filters. Tool definitions shared in `packages/shared`. "Open in view" dispatches the validated filters and switches the view.
- **Guard:** a build-stage script fails if `chatTurn` declares any audience other than `AzureAI`, calls `getDataClient`, uses `Tokens.Sql/Storage/Fabric`, or fetches any host but the one LLM endpoint.
- **Vendor:** recommended **Azure OpenAI, Data Zone EU deployment, Entra path** (`AudienceType.AzureAI`, owner gets *Cognitive Services OpenAI User*, no key exists). Needs an Azure subscription in the tenant. Fallback: **Mistral La Plateforme** via `rayfin secret` (EU provider, bearer key), which is also Track C's vendor.
- **Plan (~3.5–4 d after decisions):** enable functions + client generics (0.25 d) → install Azure Functions Core Tools v4, typegen, `chatTurn` handler with tests (1 d) → tool-args validator + runner + golden question → tool-call cases (1 d) → chat panel, result cards, Open in view, states (1 d) → guard script (0.25 d) → gate, dry-run, full `up`, RBAC or secret, deployed smoke (0.25 d).

## 3. Track B — Power BI Copilot (bip)

- **No public Copilot.** Publish to web: none. Embed for customers (app-owns-data): no Copilot pane; only the Copilot **narrative visual** (a canned, author-defined summary; preview; CU on every page load). Secure embed has the pane but needs Entra sign-in. → On vosk.dev, Copilot is a **recorded demo** (60–90 s + screenshots), labelled "signed-in feature".
- **Requirements:** capacity **F2+** (not F64; F64 only matters for Free-licence viewers); tenant setting on; Q&A on in the model; North Europe is inside the EU Data Boundary (no cross-geo switch). Cost: 100 / 10 / 400 CU-s per 1k input / cached / output tokens, background-smoothed; marginal on F64.
- **Main risk:** our window logic runs through disconnected parameter tables and `ALL ( dim_month )`; Copilot writes its own DAX and ignores slicers, so a question like "Commerce Cloud Q3" can silently return the default window.
- **Preparation P1 (~3–3.5 d, recommended):** "Prep data for AI" — AI data schema with the user-facing measures only (versions, subtotals, `KPI *`, `Bridge *`, `Prof *`, `PL *`, `LV *` + readable dims and the steering parameter tables; exclude Design / Engine / colour / context / switch measures and technical tables), AI instructions (metric, window, version, entity, units and sign rules from §7), 6–8 verified answers on a plain "AI" page (no slicers, no hidden fields), synonyms, "Approved for Copilot". Verified answers and the Prep dialog are authored by the USER in Desktop / the service (no PBIP / CI path).
- **P2 (+2–3 d, needs its own ADR):** a few Copilot-friendly measures that respect `dim_month` / `dim_entity` / `dim_version` filters directly.
- **Watch:** Q&A retirement (Dec 2026 or Feb 2027, sources conflict) with a replacement setting promised; several features in preview; English only.
- **Fabric data agent** over the model is optional (0.5 d) for the same signed-in demo; it is not a public option either.

## 4. Track C — JS report with a sovereign LLM (archi)

- **Architecture:** relay `POST /api/pnl-chat` in the **vosk.dev repo** (Vercel function; preferably same-origin with the vendored Track C app, so no CSP/CORS change). It checks the kill switch, spend counter and limits, adds the system prompt and the tool definitions, strips client system roles, trims history, calls the LLM and streams back text or tool calls. The browser validates arguments with Track C's selection codec, runs the engine, caps results (≤ 60 rows), and loops (≤ 3 steps, ≤ 4 tool calls per turn).
- **This repo** adds only `js-report/lib/chat/tools.ts` (closed tool set, Zod schemas via the existing codec, `runTool`, JSON-Schema export, golden tests) + `system-prompt.ts` + a `.sync/` contract. No backend here (ADR-0002 holds); the chat panel and relay are built in the vosk.dev repo. Four of six tools need Track C's views 2–4 (slices 6–8), which aren't built yet.
- **Sovereignty levels:** L1 EU residency at a US provider (Azure EU Data Zone, Claude on Bedrock/Vertex EU) · L2 EU provider on EU metal · L2+ EU provider and EU-made model · L3 self-hosted open weights (≈ €1,100–2,400 / month, out of proportion).
- **Recommended:** **Mistral La Plateforme**, Medium 3.5 (A/B against Large 3 at $0.50 / $1.50 per M tokens on 30 golden questions), training opt-out + zero data retention requested (L2+). **Fallback:** **Scaleway Generative APIs** (Paris), same model, zero data retention by default; switching is an env change. Budget model for the soft cap: Mistral Small.
- **Guard rails:** kill switch; monthly spend counter (soft cap → budget model, hard cap → "chat paused"); per-IP and per-session limits; message ≤ 1,000 chars, request ≤ 16k chars; ≤ 600 output tokens per turn; closed tools, no free-form queries, deep links built from validated arguments; logs without message text (hashed IP, tokens, cost, tool names); privacy + EU AI Act transparency notice ("AI assistant").
- **Cost** (500 conversations × 6 turns ≈ 36 M input / 1.5 M output tokens): Medium 3.5 ≈ $40–65 / month, Large 3 ≈ $20, Small ≈ $6; Vercel and Upstash within free tiers. Suggested cap: $50 hard / $40 soft.
- **Effort:** ~4.5–5 d, ~1.5 d in this repo.

## 5. Vendors in one view

| Track | Primary | Fallback | Sovereignty |
|---|---|---|---|
| A | Azure OpenAI, Data Zone EU, Entra (no key) | Mistral La Plateforme (key via `rayfin secret`) | L1 (Azure) / L2+ (Mistral) |
| B | Microsoft Copilot in Power BI | — | EU Data Boundary (Microsoft) |
| C | Mistral La Plateforme | Scaleway Generative APIs | L2+ / L2 |

If one sovereign vendor for A and C matters more than "no secrets in A", use Mistral in both (one integration style, bearer key).

## 6. Consequences

- New runtime pieces: Rayfin functions in Track A (one UDF, Core Tools v4 locally), a relay + rate-limit store in the vosk.dev repo, LLM spend. New dependencies need the USER's yes: in vosk.dev `ai`, `@ai-sdk/react`, `@ai-sdk/mistral`, `@ai-sdk/openai-compatible`, `@upstash/ratelimit`; none in this repo.
- Tool calls cost about one view query each: build Track A's chat after the ADR-0008 speed-ups.
- Track C's chat depends on Track C's views 2–4.
- New tests per track: argument validation (unknown entity, open month under Actual, slices in Group), golden question → tool-call cases, "numbers only from tools", and for A the no-data-access guard.
- The first draft's §3.6 ("Track C gets no chat") is reversed by the USER's request.

## 7. Open questions for the USER

1. Accept the pattern for all three tracks (§1)?
2. **Track A vendor:** Azure OpenAI EU Data Zone (needs an Azure subscription in the tenant; no key) or Mistral (key)? Is there an Azure subscription?
3. **Track C vendor and cap:** Mistral primary + Scaleway fallback, $50 hard / $40 soft per month?
4. **Track B:** recorded Copilot demo with P1 prep (~3–3.5 d), or P2 as well (+2–3 d, ADR)? Run the demo on the RAW dev capacity or wait for the publishing capacity?
5. **Order:** after ADR-0008 (recommended for A); Track C chat after its views 2–4. Install Azure Functions Core Tools v4 locally (needed for A)?

## 8. Decisions (USER, 2026-10-23)

1. **Pattern accepted** for the tracks that get a chat; build lanes run in parallel.
2. **Track A (Rayfin app):** Azure / Azure OpenAI in the backend (Data Zone EU deployment, Entra auth from the Rayfin function, no API key), with data privacy maximised: no prompt or answer logging in the function, tool results capped and aggregated, key-based auth disabled on the resource, the provider's data-retention and abuse-monitoring options set to the strictest available (modified abuse monitoring / zero retention needs a Microsoft approval; applied for, not assumed).
3. **Track B (Power BI report):** no AI chat for the embedded showcase; the report stays as is. Fabric / Microsoft AI is acceptable later, for signed-in use.
4. **Track C (JS report):** a third-party LLM, as cheap as possible; answer quality is not the goal (this tests the setup and the flow). Preferred: a small open-weight model on a self-hosted VM; a cheap EU API (e.g. Mistral free / small tier, OVH or Scaleway small models) is the fallback. The relay and the VM live outside this repo (vosk.dev repo / the USER's hosting); this repo delivers the tool layer and the `.sync/` contract.
5. **Order:** build now, in parallel lanes (A: fin; C: nerd + archi; B: none). Track C ships with the tools whose views exist (statement, line definitions) and adds the others as its views 2–4 are built.
6. **Track C limits tightened for a CPU-only backend (2026-10-23, as built):** ≤ 30 rows and ≤ 1,600 characters per tool result, ≤ 300 output tokens per model call, history trimmed to the last 6 messages, fixed prefix (system prompt + tool schemas) ≈ 900 tokens of a 1,200 budget, default statement = the 8 subtotals; the relay **rejects** a client-supplied system role (stricter than "strips"). Contract: `.sync/2026-10-23-track-c-chat-contract.md`, `.sync/track-c/chat-tools.json`; backend: `.sync/2026-10-23-track-c-chat-backend.md`.
