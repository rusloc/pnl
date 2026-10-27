// One chat turn (ADR-0009 §2): bound the input, add the system prompt and the
// closed tool list, call the provider once, map the response to a bounded
// result. No state, no data access, no content logging. Pure given its deps,
// so it is tested with recorded provider responses and no network.
import { CHAT_BOUNDS, chatToolsForProvider, isChatToolName } from '@rayfin-app/shared';

import { chatCompletion, chatCompletionsUrl, type ProviderConfig, ProviderConfigError, type ProviderMessage, type ProviderRequest } from './azure-openai.js';
import type { ChatInMessage, ChatToolCall, ChatTurnOutput } from './chat-contract.js';
import { logEvent } from './safe-log.js';
import { SYSTEM_PROMPT } from './system-prompt.js';

export interface ChatTurnDeps {
  /** The Entra bearer for the provider (`ctx.Tokens.AzureAI`); read lazily so a missing token is one error path. */
  token: () => string;
  /** Endpoint, deployment and API version; throws `ProviderConfigError` when not configured. */
  config: () => ProviderConfig;
  fetchImpl: typeof fetch;
  now: () => number;
}

/** Longest answer text returned to the browser, characters. */
export const MAX_ANSWER_CHARS = 4_000;
/** Longest tool-call arguments accepted from the provider, characters. */
export const MAX_ARGUMENTS_CHARS = 2_000;
const TOOL_CALL_ID = /^[A-Za-z0-9_-]{1,64}$/;
const TEMPERATURE = 0.2;

export async function runChatTurn(input: unknown, deps: ChatTurnDeps): Promise<ChatTurnOutput> {
  const started = deps.now();
  const bounded = boundInput(input);
  if (bounded === null) {
    logEvent({ event: 'chat_turn_rejected' });
    return { kind: 'error', reason: 'bad_request', status: null };
  }
  let url: string;
  let token: string;
  try {
    url = chatCompletionsUrl(deps.config());
    token = deps.token();
  } catch (err) {
    // A missing secret or token reads as "not configured" whatever the host's wording; nothing of it is logged.
    void err;
    logEvent({ event: 'chat_provider_error', ms: deps.now() - started });
    return { kind: 'error', reason: 'not_configured', status: null };
  }
  const request: ProviderRequest = {
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...bounded.messages.map(toProviderMessage)],
    tools: chatToolsForProvider(),
    tool_choice: 'auto',
    max_tokens: CHAT_BOUNDS.maxOutputTokens,
    temperature: TEMPERATURE,
  };
  const result = await chatCompletion({ url, token, request, timeoutMs: CHAT_BOUNDS.providerTimeoutMs, fetchImpl: deps.fetchImpl });
  const ms = deps.now() - started;
  if (!result.ok) {
    logEvent({ event: result.reason === 'timeout' ? 'chat_provider_timeout' : 'chat_provider_error', ms, status: result.status ?? undefined, messages: bounded.messages.length, inChars: bounded.chars });
    return { kind: 'error', reason: result.reason, status: result.status };
  }
  const output = mapChoice(result.choice);
  logEvent({
    event: 'chat_turn',
    ms,
    status: result.status,
    messages: bounded.messages.length,
    inChars: bounded.chars,
    outChars: output.kind === 'answer' ? output.text.length : output.kind === 'tool_calls' ? output.calls.reduce((n, c) => n + c.argumentsJson.length, 0) : 0,
    toolCalls: output.kind === 'tool_calls' ? output.calls.length : 0,
  });
  return output;
}

// --- Input bounds -----------------------------------------------------------

