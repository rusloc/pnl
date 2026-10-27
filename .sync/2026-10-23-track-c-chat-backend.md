# Track C chat — LLM backend for the relay (cheapest viable: self-hosted CPU VM, EU API fallback)

- **From:** rusloc/pnl (Track C, archi)
- **To:** vosk.dev repo agent (relay + hosting) · the USER (VM and accounts)
- **Date:** 2026-10-23
- **Status:** ready (prices checked 2026-10-23; items marked *unconfirmed* come from secondary sources or pages that did not load)

Companion of `2026-10-23-track-c-chat-contract.md` (nerd: the tool contract — OpenAI-compatible `chat/completions` with `tools`). This note picks the thing on the other end of `LLM_BASE_URL`. Decision context: ADR-0009 §8.4 in rusloc/pnl — a third-party LLM, as cheap as possible; answer quality is not the goal (the chat tests the setup and the flow; hallucinations are acceptable); preferred a small open-weight model on a self-hosted VM, fallback a cheap EU API. Sources of truth stay in rusloc/pnl (`docs/ADR/0009-ai-chat-track-a.md`, `docs/ADR/0002-track-c-architecture.md`). No secrets, keys, hostnames or account IDs in this file.

## 0. Summary

| | Primary | Fallback |
|---|---|---|
| What | Hetzner Cloud **CX33** (4 shared x86 vCPU, 8 GB, €8.99/month excl. VAT) running **llama.cpp `llama-server`** (CPU Docker image) with **Qwen3-4B Q4_K_M** (fallback model on the same box: Qwen3-1.7B) | **OVHcloud AI Endpoints** `gpt-oss-20b` (€0.04 / €0.15 per M tokens in/out) or **Scaleway Generative APIs** `mistral-small-3.2-24b-instruct-2506` (€0.15 / €0.35; zero data retention by default; first 1 M tokens free) |
| How the relay reaches it | `LLM_BASE_URL=https://<vm-host>/v1`, bearer `LLM_API_KEY`, `LLM_MODEL` = the loaded model's name; OpenAI chat-completions with `tools`, `stream: true` | same four env vars, different values; switching is a redeploy of the relay, no code change |
| Latency per turn (2 model calls) | **≈ 20–60 s** with the prompt-prefix cache warm; worse cold (see §1.3) — *estimates, measure on the box* | 1–4 s |
| Concurrency | 1–2 slots; the relay must return 429 "busy" beyond that | provider-side limits |
| Monthly cost | **≈ €9 (≈ €10.70 incl. VAT)**, flat | ≈ €1–6 at the ADR-0009 volume (500 conversations × 6 turns), €0 while inside Scaleway's free 1 M tokens / OVH's $200 first-month credit |

Honest note on cost: at this traffic the API fallback alone is cheaper than the VM. The VM is the pick because the USER prefers self-hosting (ADR-0009 §8.4); it is not the cost-minimal choice.

## 1. Self-hosted option (primary)

### 1.1 VM — price comparison (EU, CPU only, prices excl. VAT, checked 2026-10-23)

| Provider · plan | Arch | vCPU | RAM | Disk | €/month | Notes |
|---|---|---|---|---|---|---|
| **Hetzner CX33** | x86 shared | 4 | 8 GB | 80 GB NVMe | **8.99** | official page; 20 TB traffic; "incl. IPv4". The page showed every plan as "currently unavailable" to an anonymous visitor — *check stock in the console* |
| Hetzner CX23 | x86 shared | 2 | 4 GB | 40 GB | 5.99 | fits Qwen3-1.7B comfortably, Qwen3-4B tightly (2.5 GB weights + KV + OS); half the speed of CX33 |
| Hetzner CAX21 | ARM Ampere Altra (Neoverse-N1) | 4 | 8 GB | 80 GB | 10.99 | llama.cpp has good NEON kernels; no published tokens/s for CAX — *unconfirmed* whether it beats CX33 |
| Hetzner CAX11 | ARM | 2 | 4 GB | 40 GB | 6.49 | as CX23 |
| Netcup VPS 500 G12.5 | x86 | 2 | 4 GB | 64 GB | 8.26 (12-month term) | official page; 1/12/24-month terms |
| Netcup VPS 1000 G12.5 | x86 | 4 | 8 GB | 128 GB | 14.50 (12-month term) | official page |
| OVHcloud VPS-1 ("VPS 2027") | x86 | 2 | 4 GB | 40 GB | £3.31 (≈ €3.9) | official en-gb page, "from" price, 12-month upfront implied — *EUR price unconfirmed* |
| OVHcloud VPS-2 | x86 | 4 | 8 GB | 75 GB | £6.29 (≈ €7.4) | same caveats |
| Scaleway DEV1-S / STARDUST | x86 | 2 / 1 | 2 GB / 1 GB | — | ≈ €7 / ≈ €1.8 | *third-party prices*; RAM too small for a 4B model |

