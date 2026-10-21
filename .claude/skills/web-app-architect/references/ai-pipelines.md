# AI Pipeline Architecture Reference

Patterns for integrating external AI APIs into web application data flows — from simple request enrichment to complex multi-model orchestration.

---

## Prompt Management

### Prompt Registry Pattern

Store prompts as versioned templates in your codebase, not inline strings:

```
engine/
└── ai/
    ├── prompts/
    │   ├── classify-intent.ts      # Each prompt is a module
    │   ├── extract-entities.ts
    │   ├── generate-summary.ts
    │   └── moderate-content.ts
    ├── client.ts                   # AI API client setup
    ├── pipeline.ts                 # Pipeline orchestrator
    └── types.ts                    # Shared AI types
```

Each prompt module exports the template, input schema, output schema, and model config:

```typescript
// engine/ai/prompts/classify-intent.ts
import { z } from 'zod'

export const ClassifyIntentPrompt = {
  name: 'classify-intent',
  version: '1.2',
  model: 'claude-sonnet-4-20250514',
  maxTokens: 200,
  temperature: 0,

  inputSchema: z.object({
    userMessage: z.string(),
    availableIntents: z.array(z.string()),
  }),

  outputSchema: z.object({
    intent: z.string(),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
  }),

  build(input: { userMessage: string; availableIntents: string[] }) {
    return {
      system: `You classify user messages into intents. Available intents: ${input.availableIntents.join(', ')}. Respond with JSON only.`,
      messages: [{ role: 'user' as const, content: input.userMessage }],
    }
  },
}
```

This pattern enables: versioning prompts alongside code, A/B testing prompt variations, consistent input/output validation, and easy prompt reuse across services.

---

## Token Budgeting & Cost Control

### Per-Request Budget

Calculate token budgets before making AI calls:

```typescript
interface TokenBudget {
  inputEstimate: number    // Estimated input tokens
  maxOutput: number        // max_tokens parameter
  costEstimate: number     // Estimated cost in USD
  model: string
}

function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English
  return Math.ceil(text.length / 4)
}

function calculateBudget(prompt: string, maxOutput: number, model: string): TokenBudget {
  const inputEstimate = estimateTokens(prompt)
  const rates = MODEL_RATES[model] // { inputPer1k, outputPer1k }
  const costEstimate = (inputEstimate / 1000) * rates.inputPer1k
                     + (maxOutput / 1000) * rates.outputPer1k
  return { inputEstimate, maxOutput, costEstimate, model }
}
```

### Per-User Usage Tracking

Track token consumption per user for billing and abuse prevention:

```sql
CREATE TABLE ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  model text NOT NULL,
  input_tokens int NOT NULL,
  output_tokens int NOT NULL,
  cost_usd numeric(10,6) NOT NULL,
  prompt_name text,           -- Which prompt template was used
  latency_ms int,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_usage_user_period ON ai_usage(user_id, created_at DESC);

-- Materialized view for billing period summaries
CREATE MATERIALIZED VIEW ai_usage_monthly AS
SELECT
  user_id,
  date_trunc('month', created_at) AS month,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(cost_usd) AS total_cost,
  COUNT(*) AS request_count
FROM ai_usage
GROUP BY user_id, date_trunc('month', created_at);
```

### Budget Enforcement

Before each AI call, check the user's remaining budget:

```typescript
async function checkBudget(userId: string, estimatedCost: number): Promise<boolean> {
  const usage = await getUserMonthlyUsage(userId)
  const plan = await getUserPlan(userId)
  return (usage.total_cost + estimatedCost) <= plan.monthlyAiBudget
}
```

---

## Multi-Model Orchestration

### Pipeline Pattern

Chain multiple AI calls where each step's output feeds the next:

```
Input → [Classify Intent] → [Route to Specialist] → [Generate Response] → [Safety Check] → Output
            Model A              Model B                 Model C              Model D
```

Implement as a pipeline with typed stages:

```typescript
type PipelineStage<TIn, TOut> = {
  name: string
  execute: (input: TIn, context: PipelineContext) => Promise<TOut>
  onError?: (error: Error, input: TIn) => TOut | Promise<TOut>  // Fallback
}

class AIPipeline {
  private stages: PipelineStage<any, any>[] = []

  addStage<TIn, TOut>(stage: PipelineStage<TIn, TOut>) {
    this.stages.push(stage)
    return this
  }

  async execute(input: any, context: PipelineContext) {
    let current = input
    for (const stage of this.stages) {
      try {
        current = await stage.execute(current, context)
      } catch (error) {
        if (stage.onError) {
          current = await stage.onError(error as Error, current)
        } else {
          throw error
        }
      }
    }
    return current
  }
}
```

### Model Selection Strategy

| Task | Recommended Model | Why |
|------|------------------|-----|
| Classification, routing | Fast/cheap model (Haiku, GPT-4o-mini) | Low latency, structured output |
| Complex reasoning | Flagship model (Claude Opus/Sonnet, GPT-4o) | Quality matters more than speed |
| Content generation | Mid-tier model (Claude Sonnet) | Good balance of quality and cost |
| Embeddings | Dedicated embedding model (text-embedding-3-small) | Optimized for vector tasks |
| Safety/moderation | Specialized model or fast classifier | Needs to be fast, runs on every request |