interface BoundedInput {
  messages: ChatInMessage[];
  chars: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundToolCall(value: unknown): ChatToolCall | null {
  if (!isRecord(value)) return null;
  const { id, name, argumentsJson } = value;
  if (typeof id !== 'string' || !TOOL_CALL_ID.test(id)) return null;
  if (typeof name !== 'string' || !isChatToolName(name)) return null;
  if (typeof argumentsJson !== 'string' || argumentsJson.length > MAX_ARGUMENTS_CHARS) return null;
  return { id, name, argumentsJson };
}

/**
 * The turn's messages, or null when anything is out of bounds: count, size per
 * role, total size, roles, the user-first / user-or-tool-last order, tool
 * results that answer no call of the preceding assistant message.
 */
export function boundInput(input: unknown): BoundedInput | null {
  if (!isRecord(input) || !Array.isArray(input.messages)) return null;
  const raw = input.messages;
  if (raw.length === 0 || raw.length > CHAT_BOUNDS.maxMessages) return null;
  const messages: ChatInMessage[] = [];
  let chars = 0;
  let openCalls = new Set<string>();
  for (const item of raw) {
    if (!isRecord(item) || typeof item.content !== 'string') return null;
    const content = item.content;
    chars += content.length;
    switch (item.role) {
      case 'user': {
        if (content.trim().length === 0 || content.length > CHAT_BOUNDS.maxUserChars) return null;
        openCalls = new Set();
        messages.push({ role: 'user', content, toolCallId: null, toolCalls: null });
        break;
      }
      case 'assistant': {
        if (content.length > MAX_ANSWER_CHARS) return null;
        const calls: ChatToolCall[] = [];
        if (Array.isArray(item.toolCalls)) {
          if (item.toolCalls.length > CHAT_BOUNDS.maxToolCallsPerTurn) return null;
          for (const c of item.toolCalls) {
            const call = boundToolCall(c);
            if (call === null) return null;
            calls.push(call);
          }
        }
        if (calls.length === 0 && content.trim().length === 0) return null;
        openCalls = new Set(calls.map((c) => c.id));
        messages.push({ role: 'assistant', content, toolCallId: null, toolCalls: calls.length > 0 ? calls : null });
        break;
      }
      case 'tool': {
        if (content.length > CHAT_BOUNDS.maxToolResultChars) return null;
        if (typeof item.toolCallId !== 'string' || !openCalls.has(item.toolCallId)) return null;
        openCalls.delete(item.toolCallId);
        messages.push({ role: 'tool', content, toolCallId: item.toolCallId, toolCalls: null });
        break;
      }
      default:
        return null;
    }
    if (chars > CHAT_BOUNDS.maxRequestChars) return null;
  }
  if (messages[0].role !== 'user') return null;
  const last = messages[messages.length - 1];
  if (last.role === 'assistant') return null;
  // Every call the assistant made must be answered before the model is asked again.
  if (last.role === 'tool' && openCalls.size > 0) return null;
  return { messages, chars };
}

function toProviderMessage(m: ChatInMessage): ProviderMessage {
  switch (m.role) {
    case 'user':
      return { role: 'user', content: m.content };
    case 'tool':
      return { role: 'tool', tool_call_id: m.toolCallId ?? '', content: m.content };
    case 'assistant':
      return m.toolCalls
        ? {
            role: 'assistant',
            content: m.content.length > 0 ? m.content : null,
            tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.argumentsJson } })),
          }
        : { role: 'assistant', content: m.content };
  }
}

// --- Output bounds ----------------------------------------------------------

/** The provider's choice → the bounded result union; unknown tool names are dropped, extras beyond the cap too. */
export function mapChoice(choice: { finish_reason: string | null; message: { content: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }): ChatTurnOutput {
  if (choice.finish_reason === 'content_filter') return { kind: 'error', reason: 'filtered', status: null };
  const calls: ChatToolCall[] = [];
  for (const call of choice.message.tool_calls ?? []) {
    if (calls.length >= CHAT_BOUNDS.maxToolCallsPerTurn) break;
    if (!TOOL_CALL_ID.test(call.id) || !isChatToolName(call.function.name)) continue;
    const args = call.function.arguments.trim().length === 0 ? '{}' : call.function.arguments;
    if (args.length > MAX_ARGUMENTS_CHARS) continue;
    calls.push({ id: call.id, name: call.function.name, argumentsJson: args });
  }
  if (calls.length > 0) return { kind: 'tool_calls', calls };
  const text = (choice.message.content ?? '').trim();
  if (text.length === 0) return { kind: 'error', reason: 'provider', status: null };
  return { kind: 'answer', text: text.length > MAX_ANSWER_CHARS ? `${text.slice(0, MAX_ANSWER_CHARS)}…` : text };
}

export { ProviderConfigError };