Pick: **Hetzner CX33** — cheapest 4 vCPU / 8 GB with hourly billing and no term; OVH VPS-2 is ≈ €1.5 cheaper but wants a 12-month commitment and the EUR price is unconfirmed. If stock is the problem, CAX21 is the same money class.

### 1.2 Server software — `llama-server` over Ollama

| | llama.cpp `llama-server` (recommended) | Ollama |
|---|---|---|
| OpenAI `/v1/chat/completions` with `tools`, streaming | yes (tools need `--jinja`, which is on by default in current builds) | yes |
| API key | built in: `--api-key` / `LLAMA_API_KEY` (bearer) | none built in — needs the reverse proxy to enforce auth |
| Prompt-prefix cache (the thing that makes CPU bearable) | per slot, automatic for a shared prefix; `--cache-reuse` for partial reuse | yes, but less controllable |
| Model download | `-hf Qwen/Qwen3-4B-GGUF:Q4_K_M` at start, cached in a volume | `ollama pull qwen3:4b` |
| Footprint | one static binary in the official CPU image `ghcr.io/ggml-org/llama.cpp:server` | Go daemon + model store |
| Known gaps | named `tool_choice` ignored in at least one tested build (*single report*); llama.cpp b8429 misdetected `Qwen3-4B-Instruct-2507` as a thinking model so tool calls landed in `reasoning_content` (GitHub issue) → use the hybrid `Qwen3-4B` with the reasoning budget set to 0, not the `-Instruct-2507` GGUF, or verify on the build you pull | Qwen3.5 GGUFs do not work in Ollama yet (separate mmproj files, per Unsloth docs); `phi4-mini` tools need Ollama ≥ 0.5.13 |

### 1.3 Model — which small models call tools today

