import { z } from 'zod';
import type { Engine } from '../engine/index.ts';
import type { EntityCode, Selection } from '../engine/types.ts';
import { CHAT_LIMITS } from './limits.ts';
import { entityOf } from './tools.ts';
import type { ChatTools, CheckedCall, ToolError, ToolResult } from './tools.ts';

// Loop helpers for the host chat panel (built in the vosk.dev repo; ADR-0009 §4). Pure functions, no network, no
// React: the host owns fetch, streaming and the UI. One user turn:
//
//   const user = userMessage(text)                      → append to history
//   for (let step = 1; step <= CHAT_LIMITS.maxStepsPerTurn; step++) {
//     const { request, fits } = buildChatRequest(history, { step, toolCallsUsed })   // POST to the relay
//     let draft = emptyDraft(); for each SSE data line: draft = applyRelayEvent(draft, JSON.parse(line))
//     if (draft.error) → show it, stop the turn (nothing goes into history)
//     const reply = toAssistantMessage(draft, request.allowTools); history.push(reply)
//     if (!reply.tool_calls) break
//     const plan = planToolCalls(tools, reply.tool_calls, current, toolCallsUsed); toolCallsUsed = plan.used
//     const engine = createEngine(await loader.load(plan.entities ∪ current entity))
//     for (const run of runToolPlan(tools, plan, engine, current)) history.push(run.message)
//   }
//
// Wire shapes: OpenAI chat-completions messages (user / assistant with tool_calls / tool) between browser and relay;
// the relay re-emits the model's stream as the small events below. Contract: .sync/2026-10-23-track-c-chat-contract.md.

const id = z.string().min(1).max(100);
const MAX_ASSISTANT_CHARS = 4 * 1_000; // ≈ 3 × the 300-token output cap: generous, still bounded

export const toolCallSchema = z
  .object({
    id,
    type: z.literal('function'),
    function: z.object({ name: z.string().min(1).max(64), arguments: z.string().max(4_000) }).strict(),
  })
  .strict();
export type ToolCall = z.infer<typeof toolCallSchema>;

const userSchema = z
  .object({ role: z.literal('user'), content: z.string().min(1).max(CHAT_LIMITS.maxMessageChars) })
  .strict();
const assistantSchema = z
  .object({
    role: z.literal('assistant'),
    content: z.string().max(MAX_ASSISTANT_CHARS).nullable(),
    tool_calls: z.array(toolCallSchema).min(1).max(CHAT_LIMITS.maxToolCallsPerTurn).optional(),
  })
  .strict();
const toolSchema = z
  .object({ role: z.literal('tool'), tool_call_id: id, content: z.string().max(CHAT_LIMITS.maxRequestChars) })
  .strict();

/** No `system` role: the relay adds the one system prompt and drops anything else (ADR-0009 §4). */
export const chatMessageSchema = z.discriminatedUnion('role', [userSchema, assistantSchema, toolSchema]);
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type AssistantMessage = z.infer<typeof assistantSchema>;
export type ToolMessage = z.infer<typeof toolSchema>;

/** Browser → relay body. The relay validates it with this schema before it calls the model. */
export const chatRequestSchema = z
  .object({
    // the history cap, plus the overflow of one turn whose tool calls alone exceed it (never trimmed, see fitHistory)
    messages: z
      .array(chatMessageSchema)
      .min(1)
      .max(CHAT_LIMITS.maxHistoryMessages + CHAT_LIMITS.maxToolCallsPerTurn)
      .refine((ms) => ms[0]?.role === 'user', 'the first message must be a user message'),
    /** false on the last step of a turn: the relay sends tool_choice "none" (the tools stay, the prefix cache holds). */
    allowTools: z.boolean(),
  })
  .strict();
export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** Relay → browser stream: one JSON object per SSE `data:` line. */
export const relayEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().max(MAX_ASSISTANT_CHARS) }).strict(),
  z
    .object({ type: z.literal('tool_call'), id, name: z.string().min(1).max(64), arguments: z.string().max(4_000) })
    .strict(),
  z.object({ type: z.literal('done'), finish: z.enum(['stop', 'tool_calls', 'length']) }).strict(),
  z
    .object({ type: z.literal('error'), error: z.enum(['busy', 'paused', 'rate_limited', 'upstream', 'timeout']) })
    .strict(),
]);
export type RelayEvent = z.infer<typeof relayEventSchema>;

/** Relay error body for a non-2xx answer sent before any stream starts. */
export const relayErrorSchema = z
  .object({ error: z.enum(['busy', 'paused', 'rate_limited', 'too_large', 'invalid', 'upstream']) })
  .strict();

export type UserMessageCheck =
  { ok: true; message: Extract<ChatMessage, { role: 'user' }> } | { ok: false; reason: 'empty' | 'too long' };

export function userMessage(text: string): UserMessageCheck {
  const content = text.trim();
  if (!content) return { ok: false, reason: 'empty' };
  if (content.length > CHAT_LIMITS.maxMessageChars) return { ok: false, reason: 'too long' };
  return { ok: true, message: { role: 'user', content } };
}

/**
 * The messages to send: whole turns are dropped from the front until at most `maxHistoryMessages` remain and the
 * body fits `maxRequestChars`. The current turn is never cut (a tool message must follow its tool call); `fits` is
 * false when even the current turn alone is over the size cap.
 */
