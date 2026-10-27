# Recorded provider responses

Chat-completions response bodies the `chatTurn` handler tests replay (no network).

Status: **shaped per the Azure OpenAI chat-completions reference** (api-version
2024-10-21), written by hand on 2026-10-23 because no resource existed yet. Once
the Azure OpenAI deployment is up, replace each file with a real capture of the
same golden question (same file name) and re-run `npm test`; the assertions
check tool names and arguments, not wording.

| File | Golden question | Expected |
|---|---|---|
| `q1-commerce-cloud-q3.json` | "How did Commerce Cloud do in Q3 against budget?" | one `get_kpis` call, `entity: S`, `time_view: qtd`, `compare_a: BUD` |
| `q2-why-revenue-above-budget.json` | "Why is net revenue above budget?" | one `get_bridge` call, no filter change |
| `q3-two-companies.json` | "Compare gross margin of both companies" | two `get_statement` calls, `entity: P` and `entity: S` |
| `q4-answer-after-tools.json` | the model's answer once tool results are in | `answer` |
| `q5-off-topic.json` | "What is the weather in Oslo?" | `answer` (a refusal, no tool call) |
| `q6-content-filter.json` | any | `error` / `filtered` |
| `q7-unknown-tool.json` | any | the unknown call is dropped; the valid one stays |
| `q8-too-many-calls.json` | any | capped at 4 calls |