### Fallback Chains

Design fallback chains for resilience:

```typescript
const AI_FALLBACK_CHAIN = [
  { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  { provider: 'openai', model: 'gpt-4o' },
  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' }, // Degraded but available
]

async function callWithFallback(prompt: Prompt, chain = AI_FALLBACK_CHAIN) {
  for (const { provider, model } of chain) {
    try {
      return await callAI(provider, model, prompt)
    } catch (error) {
      if (isRetryable(error)) continue
      throw error  // Non-retryable errors (bad input, auth) should fail fast
    }
  }
  throw new Error('All AI providers failed')
}
```

---

## Structured Output Extraction

### JSON Mode

Force the AI to return valid JSON by:
1. Specifying the exact JSON schema in the system prompt
2. Using the model's native JSON mode / structured output where available
3. Validating the response with Zod before using it

```typescript
async function extractStructured<T>(
  prompt: string,
  schema: z.ZodType<T>,
  model = 'claude-sonnet-4-20250514'
): Promise<T> {
  const response = await callAI(model, {
    system: `Respond with valid JSON only. No markdown, no explanation. Schema: ${JSON.stringify(zodToJsonSchema(schema))}`,
    messages: [{ role: 'user', content: prompt }],
  })

  const parsed = JSON.parse(response.text)
  return schema.parse(parsed)  // Validates and types the response
}
```

### Tool Use / Function Calling

For complex extraction, use the model's tool-use capability to guarantee structured output:

```typescript
const tools = [{
  name: 'save_entities',
  description: 'Save extracted entities from the document',
  input_schema: {
    type: 'object',
    properties: {
      people: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' } } } },
      dates: { type: 'array', items: { type: 'string', format: 'date' } },
      amounts: { type: 'array', items: { type: 'object', properties: { value: { type: 'number' }, currency: { type: 'string' } } } },
    },
    required: ['people', 'dates', 'amounts'],
  }
}]
```

---

## Caching Strategies

### Response Caching

Cache AI responses when the same input produces the same output:

```typescript
async function cachedAICall(cacheKey: string, ttlSeconds: number, aiCall: () => Promise<string>) {
  const cached = await redis.get(`ai:${cacheKey}`)
  if (cached) return JSON.parse(cached)

  const result = await aiCall()
  await redis.set(`ai:${cacheKey}`, JSON.stringify(result), 'EX', ttlSeconds)
  return result
}
```

**When to cache:**
- Classification / categorization (same input → same output) — cache for hours/days
- Embeddings (deterministic) — cache indefinitely
- Content generation with same prompt + temperature=0 — cache for hours
- Summaries of static documents — cache until document changes

**When NOT to cache:**
- Conversational responses (context-dependent)
- Creative generation with temperature > 0
- Anything using real-time data

### Prompt Caching (Anthropic-specific)

Use Anthropic's prompt caching to reduce costs on repeated system prompts:
- Mark long, reusable system prompts with `cache_control: { type: "ephemeral" }`
- Cached input tokens cost 90% less on cache hits
- Structure prompts so the cacheable part (system instructions, few-shot examples) comes first

---

## Error Handling & Resilience

### Error Categories

| Error Type | Action | Retry? |
|-----------|--------|--------|
| Rate limited (429) | Back off exponentially | Yes, after delay |
| Server error (500/503) | Try fallback provider | Yes, with fallback |
| Invalid response (parse error) | Retry with clearer prompt | Yes, once |
| Context too long | Truncate input, retry | Yes, with shorter input |
| Content filtered | Return safe fallback | No |
| Auth error (401/403) | Alert ops, fail request | No |
| Timeout | Increase timeout, retry | Yes, once |

### Circuit Breaker

Implement a circuit breaker per AI provider to avoid cascading failures:

```typescript
class CircuitBreaker {
  private failures = 0
  private lastFailure = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  constructor(
    private threshold = 5,      // Failures before opening
    private resetMs = 60_000,   // Time before trying again
  ) {}

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.resetMs) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }

    try {
      const result = await fn()
      this.failures = 0
      this.state = 'closed'
      return result
    } catch (error) {
      this.failures++
      this.lastFailure = Date.now()
      if (this.failures >= this.threshold) this.state = 'open'
      throw error
    }
  }
}
```

---

## Streaming Architecture

For real-time AI responses in web apps:

### Server-Sent Events (SSE)

```typescript
// API route (Next.js)
export async function POST(req: Request) {
  const stream = new ReadableStream({
    async start(controller) {
      const aiStream = await anthropic.messages.stream({ ... })

      for await (const event of aiStream) {
        if (event.type === 'content_block_delta') {
          const data = JSON.stringify({ text: event.delta.text })
          controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`))
        }
      }
      controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

### Client-Side Stream Consumption

```typescript
async function streamChat(message: string, onChunk: (text: string) => void) {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  })

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value)
    // Parse SSE format
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        const { text } = JSON.parse(line.slice(6))
        onChunk(text)
      }
    }
  }
}
```