export function fitHistory(
  history: readonly ChatMessage[],
  allowTools = true,
): { messages: ChatMessage[]; fits: boolean } {
  const size = (ms: readonly ChatMessage[]) => JSON.stringify({ messages: ms, allowTools }).length;
  const starts = history.flatMap((msg, i) => (msg.role === 'user' ? [i] : []));
  const last = starts[starts.length - 1] ?? 0;
  for (const s of starts) {
    const ms = history.slice(s);
    if (s === last || (ms.length <= CHAT_LIMITS.maxHistoryMessages && size(ms) <= CHAT_LIMITS.maxRequestChars))
      return { messages: ms, fits: size(ms) <= CHAT_LIMITS.maxRequestChars };
  }
  const ms = history.slice(last);
  return { messages: ms, fits: size(ms) <= CHAT_LIMITS.maxRequestChars };
}

/** Request for step `step` (1-based) of a turn; tools are off on the last step or once the turn's calls are spent. */
export function buildChatRequest(
  history: readonly ChatMessage[],
  { step, toolCallsUsed }: { step: number; toolCallsUsed: number },
): { request: ChatRequest; fits: boolean } {
  const allowTools = step < CHAT_LIMITS.maxStepsPerTurn && toolCallsUsed < CHAT_LIMITS.maxToolCallsPerTurn;
  const { messages, fits } = fitHistory(history, allowTools);
  return { request: { messages, allowTools }, fits };
}

export interface AssistantDraft {
  text: string;
  toolCalls: ToolCall[];
  finish: 'stop' | 'tool_calls' | 'length' | null;
  error: Extract<RelayEvent, { type: 'error' }>['error'] | null;
}

export const emptyDraft = (): AssistantDraft => ({ text: '', toolCalls: [], finish: null, error: null });

/** Folds one stream event into the draft. An event that fails the schema ends the draft as an upstream error. */
export function applyRelayEvent(draft: AssistantDraft, raw: unknown): AssistantDraft {
  if (draft.finish !== null || draft.error !== null) return draft;
  const r = relayEventSchema.safeParse(raw);
  if (!r.success) return { ...draft, error: 'upstream' };
  const e = r.data;
  switch (e.type) {
    case 'text':
      return { ...draft, text: (draft.text + e.text).slice(0, MAX_ASSISTANT_CHARS) };
    case 'tool_call': // calls past the turn cap are dropped here, so every kept call gets a tool message
      return draft.toolCalls.length >= CHAT_LIMITS.maxToolCallsPerTurn
        ? draft
        : {
            ...draft,
            toolCalls: [
              ...draft.toolCalls,
              { id: e.id, type: 'function', function: { name: e.name, arguments: e.arguments } },
            ],
          };
    case 'done':
      return { ...draft, finish: e.finish };
    case 'error':
      return { ...draft, error: e.error };
  }
}

/** Shown and stored when the model ends a step with neither text nor (allowed) tool calls. */
export const NO_ANSWER = 'No answer within the step limit. Try a narrower question.';

/**
 * The history entry for a finished draft. With tools off (`toolsAllowed` = the request's allowTools), tool calls the
 * model sent anyway are dropped: no tool message would answer them, and an unanswered call breaks the next request.
 */
export function toAssistantMessage(draft: AssistantDraft, toolsAllowed = true): AssistantMessage {
  const calls = toolsAllowed ? draft.toolCalls : [];
  return {
    role: 'assistant',
    content: draft.text || (calls.length ? null : NO_ANSWER),
    ...(calls.length ? { tool_calls: calls } : {}),
  };
}

export interface PlannedCall {
  id: string;
  name: string;
  checked: CheckedCall;
}

export interface ToolPlan {
  calls: PlannedCall[];
  /** Data files the engine needs before runToolPlan (the host's dataset loader fetches them). */
  entities: EntityCode[];
  /** Tool calls used in this turn after this plan. */
  used: number;
}

/** Validates a step's tool calls; calls past `maxToolCallsPerTurn` for the turn get a "limit reached" result. */
export function planToolCalls(
  tools: ChatTools,
  calls: readonly ToolCall[],
  current: Selection,
  usedInTurn: number,
): ToolPlan {
  const planned = calls.map((c, i): PlannedCall => {
    const checked: CheckedCall =
      usedInTurn + i < CHAT_LIMITS.maxToolCallsPerTurn
        ? tools.check(c.function.name, c.function.arguments, current)
        : {
            ok: false,
            result: {
              tool: c.function.name,
              error: 'tool-call limit reached',
              detail: `At most ${CHAT_LIMITS.maxToolCallsPerTurn} tool calls per question; answer with what you have.`,
            },
          };
    return { id: c.id, name: c.function.name, checked };
  });
  const entities = [
    ...new Set(planned.flatMap((p) => (p.checked.ok ? [entityOf(p.checked.call)].filter((e) => e !== null) : []))),
  ];
  return { calls: planned, entities, used: usedInTurn + calls.length };
}

export interface ToolRun {
  id: string;
  name: string;
  /** For the host's result card. */
  result: ToolResult;
  /** For the history: the tool message answering the call. */
  message: ToolMessage;
  /** Statement view query string for an "Open in view" link; null for other tools and errors. */
  query: string | null;
}

/**
 * Runs a plan. The engine must be built over a dataset that holds `plan.entities`. An engine exception becomes a
 * "tool failed" result without its message (no internals reach the LLM); the chat turn goes on.
 */
export function runToolPlan(tools: ChatTools, plan: ToolPlan, engine: Engine, current: Selection): ToolRun[] {
  return plan.calls.map(({ id: callId, name, checked }) => {
    let result: ToolResult;
    if (!checked.ok) result = checked.result;
    else
      try {
        result = tools.run(checked.call, engine, current);
      } catch {
        result = { tool: name, error: 'tool failed', detail: 'The report could not compute this.' } satisfies ToolError;
      }
    return {
      id: callId,
      name,
      result,
      message: { role: 'tool', tool_call_id: callId, content: JSON.stringify(result) },
      query: checked.ok && checked.call.tool === 'get_statement' && !('error' in result) ? checked.call.query : null,
    };
  });
}