| Model (GGUF, Q4_K_M) | Size on disk | Tool calling in llama-server | Tool calling in Ollama | Verdict |
|---|---|---|---|---|
| **Qwen3-4B** (hybrid think/no-think) | 2.5 GB | yes — Hermes-style template handled natively (llama.cpp lists "Hermes 2/3, Qwen 2.5"; Qwen3 uses the same tool format); run with `--reasoning-budget 0` | `qwen3:4b`, tagged `tools` | **primary**: best tool reliability of the ≤ 4B set |
| **Qwen3-1.7B** | 1.4 GB | yes, same template | `qwen3:1.7b`, tagged `tools` | **speed fallback** on the same VM (≈ 2× faster, more wrong arguments — acceptable per §8.4) |
| Llama 3.2 3B | 2.0 GB | yes — native "Llama 3.2" handler | `llama3.2:3b`, tagged `tools` | works; weaker JSON argument discipline than Qwen3 in community reports — *unconfirmed* |
| Phi-4-mini 3.8B | 2.5 GB | generic handler (no native entry in llama.cpp's list) | `phi4-mini`, tagged `tools` (Ollama ≥ 0.5.13) | works but slower per token than Qwen3-4B for the same size; no advantage |
| SmolLM3 3B | ≈ 1.9 GB | generic/chatml handler | no `smollm3` page on ollama.com (404 on 2026-10-23) | skip — least tooling support |
| Qwen3.5 0.8B / 2B / 4B | 0.6–2.5 GB | GGUFs exist (Unsloth); tool support at these sizes *unconfirmed*; not in Ollama | — | watch, not now |
| gpt-oss-20b | ≈ 12 GB (MXFP4) | native Harmony handler | yes | too big for an 8 GB box; this is the API-fallback model instead |

**Expected speed on CX33 (4 shared x86 vCPU)** — *estimates*, extrapolated from a CPU-only laptop test (i5, 12 GB: Phi-4-mini 3.8B ≈ 6.9 tok/s generation / 20 tok/s prompt processing; Granite 3B ≈ 8.5–9 tok/s; Qwen3-0.6B ≈ 35 tok/s) and an older-Xeon VM study (Llama-3.2-1B ≈ 25 tok/s, Qwen2.5-7B ≈ 8 tok/s). Shared cloud vCPUs are weaker than a desktop core, so:

| | Qwen3-4B Q4_K_M | Qwen3-1.7B Q4_K_M |
|---|---|---|
| Generation | 4–8 tok/s | 10–18 tok/s |
| Prompt processing | 20–50 tok/s | 50–120 tok/s |

**Turn latency model** (per the contract's two model calls per turn: 1) tool call, 2) answer). Assumes the contract keeps the fixed prefix (system prompt + 6 tool definitions) ≤ ~1,200 tokens, trims history to the last 6 messages, caps a tool result at ≈ 400 tokens and the answer at 300 tokens:

| Phase | Qwen3-4B | Qwen3-1.7B |
|---|---|---|
| Call 1: new user text (≈ 50–150 tokens) on a cached prefix + tool-call generation (≈ 60 tokens) | 8–15 s | 4–7 s |
| Call 2: tool result (≈ 400 tokens) prompt processing + answer (≈ 200 tokens) | 30–50 s | 12–22 s |
| **Warm turn total** | **≈ 40–60 s** | **≈ 15–30 s** |
| Cold prefix (first request after a restart, or slot evicted): + 1,200 tokens of prompt processing | + 25–60 s | + 10–25 s |

Consequences for the relay and the contract (please keep consistent in `2026-10-23-track-c-chat-contract.md`):
- Stream everything; show the tool call as soon as it arrives (the browser runs the engine in ms, so the visible wait is all LLM).
- Relay timeout ≥ 120 s per model call (Vercel fluid compute allows 300 s default); client-side "this assistant runs on a small CPU model, answers take up to a minute" copy.
- Short fixed prefix: every 100 tokens of system prompt or tool schema cost ≈ 2–5 s on a cold slot. Terse tool descriptions, enums instead of prose, no examples in the schemas.
- `parallel_tool_calls: false`, `tool_choice: "auto"` (do not rely on named `tool_choice`), `temperature` ≈ 0.2, `max_tokens` 300.
- Concurrency: `-np 2` with `-c 8192` (4,096 tokens per slot) is enough for a showcase; the relay should count in-flight requests and answer 429 "the assistant is busy, try again in a minute" when both slots are taken. Two warm slots mean the prefix is cached twice (once per slot), which is the point.
- If 4B latency is judged too slow for the demo, switch `LLAMA_ARG_HF_REPO` to `Qwen/Qwen3-1.7B-GGUF:Q4_K_M` and restart (same relay config).

### 1.4 Setup steps (USER runs them; nothing here is executed from the repos)

1. **Create the VM**: Hetzner Cloud → CX33, Ubuntu LTS, a Hetzner Cloud Firewall with inbound **443/tcp from anywhere** and **22/tcp from the USER's IP only**; nothing else inbound. (Vercel functions have no fixed egress IPs on Hobby/Pro, so the relay cannot be IP-allow-listed; the bearer key plus TLS is the boundary. If the vosk.dev project ever gets Secure Compute/static egress, narrow 443 to those IPs.)
2. **DNS**: an `A` record for a sub-domain of the USER's domain → the VM's IPv4 (needed for automatic TLS). The hostname goes into the relay's `LLM_BASE_URL` only, never into the repos.
3. **Docker + compose**: `apt install docker.io docker-compose-plugin`; `unattended-upgrades` on; a non-root user in the `docker` group.
4. **`docker-compose.yml`** (two services, one network; the model server is not published on a host port):

```yaml
services:
  llm:
    image: ghcr.io/ggml-org/llama.cpp:server          # CPU image
    restart: unless-stopped
    environment:
      LLAMA_ARG_HF_REPO: Qwen/Qwen3-4B-GGUF:Q4_K_M   # or Qwen/Qwen3-1.7B-GGUF:Q4_K_M
      LLAMA_ARG_HOST: 0.0.0.0
      LLAMA_ARG_PORT: "8080"
      LLAMA_ARG_CTX_SIZE: "8192"                     # total; split across slots
      LLAMA_ARG_N_PARALLEL: "2"
      LLAMA_ARG_THREADS: "4"
      LLAMA_ARG_THINK_BUDGET: "0"                    # Qwen3 hybrid: no <think> blocks
      LLAMA_API_KEY: ${LLM_API_KEY}                  # from an untracked .env on the VM
      HF_HOME: /models
    command: ["--jinja", "--cache-reuse", "256", "--metrics"]
    volumes: [ "models:/models" ]
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:8080/health"]
      interval: 30s
      timeout: 5s
      retries: 5
  proxy:
    image: caddy:2
    restart: unless-stopped
    ports: [ "443:443", "80:80" ]                    # 80 only for the ACME challenge
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
    depends_on: [ llm ]
volumes: { models: {}, caddy_data: {} }
```

`Caddyfile` (automatic Let's Encrypt; a second gate on top of llama-server's bearer check, and long timeouts for CPU generation):

```
<llm-hostname> {
  @noauth not header Authorization "Bearer {env.LLM_API_KEY}"
  respond @noauth 401
  reverse_proxy llm:8080 {
    transport http { response_header_timeout 300s }
    flush_interval -1          # stream SSE chunks immediately
  }
}
```

5. **First start**: `docker compose up -d` — the model (2.5 GB) downloads into the `models` volume once; `docker compose logs -f llm` until `/health` is OK. Check `curl -s https://<host>/props | jq .chat_template` contains a tools section and the log says `Chat format: Hermes 2 Pro` (native) rather than `Generic`.
6. **Smoke test** from a laptop with the OpenAI SDK or curl: one `chat/completions` with `stream: true` and one tool in `tools`; expect a `tool_calls` delta with valid JSON arguments. Then `llama-bench`-style timing: time a 1,200-token prompt cold, then the same prompt again (should drop to under 2 s of prompt time — proves the prefix cache).
7. **Ops**: `restart: unless-stopped` + Docker's systemd unit = auto-restart on crash and reboot; Hetzner's console graph or `/metrics` for load; rotate `LLM_API_KEY` by editing the VM's `.env` and the Vercel env together. Reboot monthly after kernel updates (unattended-upgrades does not reboot by default).

### 1.5 How the relay calls it

The relay (vosk.dev repo, `POST /api/pnl-chat`) already speaks OpenAI chat-completions per the contract. Only env differs:

| Env (relay, server-side) | Self-hosted value |
|---|---|
| `LLM_PROVIDER` | `openai-compatible` |
| `LLM_BASE_URL` | `https://<llm-hostname>/v1` |
| `LLM_API_KEY` | the VM's bearer key |
| `LLM_MODEL` | any string — llama-server serves one model and echoes the name; use the GGUF name for logs |

Request shape (unchanged from the contract): `messages`, `tools` (JSON Schema), `tool_choice: "auto"`, `parallel_tool_calls: false`, `stream: true`, `max_tokens`, `temperature`. Response: SSE deltas with `tool_calls` or `content`; `finish_reason: "tool_calls"` ends call 1. With the AI SDK, `@ai-sdk/openai-compatible` → `createOpenAICompatible({ baseURL, apiKey })` covers this; no vendor SDK needed.

## 2. API fallback (cheapest EU, free or near-free)

| Provider · model | Price per M tokens (in / out) | Free tier | Tool calling | Data terms | Limits / caveats |
|---|---|---|---|---|---|
| **OVHcloud AI Endpoints · `gpt-oss-20b`** (Gravelines, FR) | **€0.04 / €0.15** (official catalogue) | anonymous use with a per-IP, per-model requests-per-minute cap (numbers not published); $200 credit for a first Public Cloud project, valid one month (official page) | yes (catalogue) | "data is not stored or shared during or after model use" (official docs); DPA detail not found | cheapest; OpenAI-compatible; `gpt-oss-120b` at €0.08 / €0.40 if 20b misfires on tools |
| **Scaleway Generative APIs · `mistral-small-3.2-24b-instruct-2506`** (Paris) | **€0.15 / €0.35** (official page) | first 1 M tokens free; batch −50 % | yes (official supported-models page) | **zero data retention by default**, no training, prompt content not logged (official data-privacy page) | best terms; also `gpt-oss-120b` €0.15 / €0.60, `qwen3.6-35b-a3b` €0.25 / €1.50 |
| IONOS AI Model Hub · `Qwen3.5-9B` (DE) | £0.09 / £0.13 (official GBP list) | none found | expected (OpenAI-compatible) — *unconfirmed* | EU DCs; retention terms not found | fine third option |
| Mistral La Plateforme · **Experiment (free) plan**, `mistral-small-latest` / `ministral-*` | €0 | yes — phone verification; limits *unconfirmed* (community: ≈ 1 req/s, 500 k tokens/min, 1 B tokens/month; other pages say 500 req/day) | yes, native | **free-plan inputs/outputs may be used for training unless you opt out** (official help article); opt out in the privacy settings | ToS frames it as experiment/prototype use; a public showcase is borderline — prefer OVH/Scaleway and keep Mistral free as a second fallback |
| Mistral paid · `mistral-small-latest` | ≈ $0.15 / $0.60 *unconfirmed* | — | yes | ZDR by request only | not cheaper than Scaleway for the same model family |

Relay env for the fallback: `LLM_PROVIDER=openai-compatible`, `LLM_BASE_URL=<provider's OpenAI-compatible base>`, `LLM_API_KEY=<provider key>`, `LLM_MODEL=<model name above>`. Same request shape. For Mistral direct, `@ai-sdk/mistral` or its OpenAI-compatible endpoint both work.

## 3. Recommendation and monthly cost

**Primary: Hetzner CX33 + `llama-server` + Qwen3-4B Q4_K_M** (Qwen3-1.7B on the same box if the turn latency is judged too slow). **Fallback: OVHcloud `gpt-oss-20b`** (cheapest, no retention claim, anonymous tier for the smoke test) with **Scaleway `mistral-small-3.2`** as the better-terms alternative (ZDR by default). Mistral free tier only as a last resort because of the training default and the experiment-only ToS.

Token volume: ADR-0009 assumed 500 conversations × 6 turns ≈ 36 M input / 1.5 M output per month with a long prefix. With the CPU-friendly short prefix from §1.3 (≈ 1.2 k prefix, 6-message history, 400-token tool results, 300-token answers) the same traffic is ≈ **15 M input / 0.9 M output**.

| Item | Monthly |
|---|---|
| Hetzner CX33 | €8.99 excl. VAT (≈ €10.70 incl.) — flat, independent of traffic |
| Sub-domain, TLS (Let's Encrypt), Docker | €0 |
| Vercel function (≈ 6,000 invocations, I/O wait not billed as active CPU) · Upstash Redis (≈ 9 k commands) | €0 within free tiers (ADR-0009 §4) |
| **Primary total** | **≈ €9–11** |
| Fallback if used for the whole month — OVH `gpt-oss-20b` | ≈ €0.75 (short prefix) … €1.70 (long prefix) |
| Fallback — Scaleway `mistral-small-3.2` | ≈ €2.60 … €5.90 (first 1 M tokens free) |
| Fallback — Mistral Experiment | €0 |

Reversal: switching backend = four env values on the relay; the VM can be deleted any time (hourly billing). Nothing in rusloc/pnl changes.

## 4. Open points for the USER

1. Confirm CX33 stock and create the VM + sub-domain (step 1–2); or decide to start API-only (OVH/Scaleway) and add the VM later — the relay does not care.
2. Accept the latency class (tens of seconds per turn on CPU) for the showcase, with the "small CPU model" copy in the chat panel.
3. Qwen3-4B vs 1.7B after the first measured turn on the box.
4. Which fallback key to create first (OVH or Scaleway).

## Sources

Primary: Hetzner [Cost-Optimized](https://www.hetzner.com/cloud/cost-optimized/) · [Regular Performance](https://www.hetzner.com/cloud/regular-performance/) · [Netcup VPS](https://www.netcup.com/en/server/vps) · [OVHcloud VPS (en-gb)](https://www.ovhcloud.com/en-gb/vps/) · [llama.cpp function calling](https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md) · [llama-server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) · [llama.cpp issue: Qwen3-Instruct-2507 misdetected as thinking](https://github.com/ggml-org/llama.cpp/issues/20809) · Ollama [qwen3](https://ollama.com/library/qwen3) · [llama3.2](https://ollama.com/library/llama3.2) · [phi4-mini](https://ollama.com/library/phi4-mini) · [Unsloth Qwen3.5 docs](https://unsloth.ai/docs/de/modelle/qwen3.5) · [OVHcloud AI Endpoints catalogue](https://www.ovhcloud.com/en/public-cloud/ai-endpoints/catalog/) · [OVHcloud free AI API](https://www.ovhcloud.com/en/public-cloud/free-ai-api/) · [OVHcloud AI Endpoints capabilities](https://docs.ovhcloud.com/en/guides/public-cloud/ai-machine-learning/ai-endpoints-capabilities) · [Scaleway MaaS pricing](https://www.scaleway.com/en/pricing/model-as-a-service/) · [Scaleway supported models](https://www.scaleway.com/en/docs/generative-apis/reference-content/supported-models/) · [Scaleway data privacy](https://www.scaleway.com/en/docs/generative-apis/reference-content/data-privacy/) · [IONOS price list](https://docs.ionos.com/cloud/support/general-information/price-list/ionos-cloud-ltd) · [Mistral help: data used for training](https://help.mistral.ai/en/articles/347617-do-you-use-my-user-data-to-train-your-artificial-intelligence-models) · [Mistral ZDR](https://docs.mistral.ai/admin/monitor-comply/zero-data-retention) · [Vercel fluid compute pricing](https://vercel.com/docs/fluid-compute/pricing)

Secondary (marked *unconfirmed* above): [itsfoss CPU-only LLM test](https://itsfoss.com/testing-local-llms-without-gpu) · [CPU-only llama.cpp study (CEUR-WS)](https://ceur-ws.org/Vol-4164/paper11.pdf) · [kingy.ai: tools require --jinja](https://kingy.ai/wp-content/plugins/kingy-workbench/assets/kingy-fix-001-report-v1.html) · [jacar.es: llama-server with the OpenAI SDKs](https://jacar.es/?p=7642) · [freellm.net Mistral](https://freellm.net/providers/mistral-ai) · [freellm.net OVHcloud](https://freellm.net/providers/ovhcloud-ai-endpoints) · [pricepertoken Mistral free](https://pricepertoken.com/endpoints/mistral/free) · [deploywise cheap VPS](https://deploywise.dev/blog/cheap-vps-for-developers) · [sparecores Hetzner CX](https://sparecores.com/article/hetzner-new-cx-servers) · [vpsbenchmarks CX22](https://vpsbenchmarks.com/hosters/hetzner/plans/cx22)
